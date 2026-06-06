#!/bin/sh
set -e

PB_DATA=/pb/pb_data

R2_CONFIGURED=false
if [ -n "$CF_R2_ACCESS_KEY_ID" ] && [ -n "$CF_R2_SECRET_ACCESS_KEY" ] && \
   [ -n "$CF_R2_BUCKET" ] && [ -n "$CF_R2_ACCOUNT_ID" ]; then
  R2_CONFIGURED=true
  ENDPOINT="https://${CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
fi

r2() {
  AWS_ACCESS_KEY_ID="$CF_R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$CF_R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION=auto \
  aws s3 "$@" --endpoint-url "$ENDPOINT"
}

echo "==> Disk contents at startup:"
ls -lh "$PB_DATA" 2>/dev/null || echo "    (empty or missing)"

if [ -f "$PB_DATA/data.db" ]; then
  echo "==> Existing database found ($(wc -c < "$PB_DATA/data.db") bytes)"

  # Back up the live database to R2 before starting so data survives any
  # future disk loss. Safe to copy raw because PocketBase isn't running yet.
  if $R2_CONFIGURED; then
    BACKUP_NAME="startup-$(date -u +%Y%m%d-%H%M%S).db"
    echo "==> Backing up to R2: $BACKUP_NAME"
    r2 cp "$PB_DATA/data.db" "s3://${CF_R2_BUCKET}/$BACKUP_NAME" \
      && echo "==> Backup complete" \
      || echo "==> R2 backup failed (non-fatal, continuing)"
  fi

else
  echo "==> No database found"

  if $R2_CONFIGURED; then
    echo "==> Looking for latest backup in R2..."
    LATEST=$(r2 ls "s3://${CF_R2_BUCKET}/" 2>/dev/null \
      | grep '\.db$' | sort | tail -n1 | awk '{print $4}')

    if [ -n "$LATEST" ]; then
      echo "==> Restoring from: $LATEST"
      mkdir -p "$PB_DATA"
      r2 cp "s3://${CF_R2_BUCKET}/$LATEST" "$PB_DATA/data.db"
      echo "==> Restore complete ($(wc -c < "$PB_DATA/data.db") bytes)"
    else
      echo "==> No backups in R2, starting fresh"
    fi
  else
    echo "==> R2 not configured, starting fresh"
  fi
fi

exec /pb/pocketbase serve \
  --http="0.0.0.0:${PORT:-10000}" \
  --dir="$PB_DATA" \
  --migrationsDir=/pb/pb_migrations
