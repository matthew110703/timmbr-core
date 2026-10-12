# CI/CD

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Event                   | Checks | Deploy                             |
| ----------------------- | ------ | ---------------------------------- |
| PR → `staging` / `main` | ✅     | –                                  |
| Push to `staging`       | ✅     | Render deploy hook → wait → health |
| Manual run on `staging` | ✅     | same as a push                     |

## Jobs

- **`checks`**: `pnpm lint:check` (errors fail, warnings don't), `check:types`, `test`, `build`.
- **`migrations`**: starts an empty Postgres, runs `prisma migrate deploy` (every migration must apply cleanly), then `prisma migrate diff --exit-code`. It fails if a `.prisma` file changed without a migration; fix that with `pnpm db:migrate` and commit the migration.
- **`ci-ok`**: the one required status check for branch protection.
- **`deploy-staging`**: runs only after both checks pass:
  1. POSTs the Render deploy hook with `ref=<commit>`, so Render deploys exactly the commit that passed CI.
  2. If `RENDER_API_KEY` is set, polls the Render API until the deploy is `live`, and fails on a failed or cancelled deploy.
  3. Polls `<STAGING_API_URL>/health` for up to ~3 minutes, to allow for free-instance cold starts.

**Staging migrations are applied manually**: CI never connects to the staging database. Before pushing a change that adds migrations, run `pnpm exec prisma migrate deploy` against staging. Keep migrations backwards-compatible, so the running version keeps working until the new deploy is live.

Deploys never cancel each other. A newer push waits until the running deploy finishes.

## One-time setup

**Render: staging web service**

- Settings → Build & Deploy → **Auto-Deploy: Off**. Otherwise Render deploys on push, before CI.
- Settings → **Deploy Hook**: copy the URL (`https://api.render.com/deploy/srv-…?key=…`).
- _(Optional, recommended)_ Account Settings → **API Keys** → create a key. Without it, CI can't confirm that the new deploy went live and only checks that `/health` responds.

**GitHub: repo → Settings → Environments → `staging`**

| Kind     | Name                     | Value                                           |
| -------- | ------------------------ | ----------------------------------------------- |
| Secret   | `RENDER_DEPLOY_HOOK_URL` | Deploy hook URL                                 |
| Secret   | `RENDER_API_KEY`         | Render API key _(optional)_                     |
| Variable | `STAGING_API_URL`        | e.g. `https://timmbr-core-staging.onrender.com` |

**Branch protection** (`staging`, `main`): require the **CI OK** check. It appears in the list after the first run.

## Adding production later

Copy `deploy-staging` as `deploy-production`: trigger on `refs/heads/main`, use `environment: production` (with required reviewers), and give it its own secrets and variables. Add `main` to the `push` branches.
