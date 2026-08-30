# Mobile Database Schema Specification

## Purpose

This document captures the backend data structures that directly affect mobile operator workflows.

## Source Of Truth

- `db/mssql/create_app_users.sql`
- `db/mssql/add_app_users_plant.sql`
- `db/mssql/create_api_refresh_sessions.sql`
- `docs/openapi.yaml`

## Tables Relevant To Mobile

### `dbo.app_users`

Used by mobile login and identity restoration.

Relevant fields:
- `id`
- `username`
- `full_name`
- `email`
- `password_hash`
- `role`
- `plant`
- `is_active`
- `last_login_at`

### `dbo.app_api_refresh_sessions`

Used for long-lived mobile session persistence.

Relevant fields:
- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `last_used_at`
- `revoked_at`
- `created_at`
- `updated_at`

## Registry Data Used By Mobile

The mobile app also depends on existing capture/device registry data exposed through API endpoints documented in `docs/openapi.yaml`, especially:
- captures
- sessions
- devices
- camera jobs

## Current Limitation

This document describes only schema that is directly relevant to mobile authentication and operator workflows. If mobile starts writing new domain data, extend this document in the same work item.
