"""Tool definitions and executors for agent VMs."""

from __future__ import annotations

import asyncio
import html
import json
import os
import re
from pathlib import Path

import httpx

MAX_TOOL_OUTPUT = 30_000
MAX_WEB_CONTENT = 50_000

# ── Bash safety guards ────────────────────────────────────────────────

BASH_DENY_PATTERNS = [
    re.compile(p)
    for p in [
        r"\brm\s+-[rf]{1,2}\s+/",
        r"\brm\s+-[rf]{1,2}\s+~",
        r"\b(mkfs|format|diskpart)\b",
        r"\bdd\s+if=",
        r">\s*/dev/sd",
        r"\b(shutdown|reboot|poweroff|halt)\b",
        r":\(\)\s*\{.*\};\s*:",
        r"\bsystemctl\s+(stop|disable)\s+baal-agent\b",
        r"\bkill\s+-9\s+1\b",
    ]
]

# ── Tool definitions ──────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Run a bash command and return stdout, stderr, and exit code.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The bash command to execute.",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default 60, max 300).",
                    },
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file and return its contents with line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the file.",
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Line number to start reading from (1-based).",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of lines to read.",
                    },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file, creating parent directories as needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the file.",
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write to the file.",
                    },
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Find and replace an exact string in a file (first occurrence).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the file.",
                    },
                    "old_string": {
                        "type": "string",
                        "description": "The exact string to find.",
                    },
                    "new_string": {
                        "type": "string",
                        "description": "The replacement string.",
                    },
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List contents of a directory with [dir] and [file] prefixes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Directory path to list. Defaults to current directory.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": "Fetch a URL and return its text content (HTML tags stripped).",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to fetch (http or https).",
                    },
                },
                "required": ["url"],
            },
        },
    },
]

# Optional web_search tool — only registered if BRAVE_API_KEY is set
_WEB_SEARCH_DEF = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web using Brave Search. Returns titles, URLs, and snippets.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query.",
                },
                "count": {
                    "type": "integer",
                    "description": "Number of results (1-10, default 5).",
                },
            },
            "required": ["query"],
        },
    },
}

# Spawn tool — added dynamically in main.py (not available to subagents)
SPAWN_TOOL_DEF = {
    "type": "function",
    "function": {
        "name": "spawn",
        "description": "Spawn a background subagent to work on a task asynchronously. Results are delivered as pending messages.",
        "parameters": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "The task description for the subagent.",
                },
                "label": {
                    "type": "string",
                    "description": "Short label for the task (used in result notification).",
                },
            },
            "required": ["task"],
        },
    },
}

if os.environ.get("BRAVE_API_KEY"):
    TOOL_DEFINITIONS.append(_WEB_SEARCH_DEF)


# ── Helpers ───────────────────────────────────────────────────────────

def _truncate(text: str) -> str:
    if len(text) <= MAX_TOOL_OUTPUT:
        return text
    half = MAX_TOOL_OUTPUT // 2
    return text[:half] + f"\n\n... truncated ({len(text)} chars total) ...\n\n" + text[-half:]


def _check_bash_safety(command: str) -> str | None:
    """Return an error message if the command matches a deny pattern, else None."""
    for pattern in BASH_DENY_PATTERNS:
        if pattern.search(command):
            return f"[blocked: command matches safety pattern: {pattern.pattern}]"
    return None


def _strip_html(text: str) -> str:
    """Strip HTML tags and decode entities to produce readable text."""
    # Remove script and style blocks
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Convert common block elements to newlines
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|h[1-6]|li|tr)>", "\n", text, flags=re.IGNORECASE)
    # Strip all remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode HTML entities
    text = html.unescape(text)
    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Tool executors ────────────────────────────────────────────────────

async def _exec_bash(args: dict) -> str:
    command = args["command"]
    # Safety check
    blocked = _check_bash_safety(command)
    if blocked:
        return blocked
    timeout = min(args.get("timeout", 60), 300)
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        out = stdout.decode("utf-8", errors="replace")
        err = stderr.decode("utf-8", errors="replace")
        code = proc.returncode or 0
        parts = []
        if out:
            parts.append(out)
        if err:
            parts.append(f"[stderr]\n{err}")
        parts.append(f"[exit code: {code}]")
        return _truncate("\n".join(parts))
    except asyncio.TimeoutError:
        return f"[timed out after {timeout}s]"
    except Exception as e:
        return f"[error: {e}]"


async def _exec_read_file(args: dict) -> str:
    path = args["path"]
    offset = args.get("offset", 1)
    limit = args.get("limit")
    try:
        with open(path, "r", errors="replace") as f:
            lines = f.readlines()
        start = max(0, offset - 1)
        end = start + limit if limit else len(lines)
        numbered = [f"{i + start + 1}\t{line}" for i, line in enumerate(lines[start:end])]
        return _truncate("".join(numbered)) if numbered else "(empty file)"
    except FileNotFoundError:
        return f"[error: file not found: {path}]"
    except Exception as e:
        return f"[error: {e}]"


async def _exec_write_file(args: dict) -> str:
    path = args.get("path")
    content = args.get("content")
    if not path:
        return "[error: missing required 'path' parameter]"
    if content is None:
        return "[error: missing required 'content' parameter]"
    try:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        return f"Wrote {len(content)} bytes to {path}"
    except Exception as e:
        return f"[error: {e}]"


async def _exec_edit_file(args: dict) -> str:
    path = args.get("path")
    old_string = args.get("old_string")
    new_string = args.get("new_string")
    if not path:
        return "[error: missing required 'path' parameter]"
    if old_string is None:
        return "[error: missing required 'old_string' parameter]"
    if new_string is None:
        return "[error: missing required 'new_string' parameter]"
    try:
        with open(path, "r") as f:
            content = f.read()
        if old_string not in content:
            return f"[error: old_string not found in {path}]"
        content = content.replace(old_string, new_string, 1)
        with open(path, "w") as f:
            f.write(content)
        return f"Edited {path}"
    except FileNotFoundError:
        return f"[error: file not found: {path}]"
    except Exception as e:
        return f"[error: {e}]"


async def _exec_list_dir(args: dict) -> str:
    path = args.get("path", ".")
    try:
        p = Path(path)
        if not p.is_dir():
            return f"[error: not a directory: {path}]"
        entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        lines = []
        for entry in entries:
            prefix = "[dir]" if entry.is_dir() else "[file]"
            lines.append(f"{prefix}  {entry.name}")
        return "\n".join(lines) if lines else "(empty directory)"
    except PermissionError:
        return f"[error: permission denied: {path}]"
    except Exception as e:
        return f"[error: {e}]"


async def _exec_web_fetch(args: dict) -> str:
    url = args["url"]
    if not re.match(r"^https?://", url):
        return "[error: URL must start with http:// or https://]"
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, max_redirects=5) as client:
            resp = await client.get(url, headers={"User-Agent": "BaalAgent/1.0"})
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            text = resp.text
            if "json" in content_type:
                try:
                    parsed = json.loads(text)
                    text = json.dumps(parsed, indent=2)
                except json.JSONDecodeError:
                    pass
            elif "html" in content_type:
                text = _strip_html(text)
            if len(text) > MAX_WEB_CONTENT:
                text = text[:MAX_WEB_CONTENT] + f"\n\n... truncated ({len(resp.text)} chars total)"
            return text if text.strip() else "(empty response)"
    except httpx.HTTPStatusError as e:
        return f"[error: HTTP {e.response.status_code}]"
    except Exception as e:
        return f"[error: {e}]"


async def _exec_web_search(args: dict) -> str:
    query = args["query"]
    count = min(args.get("count", 5), 10)
    api_key = os.environ.get("BRAVE_API_KEY", "")
    if not api_key:
        return "[error: BRAVE_API_KEY not configured]"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": count},
                headers={"X-Subscription-Token": api_key, "Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("web", {}).get("results", [])
            if not results:
                return "(no results found)"
            lines = []
            for r in results:
                title = r.get("title", "")
                url = r.get("url", "")
                snippet = r.get("description", "")
                lines.append(f"**{title}**\n{url}\n{snippet}\n")
            return "\n".join(lines)
    except Exception as e:
        return f"[error: {e}]"


# ── Tool registry ─────────────────────────────────────────────────────

TOOL_HANDLERS: dict[str, callable] = {
    "bash": _exec_bash,
    "read_file": _exec_read_file,
    "write_file": _exec_write_file,
    "edit_file": _exec_edit_file,
    "list_dir": _exec_list_dir,
    "web_fetch": _exec_web_fetch,
    "web_search": _exec_web_search,
}


def get_tool_definitions(*, include_spawn: bool = True) -> list[dict]:
    """Return tool definitions, optionally including spawn."""
    defs = list(TOOL_DEFINITIONS)
    if include_spawn:
        defs.append(SPAWN_TOOL_DEF)
    return defs


async def execute_tool(name: str, arguments: str | dict) -> str:
    """Dispatch a tool call by name. Returns the result string."""
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return f"[error: unknown tool '{name}']"
    if isinstance(arguments, str):
        arguments = json.loads(arguments)
    return await handler(arguments)
