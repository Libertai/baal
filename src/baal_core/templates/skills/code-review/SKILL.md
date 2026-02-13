# Code Review

Systematic code review: read files, check for bugs, security issues, and style, and provide structured feedback.

## Process

1. **Understand scope** -- identify which files changed and why
2. **Read each file** -- use `read_file` to examine the code carefully
3. **Analyze** -- check against the review checklist below
4. **Report** -- provide structured, actionable feedback

## Reading Code

Use `read_file` to examine files with line numbers for precise references:
```
read_file: path=src/auth.py
read_file: path=src/auth.py, offset=50, limit=30   # focus on specific section
```

Use `list_dir` to understand project structure:
```
list_dir: path=src/
```

If reviewing a Git diff, use bash:
```
bash: git diff main --stat               # see which files changed
bash: git diff main -- src/auth.py       # diff for one file
bash: git log --oneline main..HEAD       # commits under review
```

## Review Checklist

### Correctness
- Does the logic match the stated intent?
- Are edge cases handled (empty inputs, nulls, boundary values)?
- Are error conditions caught and handled appropriately?
- Do loops terminate? Are off-by-one errors present?

### Security
- Is user input validated and sanitized?
- Are SQL queries parameterized (no string concatenation)?
- Are secrets hardcoded? (API keys, passwords, tokens)
- Is authentication/authorization checked on all protected paths?
- Are file paths validated to prevent traversal attacks?
- Is sensitive data logged or exposed in error messages?

### Performance
- Are there N+1 query patterns (DB calls inside loops)?
- Are large datasets loaded entirely into memory unnecessarily?
- Are expensive operations repeated when results could be cached?
- Are database queries missing indexes on filtered/joined columns?

### Maintainability
- Are functions doing too many things? (single responsibility)
- Is there duplicated code that should be extracted?
- Are variable/function names descriptive?
- Are complex sections commented or self-documenting?
- Are magic numbers replaced with named constants?

### Error Handling
- Are exceptions too broad (`except Exception`)?
- Are errors swallowed silently?
- Do error messages help with debugging?
- Are resources cleaned up in finally blocks or context managers?

### Testing
- Are new code paths covered by tests?
- Do tests assert the right things (not just "no exception")?
- Are edge cases tested?

## Structured Feedback Format

Organize findings by severity:

```markdown
## Code Review: [filename or PR title]

### Critical (must fix)
- **Line 42**: SQL injection -- user input concatenated into query. Use parameterized queries.

### Important (should fix)
- **Line 87-92**: No error handling around HTTP call. Wrap in try/except, handle timeout.

### Suggestions (nice to have)
- **Line 15**: `data_list` could be renamed to `pending_orders` for clarity.

### Positive
- Clean separation of concerns in the service layer.
- Good use of type hints throughout.
```

## Tips

- Always read the full file before commenting -- context matters
- Reference exact line numbers from `read_file` output
- Suggest fixes, not just problems: show the corrected code with `edit_file` syntax
- Prioritize: security > correctness > performance > style
- Acknowledge good patterns, not just problems
- For large reviews, use `spawn` to review multiple files in parallel
