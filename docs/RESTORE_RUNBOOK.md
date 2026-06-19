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
│   ├── data-<stamp>.dump        # public + storage data, pg_dump custom format
│   └── auth-users-<stamp>.json  # auth.users (JSON via Admin API — NO password hashes)
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
    ├── .vercel/                 # project link
    ├── project.json             # framework, build cmd, regions, root dir
    ├── domains.json             # custom domains attached to the project
    ├── deploy-hooks.json        # external trigger URLs (if any)
    └── account-domains.json     # account-level domains
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

### 3.4 — Restore Supabase Auth users

`auth-users-<stamp>.json` is the output of the Auth Admin API
(`GET /auth/v1/admin/users`). It contains every user row with email,
metadata, providers, MFA factors, and timestamps. **Password hashes
are NOT included** — the API deliberately hides them — so restored
users will need to set a new password.

Two restore strategies, pick one:

**Strategy A — magic-link migration (recommended)**
```bash
# Requires the NEW project's service_role key.
export NEW_SRK='<service_role of the destination project>'
export NEW_URL='https://<new-ref>.supabase.co'

python - <<PYEOF
import json, urllib.request
users = json.load(open("restore/out/db/auth-users-<stamp>.json"))["users"]
for u in users:
    body = json.dumps({
        "email": u["email"],
        "email_confirm": bool(u.get("email_confirmed_at")),
        "phone": u.get("phone") or None,
        "phone_confirm": bool(u.get("phone_confirmed_at")),
        "user_metadata": u.get("user_metadata", {}),
        "app_metadata": u.get("app_metadata", {}),
    }).encode()
    req = urllib.request.Request(
        f"{'$NEW_URL'}/auth/v1/admin/users",
        data=body, method="POST",
        headers={
            "apikey": "$NEW_SRK",
            "Authorization": "Bearer $NEW_SRK",
            "Content-Type": "application/json",
        },
    )
    try:
        urllib.request.urlopen(req)
        print(f"OK   {u['email']}")
    except Exception as e:
        print(f"FAIL {u['email']}: {e}")
PYEOF

# Then send each user a password reset email via the Dashboard
# (Authentication → Users → "Send recovery link") or programmatically
# via /auth/v1/recover.
```

**Strategy B — manual email outreach**
Read the JSON, export the email list, and tell users to sign up again
with the same email. Acceptable for tiny user bases.

> **MFA**: factors restored as JSON cannot be reactivated without their
> original TOTP secrets (which the API never exposes). Users will need
> to re-enroll MFA on next login.

> **Sessions**: not preserved either — every user logs in fresh.

> **What about old IDs?**: a recreated user gets a NEW UUID. If any of
> your `public.*` rows reference `auth.users.id` directly via FK, those
> rows will be orphaned on restore. Mitigation: store the old → new ID
> mapping during the loop and run an UPDATE on the FK rows.

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

## 5. Restore Vercel project + env vars + domains

```bash
# Link the local repo clone to the Vercel project (or to a new one).
vercel link --yes --project=checkingvenezuela --token=$VERCEL_TOKEN

# 5.1 — Env vars per environment.
for envname in production preview development; do
  while IFS='=' read -r k v; do
    [[ -z "$k" || "$k" == \#* ]] && continue
    echo "$v" | vercel env add "$k" "$envname" --token=$VERCEL_TOKEN
  done < "restore/out/vercel/.env.$envname"
done

# 5.2 — Re-attach custom domains.
# The list of domains lives in restore/out/vercel/domains.json. Re-add each:
python -c "
import json
for d in json.load(open('restore/out/vercel/domains.json'))['domains']:
    print(d['name'])
" | while read DOMAIN; do
  vercel domains add "$DOMAIN" --token=$VERCEL_TOKEN || true
done

# 5.3 — Re-create deploy hooks (if you used any external triggers).
cat restore/out/vercel/deploy-hooks.json
# The output shows the previous hook names and target branches. Re-create
# them from the Vercel Dashboard → Project → Git → Deploy Hooks (no public
# API yet for creating hooks — needs the UI).

# 5.4 — Verify project settings.
diff <(curl -fsSL -H "Authorization: Bearer $VERCEL_TOKEN" \
        https://api.vercel.com/v9/projects/checkingvenezuela | jq .framework,.buildCommand) \
     <(jq .framework,.buildCommand restore/out/vercel/project.json)
```

> If the Vercel project itself is gone, create a fresh one
> (`vercel`), redeploy from the git repo, then run the loops above.

> **DNS step**: pointing a domain at the new Vercel project requires
> updating the registrar (see §8 "External accounts").

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

## 8. External accounts — what backups CANNOT recover

The backup archive does NOT contain credentials or data from third-party
services. If you lose access to any of these accounts, restoring the
encrypted backup is not enough.

**Keep this checklist offline (password manager + paper copy).**

### 8.1 — Account inventory

| Service | Why it matters on restore | Recovery if locked out |
|---|---|---|
| **Domain registrar** (where the production domain is registered) | DNS still points at old infra after restore — you can't point at the new Vercel project without registrar access | Use registrar's account-recovery flow; this is often the SINGLE point of failure for restores |
| **GitHub** (`frincones`) | Source of truth for code AND home of the encrypted backups | 2FA backup codes + recovery email |
| **Vercel** | Hosts the app + holds env vars | 2FA backup codes + recovery email |
| **Supabase** | DB + Storage + Auth | 2FA backup codes + recovery email |
| **Stripe** | Payment records, customer subs (your app: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`) | 2FA backup codes; Stripe support |
| **Resend** | Email-sending API + webhook (`RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET`) | 2FA backup codes |
| **Mailjet** | Email-sending fallback (`MAIL_API_TOKEN` + `MAIL_SECRET_TOKEN`) | 2FA backup codes |
| **Google AI Studio** | Chatbot LLM (`GOOGLE_GENERATIVE_AI_API_KEY`) | Same Google account recovery |
| **OpenRouter** | LLM fallback (`OPENROUTER_API_KEY`) | 2FA backup codes |
| **Groq** | LLM (used by parts of the app) | 2FA backup codes |
| **Jina** | Embeddings for chatbot RAG (`JINA_API_KEY`) | 2FA backup codes |
| **cron-job.org** (if used as external trigger) | Calls `repository_dispatch` to make the backup workflow more reliable than GitHub's own cron | Account email/password |

### 8.2 — Inbound webhooks registered on external services

These webhooks live on the THIRD-PARTY side and point at THIS app's URL.
After restoring to a new Vercel URL, each one must be re-registered and
the secret rotated.

| Webhook | Where it's registered | App endpoint | Secret env var |
|---|---|---|---|
| Stripe events (payments, subs) | Stripe Dashboard → Developers → Webhooks | `POST /api/stripe/webhook` | `STRIPE_WEBHOOK_SECRET` |
| Resend events (delivery, bounce) | Resend Dashboard → Webhooks | `POST /api/webhook/email` | `RESEND_WEBHOOK_SECRET` |

After a restore:
1. Register the new endpoint URL on each provider's dashboard.
2. Copy the new signing secret they give you.
3. Update the matching env var in Vercel (`vercel env add ...`).
4. Send a test event from each provider and check the Vercel function
   log returns 200.

### 8.3 — Key rotation

- **Database password**: reset via Dashboard, then update the
  `SUPABASE_DB_PASSWORD` GitHub Actions secret. The next workflow run
  validates the change.
- **S3 access key**: rotate via Dashboard → Storage → S3 Configuration.
  Update `SUPABASE_S3_KEY` and `SUPABASE_S3_SECRET` GitHub Actions
  secrets.
- **Vercel token**: rotate via Vercel → Account Settings → Tokens.
  Update `VERCEL_TOKEN` secret.
- **Stripe / Resend webhook secrets**: regenerate via each Dashboard
  after re-registering the webhook URL (see §8.2). Update the matching
  env var in Vercel.
- **age key**: do NOT rotate without first decrypting every existing
  release with the OLD key, re-encrypting with the NEW public key, and
  uploading the replacement assets. Otherwise old releases become
  unrecoverable.

### 8.4 — GitHub Actions secrets used by this workflow

For reference (these CANNOT be backed up — they are encrypted on the
GitHub side). On a fresh repo or after a leak, regenerate from the
sources listed in §8.3 and add them to the new repo's
*Settings → Secrets and variables → Actions*:

```
SUPABASE_DB_HOST           e.g. aws-1-us-east-1.pooler.supabase.com
SUPABASE_DB_USER           postgres.<project-ref>
SUPABASE_DB_PASSWORD       from Supabase Dashboard → Database
SUPABASE_S3_ENDPOINT       https://<project-ref>.storage.supabase.co/storage/v1/s3
SUPABASE_S3_REGION         us-east-1 (or whatever the project is in)
SUPABASE_S3_KEY            from Supabase Dashboard → Storage → S3
SUPABASE_S3_SECRET         from the SAME key creation step (only shown once!)
VERCEL_TOKEN               from Vercel → Account Settings → Tokens
VERCEL_PROJECT             project slug, e.g. checkingvenezuela
AGE_PUBLIC_KEY             from age-keygen output (public part)
BACKUP_REPO_PAT            GH PAT with `repo` scope on backups-checkingvenezuela
```

---

## 9. Failure modes seen in the wild

| Symptom | Cause | Fix |
|---|---|---|
| `(ENOTFOUND) tenant/user postgres.X not found` | Pooler host wrong (`aws-0` vs `aws-1`, wrong region) | Copy the exact `aws-N-region.pooler.supabase.com` string from Dashboard |
| `password authentication failed for user "postgres"` | Wrong password OR Supabase reset it | Reset via Dashboard, update `SUPABASE_DB_PASSWORD` secret |
| `rclone: signature does not match` | rclone newer than 1.67 | Force v1.67 |
| GitHub Action: "account is locked due to a billing issue" | Payment method missing/declined | Add card; the $1 USD auth releases in 5–7 business days |
| `age: no identity matched any of the recipients` | Wrong age key | Use the one paired with the public key in `AGE_PUBLIC_KEY` secret |
