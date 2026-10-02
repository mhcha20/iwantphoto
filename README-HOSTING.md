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
