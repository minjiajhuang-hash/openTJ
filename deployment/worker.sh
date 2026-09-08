#!/bin/sh
set -eu
cd "$(dirname "$0")/tasks"
exec node --import ../runtime-env.mjs --import tsx src/worker.ts "$@"
