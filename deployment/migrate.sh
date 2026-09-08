#!/bin/sh
set -eu
cd "$(dirname "$0")/tasks"
node --import ../load-env.mjs node_modules/prisma/build/index.js migrate deploy
exec node --import ../load-env.mjs --import tsx prisma/seed.ts
