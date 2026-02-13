# Web Research

Conduct thorough multi-source research with cross-referencing, citations, and structured output.

## Research Workflow

### 1. Plan the Search Strategy
Before fetching anything, identify what you need:
- Break the question into sub-questions
- List 3-5 potential source types (docs, Wikipedia, news, academic, forums)
- Decide on output format (summary, comparison table, report)

### 2. Gather Sources
Use `web_fetch` for known URLs and `web_search` for discovery:
```
web_search: "quantum error correction 2024 advances"
web_fetch: https://en.wikipedia.org/wiki/Quantum_error_correction
web_fetch: https://arxiv.org/abs/2401.xxxxx
```

Start broad, then drill into specifics. Fetch at least 2-3 sources for any factual claim.

### 3. Cross-Reference
- Compare facts across sources -- flag contradictions
- Prefer primary sources (official docs, papers) over secondary (blog posts, forums)
- Note when sources agree -- higher confidence
- Note when a claim appears in only one source -- mark as unverified

### 4. Save Structured Findings
Write results to a file for the user:
```
write_file: research/topic-name.md
---
# Topic Name
Date: 2024-XX-XX
Sources: 5 consulted, 3 cited

## Key Findings
- Finding 1 [1][2]
- Finding 2 [1][3]

## Details
...

## Open Questions
- What remains unclear or contested

## Sources
[1] https://example.com/page - Title (accessed date)
[2] https://example.org/doc - Title (accessed date)
[3] https://other.com/article - Title (accessed date)
---
```

## Source Selection Guide

| Source Type | Best For | URL Pattern |
|---|---|---|
| Wikipedia | Factual overviews, dates, definitions | `en.wikipedia.org/wiki/Topic` |
| Official docs | APIs, libraries, protocols | `docs.project.org/...` |
| GitHub | Code, READMEs, issues, releases | `github.com/org/repo` |
| News sites | Current events, announcements | Site-specific |
| Stack Overflow | Technical how-to, debugging | `stackoverflow.com/questions/...` |
| ArXiv | Academic papers, cutting-edge research | `arxiv.org/abs/...` |

## Handling Large or Truncated Content

`web_fetch` truncates at 50K characters. For large pages:
1. Fetch the main page to get the structure and key links
2. Follow links to specific sub-sections or sub-pages
3. For documentation sites, fetch the table of contents page first
4. For long articles, look for a "printable version" or API endpoint

## Multi-Step Research Example

User asks: "Compare React and Svelte for a new project"
```
Step 1: web_search: "React vs Svelte comparison 2024"
Step 2: web_fetch: top 2-3 comparison articles from results
Step 3: web_fetch: https://react.dev/ (official stance, latest features)
Step 4: web_fetch: https://svelte.dev/ (official stance, latest features)
Step 5: web_fetch: npm download stats or State of JS survey
Step 6: Synthesize into comparison table with citations
Step 7: write_file: research/react-vs-svelte.md
```

## Citation Format

Always track where information comes from:
- Inline: "React uses a virtual DOM [1] while Svelte compiles to vanilla JS [2]"
- Footnotes: numbered list at the end with full URLs
- If quoting directly, use blockquotes and attribute the source

## Tips

- Run `web_search` before `web_fetch` when you don't have a specific URL
- Fetch the same topic from 2+ independent sources before stating facts
- Save useful reference URLs to MEMORY.md for future lookups
- When results conflict, present both sides and note the disagreement
- Date-stamp research files -- information goes stale
- Use `spawn` for parallel research on independent sub-topics
