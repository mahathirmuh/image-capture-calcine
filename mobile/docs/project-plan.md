# Mobile Project Plan

## Objective

Ship a production-ready operator mobile app for Capture Calcine using the existing backend and OpenAPI contract wherever possible.

## Current Scope

The mobile app is for plant operators only. Current intended workflows:
- sign in with persistent session restore
- review today sessions
- run camera capture tasks
- review recent captures and capture detail
- inspect assigned device status
- adjust lightweight operator settings

Out of scope for the current mobile phase:
- admin user management
- cross-plant reporting dashboards
- fleet-wide device registry management
- complex supervisor workflows

## Existing Assets

- backend REST API documented in `docs/openapi.yaml`
- web/backend code in `src/`
- mobile React + Capacitor shell in `mobile/`
- MSSQL schema and migration scripts in `db/mssql/`

## Delivery Goals

1. Make each mobile menu functional against real backend data
2. Keep operator flows compact and field-friendly
3. Preserve long-lived mobile sessions
4. Minimize backend divergence from the existing contract

## Success Criteria

- mobile login and session restore work reliably
- each bottom-nav menu has a defined data contract
- verification evidence exists per roadmap phase
- mobile docs and code stay synchronized
