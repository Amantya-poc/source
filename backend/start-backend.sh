#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ -z "${JAVA_HOME:-}" ] && [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if ss -tln 2>/dev/null | grep -q ':8081 '; then
  echo "Port 8081 is in use. Stopping old backend process..."
  fuser -k 8081/tcp 2>/dev/null || true
  sleep 1
fi

if ! pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL is not running. Start it first:"
  echo "  ./start-postgres.sh"
  exit 1
fi

echo "Starting Spring Boot backend on http://localhost:8081 ..."
mvn spring-boot:run
