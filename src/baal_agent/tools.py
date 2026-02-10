"""Tool definitions and executors for agent VMs."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

MAX_TOOL_OUTPUT = 30_000

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
]


def _truncate(text: str) -> str:
    if len(text) <= MAX_TOOL_OUTPUT:
        return text
    half = MAX_TOOL_OUTPUT // 2
    return text[:half] + f"\n\n... truncated ({len(text)} chars total) ...\n\n" + text[-half:]


async def _exec_bash(args: dict) -> str:
    command = args["command"]
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
    path = args["path"]
    content = args["content"]
    try:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        return f"Wrote {len(content)} bytes to {path}"
    except Exception as e:
        return f"[error: {e}]"


async def _exec_edit_file(args: dict) -> str:
    path = args["path"]
    old_string = args["old_string"]
    new_string = args["new_string"]
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


TOOL_HANDLERS = {
    "bash": _exec_bash,
    "read_file": _exec_read_file,
    "write_file": _exec_write_file,
    "edit_file": _exec_edit_file,
}


async def execute_tool(name: str, arguments: str | dict) -> str:
    """Dispatch a tool call by name. Returns the result string."""
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return f"[error: unknown tool '{name}']"
    if isinstance(arguments, str):
        arguments = json.loads(arguments)
    return await handler(arguments)
