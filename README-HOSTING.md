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

The current code uses Manus OAuth, Manus Forge Storage and Manus Forge AI. A generic host requires those integrations to remain securely configured or to be replaced as detailed in the migration guide.
