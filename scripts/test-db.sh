#!/usr/bin/env bash
# Testa as migrations e as políticas de segurança num PostgreSQL descartável.
#
# Uso:
#   PGHOST=... PGPORT=... PGUSER=postgres ./scripts/test-db.sh
#
# Requer um PostgreSQL 15+ local (superusuário). Cria o banco "adega_test",
# aplica um ambiente mínimo do Supabase, todas as migrations e os testes, e
# apaga o banco ao final. Nunca rode contra o banco de produção.
set -euo pipefail

DB="${TEST_DB_NAME:-adega_test}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB};" -c "create database ${DB};"
trap 'psql -q -d postgres -c "drop database if exists ${DB};" >/dev/null 2>&1 || true' EXIT

psql -v ON_ERROR_STOP=1 -q -d "${DB}" -f "${ROOT}/supabase/tests/supabase-stub.sql"
for f in "${ROOT}"/supabase/migrations/*.sql; do
  echo "→ aplicando $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -d "${DB}" -f "$f"
done
echo "→ executando testes"
psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${ROOT}/supabase/tests/security.test.sql"
