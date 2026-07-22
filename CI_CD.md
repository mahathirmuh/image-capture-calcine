# CI/CD Workflow

This repository now includes a GitHub Actions pipeline at `.github/workflows/ci-cd.yml`.

## Stages

The workflow follows the required stage order:

1. `lint`
2. `test`
3. `build`
4. `deploy`

## Triggers

- `pull_request`: runs `lint`, `test`, and `build`
- `push` to `main`: runs the full pipeline
- `workflow_dispatch`: allows manual execution of the pipeline

## What Each Stage Does

### Lint

- Installs dependencies with `bun install --frozen-lockfile`
- Runs `bun run lint`

### Test

- Runs after `lint`
- Executes `bun test`

### Build

- Runs after `test`
- Executes `bun run build`
- Verifies the Docker image can be built with:

```bash
docker build -t image-capture-calcine:ci .
```

### Deploy

- Runs after `build`
- Only applies to `push` / `workflow_dispatch`, never on pull requests
- Connects to the deployment host over SSH
- Updates the checked-out repository on the server
- Rebuilds and restarts the stack using Docker Compose

The deploy stage is intentionally gated. If the required secrets are not configured,
the job is skipped instead of failing.

## Required GitHub Secrets

Configure these repository or environment secrets before enabling production deploys:

- `DEPLOY_HOST`: hostname or IP of the deployment server
- `DEPLOY_USER`: SSH user used for deployment
- `DEPLOY_SSH_KEY`: private SSH key for the deploy user
- `DEPLOY_KNOWN_HOSTS`: pinned `known_hosts` entry for the target server
- `DEPLOY_PATH`: absolute path to the checked-out repository on the server

## Remote Server Expectations

The deployment server is expected to have:

- Git installed
- Docker and Docker Compose available
- This repository already cloned at `DEPLOY_PATH`
- Access to the required `.env` / runtime configuration

## Default Remote Deploy Command

The workflow currently runs this remote sequence:

```bash
cd "$DEPLOY_PATH"
git pull --ff-only origin main
docker compose up -d --build --remove-orphans
```

## Hardening Notes

- `DEPLOY_KNOWN_HOSTS` is required so SSH host verification stays explicit
- Use a least-privilege deploy user
- Store only production secrets in GitHub Secrets or protected environments
- Consider adding monitoring/alerting on the target host after deploy
