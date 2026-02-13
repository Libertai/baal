# Skills & Agent Template Gallery — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a browseable gallery of curated agent templates and a skills library to LiberClaw, with a checkbox-based skill picker in agent creation.

**Architecture:** Static JSON catalog in `src/baal_core/templates/` serves curated templates + skills via new API endpoints. The deployer copies user-selected skills to agent VMs during deployment. The Expo app gets a gallery tab and skill picker on the create screen.

**Tech Stack:** Python (FastAPI, Pydantic), TypeScript (Expo Router, TanStack Query, NativeWind), Alembic (PostgreSQL migration), JSON catalog

**Design doc:** `docs/plans/2026-02-13-skills-gallery-design.md`

---

## Task 1: Create Skills Library — Developer Skills (Part 1)

Write the first 4 developer skill SKILL.md files.

**Files:**
- Create: `src/baal_core/templates/skills/git/SKILL.md`
- Create: `src/baal_core/templates/skills/code-review/SKILL.md`
- Create: `src/baal_core/templates/skills/python-dev/SKILL.md`
- Create: `src/baal_core/templates/skills/node-dev/SKILL.md`

**Context:** Each skill is a markdown file that teaches an agent how to use its tools (bash, read_file, write_file, edit_file, list_dir, web_fetch, web_search, spawn) for a specific domain. The agent's context builder at `src/baal_agent/context.py:_load_skills_summary()` reads the first non-heading line as description, and includes a summary in the system prompt. The agent reads the full SKILL.md on demand via `read_file`.

**Step 1: Create directory structure**

```bash
mkdir -p src/baal_core/templates/skills/{git,code-review,python-dev,node-dev}
```

**Step 2: Write git/SKILL.md**

Write a skill that teaches the agent Git workflows. Cover: clone, branch, status, diff, add, commit, push, pull, merge, log, stash. Include examples using the `bash` tool. Mention common flags. ~60-80 lines.

**Step 3: Write code-review/SKILL.md**

Write a skill for systematic code review. Cover: reading files with `read_file`, checking for bugs/security/style, providing structured feedback. Include a review checklist template. ~50-70 lines.

**Step 4: Write python-dev/SKILL.md**

Write a skill for Python development. Cover: creating venvs (`python -m venv`), pip install, running scripts, debugging with tracebacks, writing tests with pytest, common patterns. ~60-80 lines.

**Step 5: Write node-dev/SKILL.md**

Write a skill for Node.js/TypeScript development. Cover: npm/pnpm init and install, running scripts, TypeScript compilation, debugging, package.json management. ~50-70 lines.

**Step 6: Commit**

```bash
git add src/baal_core/templates/skills/{git,code-review,python-dev,node-dev}/SKILL.md
git commit -m "feat: add developer skills — git, code-review, python-dev, node-dev"
```

---

## Task 2: Create Skills Library — Developer Skills (Part 2)

Write the remaining 4 developer skill SKILL.md files.

**Files:**
- Create: `src/baal_core/templates/skills/devops/SKILL.md`
- Create: `src/baal_core/templates/skills/api-testing/SKILL.md`
- Create: `src/baal_core/templates/skills/data-analysis/SKILL.md`
- Create: `src/baal_core/templates/skills/sql/SKILL.md`

**Step 1: Create directories**

```bash
mkdir -p src/baal_core/templates/skills/{devops,api-testing,data-analysis,sql}
```

**Step 2: Write devops/SKILL.md**

Cover: Dockerfile writing, docker-compose, CI/CD yaml (GitHub Actions), nginx/Caddy configs, systemd services, environment management. ~60-80 lines.

**Step 3: Write api-testing/SKILL.md**

Cover: curl for GET/POST/PUT/DELETE with headers and auth, parsing JSON responses with `jq` via bash, chaining requests, testing error cases, load testing basics with `ab`. ~50-70 lines.

**Step 4: Write data-analysis/SKILL.md**

Cover: reading CSV/JSON files, Python with pandas (install via pip in bash), generating summaries and stats, creating reports as markdown files, data cleaning patterns. ~60-80 lines.

**Step 5: Write sql/SKILL.md**

Cover: SQLite queries via bash (`sqlite3`), schema inspection, SELECT/INSERT/UPDATE/DELETE, JOINs, aggregation, indexing, data export. Note: agents have SQLite available. ~50-70 lines.

**Step 6: Commit**

```bash
git add src/baal_core/templates/skills/{devops,api-testing,data-analysis,sql}/SKILL.md
git commit -m "feat: add developer skills — devops, api-testing, data-analysis, sql"
```

---

## Task 3: Create Skills Library — Productivity Skills

Write the 5 general productivity skill SKILL.md files. Move and enhance the existing web-research skill.

**Files:**
- Create: `src/baal_core/templates/skills/web-research/SKILL.md` (enhanced version of existing `src/baal_agent/workspace/skills/web-research/SKILL.md`)
- Create: `src/baal_core/templates/skills/writing/SKILL.md`
- Create: `src/baal_core/templates/skills/summarization/SKILL.md`
- Create: `src/baal_core/templates/skills/task-planning/SKILL.md`
- Create: `src/baal_core/templates/skills/learning-tutor/SKILL.md`

**Step 1: Create directories**

```bash
mkdir -p src/baal_core/templates/skills/{web-research,writing,summarization,task-planning,learning-tutor}
```

**Step 2: Write web-research/SKILL.md (enhanced)**

Start from existing skill at `src/baal_agent/workspace/skills/web-research/SKILL.md`. Enhance with: multi-source research patterns, cross-referencing facts, saving citations to memory, structuring findings as reports. ~70-90 lines.

**Step 3: Write writing/SKILL.md**

Cover: drafting text in various tones (formal, casual, technical, creative), editing for clarity, proofreading checklist, blog post structure, email templates, using `write_file` to save drafts. ~60-80 lines.

**Step 4: Write summarization/SKILL.md**

Cover: extractive vs abstractive summarization, summarizing long documents (read_file + process chunks), article summaries, codebase overviews, creating executive summaries, TL;DR format. ~50-60 lines.

**Step 5: Write task-planning/SKILL.md**

Cover: breaking goals into actionable steps, creating TODO files with `write_file`, priority levels, progress tracking, project planning with milestones, daily planning. ~50-60 lines.

**Step 6: Write learning-tutor/SKILL.md**

Cover: Socratic teaching method (ask questions instead of giving answers), concept explanation at different levels, quiz generation, spaced repetition reminders in memory, creating study guides. ~60-70 lines.

**Step 7: Commit**

```bash
git add src/baal_core/templates/skills/{web-research,writing,summarization,task-planning,learning-tutor}/SKILL.md
git commit -m "feat: add productivity skills — web-research, writing, summarization, task-planning, learning-tutor"
```

---

## Task 4: Create Skills Library — Web3 + Retained Skills

Write 4 web3 skills and copy 2 retained skills from the existing workspace.

**Files:**
- Create: `src/baal_core/templates/skills/aleph-cloud/SKILL.md`
- Create: `src/baal_core/templates/skills/crypto-research/SKILL.md`
- Create: `src/baal_core/templates/skills/smart-contract-reading/SKILL.md`
- Create: `src/baal_core/templates/skills/onchain-data/SKILL.md`
- Create: `src/baal_core/templates/skills/memory-management/SKILL.md` (from `src/baal_agent/workspace/skills/memory-management/SKILL.md`)
- Create: `src/baal_core/templates/skills/weather/SKILL.md` (from `src/baal_agent/workspace/skills/weather/SKILL.md`)

**Step 1: Create directories**

```bash
mkdir -p src/baal_core/templates/skills/{aleph-cloud,crypto-research,smart-contract-reading,onchain-data,memory-management,weather}
```

**Step 2: Write aleph-cloud/SKILL.md**

Cover: Aleph Cloud CLI basics (`aleph` commands), instance management (create, list, stop), PAYG credit checking, storage operations, program deployment, network status queries. Reference Aleph Cloud docs. ~70-90 lines.

**Step 3: Write crypto-research/SKILL.md**

Cover: fetching token data via web_fetch (CoinGecko API, DeFiLlama), analyzing protocols, tracking ecosystem news, DeFi yield research, comparing token metrics. ~60-70 lines.

**Step 4: Write smart-contract-reading/SKILL.md**

Cover: reading Solidity/Vyper contracts with read_file, identifying common patterns (ERC20, ERC721, proxy), spotting vulnerabilities (reentrancy, overflow), explaining contract logic in plain language. ~60-80 lines.

**Step 5: Write onchain-data/SKILL.md**

Cover: querying public APIs (Etherscan-like, block explorers) via web_fetch, formatting transaction data, address balance checks, event log analysis, gas price checking. ~50-60 lines.

**Step 6: Copy and place retained skills**

Copy `memory-management` and `weather` from `src/baal_agent/workspace/skills/` to `src/baal_core/templates/skills/`. These stay as-is.

```bash
cp src/baal_agent/workspace/skills/memory-management/SKILL.md src/baal_core/templates/skills/memory-management/SKILL.md
cp src/baal_agent/workspace/skills/weather/SKILL.md src/baal_core/templates/skills/weather/SKILL.md
```

**Step 7: Commit**

```bash
git add src/baal_core/templates/skills/
git commit -m "feat: add web3 skills and copy retained skills to shared library"
```

---

## Task 5: Create Catalog JSON + Template Prompts

Create the catalog.json with all categories, skills metadata, and template definitions. Write all 14 system prompt markdown files.

**Files:**
- Create: `src/baal_core/templates/__init__.py` (empty, makes it a package)
- Create: `src/baal_core/templates/catalog.json`
- Create: `src/baal_core/templates/prompts/full-stack-dev.md`
- Create: `src/baal_core/templates/prompts/devops-engineer.md`
- Create: `src/baal_core/templates/prompts/python-expert.md`
- Create: `src/baal_core/templates/prompts/code-reviewer.md`
- Create: `src/baal_core/templates/prompts/data-analyst.md`
- Create: `src/baal_core/templates/prompts/api-builder.md`
- Create: `src/baal_core/templates/prompts/aleph-admin.md`
- Create: `src/baal_core/templates/prompts/research-assistant.md`
- Create: `src/baal_core/templates/prompts/writing-coach.md`
- Create: `src/baal_core/templates/prompts/study-buddy.md`
- Create: `src/baal_core/templates/prompts/personal-assistant.md`
- Create: `src/baal_core/templates/prompts/defi-researcher.md`
- Create: `src/baal_core/templates/prompts/contract-auditor.md`
- Create: `src/baal_core/templates/prompts/aleph-navigator.md`

**Context for system prompts:** The bot's `_default_system_prompt()` at `src/baal/handlers/commands.py:34-41` generates a basic prompt. Template prompts should be richer — ~20-40 lines each with personality, domain expertise, behavioral guidelines, and references to skills.

**Step 1: Create directories**

```bash
mkdir -p src/baal_core/templates/prompts
touch src/baal_core/templates/__init__.py
```

**Step 2: Write catalog.json**

Full JSON with:
- 3 categories (developer, productivity, web3)
- 20 skills (all fields: id, name, category, description)
- 14 templates (all fields: id, name, category, description, icon, model, skills, system_prompt_file, featured)

Mark `full-stack-dev`, `research-assistant`, and `aleph-navigator` as `featured: true`.

Reference the design doc `docs/plans/2026-02-13-skills-gallery-design.md` for the complete list.

**Step 3: Write all 14 system prompt files**

Each prompt should be ~20-40 lines of markdown defining the agent's:
- Identity and expertise
- Behavioral guidelines (tone, style, approach)
- Domain-specific instructions
- How to use their skills effectively
- What NOT to do

**Step 4: Commit**

```bash
git add src/baal_core/templates/
git commit -m "feat: add catalog.json and 14 template system prompts"
```

---

## Task 6: Catalog Loader Module

Python module to read catalog.json and skill files at runtime. This is the backend for the API endpoints.

**Files:**
- Create: `src/baal_core/templates/loader.py`
- Reference: `src/baal_core/templates/catalog.json` (created in Task 5)
- Reference: `src/baal_core/templates/skills/*/SKILL.md` (created in Tasks 1-4)
- Reference: `src/baal_core/templates/prompts/*.md` (created in Task 5)

**Step 1: Write loader.py**

```python
"""Catalog loader for skills and agent templates."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_TEMPLATES_DIR = Path(__file__).resolve().parent

@lru_cache(maxsize=1)
def _load_catalog() -> dict:
    """Load and cache catalog.json."""
    catalog_path = _TEMPLATES_DIR / "catalog.json"
    return json.loads(catalog_path.read_text())

def list_categories() -> list[dict]:
    """Return all categories."""
    return _load_catalog()["categories"]

def list_skills() -> list[dict]:
    """Return all skill summaries from catalog."""
    return _load_catalog()["skills"]

def get_skill(skill_id: str) -> dict | None:
    """Return a skill summary + full SKILL.md content."""
    for skill in list_skills():
        if skill["id"] == skill_id:
            skill_path = _TEMPLATES_DIR / "skills" / skill_id / "SKILL.md"
            if skill_path.exists():
                return {**skill, "content": skill_path.read_text()}
            return None
    return None

def get_skill_content(skill_id: str) -> str | None:
    """Return just the SKILL.md content for a skill."""
    skill_path = _TEMPLATES_DIR / "skills" / skill_id / "SKILL.md"
    if skill_path.exists():
        return skill_path.read_text()
    return None

def list_templates() -> list[dict]:
    """Return all template summaries from catalog."""
    return _load_catalog()["templates"]

def get_template(template_id: str) -> dict | None:
    """Return a template with full system prompt loaded."""
    for tmpl in list_templates():
        if tmpl["id"] == template_id:
            prompt_path = _TEMPLATES_DIR / "prompts" / tmpl["system_prompt_file"]
            if prompt_path.exists():
                return {**tmpl, "system_prompt": prompt_path.read_text()}
            return None
    return None

def list_templates_by_category() -> list[dict]:
    """Return templates grouped by category."""
    categories = list_categories()
    templates = list_templates()
    result = []
    for cat in categories:
        cat_templates = [t for t in templates if t["category"] == cat["id"]]
        result.append({**cat, "templates": cat_templates})
    return result

def validate_skills(skill_ids: list[str]) -> list[str]:
    """Return list of invalid skill IDs (empty if all valid)."""
    valid = {s["id"] for s in list_skills()}
    return [s for s in skill_ids if s not in valid]
```

**Step 2: Verify it works**

```bash
cd /home/jon/repos/baal && python -c "
from baal_core.templates.loader import list_skills, list_templates, get_template, get_skill
print(f'Skills: {len(list_skills())}')
print(f'Templates: {len(list_templates())}')
t = get_template('full-stack-dev')
print(f'Template: {t[\"name\"] if t else \"NOT FOUND\"}')
s = get_skill('git')
print(f'Skill: {s[\"name\"] if s else \"NOT FOUND\"}')
"
```

Expected output:
```
Skills: 20
Templates: 14
Template: Full-Stack Dev
Skill: Git
```

**Step 3: Commit**

```bash
git add src/baal_core/templates/loader.py
git commit -m "feat: add catalog loader module for skills and templates"
```

---

## Task 7: LiberClaw API — Templates and Skills Schemas

Add Pydantic schemas for the new template and skill endpoints.

**Files:**
- Create: `src/liberclaw/schemas/templates.py`
- Modify: `src/liberclaw/schemas/agents.py:11-14` (AgentCreate — add template_id and skills)

**Step 1: Write schemas/templates.py**

```python
"""Schemas for the template gallery and skills library."""

from __future__ import annotations

from pydantic import BaseModel


class SkillSummary(BaseModel):
    id: str
    name: str
    category: str
    description: str


class SkillDetail(SkillSummary):
    content: str


class SkillListResponse(BaseModel):
    skills: list[SkillSummary]


class TemplateSummary(BaseModel):
    id: str
    name: str
    category: str
    description: str
    icon: str
    model: str
    skills: list[str]
    featured: bool = False


class TemplateDetail(TemplateSummary):
    system_prompt: str


class CategoryGroup(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    templates: list[TemplateSummary]


class TemplateListResponse(BaseModel):
    categories: list[CategoryGroup]
```

**Step 2: Modify AgentCreate in schemas/agents.py**

Current `AgentCreate` at `src/liberclaw/schemas/agents.py:11-14`:

```python
class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    system_prompt: str = Field(..., min_length=1)
    model: str = "qwen3-coder-next"
```

Change to:

```python
class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    system_prompt: str | None = Field(None, min_length=1)
    model: str | None = None
    template_id: str | None = None
    skills: list[str] | None = None
```

**Step 3: Add skills to AgentResponse**

Current `AgentResponse` at `src/liberclaw/schemas/agents.py:23-34` — add `skills` field:

```python
class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    system_prompt: str
    model: str
    deployment_status: str
    vm_url: str | None
    source: str
    skills: list[str] | None = None  # NEW
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

**Step 4: Commit**

```bash
git add src/liberclaw/schemas/templates.py src/liberclaw/schemas/agents.py
git commit -m "feat: add template/skill schemas, extend AgentCreate with template_id and skills"
```

---

## Task 8: Database Migration — Add skills Column to Agent

Add a `skills` JSON column to the agents table to persist which skills were selected.

**Files:**
- Create: `src/liberclaw/database/migrations/versions/003_agent_skills.py`
- Modify: `src/liberclaw/database/models.py:131-154` (Agent model — add skills column)

**Step 1: Add skills column to Agent model**

In `src/liberclaw/database/models.py`, after line 145 (`source` column), add:

```python
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of skill IDs
```

This stores skills as a JSON string (e.g., `'["git","python-dev"]'`). Simple and avoids a join table for phase 1.

**Step 2: Write the migration**

Create `src/liberclaw/database/migrations/versions/003_agent_skills.py`:

```python
"""Add skills column to agents table.

Revision ID: 003
Revises: 002
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("skills", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "skills")
```

**Step 3: Run the migration**

```bash
cd /home/jon/repos/baal && alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 002 -> 003, Add skills column to agents table.`

**Step 4: Commit**

```bash
git add src/liberclaw/database/models.py src/liberclaw/database/migrations/versions/003_agent_skills.py
git commit -m "feat: add skills column to agents table"
```

---

## Task 9: LiberClaw API — Templates and Skills Router

Create the new router with endpoints for listing templates and skills.

**Files:**
- Create: `src/liberclaw/routers/templates.py`
- Modify: `src/liberclaw/main.py:67` (register new router)

**Step 1: Write routers/templates.py**

```python
"""Template gallery and skills library endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from baal_core.templates.loader import (
    get_skill,
    get_template,
    list_skills,
    list_templates_by_category,
)
from liberclaw.schemas.templates import (
    CategoryGroup,
    SkillDetail,
    SkillListResponse,
    SkillSummary,
    TemplateDetail,
    TemplateListResponse,
)

router = APIRouter(prefix="/templates", tags=["templates"])
skills_router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("/", response_model=TemplateListResponse)
async def list_all_templates():
    """List all templates grouped by category."""
    grouped = list_templates_by_category()
    return TemplateListResponse(
        categories=[CategoryGroup(**g) for g in grouped]
    )


@router.get("/{template_id}", response_model=TemplateDetail)
async def get_template_detail(template_id: str):
    """Get a single template with its full system prompt."""
    template = get_template(template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_id}' not found",
        )
    return TemplateDetail(**template)


@skills_router.get("/", response_model=SkillListResponse)
async def list_all_skills():
    """List all available skills."""
    skills = list_skills()
    return SkillListResponse(
        skills=[SkillSummary(**s) for s in skills]
    )


@skills_router.get("/{skill_id}", response_model=SkillDetail)
async def get_skill_detail(skill_id: str):
    """Get a single skill with its full SKILL.md content."""
    skill = get_skill(skill_id)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill '{skill_id}' not found",
        )
    return SkillDetail(**skill)
```

**Step 2: Register routers in main.py**

In `src/liberclaw/main.py`, after line 67 (`agents router`), add:

```python
    from liberclaw.routers.templates import router as templates_router, skills_router
    app.include_router(templates_router, prefix="/api/v1")
    app.include_router(skills_router, prefix="/api/v1")
```

**Step 3: Verify endpoints work**

```bash
cd /home/jon/repos/baal && uvicorn liberclaw.main:app --port 8000 &
sleep 2
curl -s http://localhost:8000/api/v1/templates/ | python -m json.tool | head -20
curl -s http://localhost:8000/api/v1/skills/ | python -m json.tool | head -20
curl -s http://localhost:8000/api/v1/templates/full-stack-dev | python -m json.tool | head -10
curl -s http://localhost:8000/api/v1/skills/git | python -m json.tool | head -10
kill %1
```

**Step 4: Commit**

```bash
git add src/liberclaw/routers/templates.py src/liberclaw/main.py
git commit -m "feat: add /templates/ and /skills/ API endpoints"
```

---

## Task 10: Modify Agent Creation — Template + Skills Support

Update the agent creation flow to accept `template_id` and `skills`, resolve template defaults, and persist skills.

**Files:**
- Modify: `src/liberclaw/routers/agents.py:52-97` (create endpoint)
- Modify: `src/liberclaw/services/agent_manager.py:22-48` (create_agent function)
- Modify: `src/liberclaw/schemas/agents.py` (AgentResponse — already done in Task 7)

**Step 1: Update create_agent() service**

In `src/liberclaw/services/agent_manager.py:22-48`, change signature and body:

```python
async def create_agent(
    db: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    system_prompt: str,
    model: str,
    encryption_key: str,
    skills: list[str] | None = None,
) -> Agent:
    """Create a new agent record with an encrypted auth token."""
    if model not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown model: {model}")

    agent_secret = secrets.token_urlsafe(32)
    encrypted_secret = encrypt(agent_secret, encryption_key)

    agent = Agent(
        owner_id=owner_id,
        name=name,
        system_prompt=system_prompt,
        model=model,
        auth_token=encrypted_secret,
        deployment_status="pending",
        source="web",
        skills=json.dumps(skills) if skills else None,
    )
    db.add(agent)
    await db.flush()
    return agent
```

Add `import json` at top of file.

**Step 2: Update create_user_agent() endpoint**

In `src/liberclaw/routers/agents.py:52-97`, add template resolution before calling create_agent:

```python
@router.post("/", response_model=AgentResponse, status_code=201)
async def create_user_agent(
    body: AgentCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent and start background deployment."""
    settings = get_settings()

    # Check agent limit
    agent_limit = (
        settings.guest_max_agents if user.tier == "guest"
        else settings.max_agents_per_user
    )
    count = await get_agent_count(db, user.id)
    if count >= agent_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Agent limit reached ({agent_limit})",
        )

    # Resolve template defaults
    system_prompt = body.system_prompt
    model = body.model
    skills = body.skills

    if body.template_id:
        from baal_core.templates.loader import get_template, validate_skills
        template = get_template(body.template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown template: {body.template_id}",
            )
        if system_prompt is None:
            system_prompt = template["system_prompt"]
        if model is None:
            model = template["model"]
        if skills is None:
            skills = template["skills"]

    # Final defaults
    if system_prompt is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="system_prompt is required when not using a template",
        )
    if model is None:
        model = "qwen3-coder-next"

    # Validate skills
    if skills:
        from baal_core.templates.loader import validate_skills
        invalid = validate_skills(skills)
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown skills: {', '.join(invalid)}",
            )

    agent = await create_agent(
        db, user.id, body.name, system_prompt, model,
        settings.encryption_key, skills=skills,
    )
    await db.commit()

    # Launch background deployment (unchanged)
    ...
```

**Step 3: Update AgentResponse to serialize skills**

The `skills` field on the Agent model is stored as a JSON string. Add a property or validator so the Pydantic response returns it as `list[str] | None`. In `src/liberclaw/schemas/agents.py`, add a validator to AgentResponse:

```python
from pydantic import field_validator

class AgentResponse(BaseModel):
    ...
    skills: list[str] | None = None

    @field_validator("skills", mode="before")
    @classmethod
    def parse_skills(cls, v):
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v

    model_config = {"from_attributes": True}
```

**Step 4: Commit**

```bash
git add src/liberclaw/routers/agents.py src/liberclaw/services/agent_manager.py src/liberclaw/schemas/agents.py
git commit -m "feat: support template_id and skills in agent creation"
```

---

## Task 11: Deployer — Deploy Selected Skills to VM

Modify the deployer to copy user-selected skills to the agent VM workspace instead of the default bundled skills.

**Files:**
- Modify: `src/baal_core/deployer.py:483-495` (deploy_agent signature)
- Modify: `src/baal_core/deployer.py:574-578` (workspace copy — replace with skill-aware copy)
- Modify: `src/baal_core/deployer.py:738-749` (deploy_agent_code signature)
- Modify: `src/baal_core/deployer.py:778-782` (workspace copy in fast path)
- Modify: `src/liberclaw/services/agent_manager.py:209-220` (pass skills to deployer)

**Step 1: Add skills parameter to deploy_agent()**

At `src/baal_core/deployer.py:483-495`, add `skills: list[str] | None = None` parameter:

```python
    async def deploy_agent(
        self,
        vm_ip: str,
        ssh_port: int,
        agent_name: str,
        system_prompt: str,
        model: str,
        libertai_api_key: str,
        agent_secret: str,
        instance_hash: str,
        owner_chat_id: str = "",
        on_progress=None,
        skills: list[str] | None = None,
    ) -> dict:
```

**Step 2: Replace workspace copy with skill-aware deployment**

At `src/baal_core/deployer.py:574-578`, replace the `cp -rn` block with:

```python
        # Copy base workspace template (memory only, no-clobber)
        await self._ssh_run(
            vm_ip, ssh_port,
            f"cp -rn {agent_dir}/baal_agent/workspace/memory /opt/baal-agent/workspace/memory 2>/dev/null; "
            f"mkdir -p /opt/baal-agent/workspace/memory /opt/baal-agent/workspace/skills",
        )

        # Deploy selected skills from shared library
        if skills:
            await self._deploy_skills(vm_ip, ssh_port, skills)
        else:
            # Backward compat: copy all bundled skills from agent workspace
            await self._ssh_run(
                vm_ip, ssh_port,
                f"cp -rn {agent_dir}/baal_agent/workspace/skills/* /opt/baal-agent/workspace/skills/ 2>/dev/null || true",
            )
```

**Step 3: Add _deploy_skills() helper method**

Add a new method to the AlephDeployer class (after `_get_agent_source_dir()`):

```python
    async def _deploy_skills(
        self, vm_ip: str, ssh_port: int, skill_ids: list[str]
    ) -> None:
        """Copy selected skills from the shared library to the agent VM."""
        from baal_core.templates.loader import get_skill_content

        for skill_id in skill_ids:
            content = get_skill_content(skill_id)
            if not content:
                logger.warning(f"Skill '{skill_id}' not found, skipping")
                continue
            # Create skill directory and write SKILL.md
            skill_dir = f"/opt/baal-agent/workspace/skills/{skill_id}"
            await self._ssh_run(vm_ip, ssh_port, f"mkdir -p {skill_dir}")
            cmd = _safe_write_file_command(content, f"{skill_dir}/SKILL.md")
            await self._ssh_run(vm_ip, ssh_port, cmd)
```

**Step 4: Apply same changes to deploy_agent_code()**

At `src/baal_core/deployer.py:738-749`, add `skills: list[str] | None = None` parameter.

At lines 778-782, replace the workspace copy with the same skill-aware logic from Step 2.

**Step 5: Pass skills from agent_manager to deployer**

In `src/liberclaw/services/agent_manager.py:209-220`, add skills:

```python
            # Parse skills from agent record
            agent_skills = json.loads(agent.skills) if agent.skills else None

            deploy_result = await deployer.deploy_agent(
                vm_ip=vm_ip,
                ssh_port=ssh_port,
                agent_name=agent.name,
                system_prompt=agent.system_prompt,
                model=agent.model,
                libertai_api_key=libertai_api_key,
                agent_secret=agent_secret,
                instance_hash=instance_hash,
                owner_chat_id=str(agent.owner_id),
                on_progress=on_deploy_progress,
                skills=agent_skills,
            )
```

Add `import json` at top if not already present.

**Step 6: Commit**

```bash
git add src/baal_core/deployer.py src/liberclaw/services/agent_manager.py
git commit -m "feat: deploy user-selected skills to agent VMs"
```

---

## Task 12: Expo App — TypeScript Types and API Functions

Add TypeScript types and API functions for templates and skills.

**Files:**
- Modify: `apps/liberclaw/lib/api/types.ts:50-81` (add template + skill types, update AgentCreate)
- Create: `apps/liberclaw/lib/api/templates.ts`
- Create: `apps/liberclaw/lib/hooks/useTemplates.ts`

**Step 1: Add types to types.ts**

After the `AgentUpdate` interface (line 81), add:

```typescript
// ── Templates & Skills ───────────────────────────────────────────────

export interface SkillSummary {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface SkillDetail extends SkillSummary {
  content: string;
}

export interface SkillListResponse {
  skills: SkillSummary[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  model: string;
  skills: string[];
  featured: boolean;
}

export interface TemplateDetail extends TemplateSummary {
  system_prompt: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  templates: TemplateSummary[];
}

export interface TemplateListResponse {
  categories: CategoryGroup[];
}
```

Update AgentCreate (line 71-75):

```typescript
export interface AgentCreate {
  name: string;
  system_prompt?: string;
  model?: string;
  template_id?: string;
  skills?: string[];
}
```

Add `skills` to Agent interface (line 59-69):

```typescript
export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  deployment_status: DeploymentStatusValue;
  vm_url: string | null;
  source: string;
  skills: string[] | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Write templates.ts API functions**

```typescript
/**
 * Template gallery and skills library API calls.
 */

import { apiFetch } from "./client";
import type {
  TemplateListResponse,
  TemplateDetail,
  SkillListResponse,
  SkillDetail,
} from "./types";

export async function listTemplates(): Promise<TemplateListResponse> {
  return apiFetch<TemplateListResponse>("/templates/", { noAuth: true });
}

export async function getTemplate(id: string): Promise<TemplateDetail> {
  return apiFetch<TemplateDetail>(`/templates/${id}`, { noAuth: true });
}

export async function listSkills(): Promise<SkillListResponse> {
  return apiFetch<SkillListResponse>("/skills/", { noAuth: true });
}

export async function getSkill(id: string): Promise<SkillDetail> {
  return apiFetch<SkillDetail>(`/skills/${id}`, { noAuth: true });
}
```

Note: `noAuth: true` — templates and skills are public, no login needed to browse.

**Step 3: Write useTemplates.ts hook**

```typescript
/**
 * TanStack Query hooks for templates and skills.
 */

import { useQuery } from "@tanstack/react-query";
import { listTemplates, getTemplate, listSkills } from "@/lib/api/templates";

export const TEMPLATES_QUERY_KEY = ["templates"] as const;
export const SKILLS_QUERY_KEY = ["skills"] as const;

export function useTemplates() {
  return useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: listTemplates,
    staleTime: 5 * 60 * 1000, // 5 min — catalog rarely changes
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: () => getTemplate(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSkills() {
  return useQuery({
    queryKey: SKILLS_QUERY_KEY,
    queryFn: listSkills,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Step 4: Commit**

```bash
cd /home/jon/repos/baal && git add apps/liberclaw/lib/api/types.ts apps/liberclaw/lib/api/templates.ts apps/liberclaw/lib/hooks/useTemplates.ts
git commit -m "feat: add TypeScript types, API functions, and hooks for templates/skills"
```

---

## Task 13: Expo App — Gallery Tab Screen

Create the gallery tab with category filters and template cards.

**Files:**
- Create: `apps/liberclaw/app/(tabs)/gallery.tsx`
- Modify: `apps/liberclaw/app/(tabs)/_layout.tsx:54-95` (add gallery tab)

**Context:** Follow the patterns in `apps/liberclaw/app/(tabs)/index.tsx` for styling (glass morphism, NativeWind classes, responsive layout). Use `useTemplates()` hook. Tab layout is at `apps/liberclaw/app/(tabs)/_layout.tsx`. Active tab color is `#ff5e00`. Surface colors: base `#0a0810`, raised `#131018`.

**Step 1: Add gallery tab to layout**

In `apps/liberclaw/app/(tabs)/_layout.tsx`, add a new `Tabs.Screen` entry between the `index` (agents) and `chat` entries. Use `MaterialIcons` name `"auto-awesome"` for the icon:

```tsx
<Tabs.Screen
  name="gallery"
  options={{
    title: "Gallery",
    tabBarIcon: ({ color }) => (
      <MaterialIcons name="auto-awesome" size={24} color={color} />
    ),
  }}
/>
```

**Step 2: Build the gallery screen**

Create `apps/liberclaw/app/(tabs)/gallery.tsx`. Key elements:

- Header: "Agent Gallery" title + subtitle
- Category filter: horizontal ScrollView with chip/pill buttons for All | Developer | Productivity | Web3
- Template grid: FlatList with 2 columns on web, 1 on mobile
- Each card: gradient border, icon, name, description, skill count badge, model badge
- Featured templates: highlighted with a small "Featured" badge
- "Create Custom" card at end of list
- Tap card → navigate to `/(tabs)/gallery/[id]` or pass params to create screen

Use the `useTemplates()` hook for data. Filter by `selectedCategory` state.

**Step 3: Verify it renders**

```bash
cd /home/jon/repos/baal/apps/liberclaw && npx expo start --web
```

Navigate to the gallery tab and verify:
- Category filter works
- Template cards render with correct data
- Tap navigates correctly

**Step 4: Commit**

```bash
cd /home/jon/repos/baal && git add apps/liberclaw/app/\(tabs\)/gallery.tsx apps/liberclaw/app/\(tabs\)/_layout.tsx
git commit -m "feat: add gallery tab to Expo app with category filters and template cards"
```

---

## Task 14: Expo App — Skill Picker on Create Screen

Add a skills checkbox section to the agent creation screen. Support pre-filling from template navigation params.

**Files:**
- Modify: `apps/liberclaw/app/agent/create.tsx` (add skills state, skill picker section, template params)

**Context:** The create screen is at `apps/liberclaw/app/agent/create.tsx:181-562`. It has 4 steps: Identity, Capabilities, Model, Review. The skill picker should be added to Step 2 (Capabilities). The screen uses `useState` for form state (line 185-188). Route params from gallery will pass `template_id`.

**Step 1: Add template param handling + skills state**

At the top of `CreateAgentScreen()` (line 181), add:

```tsx
import { useLocalSearchParams } from "expo-router";
import { useTemplate, useSkills } from "@/lib/hooks/useTemplates";

// Inside the component:
const params = useLocalSearchParams<{ template_id?: string }>();
const { data: templateData } = useTemplate(params.template_id);
const { data: skillsData } = useSkills();
const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
```

Add a `useEffect` to pre-fill from template when data loads:

```tsx
useEffect(() => {
  if (templateData) {
    setSystemPrompt(templateData.system_prompt);
    setModel(templateData.model);
    setSelectedSkills(templateData.skills);
  }
}, [templateData]);
```

**Step 2: Build SkillPicker component**

Add a component within the file (or as a separate component file at `apps/liberclaw/components/agent/SkillPicker.tsx`). Renders:

- Category headers (Developer, Productivity, Web3)
- Checkbox row per skill: toggle icon + name + description
- Grouped by category from `skillsData.skills`

Toggle logic:

```tsx
function toggleSkill(skillId: string) {
  setSelectedSkills(prev =>
    prev.includes(skillId)
      ? prev.filter(s => s !== skillId)
      : [...prev, skillId]
  );
}
```

**Step 3: Add SkillPicker to Step 2 (Capabilities)**

In the Step 2 render block (around line 390-411), add the SkillPicker below the SoulEditor (system prompt editor):

```tsx
{/* Skills Section */}
<View className="mt-6">
  <Text className="text-white text-lg font-semibold mb-3">Skills</Text>
  <Text className="text-text-secondary text-sm mb-4">
    Choose what your agent can do. Skills teach it specific workflows.
  </Text>
  <SkillPicker
    skills={skillsData?.skills ?? []}
    selected={selectedSkills}
    onToggle={toggleSkill}
  />
</View>
```

**Step 4: Pass skills in handleCreate()**

Modify `handleCreate()` (line 210-222):

```tsx
async function handleCreate(): Promise<void> {
  setError(null);
  try {
    const agent = await createAgent.mutateAsync({
      name: name.trim(),
      system_prompt: systemPrompt.trim(),
      model,
      skills: selectedSkills.length > 0 ? selectedSkills : undefined,
      template_id: params.template_id ?? undefined,
    });
    router.replace(`/agent/${agent.id}`);
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "Failed to create agent");
  }
}
```

**Step 5: Show selected skills in Review step (Step 4)**

Add a skills summary to the review screen (around line 440-481):

```tsx
{selectedSkills.length > 0 && (
  <View className="bg-surface-raised rounded-2xl p-4 mt-3">
    <Text className="text-text-secondary text-xs mb-2">SKILLS ({selectedSkills.length})</Text>
    <View className="flex-row flex-wrap gap-2">
      {selectedSkills.map(s => (
        <View key={s} className="bg-surface-base px-3 py-1 rounded-full">
          <Text className="text-white text-sm">{s}</Text>
        </View>
      ))}
    </View>
  </View>
)}
```

**Step 6: Commit**

```bash
cd /home/jon/repos/baal && git add apps/liberclaw/app/agent/create.tsx
git commit -m "feat: add skill picker to agent creation screen with template pre-fill"
```

---

## Task 15: Telegram Bot — Skill Selection in /create Wizard

Add an optional skill selection step to the Telegram bot's /create wizard.

**Files:**
- Modify: `src/baal/handlers/commands.py:28` (add SKILLS state constant)
- Modify: `src/baal/handlers/commands.py:950-994` (after model selection, go to skills)
- Add: new `create_skills_callback()` handler
- Modify: `src/baal/handlers/commands.py:1572-1613` (ConversationHandler — add SKILLS state)
- Modify: deploy functions to pass skills

**Context:** The ConversationHandler states are at line 28: `NAME, PROMPT, MODEL, CONFIRM = range(4)`. The wizard flow is NAME → MODEL → CONFIRM. We add SKILLS between MODEL and CONFIRM.

**Step 1: Add SKILLS state constant**

At `src/baal/handlers/commands.py:28`, change:

```python
NAME, PROMPT, MODEL, CONFIRM = range(4)
```

to:

```python
NAME, PROMPT, MODEL, SKILLS, CONFIRM = range(5)
```

**Step 2: Modify model selection to show skills**

After model is selected in `create_model_callback()` (line 950-994), instead of going to CONFIRM, show a skill selection message with inline keyboard:

```python
# Show skill categories with toggle buttons
from baal_core.templates.loader import list_skills

all_skills = list_skills()
# Group by category
categories = {}
for s in all_skills:
    categories.setdefault(s["category"], []).append(s)

# Build inline keyboard: one row per skill with checkbox emoji
buttons = []
selected = context.user_data.get("create_skills", [])
for cat_name, cat_skills in categories.items():
    buttons.append([InlineKeyboardButton(f"── {cat_name.title()} ──", callback_data="noop")])
    for s in cat_skills:
        check = "✅" if s["id"] in selected else "⬜"
        buttons.append([InlineKeyboardButton(
            f"{check} {s['name']}",
            callback_data=f"skill_toggle:{s['id']}"
        )])

buttons.append([
    InlineKeyboardButton("Skip (no skills)", callback_data="skills_skip"),
    InlineKeyboardButton("Done ✓", callback_data="skills_done"),
])

await query.edit_message_text(
    "Select skills for your agent (tap to toggle):",
    reply_markup=InlineKeyboardMarkup(buttons),
)
return SKILLS
```

**Step 3: Add skill toggle + done handlers**

Add `create_skills_callback()` to handle `skill_toggle:*`, `skills_skip`, and `skills_done` callbacks:

- `skill_toggle:{id}` → toggle skill in `context.user_data["create_skills"]`, re-render buttons
- `skills_skip` → clear skills, go to CONFIRM
- `skills_done` → go to CONFIRM with selected skills

**Step 4: Pass skills to deploy functions**

In `_deploy_agent_fast()` (line ~1069) and `_deploy_agent_background()` (line ~1090), read `context.user_data.get("create_skills", [])` and pass to `deployer.deploy_agent()` as `skills=`.

**Step 5: Update ConversationHandler**

At `src/baal/handlers/commands.py:1572-1613`, add `SKILLS` state with the callback handler.

**Step 6: Commit**

```bash
git add src/baal/handlers/commands.py
git commit -m "feat: add skill selection step to Telegram /create wizard"
```

---

## Task 16: End-to-End Verification

Verify the full flow works: browse gallery → pick template → customize skills → deploy → verify skills on VM.

**Files:** None (testing only)

**Step 1: Start the LiberClaw API**

```bash
cd /home/jon/repos/baal && uvicorn liberclaw.main:app --port 8000
```

**Step 2: Test API endpoints**

```bash
# List templates
curl -s http://localhost:8000/api/v1/templates/ | python -m json.tool

# Get template detail
curl -s http://localhost:8000/api/v1/templates/full-stack-dev | python -m json.tool

# List skills
curl -s http://localhost:8000/api/v1/skills/ | python -m json.tool

# Get skill detail
curl -s http://localhost:8000/api/v1/skills/git | python -m json.tool
```

Verify: 3 categories, 14 templates, 20 skills returned correctly.

**Step 3: Test agent creation with template**

```bash
# Create agent from template with skill override
curl -s -X POST http://localhost:8000/api/v1/agents/ \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Dev","template_id":"full-stack-dev","skills":["git","python-dev"]}' \
  | python -m json.tool
```

Verify: agent has `skills: ["git", "python-dev"]`, system_prompt from template, model from template.

**Step 4: Test Expo app gallery**

```bash
cd /home/jon/repos/baal/apps/liberclaw && npx expo start --web
```

Verify:
- Gallery tab shows categories and templates
- Tapping a template navigates to create with pre-filled values
- Skill picker shows all 20 skills grouped by category
- Pre-checked skills match template
- Toggling skills works
- Creating an agent sends correct data

**Step 5: Test deployed agent has skills**

After a test agent deploys, SSH into the VM and verify:

```bash
# Check skills directory on agent VM
ls /opt/baal-agent/workspace/skills/
# Should show only the selected skill directories

# Check a skill file
cat /opt/baal-agent/workspace/skills/git/SKILL.md
# Should contain the full skill content
```

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in end-to-end testing"
```
