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
