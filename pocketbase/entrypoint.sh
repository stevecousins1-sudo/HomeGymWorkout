#!/bin/sh
set -e

PB_DATA=/pb/pb_data

if [ ! -f "$PB_DATA/data.db" ]; then
  echo "==> pb_data/data.db not found"

  if [ -n "$CF_R2_ACCESS_KEY_ID" ] && [ -n "$CF_R2_SECRET_ACCESS_KEY" ] && \
     [ -n "$CF_R2_BUCKET" ] && [ -n "$CF_R2_ACCOUNT_ID" ]; then

    echo "==> R2 credentials found, looking for latest backup..."
    ENDPOINT="https://${CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    LATEST=$(AWS_ACCESS_KEY_ID="$CF_R2_ACCESS_KEY_ID" \
              AWS_SECRET_ACCESS_KEY="$CF_R2_SECRET_ACCESS_KEY" \
              AWS_DEFAULT_REGION=auto \
              aws s3 ls "s3://${CF_R2_BUCKET}/" \
                --endpoint-url "$ENDPOINT" 2>/dev/null \
              | sort | tail -n1 | awk '{print $4}')

    if [ -n "$LATEST" ]; then
      echo "==> Restoring from backup: $LATEST"
      AWS_ACCESS_KEY_ID="$CF_R2_ACCESS_KEY_ID" \
      AWS_SECRET_ACCESS_KEY="$CF_R2_SECRET_ACCESS_KEY" \
      AWS_DEFAULT_REGION=auto \
      aws s3 cp "s3://${CF_R2_BUCKET}/${LATEST}" /tmp/restore.zip \
        --endpoint-url "$ENDPOINT"

      unzip -q /tmp/restore.zip -d "$PB_DATA"
      rm /tmp/restore.zip
      echo "==> Restore complete"
    else
      echo "==> No backups found in R2, starting fresh"
    fi
  else
    echo "==> R2 not configured, starting fresh"
  fi
else
  echo "==> Existing database found, no restore needed"
fi

exec /pb/pocketbase serve \
  --http="0.0.0.0:${PORT:-10000}" \
  --dir="$PB_DATA" \
  --migrationsDir=/pb/pb_migrations
