#!/usr/bin/env bash
# Backup restore test: decrypt the backup with the restore-test key, restore it into a brand-new local Supabase
# (Supabase's documented restore order: roles, schema, then data with triggers off; as the local superuser, since the
# roles file re-grants Supabase's own role settings) and compare every table's row
# count with the live project. Writes the result to /tmp/restore-result.txt. Prints counts only, never data.
set -euo pipefail
backup="$1"
work=$(mktemp -d)
umask 077
age -d -i /tmp/restore.key -o "$work/backup.tar.gz" "$backup"
tar -C "$work" -xzf "$work/backup.tar.gz"
# A fresh project with the same Postgres version and no migrations; the auth hook is off until its function exists.
mkdir -p "$work/project/supabase"
sed -e 's/^project_id = .*/project_id = "restore-test"/' supabase/config.toml > "$work/project/supabase/config.toml"
cp -r supabase/templates "$work/project/supabase/"
python3 - "$work/project/supabase/config.toml" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
s = re.sub(r'(\[auth\.hook\.[a-z_]+\]\s*\n)enabled = true', r'\1enabled = false', s)
open(p, 'w').write(s)
PY
cd "$work/project"
supabase start -x realtime,imgproxy,postgres-meta,supavisor,vector,logflare,studio,edge-runtime > /tmp/restore-start.log 2>&1 || { tail -20 /tmp/restore-start.log; exit 1; }
export DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql --single-transaction --variable ON_ERROR_STOP=1 -X -q \
  --file "$work/roles.sql" \
  --file "$work/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$work/data.sql" \
  --dbname "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres" > /tmp/restore-psql.log 2>&1 || { grep -m5 -i error /tmp/restore-psql.log; exit 1; }
cd - > /dev/null
node scripts/backup-row-counts.mjs local > /tmp/counts-restored.txt
tables=$(wc -l < /tmp/counts-live.txt)
rows=$(awk '{s+=$2} END {print s+0}' /tmp/counts-live.txt)
if diff -u /tmp/counts-live.txt /tmp/counts-restored.txt > /tmp/counts.diff; then
  echo "PASS  restored $tables tables, $rows rows; every table's row count matches the live project" | tee /tmp/restore-result.txt
  status=0
else
  echo "FAIL  row counts differ (schema.table count; - live, + restored):" | tee /tmp/restore-result.txt
  grep -E '^[-+][a-z]' /tmp/counts.diff | head -40 | tee -a /tmp/restore-result.txt
  status=1
fi
(cd "$work/project" && supabase stop --no-backup > /dev/null) || true
rm -rf "$work"
exit $status
