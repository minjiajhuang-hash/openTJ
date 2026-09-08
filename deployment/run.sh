#!/bin/sh
set -eu
cd "$(dirname "$0")/web"
exec node --import ../runtime-env.mjs server.js
