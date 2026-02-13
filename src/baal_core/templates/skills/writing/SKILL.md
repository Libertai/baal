# Writing

Draft, edit, and polish text in any tone -- formal, casual, technical, or creative.

## Writing Process

### 1. Clarify the Brief
Before writing, establish:
- **Audience**: Who will read this? (executives, developers, general public)
- **Purpose**: Inform, persuade, entertain, instruct?
- **Tone**: Formal, casual, technical, creative, empathetic?
- **Length**: Word count or format constraints
- **Format**: Blog post, email, report, documentation, story?

### 2. Draft
Write the full first draft without self-editing. Save it for review:
```
write_file: drafts/blog-post-v1.md
```

### 3. Edit and Revise
Review the draft for:
- **Clarity**: Can every sentence be understood on first read?
- **Conciseness**: Remove filler words (very, really, just, actually, basically)
- **Structure**: Does it flow logically? Are transitions smooth?
- **Voice consistency**: Does the tone stay consistent throughout?
- **Active voice**: Prefer "The team shipped the feature" over "The feature was shipped"

Use `edit_file` for targeted revisions rather than rewriting the whole file.

### 4. Proofread
Final pass for:
- Spelling and grammar
- Punctuation consistency (Oxford comma, em dashes)
- Formatting (heading levels, list style, code blocks)
- Factual accuracy of any claims

## Tone Guide

**Formal/Professional**: No contractions, precise vocabulary, structured paragraphs. Use for reports, proposals, business communication.

**Casual/Conversational**: Contractions OK, shorter sentences, direct address ("you"). Use for blog posts, newsletters, social media.

**Technical**: Precise terminology, code examples, step-by-step structure. Assume domain knowledge. Use for documentation, tutorials, API guides.

**Creative**: Varied sentence length, metaphors, sensory details, narrative arc. Use for stories, marketing copy, engaging introductions.

## Common Formats

### Blog Post Structure
```
# Title (compelling, specific)

Opening hook -- 1-2 sentences that grab attention.

Context paragraph -- why this matters to the reader.

## Main Section 1
Key point with supporting detail.

## Main Section 2
Key point with supporting detail.

## Conclusion
Summary + call to action or takeaway.
```

### Email Draft
```
Subject: [Clear, actionable subject line]

Hi [Name],

[1 sentence: why you're writing]

[1-2 paragraphs: the details]

[1 sentence: clear ask or next step]

Best,
[Name]
```

### Technical Documentation
```
# Feature/API Name

One-line description of what it does.

## Quick Start
Minimal working example.

## API Reference
Parameters, return values, errors.

## Examples
Real-world usage patterns.
```

## Editing Checklist

1. Cut the first paragraph -- the real opening is usually paragraph two
2. Replace adverbs with stronger verbs ("ran quickly" -> "sprinted")
3. Break paragraphs longer than 4-5 sentences
4. Ensure every heading delivers on its promise
5. Read the last sentence of each section -- does it transition to the next?

## Tips

- Save drafts with version numbers: `v1`, `v2`, `v3`
- When asked to "make it shorter," cut 30% -- half-measures feel unchanged
- When asked to "make it better," ask which dimension: clarity, tone, structure, or persuasion
- Read difficult passages aloud mentally -- awkward phrasing becomes obvious
- For important pieces, write the conclusion first to clarify the argument
- Use `read_file` to review the user's existing writing before suggesting edits
