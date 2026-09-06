#!/bin/sh
set -eu

node scripts/check-env.mjs

echo "Applying database migrations..."
npm run db:migrate

echo "Applying the idempotent base seed..."
npm run db:seed
