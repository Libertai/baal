# Python Development

Write, run, test, and debug Python code using bash, read_file, write_file, and edit_file.

## Environment Setup

### Virtual Environments
```
bash: python3 -m venv .venv
bash: source .venv/bin/activate && pip install -r requirements.txt
```

Always activate the venv in the same bash command as the operation:
```
bash: source .venv/bin/activate && python main.py
bash: source .venv/bin/activate && pip install requests
```

### Install Packages
```
bash: pip install requests flask pydantic
bash: pip install -r requirements.txt
bash: pip install -e ".[dev]"             # editable install with extras
```

If `uv` is available (faster):
```
bash: uv pip install requests
bash: uv venv .venv && source .venv/bin/activate && uv pip install -r requirements.txt
```

## Writing and Running Code

Write a script with `write_file`, then run it:
```
write_file: path=script.py, content="import sys\nprint(f'Hello {sys.argv[1]}')"
bash: python3 script.py World
```

For quick one-liners:
```
bash: python3 -c "import json; print(json.dumps({'key': 'value'}, indent=2))"
```

## Debugging Tracebacks

When a script fails, read the traceback bottom-up:
1. Last line = the exception type and message
2. Lines above = call stack (most recent call last)
3. Use `read_file` with `offset` to examine the failing line and surrounding context

```
bash: python3 script.py
# If it fails at line 42:
read_file: path=script.py, offset=38, limit=10
# Fix the issue:
edit_file: path=script.py, old_string="broken code", new_string="fixed code"
# Re-run:
bash: python3 script.py
```

### Common Errors
- `ModuleNotFoundError` -- package not installed or venv not activated
- `ImportError` -- wrong import path or circular import
- `TypeError: missing required argument` -- check function signature
- `KeyError` -- key not in dict, use `.get()` with default
- `AttributeError: 'NoneType'` -- a function returned None unexpectedly

## Testing with pytest

```
bash: pip install pytest
bash: pytest                              # run all tests
bash: pytest tests/test_auth.py           # specific file
bash: pytest -k "test_login"             # match test name
bash: pytest -x                           # stop on first failure
bash: pytest -v --tb=short               # verbose, shorter tracebacks
```

Write a test file:
```python
# tests/test_utils.py
from myproject.utils import parse_date

def test_parse_valid_date():
    result = parse_date("2025-01-15")
    assert result.year == 2025
    assert result.month == 1

def test_parse_invalid_date():
    with pytest.raises(ValueError):
        parse_date("not-a-date")
```

## Common Patterns

### File I/O
```python
from pathlib import Path

data = Path("config.json").read_text()
Path("output.txt").write_text(result)
```

### HTTP Requests
```python
import requests

resp = requests.get("https://api.example.com/data", timeout=10)
resp.raise_for_status()
data = resp.json()
```

### JSON Processing
```python
import json

with open("data.json") as f:
    data = json.load(f)

with open("output.json", "w") as f:
    json.dump(result, f, indent=2)
```

### CLI Arguments
```python
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("input_file")
parser.add_argument("--output", "-o", default="out.txt")
args = parser.parse_args()
```

### Async Code
```python
import asyncio
import httpx

async def fetch(url):
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.json()

result = asyncio.run(fetch("https://api.example.com"))
```

## Project Scaffolding

Typical Python project layout:
```
project/
  src/project/
    __init__.py
    main.py
  tests/
    test_main.py
  pyproject.toml
  requirements.txt
```

Minimal `pyproject.toml`:
```toml
[project]
name = "myproject"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = ["requests", "pydantic"]
```

## Tips

- Always use `python3`, not `python` (some systems differ)
- Add `timeout=` to all network calls to avoid hanging
- Use f-strings for formatting: `f"User {name} has {count} items"`
- Use `breakpoint()` for interactive debugging (insert in code, run script)
- Check Python version: `bash: python3 --version`
- List installed packages: `bash: pip list`
