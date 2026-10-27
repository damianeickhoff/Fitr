# syntax=docker/dockerfile:1

# FITR, as an image.
#
# Multi-stage for one reason: what it takes to *build* this — a C toolchain for
# better-sqlite3, the whole dev dependency tree, the source — is not needed to
# run it. The runtime stage is the traced server, its dependencies, the
# migration CLI and nothing else.
#
# Debian slim rather than Alpine: background removal runs on onnxruntime-node,
# which ships glibc binaries only and has no musl build to fall back on. An
# Alpine image builds clean and then fails the first cut-out.

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app


# --- dependencies ------------------------------------------------------------
# Cached on the lockfile alone: editing a component reinstalls nothing.
FROM base AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# `--ignore-scripts` is aimed at Prisma's `postinstall` (the schema is not here
# yet) and onnxruntime-node's, which fetches GPU libraries a CPU box never
# loads. It is not selective, though: it also skips better-sqlite3's install,
# which is what provides the native binding. Without this the server starts and
# every query dies with "Could not locate the bindings file".
RUN npm rebuild better-sqlite3

COPY prisma ./prisma
COPY prisma.config.ts ./

# `prisma.config.ts` reads DATABASE_URL when it loads. Nothing is opened here;
# the real one is set at run time.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate


# --- migration CLI -----------------------------------------------------------
# Its own install in its own prefix, for `migrate deploy` at startup, so the
# runtime gets the CLI without the app's whole production tree.
FROM base AS migrator
WORKDIR /opt/prisma
RUN npm install --no-save --no-audit --no-fund prisma@7.10.0

# Prisma Studio's browser UI, which a container never serves. The packages
# holding it stay: the CLI resolves `@prisma/studio-core/data/bff` and
# `@prisma/dev/internal/state` on its way to `migrate deploy`.
RUN rm -rf \
      node_modules/@prisma/studio-core/dist/ui \
      node_modules/@prisma/studio-core/dist/metafile-cjs.json \
      node_modules/@prisma/studio-core/dist/metafile-esm.json \
      node_modules/@electric-sql \
      node_modules/elkjs \
      node_modules/react-dom


# --- build -------------------------------------------------------------------
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

ENV DATABASE_URL="file:/tmp/build.db"
ENV NODE_ENV=production

# `next build` directly: the `prebuild` script would generate the client again.
RUN npx next build


# --- runtime -----------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Everything the app keeps lives under /data: mount a volume there, or the
# wardrobe goes with the container.
ENV DATABASE_URL="file:/data/fitr.db"
ENV UPLOADS_DIR="/data/uploads"

# Prisma's CLI probes for OpenSSL on every start and warns twice without it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# `node` (uid 1000) exists in the base image; running as it means a compromise
# inside the app cannot write to the image itself.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Native binaries for platforms this image never runs on: it is glibc on x64.
# Removing sharp's musl and wasm builds and onnxruntime's other platforms is
# why the publish workflow builds linux/amd64 only.
RUN rm -rf \
      ./node_modules/@img/sharp-libvips-linuxmusl-x64 \
      ./node_modules/@img/sharp-linuxmusl-x64 \
      ./node_modules/@img/sharp-wasm32 \
      ./node_modules/onnxruntime-node/bin/napi-v3/darwin \
      ./node_modules/onnxruntime-node/bin/napi-v3/win32 \
      ./node_modules/onnxruntime-node/bin/napi-v3/linux/arm64

# Migrations run at startup. The CLI lives outside /app so its `node_modules`
# cannot shadow the traced ones the server resolves.
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node docker/prisma.config.ts ./prisma.config.ts
COPY --from=migrator --chown=node:node /opt/prisma/node_modules /opt/prisma/node_modules
COPY --chown=node:node docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# What this build is, for the app to report about itself (`src/lib/version.ts`).
# Late on purpose: earlier, a new commit would invalidate the Next build cache
# for a value the build never reads.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

USER node
EXPOSE 3000
VOLUME ["/data"]

# Node's own fetch, as slim Debian has neither curl nor wget. The start period
# covers the migrations, which run before the server binds.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
