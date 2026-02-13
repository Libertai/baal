# Skills & Agent Template Gallery

## Overview

A browseable gallery of curated agent templates and a skills library for LiberClaw. Users can deploy pre-configured agents from templates or build custom agents by picking skills from a checkbox list. Inspired by OpenClaw's ClawHub/Marketplace ecosystem but tailored to Aleph Cloud + LibertAI.

**Phase 1** (this design): Static JSON catalog of curated templates + shared skills library, skill picker in agent creation flow, gallery screen in Expo app.

**Phase 2** (future): Community marketplace — users publish their agent configs as templates, DB-backed, ratings/install counts.

## Architecture

### Hybrid Catalog Model

Curated templates ship as a static JSON catalog in the codebase (`src/baal_core/templates/`). The API serves them via read-only endpoints. The data model is designed so community DB-backed templates can be added later with the same response shape.

```
src/baal_core/templates/
├── catalog.json                    # Template + category definitions
├── prompts/                        # System prompt .md files (one per template)
│   ├── full-stack-dev.md
│   ├── devops-engineer.md
│   └── ...
└── skills/                         # Shared skills library
    ├── git/SKILL.md
    ├── python-dev/SKILL.md
    ├── code-review/SKILL.md
    └── ...
```

### Skills Library

Skills are `SKILL.md` markdown files in `src/baal_core/templates/skills/`. Each teaches an agent a capability using its existing tools (bash, read/write/edit file, web_fetch, web_search, list_dir, spawn). During deployment, selected skills are copied to the agent VM's `workspace/skills/` directory.

Moves the canonical skill location from `src/baal_agent/workspace/skills/` (agent-local defaults) to `src/baal_core/templates/skills/` (shared library). The agent workspace template keeps `memory/MEMORY.md` but skills come from the user's selection.

**Developer Skills (8):**

| ID | Name | Description |
|----|------|-------------|
| `git` | Git | Clone repos, branch, commit, diff, PR workflows via bash+git |
| `code-review` | Code Review | Systematic code review — bugs, security, style, improvements |
| `python-dev` | Python Dev | Write, run, debug Python; venvs, pip, package management |
| `node-dev` | Node.js Dev | Write, run Node/TypeScript; npm/pnpm workflows |
| `devops` | DevOps | Dockerfiles, docker-compose, CI/CD yaml, nginx configs |
| `api-testing` | API Testing | Test APIs with curl/httpie, format responses, chain requests |
| `data-analysis` | Data Analysis | Process CSV/JSON with Python, generate summaries and insights |
| `sql` | SQL | Write and execute SQL queries, schema design, data exploration |

**General Productivity Skills (5):**

| ID | Name | Description |
|----|------|-------------|
| `web-research` | Web Research | Multi-source research, fact-checking, citation (enhanced existing) |
| `writing` | Writing | Draft, edit, polish text; multiple tones/styles; proofreading |
| `summarization` | Summarization | Summarize documents, articles, codebases; extractive and abstractive |
| `task-planning` | Task Planning | Break goals into actionable steps, track progress in files |
| `learning-tutor` | Learning Tutor | Socratic teaching, quiz generation, concept explanation |

**Web3/Crypto Skills (4):**

| ID | Name | Description |
|----|------|-------------|
| `aleph-cloud` | Aleph Cloud | Manage instances, check credits/usage, storage, network status via aleph CLI and APIs |
| `crypto-research` | Crypto Research | Token data, protocol analysis, ecosystem news via web |
| `smart-contract-reading` | Smart Contract Reading | Read and explain Solidity/Vyper contracts, identify patterns |
| `onchain-data` | On-Chain Data | Query public blockchain data via APIs, format transactions/addresses |

**Retained from existing (3):**

| ID | Name | Description |
|----|------|-------------|
| `memory-management` | Memory Management | Use the persistent memory system effectively |
| `weather` | Weather | Check current weather using wttr.in |

**Total: 20 skills.**

### Agent Template Gallery

14 curated templates across 3 categories.

**Developer (7):**

| ID | Name | Model | Skills | Description |
|----|------|-------|--------|-------------|
| `full-stack-dev` | Full-Stack Dev | qwen3-coder-next | git, python-dev, node-dev, code-review | Your coding partner. Writes, reviews, and debugs code across the stack. |
| `devops-engineer` | DevOps Engineer | qwen3-coder-next | git, devops, api-testing | Builds Dockerfiles, CI pipelines, nginx configs. Keeps your infra running. |
| `python-expert` | Python Expert | qwen3-coder-next | git, python-dev, data-analysis | Python specialist — scripts, data pipelines, debugging, package management. |
| `code-reviewer` | Code Reviewer | qwen3-coder-next | git, code-review | Reviews your code for bugs, security issues, and style. Suggests improvements. |
| `data-analyst` | Data Analyst | qwen3-coder-next | python-dev, data-analysis, sql | Crunches data, writes queries, generates reports. Turns messy data into insights. |
| `api-builder` | API Builder | qwen3-coder-next | git, python-dev, node-dev, api-testing | Designs and builds REST/GraphQL APIs. Tests endpoints, writes docs. |
| `aleph-admin` | Aleph Cloud Admin | qwen3-coder-next | aleph-cloud, devops | Manages your Aleph Cloud infrastructure — instances, credits, deployments, storage. |

**General Productivity (4):**

| ID | Name | Model | Skills | Description |
|----|------|-------|--------|-------------|
| `research-assistant` | Research Assistant | glm-4.7 | web-research, summarization, writing | Deep-dives into any topic. Gathers sources, synthesizes findings, cites everything. |
| `writing-coach` | Writing Coach | glm-4.7 | writing, web-research | Helps you write, edit, and polish text. Blog posts, docs, emails — any style. |
| `study-buddy` | Study Buddy | glm-4.7 | learning-tutor, web-research, summarization | Explains concepts, quizzes you, creates study guides. Adapts to your level. |
| `personal-assistant` | Personal Assistant | glm-4.7 | task-planning, web-research, weather, memory-management | Keeps track of tasks, does research, remembers preferences. Your digital right hand. |

**Web3/Crypto (3):**

| ID | Name | Model | Skills | Description |
|----|------|-------|--------|-------------|
| `defi-researcher` | DeFi Researcher | glm-4.7 | crypto-research, onchain-data, web-research | Analyzes DeFi protocols, tracks token metrics, researches yield strategies. |
| `contract-auditor` | Smart Contract Auditor | qwen3-coder-next | smart-contract-reading, code-review | Reads and analyzes smart contracts. Spots vulnerabilities, explains logic. |
| `aleph-navigator` | Aleph Cloud Navigator | glm-4.7 | aleph-cloud, crypto-research | Your guide to the Aleph ecosystem. Manages resources, tracks $ALEPH, explains concepts. |

## API Design

### New Endpoints

```
GET  /api/v1/templates/              → list all templates grouped by category
GET  /api/v1/templates/{id}          → single template with full system prompt
GET  /api/v1/skills/                 → list all available skills
GET  /api/v1/skills/{id}             → single skill with full SKILL.md content
```

### Modified Endpoints

```
POST /api/v1/agents/                 → now accepts optional template_id and skills list
```

### Schemas

```python
# Skills
class SkillSummary(BaseModel):
    id: str                          # e.g. "git"
    name: str                        # e.g. "Git"
    category: str                    # e.g. "developer"
    description: str                 # One-line summary

class SkillDetail(SkillSummary):
    content: str                     # Full SKILL.md markdown

class SkillListResponse(BaseModel):
    skills: list[SkillSummary]

# Templates
class TemplateSummary(BaseModel):
    id: str                          # e.g. "full-stack-dev"
    name: str                        # e.g. "Full-Stack Dev"
    category: str                    # e.g. "developer"
    description: str                 # Short description
    icon: str                        # Icon identifier
    model: str                       # Default model
    skills: list[str]                # Skill IDs
    featured: bool = False

class TemplateDetail(TemplateSummary):
    system_prompt: str               # Full system prompt markdown

class CategoryGroup(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    templates: list[TemplateSummary]

class TemplateListResponse(BaseModel):
    categories: list[CategoryGroup]

# Agent creation (modified)
class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    system_prompt: str | None = Field(None, min_length=1)
    model: str | None = None
    template_id: str | None = None   # Pre-fill from template
    skills: list[str] | None = None  # Skill IDs to deploy to VM
```

When `template_id` is provided, the API fills `system_prompt`, `model`, and `skills` from the template. Explicit values in the request override template defaults. This lets users start from a template and customize.

## Deployer Changes

The deployer currently tarballs `src/baal_agent/` wholesale. It needs to:

1. Build a workspace directory with `memory/MEMORY.md` (base)
2. Copy selected skills from `src/baal_core/templates/skills/{id}/` into `workspace/skills/{id}/`
3. If no skills selected, include all skills (backward compat) or a sensible default set
4. Tarball the combined workspace and deploy via SSH as before

The `deploy_agent()` method gains a `skills: list[str] | None` parameter.

## Expo App: New Screens

### Gallery Tab (`(tabs)/gallery.tsx`)

- Category filter tabs: All | Developer | Productivity | Web3
- Grid/list of template cards
- Each card: icon, name, short description, skill count badge, model badge
- Featured templates highlighted at top
- "Create Custom Agent" button at top

### Template Detail (modal or screen)

- Full description
- Skill list with descriptions
- Model info
- System prompt preview (collapsible)
- "Deploy This Agent" button → navigates to create screen with pre-filled values

### Revised Create Agent Screen (`agent/create.tsx`)

```
┌─────────────────────────────────┐
│ Create Agent                     │
├─────────────────────────────────┤
│ Name: [___________________]      │
│                                  │
│ System Prompt:                   │
│ [Multi-line editor, pre-filled   │
│  if from template]               │
│                                  │
│ Model: [qwen3-coder-next ▼]     │
│                                  │
│ ── Skills ──────────────────── │
│                                  │
│ Developer                        │
│ ☑ Git                            │
│   Clone, branch, commit, diff    │
│ ☑ Code Review                    │
│   Systematic code review         │
│ ☐ Python Dev                     │
│   Write, run, debug Python       │
│ ☐ Node.js Dev                    │
│   Write, run Node/TypeScript     │
│ ...                              │
│                                  │
│ Productivity                     │
│ ☐ Web Research                   │
│   Multi-source research          │
│ ☐ Writing                        │
│   Draft, edit, polish text       │
│ ...                              │
│                                  │
│ Web3                             │
│ ☐ Aleph Cloud                    │
│   Manage instances, credits      │
│ ...                              │
│                                  │
│ [    Deploy Agent    ]           │
└─────────────────────────────────┘
```

Two entry points to this screen:
- **From gallery template**: name blank, prompt/model/skills pre-filled from template
- **From "Create Custom"**: all blank, no skills pre-checked

### Telegram Bot

The `/create` wizard gains an optional step after model selection showing a numbered list of skill categories. User can type skill numbers to toggle, or press "Skip" to use defaults. Keeps the conversation-based UX.

## Catalog JSON Schema

```json
{
  "categories": [
    {
      "id": "developer",
      "name": "Developer",
      "icon": "code",
      "description": "Build, debug, and ship code faster"
    },
    {
      "id": "productivity",
      "name": "Productivity",
      "icon": "sparkles",
      "description": "Research, write, learn, and stay organized"
    },
    {
      "id": "web3",
      "name": "Web3",
      "icon": "globe",
      "description": "Navigate crypto, DeFi, and Aleph Cloud"
    }
  ],
  "skills": [
    {
      "id": "git",
      "name": "Git",
      "category": "developer",
      "description": "Clone repos, branch, commit, diff, PR workflows via bash+git"
    }
  ],
  "templates": [
    {
      "id": "full-stack-dev",
      "name": "Full-Stack Dev",
      "category": "developer",
      "description": "Your coding partner. Writes, reviews, and debugs code across the stack.",
      "icon": "laptop-code",
      "model": "qwen3-coder-next",
      "skills": ["git", "python-dev", "node-dev", "code-review"],
      "system_prompt_file": "full-stack-dev.md",
      "featured": true
    }
  ]
}
```

## Phase 2: Community Marketplace (Future)

When ready, add:
- `AgentTemplate` DB table mirroring the static catalog schema + `owner_id`, `is_public`, `install_count`, `created_at`
- `POST /api/v1/templates/` — publish your agent config as a template
- `POST /api/v1/templates/{id}/install` — increment counter, clone to user's agents
- API merges static catalog + DB templates in list responses
- Moderation: admin approval before public listing
- `is_public` field on Agent model for sharing

## Implementation Sequence

1. **Skills library** — write all 20 SKILL.md files in `src/baal_core/templates/skills/`
2. **Catalog data** — create `catalog.json` + 14 system prompt `.md` files in `src/baal_core/templates/prompts/`
3. **Catalog loader** — Python module to read catalog.json and skill files (`src/baal_core/templates/__init__.py`)
4. **API endpoints** — new `/templates/` and `/skills/` routers in liberclaw
5. **AgentCreate schema** — add `template_id` and `skills` fields
6. **Deployer changes** — accept `skills` param, copy selected skills to workspace tarball
7. **Expo: gallery screen** — new tab with category filters and template cards
8. **Expo: skill picker** — checkbox section on create/edit agent screen
9. **Expo: template detail** — detail view with "Deploy This Agent" button
10. **Telegram bot** — skill selection step in `/create` wizard
11. **Testing** — end-to-end: pick template → customize skills → deploy → verify skills on VM
