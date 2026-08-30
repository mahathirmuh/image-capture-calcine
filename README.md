# Capture Calcine

Operator-focused sampling capture system with:
- existing TanStack web application and backend API
- mobile operator app in `mobile/` built with React + Vite + Capacitor
- MSSQL-backed operational data and authentication

## Repository Layout

- `src/` — main web app and backend server
- `mobile/` — operator mobile app
- `docs/` — source-of-truth documentation
- `db/mssql/` — schema and migration SQL
- `scripts/` — operational and maintenance scripts

## Source Of Truth

For mobile implementation work, use these documents first:
- `mobile/docs/project-plan.md`
- `mobile/docs/product-principles.md`
- `mobile/docs/functional-specification.md`
- `mobile/docs/technical-implementation-plan.md`
- `mobile/docs/database-schema-specification.md`
- `mobile/docs/implementation-roadmap.md`
- `mobile/docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

For mobile-specific execution discipline, also use:
- `mobile/AGENTS.md`

## Current Product Direction

The active mobile scope is an internal operator app for:
- login and long-lived session restore
- today sessions checklist
- camera capture flow
- recent captures and capture detail
- assigned device status
- lightweight operator settings

## Safe Start

Web/backend:

```bash
npm install
npm run build
```

Mobile:

```bash
npm install --prefix ./mobile
npm run dev:mobile
```

Capacitor debug APK:

```bash
npm run dev:capacitor
```

Database migrations:

```bash
npm run db:migrate
```

## Working Method

1. Read `mobile/docs/implementation-roadmap.md`
2. Identify the active phase
3. Read the source docs referenced by that phase
4. Implement only the checklist items for that phase
5. Run verification and record evidence
6. Update docs before declaring completion
