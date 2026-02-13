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
