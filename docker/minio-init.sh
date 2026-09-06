#!/bin/sh
set -eu

: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is required}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is required}"

attempt=1
until mc alias set opentj "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" \
  && mc ready opentj; do
  if [ "${attempt}" -ge 30 ]; then
    echo "MinIO did not become ready after ${attempt} attempts." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done
mc mb --ignore-existing "opentj/${S3_BUCKET}"
mc anonymous set none "opentj/${S3_BUCKET}"

echo "Private object bucket ${S3_BUCKET} is ready."
