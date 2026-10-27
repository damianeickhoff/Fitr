#!/bin/sh
set -e

# The database belongs to the deployment, not the image: bring it up to this
# image's schema, then hand over. A no-op on an up-to-date volume; on an empty
# one it creates the database from nothing.
echo "Applying database migrations…"
node /opt/prisma/node_modules/prisma/build/index.js migrate deploy

exec "$@"
