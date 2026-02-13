# Task Planning

Break goals into actionable steps, track progress, and manage priorities with persistent files.

## Planning Workflow

### 1. Clarify the Goal
Ask: What does "done" look like? Identify deliverables, deadlines, and constraints.

### 2. Break It Down
Decompose into tasks that are:
- **Specific**: "Write user auth endpoint" not "Do backend work"
- **Small enough**: Each completable in one focused session
- **Ordered**: Dependencies are clear -- what blocks what?

### 3. Create a TODO File
```
write_file: workspace/TODO.md
---
# Project: [Name]
Goal: [One-line description of the end state]
Started: [Date]

## High Priority
- [ ] Task 1 -- why it's critical
- [ ] Task 2 -- why it's critical

## Medium Priority
- [ ] Task 3
- [ ] Task 4

## Low Priority / Nice to Have
- [ ] Task 5
- [ ] Task 6

## Completed
- [x] Task 0 -- done [date]
---
```

### 4. Track Progress
Use `edit_file` to update status as work proceeds:
```
edit_file: workspace/TODO.md
old: - [ ] Task 1 -- why it's critical
new: - [x] Task 1 -- done 2024-06-15
```

Move completed items to the Completed section periodically to keep the active list short.

## Priority Framework

| Level | Criteria | Action |
|---|---|---|
| **High** | Blocks other work, deadline soon, core requirement | Do first |
| **Medium** | Important but not blocking, no immediate deadline | Schedule this week |
| **Low** | Nice to have, exploratory, non-critical improvement | Do if time allows |

## Project Milestones

For larger projects, define milestones to measure progress:
```
## Milestones
1. **MVP** (target: June 20) -- Core features working end-to-end
   - [x] Database schema
   - [x] API endpoints
   - [ ] Basic frontend
2. **Beta** (target: July 5) -- Ready for test users
   - [ ] Auth flow
   - [ ] Error handling
   - [ ] Deploy to staging
```

## Daily Planning

Create a daily plan file when the user starts a work session:
```
write_file: memory/2024-06-15.md
---
# Plan for Today

## Must Do
- [ ] Finish API endpoint for /users
- [ ] Fix bug #42

## Should Do
- [ ] Write tests for auth module

## Blockers
- Waiting on design specs for settings page

## End-of-Day Review
(fill in at end of session)
---
```

Review yesterday's file at session start to pick up where you left off.

## Tips

- Keep TODO files in the workspace root for easy access
- Save long-term project plans in `memory/MEMORY.md` under a Projects section
- When a task keeps getting deferred, ask: is it actually needed, or should it be cut?
- If a task is vague, break it down further before starting
- Re-prioritize after completing milestones -- priorities shift as projects evolve
- Use `list_dir` to check for existing TODO files before creating a new one
