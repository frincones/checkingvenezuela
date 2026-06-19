# RESTORE RUNBOOK — Venezuela Voyages

Recovery procedure for the weekly encrypted backup produced by
[.github/workflows/backup.yml](../.github/workflows/backup.yml).

The backup ships a single encrypted archive that contains: Postgres dump
(schema + data), Storage bucket files (`email-attachments`) and Vercel env
vars. Recovery is reading that archive back into a (new or existing)
Supabase project and Vercel project.

---

## 1. Pre-requisites

You need:

- The **age private key** (`AGE-SECRET-KEY-...`) — stored OFFLINE, NOT in
  any GitHub secret. Without it the backup cannot be opened.
- A GitHub PAT with `repo` scope on `frincones/backups-checkingvenezuela`
  (the release is on a private repo).
- These CLI tools installed locally:

| Tool | Install (Windows) | Install (macOS / Linux) |
|---|---|---|
| `gh` | `winget install GitHub.cli` | `brew install gh` |
| `age` | download from https://github.com/FiloSottile/age/releases | `brew install age` |
| `psql` + `pg_restore` (v17+) | https://www.postgresql.org/download/windows/ | `brew install postgresql@17` |
| `rclone` v1.67 | https://downloads.rclone.org/v1.67.0/ | same URL |
| `vercel` | `npm i -g vercel` | `npm i -g vercel` |
| `tar` + `gunzip` | Git Bash or WSL | native |

> **Pinned versions matter**: `rclone` newer than 1.67 breaks Supabase
> S3 signing. `pg_dump` was run with v17; restoring with v15 may warn
> about unknown options.

---

## 2. Fetch and decrypt the backup

```bash
# Pick the release to restore (defaults to the newest one).
TAG=$(gh release list --repo frincones/backups-checkingvenezuela \
        --limit 1 --json tagName --jq '.[0].tagName')
echo "Restoring tag: $TAG"

# Download the encrypted archive.
gh release download "$TAG" --repo frincones/backups-checkingvenezuela --pattern '*.age'

# Decrypt with the offline age private key.
# AGE_KEY_FILE points to a file with the AGE-SECRET-KEY-... line.
age -d -i "$AGE_KEY_FILE" -o "$TAG.tgz" "$TAG.tgz.age"

# Extract.
mkdir -p restore && tar -xzf "$TAG.tgz" -C restore
ls restore/out/   # → db/  storage/  vercel/
```

The extracted layout is:

```
restore/out/
├── db/
│   ├── roles-<stamp>.txt        # role names, informational only
│   ├── schema-<stamp>.sql       # DDL (tables, RLS policies, funcs, triggers)
│   └── data-<stamp>.dump        # COPY data, pg_dump custom format
├── storage/                     # one subdir per Supabase bucket
│   ├── email-attachments/       # inbound + outbound email attachments
│   ├── documents/               # voucher + quotation PDFs
│   ├── chatbot-kb/              # chatbot knowledge-base sources
│   ├── cms-images/              # CMS / blog images
│   └── <any-new-bucket>/        # auto-discovered every run
└── vercel/
    ├── .env.production
    ├── .env.preview
    ├── .env.development
    └── .vercel/                 # project link
```

> **Auto-discover**: the workflow lists every bucket the S3 creds can
> see and syncs each one. Any bucket you create in the future is backed
> up automatically — no workflow edit required.

---

## 3. Restore Postgres (Supabase)

Choose target. If you are recovering into a brand-new Supabase project,
provision it first (Free tier is fine), reset the DB password and grab
the Session Pooler connection from
*Project Settings → Database → Connection string → Session pooler*.

```bash
# Same shape as the workflow uses, but for restore.
export PGHOST='aws-1-us-east-1.pooler.supabase.com'   # adjust if region differs
export PGPORT=5432
export PGUSER='postgres.<NEW-PROJECT-REF>'
export PGPASSWORD='<new-password>'
export PGDATABASE='postgres'
export PGSSLMODE='require'

# 3.1 — Apply schema first (DDL only).
psql -v ON_ERROR_STOP=1 -f restore/out/db/schema-<stamp>.sql

# 3.2 — Load data (custom format → use pg_restore, not psql).
# --data-only because schema is already in place.
# -j 4 = 4 parallel jobs, safe for a small DB.
pg_restore --data-only --no-owner --no-privileges \
  -j 4 -d "$PGDATABASE" \
  restore/out/db/data-<stamp>.dump

# 3.3 — Sanity check.
psql -At -c "SELECT 'leads='||(SELECT count(*) FROM leads),
                    'quotations='||(SELECT count(*) FROM quotations),
                    'emails='||(SELECT count(*) FROM emails)"
```

> **RLS reminder**: `schema-*.sql` already includes the policies
> (`--schema=public --schema=storage`). Do NOT run additional `GRANT`
> statements unless you know exactly what changed — Supabase manages
> grants for the `anon`, `authenticated` and `service_role` roles.

### Restoring into the SAME (existing) project

Only do this for partial recoveries (single table, accidental delete).
For a wholesale rollback into the same project:

1. Open SQL Editor and `TRUNCATE` the affected tables (or drop the
   schema and re-create from `schema-*.sql`).
2. Then run step 3.2 above scoped with `-t <tablename>` if partial.

---

## 4. Restore ALL Storage buckets

Get S3 credentials for the target project:
*Project Settings → Storage → S3 Configuration → New access key*.

```bash
# Configure rclone for the destination project.
cat >> ~/.config/rclone/rclone.conf <<EOF
[supa-restore]
type = s3
provider = Other
endpoint = https://<NEW-PROJECT-REF>.storage.supabase.co/storage/v1/s3
access_key_id = <NEW_S3_KEY>
secret_access_key = <NEW_S3_SECRET>
region = us-east-1
force_path_style = true
EOF

# The bucket metadata (public/private, allowed mime types, file size limit)
# is restored by step 3 (it lives in storage.buckets). After that, push the
# file payload back for EVERY bucket in the archive:
for DIR in restore/out/storage/*/; do
  B=$(basename "$DIR")
  echo "=== Restoring bucket: $B ==="
  rclone sync "$DIR" "supa-restore:$B" \
    --transfers 4 --checkers 8 \
    --s3-list-version 2 \
    --stats=10s --stats-one-line
done
```

> **If a bucket does NOT exist** on the destination (e.g. you nuked
> `storage.buckets` before restoring), create it via Dashboard with the
> SAME name and same public/private flag before re-running the loop.
> rclone will not create the bucket for you.

### Buckets in this app

| Bucket | Purpose | Public? |
|---|---|---|
| `email-attachments` | Inbound + outbound email attachments | private |
| `documents` | Voucher + quotation PDFs (delivered to leads via signed URLs) | private |
| `chatbot-kb` | Knowledge-base sources for the travel chatbot | private |
| `cms-images` | CMS / blog images shown on the marketing site | public |

---

## 5. Restore Vercel project + env vars

```bash
# Link the local repo clone to the Vercel project (or to a new one).
vercel link --yes --project=checkingvenezuela --token=$VERCEL_TOKEN

# For each environment, push the env vars back.
for envname in production preview development; do
  while IFS='=' read -r k v; do
    # skip blank/comment lines
    [[ -z "$k" || "$k" == \#* ]] && continue
    echo "$v" | vercel env add "$k" "$envname" --token=$VERCEL_TOKEN
  done < "restore/out/vercel/.env.$envname"
done
```

> If the Vercel project itself is gone, create a fresh one
> (`vercel`), redeploy from the git repo, then run the env-var loop
> above.

---

## 6. Smoke test (5 min)

```bash
# 6.1 — DB reachable + row counts match expected order of magnitude.
psql -At -c "SELECT 'leads='||(SELECT count(*) FROM leads),
                    'emails='||(SELECT count(*) FROM emails),
                    'quotations='||(SELECT count(*) FROM quotations),
                    'vouchers='||(SELECT count(*) FROM vouchers),
                    'support_tickets='||(SELECT count(*) FROM support_tickets)"

# 6.2 — Storage object count matches.
rclone size supa-restore:email-attachments

# 6.3 — A signed URL for a known file should download cleanly.
psql -At -c "SELECT id, attachments FROM emails WHERE attachments IS NOT NULL LIMIT 1"
# then open the file via Supabase Studio → Storage → email-attachments.

# 6.4 — Login from the live app, open Dashboard → Email; the inbox should
#       load and an existing thread should show attachments.
```

---

## 7. Drill schedule

A backup that has never been restored is not a backup.
**Restore drill every 90 days** into a scratch Supabase project:

1. Provision a free scratch project, name it `voyages-drill-YYYYMM`.
2. Run sections 2–4 against it.
3. Run section 6 row counts; compare against
   `frincones/checkingvenezuela` production counts (PostgREST API works).
4. Delete the scratch project. Total time: <30 minutes.
5. Note the run in a comment on the latest release (`gh release edit`).

If a drill ever fails: do not delete the failing scratch project — open
an issue and root-cause before the next weekly backup overwrites the
artifact you have on hand.

---

## 8. Key rotation

- **Database password**: reset via Dashboard, then update the
  `SUPABASE_DB_PASSWORD` GitHub Actions secret. The next workflow run
  validates the change.
- **S3 access key**: rotate via Dashboard → Storage → S3 Configuration.
  Update `SUPABASE_S3_KEY` and `SUPABASE_S3_SECRET` GitHub Actions
  secrets.
- **Vercel token**: rotate via Vercel → Account Settings → Tokens.
  Update `VERCEL_TOKEN` secret.
- **age key**: do NOT rotate without first decrypting every existing
  release with the OLD key, re-encrypting with the NEW public key, and
  uploading the replacement assets. Otherwise old releases become
  unrecoverable.

---

## 9. Failure modes seen in the wild

| Symptom | Cause | Fix |
|---|---|---|
| `(ENOTFOUND) tenant/user postgres.X not found` | Pooler host wrong (`aws-0` vs `aws-1`, wrong region) | Copy the exact `aws-N-region.pooler.supabase.com` string from Dashboard |
| `password authentication failed for user "postgres"` | Wrong password OR Supabase reset it | Reset via Dashboard, update `SUPABASE_DB_PASSWORD` secret |
| `rclone: signature does not match` | rclone newer than 1.67 | Force v1.67 |
| GitHub Action: "account is locked due to a billing issue" | Payment method missing/declined | Add card; the $1 USD auth releases in 5–7 business days |
| `age: no identity matched any of the recipients` | Wrong age key | Use the one paired with the public key in `AGE_PUBLIC_KEY` secret |
