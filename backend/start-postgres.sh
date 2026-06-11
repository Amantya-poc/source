#!/usr/bin/env bash
set -euo pipefail

PORT=5432
DB=drdo_poc
USER=postgres
export PGPASSWORD=postgres

echo "Starting PostgreSQL service..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl start postgresql 2>/dev/null || sudo systemctl start postgresql
fi

for i in $(seq 1 30); do
  if pg_isready -h localhost -p "$PORT" -U "$USER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! pg_isready -h localhost -p "$PORT" -U "$USER" >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL is not accepting connections on localhost:$PORT"
  exit 1
fi

psql -h localhost -p "$PORT" -U "$USER" -tc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 \
  || createdb -h localhost -p "$PORT" -U "$USER" "$DB"

psql -h localhost -p "$PORT" -U "$USER" -d "$DB" -c \
  "ALTER TABLE IF EXISTS public.plans ADD COLUMN IF NOT EXISTS distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0;" \
  >/dev/null 2>&1 || true

echo "PostgreSQL ready on localhost:$PORT (database: $DB)"
echo "Press Ctrl+C to stop watching. PostgreSQL keeps running as a system service."

while true; do
  if pg_isready -h localhost -p "$PORT" -U "$USER" >/dev/null 2>&1; then
    sleep 30
  else
    echo "WARNING: PostgreSQL stopped. Attempting restart..."
    systemctl start postgresql 2>/dev/null || sudo systemctl start postgresql || true
    sleep 2
  fi
done
