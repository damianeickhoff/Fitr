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


# --- native packages ---------------------------------------------------------
# The heavy, rarely changing part of the runtime: the background-removal model
# (~128MB), onnxruntime and libvips. Taken from `deps`, which only reruns when
# the lockfile changes, so their layer keeps its digest across commits and an
# update doesn't download it again. Inside the app's own layer they came along
# with every change to a component.
#
# Linux x64 only: the other platforms' binaries are pruned here, which is why
# the publish workflow builds linux/amd64 alone.
FROM deps AS natives
RUN mkdir -p /natives/@imgly \
  && cp -a node_modules/@imgly/background-removal-node /natives/@imgly/ \
  && rm -rf /natives/@imgly/background-removal-node/node_modules/@types \
  && cp -a node_modules/onnxruntime-node node_modules/onnxruntime-common node_modules/@img /natives/ \
  && rm -rf /natives/onnxruntime-node/bin/napi-v3/darwin \
            /natives/onnxruntime-node/bin/napi-v3/win32 \
            /natives/onnxruntime-node/bin/napi-v3/linux/arm64 \
            /natives/onnxruntime-node/script


# --- build -------------------------------------------------------------------
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

ENV DATABASE_URL="file:/tmp/build.db"
ENV NODE_ENV=production

# `next build` directly: the `prebuild` script would generate the client again.
RUN npx next build

# Split the traced output into layers by how often they change. The packages
# `natives` supplies come out, and the rest of the traced dependencies get a
# layer of their own: they only change when an import does, while the server
# code changes with every commit.
RUN cd .next/standalone/node_modules \
  && rm -rf @imgly onnxruntime-node onnxruntime-common @img \
  && mv /app/.next/standalone/node_modules /app/traced-modules


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

# The app runs as `node` (uid 1000), so a compromise inside it cannot write to
# the image itself. The entrypoint starts as root just long enough to hand
# /data to node, since a host folder rarely arrives owned by 1000.
RUN mkdir -p /data && chown -R node:node /data

# From here on, least-often-changed first. Docker reuses a layer only while
# every layer under it is unchanged, so one early layer that changes with each
# commit makes an update download everything above it again.

# Migrations run at startup. The CLI lives outside /app so its `node_modules`
# cannot shadow the traced ones the server resolves. Changes with its version.
COPY --from=migrator --chown=node:node /opt/prisma/node_modules /opt/prisma/node_modules
# Changes with the lockfile.
COPY --from=natives --chown=node:node /natives ./node_modules
# Changes when an import does.
COPY --from=build --chown=node:node /app/traced-modules ./node_modules
# Changes with every commit: the server, its pages, the schema.
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node docker/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node --chmod=755 docker/entrypoint.sh ./entrypoint.sh

# What this build is, for the app to report about itself (`src/lib/version.ts`).
# Late on purpose: earlier, a new commit would invalidate the Next build cache
# for a value the build never reads.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

EXPOSE 3000
VOLUME ["/data"]

# Node's own fetch, as slim Debian has neither curl nor wget. The start period
# covers the migrations, which run before the server binds.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
