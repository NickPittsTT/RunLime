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
# Every live table must exist in the copy with the same row count. Tables that exist only in the copy (a newer local
# Supabase version) are allowed if they are empty.
awk 'NR==FNR {live[$1]=$2; next} {restored[$1]=$2}
     END {
       for (t in live) if (!(t in restored)) print "missing " t " (live " live[t] ")"; else if (restored[t] != live[t]) print "count " t " live " live[t] ", restored " restored[t];
       for (t in restored) if (!(t in live) && restored[t] != 0) print "extra " t " " restored[t];
     }' /tmp/counts-live.txt /tmp/counts-restored.txt | sort > /tmp/counts.diff
if [ ! -s /tmp/counts.diff ]; then
  echo "PASS  restored $tables tables, $rows rows; every live table's row count matches" | tee /tmp/restore-result.txt
  status=0
else
  echo "FAIL  the restored copy differs:" | tee /tmp/restore-result.txt
  head -40 /tmp/counts.diff | tee -a /tmp/restore-result.txt
  status=1
fi
(cd "$work/project" && supabase stop --no-backup > /dev/null) || true
rm -rf "$work"
exit $status
