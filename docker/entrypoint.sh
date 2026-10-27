#!/bin/sh
set -e

# Started as root only to make /data the app's own. Unraid creates appdata
# folders as root, and files copied in over SMB arrive as nobody:users, so
# expecting a manual `chown 1000` beforehand made a first start fail with
# "unable to open database file". Only what isn't node's yet is touched, so a
# later start is quick. Then the same script runs again without root.
if [ "$(id -u)" = "0" ]; then
  find /data \! -user node -exec chown node:node {} +
  exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi

# Started as some other user (`--user`), there is nothing to fix: say so plainly
# rather than leave SQLite's message as the only clue.
if [ ! -w /data ]; then
  echo "/data is not writable by uid $(id -u). Make the host folder writable by that user." >&2
  exit 1
fi

# The database belongs to the deployment, not the image: bring it up to this
# image's schema, then hand over. A no-op on an up-to-date volume; on an empty
# one it creates the database from nothing.
echo "Applying database migrations…"
node /opt/prisma/node_modules/prisma/build/index.js migrate deploy

exec "$@"
