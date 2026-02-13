# Summarization

Condense documents, articles, and codebases into clear, actionable summaries.

## Summary Types

### TL;DR (1-3 sentences)
The essential point in the fewest words. Use when the user needs the bottom line fast.

### Executive Summary (1 paragraph)
Key findings, decisions needed, and implications. Written for someone who will not read the full document.

### Structured Summary (bullet points + sections)
Organized extraction of all major points, grouped by theme. Use for long or complex documents.

### Progressive Summary (layered depth)
```
**One sentence:** [Core point]
**One paragraph:** [Core point + key supporting details]
**Full summary:** [Comprehensive coverage with all major points]
```
Lets the reader stop at the depth they need.

## Workflow

### Summarizing a URL
```
web_fetch: https://example.com/long-article
```
Then summarize the returned content at the requested depth.

### Summarizing a Local File
```
read_file: path/to/document.md
```
For files longer than 2000 lines, read in chunks:
```
read_file: path/to/document.md (offset=1, limit=1000)
read_file: path/to/document.md (offset=1001, limit=1000)
```
Summarize each chunk, then synthesize into a combined summary.

### Summarizing a Codebase
1. `list_dir` on the project root to understand structure
2. `read_file` on README, config files, and entry points
3. Identify the architecture: frameworks, patterns, data flow
4. Produce a summary covering: purpose, tech stack, structure, key components

## Techniques

**Extractive**: Pull the most important sentences verbatim. Best for preserving precise language (legal, technical, quotes).

**Abstractive**: Rewrite the key ideas in new, concise language. Best for clarity and brevity.

**Comparative**: When summarizing multiple sources, highlight agreements, contradictions, and unique contributions from each.

## Summary Structure Template
```
## Summary of [Title/Source]

**Source:** [URL or file path]
**Length:** [Original word/page count]

### Key Points
- Point 1
- Point 2
- Point 3

### Notable Details
- Detail that supports or qualifies the key points

### Omitted
- What was left out and why (e.g., "Excluded historical background -- not relevant to the question")
```

## Tips

- Always state what the source is and where it came from
- Preserve numbers, dates, and proper nouns exactly
- Flag your own uncertainty: "The article implies X but does not state it directly"
- If asked to summarize something you fetched, offer to save the summary with `write_file`
- For meeting notes or transcripts, extract: decisions made, action items, open questions
- When summarizing code, focus on what it does and why, not line-by-line mechanics
