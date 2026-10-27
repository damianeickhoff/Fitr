# Running FITR on Unraid

The image is the ordinary one built from the `Dockerfile` at the repo root;
nothing here changes it. Two facts drive what follows:

- **The container runs as uid 1000**, not Unraid's `nobody:users` (99:100), so
  the appdata directory has to be chowned before the first start.
- **Unraid pulls before it creates**, so the template's `Repository` must be
  something `docker pull` can resolve — a locally built `fitr:latest` is not.

## 1. Getting the image onto the box

### Option A — CI pushes to GHCR (recommended)

`.github/workflows/publish.yml` builds and pushes on every push, so a merge to
`main` produces a new `ghcr.io/damianeickhoff/fitr:latest` with nothing to
configure.

| Pushed | Tags |
| --- | --- |
| `main` | `latest`, `main`, `sha-<short>` |
| any other branch | `<branch>` (slashes become dashes), `sha-<short>` |
| a `v*` tag | that version, `sha-<short>` |

A branch never becomes `latest`, so pointing the template at a branch tag is a
safe way to try something before merging it.

The package is **private on its first push**. Either make it public at
`https://github.com/users/damianeickhoff/packages/container/fitr/settings`, or
run `docker login ghcr.io` on the Unraid box with a `read:packages` token —
Unraid keeps `/root/.docker/config.json` on the flash drive, so the login
survives a reboot.

Unraid's update check compares digests against the registry, and works only
because the workflow publishes a plain Docker manifest (see the comment on the
build step). If the Version column ever reads "not available", this is the test:

```bash
curl -sI -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' https://ghcr.io/v2/damianeickhoff/fitr/manifests/latest
```

A `200` with a `docker-content-digest` header means the registry is fine and the
problem is Unraid's cache. (A private package answers `401` without a token.)

### Option B — push by hand

```bash
docker build -t ghcr.io/damianeickhoff/fitr:latest .
```

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u damianeickhoff --password-stdin && docker push ghcr.io/damianeickhoff/fitr:latest
```

The token needs `write:packages` (GitHub → Settings → Developer settings →
Tokens (classic)).

### Option C — build on Unraid

Images live in the Docker data root on the cache pool, so one built on the box
persists like a pulled one; the root filesystem is tmpfs, so the *source* goes
on a share, never `/root` or `/tmp`. `git` isn't in stock Unraid (NerdTools has
it) — copying the tree over SMB is easier, minus `node_modules`, `.next` and
`data`. Then build, and since the template can't pull a local tag, run
`registry:2` from Community Applications and push to it:

```bash
cd /mnt/user/appdata/fitr-src && docker build -t localhost:5000/fitr:latest . && docker push localhost:5000/fitr:latest
```

Point `Repository` at `localhost:5000/fitr:latest`.

## 2. Prepare the data directory

**Before the first start.** If `/data` isn't writable the migrations fail on
their first action and the container restart-loops with `EACCES`.

```bash
mkdir -p /mnt/user/appdata/fitr && chown -R 1000:1000 /mnt/user/appdata/fitr
```

It holds `fitr.db` (SQLite) and `uploads/` (every photo). SQLite over Unraid's
`shfs` FUSE layer has a history of locking trouble, so keep the appdata share
**cache-only with no mover pass** — or point the host path at
`/mnt/cache/appdata/fitr` to bypass FUSE, and then never move it to the array.

## 3. Install the template

Copy `fitr.xml` to the flash drive as
`/boot/config/plugins/dockerMan/templates-user/my-FITR.xml`, then Docker →
**Add Container** → Template → **FITR** under user templates.

| Variable | |
| --- | --- |
| `AUTH_SECRET` | Required. `openssl rand -base64 48`. Changing it later signs everyone out. |
| `GEMINI_API_KEY` | Free from https://aistudio.google.com/apikey. Tagging, outfits and shop tips; the app runs without it. |
| `OPENAI_API_KEY` | Optional and paid: studio photos and try-on. |

The rest sit under "Show more settings" and are described inline. The host port
defaults to 3320 to stay clear of the usual 3000; change it freely.

Unraid sets `TZ` on every container. Keep it right: a wear is logged against
the server's day, so a wrong zone files late-evening wears under tomorrow.

A healthy first start in the log (Docker tab → FITR → Logs):

```
Applying database migrations…
...
11 migrations found in prisma/migrations
All migrations have been successfully applied.
▲ Next.js 16.4.1
✓ Ready
```

Later starts find nothing to migrate and say so. Then open the WebUI and create
an account.

**Sign-up is open to anyone who can reach the page.** On the LAN that's your
household; behind a public proxy, create your accounts and then keep the
instance off the open internet (or behind your proxy's own auth).

## Which build am I running?

```bash
curl -s http://tower:3320/api/health
```

→ `{"ok":true,"version":"6aa9ecf"}`, no session needed. The version is the
commit in the `sha-<short>` tag; it's also at the bottom of the Me page. A
hand-built image says `dev` unless built with
`--build-arg APP_VERSION=$(git rev-parse HEAD)`.

## 4. Reverse proxy and HTTPS

Point the proxy at `http://<unraid-ip>:3320`. HTTPS is what makes the phone
side work fully:

- **Add to Home Screen** as an app and the offline page need a service worker,
  which only runs in a secure context.
- **Send to ChatGPT** opens the phone's share menu only over HTTPS; on plain
  HTTP it falls back to copying the prompt and downloading a collage.

Allow request bodies of at least **16 MB**: a phone photo the browser can't
shrink is sent as the original. nginx-based proxies (SWAG, Nginx Proxy Manager)
default to 1 MB — set `client_max_body_size 20m;`.

## 5. Backups

All state is in the appdata directory: `fitr.db` and `uploads/`. The **Appdata
Backup** plugin stops the container first, so its copy is consistent; any other
method should stop it too, or risk copying the database mid-write.
