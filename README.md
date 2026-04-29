# Aria for Migration Agents

Aria is an AI-assisted migration operations platform for Australian migration practices. It supports matter coordination, document intake, source-linked field review, validation, official update monitoring, and matter impact triage.

## Tech stack
- Next.js (App Router) + TypeScript
- Tailwind CSS component system
- Prisma + PostgreSQL
- NextAuth foundation
- Modular service adapters for AI, update ingestion, and document extraction

## Product areas
- Overview
- Matters (list + detail)
- Documents
- Forms & Field Review
- Validation
- Updates Monitor
- AI Assistant
- Tasks
- Settings

## Architecture
- `app/`: route structure for marketing, auth, authenticated app, and API endpoints.
- `components/`: shell, shared UI primitives, and app-level blocks.
- `lib/data/`: Prisma-backed repository layer for workspace app pages.
- `lib/services/`: integration adapters for OCR/extraction pipeline, AI provider output, and update ingestion.
- `lib/connectors/`: official update source connector interfaces.
- `prisma/`: schema, migration SQL, and optional development seed dataset.

## Key integration points
- **Document ingestion**: `POST /api/documents` + `lib/services/document-pipeline.ts`
- **AI assistant**: `POST /api/assistant` grounded in matter, validation, and official update impact records.
- **Update ingestion**: `POST /api/updates/ingest` + connector interface + hash dedupe service

## Local development
1. Copy env vars:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Apply migration:
   ```bash
   npm run prisma:migrate
   ```
5. Optionally seed development data:
   ```bash
   npm run prisma:seed
   ```
6. Run app:
   ```bash
   npm run dev
   ```

## Deployment note for Prisma on Vercel
Use Vercel only for:

```bash
prisma generate && next build
```

Do not rely on Vercel build to run `prisma migrate deploy` when your production database direct host is not reachable from the build environment.

Before deploying, run migrations manually from a machine or CI job that can reach the database direct connection:

```bash
npx prisma migrate deploy
```

Or use the package script:

```bash
npm run prisma:deploy
```

Recommended production env vars:
- `DATABASE_URL`: pooled/runtime connection
- `DIRECT_URL`: direct database connection for migrations

In short:
- Vercel build: `prisma generate && next build`
- Migrations: run `npx prisma migrate deploy` or `npm run prisma:deploy` manually, locally, or in CI before deploy

### Production migration troubleshooting
If production runtime errors mention missing Prisma tables such as `User`, `ClientIntakeRequest`, `DocumentRequest`, `Appointment`, `GeneratedDocument`, or `MatterTimelineEvent`, the usual cause is that migrations were committed but not applied to the production database.

Use this order:

1. Confirm Vercel and your migration environment point to the same Supabase project:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
2. Run:
   ```bash
   npm run prisma:deploy
   ```
3. Re-check the production app.

Do not use `prisma migrate dev` against production.
Do not reset the production database.

## Docker local run
```bash
docker compose up --build
```

## Optional development seed data
The seed script can create optional local development records for manual QA, but the app does not use seed arrays or sample repositories as a runtime fallback. Production pages expect real Prisma/Postgres records for the signed-in workspace.

## Trust-safe positioning
Aria is AI-assisted and review-required. It does not replace a registered migration agent and does not promise visa outcomes.

## Downloading a source bundle (when artifact links are not clickable)
If your chat/artifact UI does not render clickable links, create and fetch a source-only archive from the repository root:

```bash
mkdir -p artifacts
zip -r artifacts/Aria-AI-Agent-source-only.zip . -x '.git/*' 'node_modules/*' '.next/*'
```

Then download the file directly from your workspace file browser at:
- `artifacts/Aria-AI-Agent-source-only.zip`
- Direct artifact filename: `Aria-AI-Agent-source-only.zip`

If your environment supports sandbox links, this format is typically clickable:
- `[Download source zip](sandbox:/workspace/Aria-AI-Agent/artifacts/Aria-AI-Agent-source-only.zip)`

## Enabling direct push from this environment
To allow the agent/environment to push straight to GitHub, confirm these repo/environment settings:

1. **Remote configured**
   ```bash
   git remote add origin https://github.com/Chahat-kansal/Aria-AI-Agent.git
   ```
   (Or `git remote set-url origin ...` if it already exists.)

2. **Write authentication available to Git**
   - HTTPS: provide a GitHub PAT with `repo` scope via credential helper or `GITHUB_TOKEN`/`GH_TOKEN` in environment.
   - SSH: load a key that is added to your GitHub account and use `git@github.com:Chahat-kansal/Aria-AI-Agent.git`.

3. **Outbound network access to GitHub**
   - Allow `github.com` and `api.github.com` over port `443`.
   - If a corporate proxy is required, set `HTTPS_PROXY`/`HTTP_PROXY` for the runtime.

4. **Branch permissions**
   - Ensure the target branch accepts direct pushes from your account/token, or allow push to a feature branch and open a PR.

5. **Quick verification commands**
   ```bash
   git remote -v
   git ls-remote origin
   git push -u origin HEAD
   ```

If `git ls-remote origin` fails with `403`/`CONNECT tunnel failed`, the blocker is network/proxy or token permissions (not repository code).

## Post-deploy verification checklist
I cannot fully validate a cloud deployment from this environment when package install and outbound registry access are blocked. Use this checklist right after deploying:

1. **Build and runtime health**
   ```bash
   npm ci
   npm run build
   npm run start
   ```

2. **Database + Prisma**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

   For production schema rollout:
   ```bash
   npm run prisma:deploy
   ```

3. **Critical route checks**
   - `/` (landing)
   - `/auth/sign-in`
   - `/app/overview`
   - `/app/matters`
   - `/app/documents`
   - `/app/forms`
   - `/app/validation`
   - `/app/updates`
   - `/app/assistant`
   - `/app/tasks`
   - `/app/settings`

4. **API checks**
   - `POST /api/documents`
   - `POST /api/assistant`
   - `POST /api/updates/ingest`

5. **Operational checks**
   - Verify env vars are set (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`).
   - Confirm auth session creation works.
   - Confirm seeded records render in overview/matters/updates/tasks.

If any step fails, capture logs and re-run with `NODE_ENV=production` to match deploy behavior.
