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
