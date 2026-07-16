# syntax=docker/dockerfile:1

# ---- Build stage ------------------------------------------------------------
# Bun matches the repo's lockfile (bun.lock) and bunfig.toml, so the install
# here resolves exactly what's committed rather than re-resolving via npm.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

# Install deps first, as their own layer -- this is only invalidated when the
# manifest/lockfile change, so ordinary source edits reuse the cached install.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

# Vite's `build` needs to produce the Node server output (.output/server/index.mjs).
# The preset default already targets node-server; NITRO_PRESET can override it.
RUN bun run build

# ---- Runtime stage ----------------------------------------------------------
# Nitro's node-server output is self-contained (it bundles/inlines what it
# needs), so the runtime image carries only .output + Node -- no source, no
# full node_modules, no build toolchain.
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Nitro's node-server listens on PORT/HOST. 0.0.0.0 so the port is reachable
# from outside the container, not just its loopback.
ENV PORT=3000
ENV HOST=0.0.0.0

# Run as the image's built-in unprivileged user rather than root.
COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

# Fails the container's health status if the app stops serving. Uses Node
# itself, so no extra package (curl/wget) is needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/capture').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
