# AGENTS.md

## Purpose

This repository contains both the main app/backend and the operator mobile app.
Use `mobile/docs/` as the source of truth for mobile implementation work, and `docs/openapi.yaml` as the backend contract reference.

## Entry Documents

- `README.md`
- `mobile/docs/project-plan.md`
- `mobile/docs/product-principles.md`
- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/database-schema-specification.md`
- `mobile/docs/implementation-roadmap.md`
- `mobile/docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

For work inside `mobile/`, also follow:
- `mobile/AGENTS.md`

## Core Rules

1. Do not implement from assumption when documentation exists.
2. Every backend contract change must include an explicit `docs/openapi.yaml` review.
3. Do not mark work complete without verification evidence.
4. Keep roadmap and docs synchronized with the codebase.

## Standard Sequence

1. Identify the active phase in `mobile/docs/implementation-roadmap.md`
2. Read the source documents listed in that phase
3. Call out ambiguity before implementation
4. Implement the checklist items only
5. Run verification and record evidence
6. Update roadmap and related docs

## Mobile Scope Reminder

The mobile app is operator-only. Do not add admin or supervisor workflows unless the user explicitly expands scope.
