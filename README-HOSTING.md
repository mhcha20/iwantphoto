# Iwantphoto Source Snapshot

This is the complete source snapshot for the **2026-10-02** hosting transfer. It deliberately excludes runtime secrets, installed dependencies, generated build files, Manus project configuration, Git history and debug logs.

Read the parent handoff package documentation before deploying:

- `../../docs/README.md`
- `../../docs/HOSTING-MIGRATION-GUIDE.md`
- `../../docs/DATA-RESTORE.md`

Use `HOST-ENVIRONMENT.template` as a secure-secret-manager configuration reference. After configuring the host, run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
NODE_ENV=production pnpm start
```

Manus has been replaced: sign-in uses **Google OAuth**, files use an **S3-compatible bucket**, and AI image editing / LLM calls go through **OpenRouter**. See `HOST-ENVIRONMENT.template` for the variables.

- Google redirect URI: `https://<your-domain>/api/oauth/callback`.
- Existing accounts: on first Google login, a pre-migration account is claimed only when exactly one row has the same Google-verified email (`openId` becomes `google:<sub>`). Ambiguous matches create a new account instead.
- Stored media URLs stay `/manus-storage/<key>`; upload `backup/media/manus-storage/` and `backup/public-assets` (brand images) to the bucket root with the same keys.

## Deploying on Railway

1. **Services:** create one service from this repo (`railway.json` sets the build, `pnpm start`, and the `/healthz` health check), a **MySQL** database, and a **Bucket**.
2. **Variables** (service → Variables; see `HOST-ENVIRONMENT.template`): `DATABASE_URL` (from the MySQL service), `JWT_SECRET`, `APP_BASE_URL`, `OWNER_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENROUTER_API_KEY`, the Bucket's `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`, plus the Stripe and Resend values.
3. **Database:** restore `backup/database/iwantphoto.sql` into the empty MySQL database (`DATA-RESTORE.md`). It already contains the schema and the `__drizzle_migrations` table, so the start command intentionally does **not** run migrations; run `pnpm db:push` yourself only for a brand-new empty database.
4. **Media:** sync `backup/media/manus-storage/` and `backup/public-assets/` to the bucket root, keeping every key.
5. **Domain:** attach `iwantphoto.com` and `www.iwantphoto.com`; keep `APP_BASE_URL=https://iwantphoto.com` and add its `/api/oauth/callback` as the Google redirect URI.
6. **Verify:** `railway run pnpm verify:ai` checks the bucket (write, signed read, size, delete), the LLM (JSON schema and vision) and the image pipeline (white background, transparent cut-out, object removal, fallback model). Image results are written to `verify-output/` for a visual check. Run a subset with `pnpm verify:ai storage|llm|image`.
7. **Stripe:** point the webhook to `https://iwantphoto.com/api/stripe/webhook`, then run the Stripe tests listed in `HOSTING-MIGRATION-GUIDE.md`.
