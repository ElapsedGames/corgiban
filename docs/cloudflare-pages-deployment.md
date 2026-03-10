# Cloudflare Pages Deployment

This repo is already wired for Cloudflare Pages at the app layer:

- `apps/web/functions/[[path]].ts` is the Pages Functions catch-all for Remix.
- `apps/web/wrangler.jsonc` is the current Cloudflare config file.
- `pnpm -C apps/web preview` runs the local Cloudflare-style preview path.
- `pnpm -C apps/web deploy:cloudflare` exists for manual deploys, but the default production path
  should be Git-integrated Pages.

## Answer First: Commit Or Build PR?

Yes: commit first.

Cloudflare Pages Git integration only builds pushed Git commits. It cannot see your local
uncommitted worktree.

For this repo, use the normal flow:

1. Finish local validation.
2. Commit to your feature branch.
3. Push the branch and open a PR into `main`.
4. Let GitHub Actions and the Cloudflare Pages preview deployment validate the branch.
5. Merge to `main` for the production deploy.

Do not create a separate "build PR" branch unless the team intentionally wants a release branch.
`main` should stay the Pages production branch.

## Repo-Specific Settings

| Cloudflare field       | Value for this repo                                                    | Why                                                                    |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Project type           | Git-integrated Pages project                                           | The repo already targets Cloudflare Pages.                             |
| Git provider           | GitHub                                                                 | The repo already uses GitHub Actions under `.github/workflows/ci.yml`. |
| Production branch      | `main`                                                                 | CI already runs on PRs and pushes to `main`.                           |
| Root directory         | `apps/web`                                                             | The Pages `functions/` directory must sit at the Pages project root.   |
| Build command          | `cd ../.. && pnpm install --frozen-lockfile && pnpm -C apps/web build` | Install workspace deps from repo root, then build the app package.     |
| Build output directory | `build/client`                                                         | Matches `apps/web/wrangler.jsonc`.                                     |
| Node version           | `20`                                                                   | Matches `.nvmrc` and the root `package.json` engine floor.             |
| pnpm version           | `9.4.0`                                                                | Matches the root `packageManager`.                                     |
| Pages project name     | `corgiban`                                                             | Matches `apps/web/wrangler.jsonc`.                                     |

## Files That Matter

- `apps/web/functions/[[path]].ts`
- `apps/web/package.json`
- `apps/web/scripts/preview-cloudflare.mjs`
- `apps/web/wrangler.jsonc`
- `package.json`
- `.nvmrc`
- `pnpm-workspace.yaml`

## Step-By-Step Setup

### 1. Verify Locally Before You Push

Run the repo-required checks before opening the deployment PR:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm test:smoke
```

Notes:

- `pnpm test:smoke` already builds the app and runs Playwright against the Cloudflare preview path.
- The pre-commit hook is not enough by itself. Repo policy still requires local `typecheck`, `lint`,
  and the full unit suite before the PR.

### 2. Commit And Open A Normal PR

Use your standard feature branch into `main`:

```bash
git checkout -b <feature-branch>
git add <files>
git commit -m "build: prepare Cloudflare Pages deployment"
git push -u origin <feature-branch>
```

Then open a PR to `main`.

This repo's CI runs on:

- every `pull_request`
- every push to `main`

Once Cloudflare Pages is connected to Git, branch pushes and PRs will also get Pages preview
deployments.

### 3. Create The Pages Project In Cloudflare

In Cloudflare:

`Workers & Pages -> Create application -> Pages -> Connect to Git`

Choose the GitHub repository for this project.

### 4. Enter The Build Settings

Use these exact values first:

- Production branch: `main`
- Root directory: `apps/web`
- Build command:

```bash
cd ../.. && pnpm install --frozen-lockfile && pnpm -C apps/web build
```

- Build output directory: `build/client`

Framework preset can be `Remix` if Cloudflare offers it, but keep the custom build command above.

Why these values:

- `apps/web` must be the Pages root because `functions/[[path]].ts` lives there.
- The app imports workspace packages, so dependency install must happen from the monorepo root.
- The current Pages output is `apps/web/build/client`, and `apps/web/wrangler.jsonc` already pins
  `pages_build_output_dir` to `./build/client`.

### 5. Add Build Environment Variables

In `Pages -> Settings -> Environment variables`, add:

```text
SKIP_DEPENDENCY_INSTALL=1
NODE_VERSION=20
PNPM_VERSION=9.4.0
```

This keeps Pages from trying to do a package install inside `apps/web` without workspace context.

### 6. Let The First Preview Deploy Finish

After the project is connected:

- pushes to PR branches should create preview deployments
- merges to `main` should create the production deployment

Do not use manual Wrangler deploys as the normal production path once Git integration is live.
Keep manual deploys as an escape hatch only.

### 7. Add The Custom Domain

After the first successful Pages deployment, add:

```text
corgiban.elapsedgames.com
```

in:

`Workers & Pages -> <project> -> Custom domains`

Important:

- Do not create the DNS CNAME manually before attaching the domain in Pages.
- The zone is already intended to live on Cloudflare, so Pages should create the needed DNS record
  during the custom-domain flow.
- If the zone uses restrictive CAA records, make sure Cloudflare is allowed to issue the
  certificate.

### 8. Tighten Monorepo Build Triggers

After the first successful deploy, add build watch paths so Pages does not rebuild on every repo
change.

Start with:

```text
apps/web/*
packages/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
.nvmrc
```

Add more root files later only if the Pages build starts depending on them.

### 9. Sync Wrangler Config Back To The Repo

After the dashboard project exists, sync the Cloudflare-side config back into the checked-in
Wrangler file:

```bash
pnpm -C apps/web exec wrangler login
pnpm -C apps/web exec wrangler pages download config corgiban
```

Then verify `apps/web/wrangler.jsonc` still matches the intended setup:

- `"name": "corgiban"`
- `"pages_build_output_dir": "./build/client"`
- the current `compatibility_date`

Treat `apps/web/wrangler.jsonc` as the deployment config source of truth after setup.

## Local Commands You Will Actually Use

Normal local preview:

```bash
pnpm -C apps/web preview
```

Full repo build:

```bash
pnpm build
```

Manual deploy path if you ever need it:

```bash
pnpm -C apps/web deploy:cloudflare
```

Use the manual deploy command only for exceptional cases. The normal production path should be:

- branch push -> Pages preview
- PR review -> merge to `main`
- `main` deploy -> production

## What Not To Do

- Do not use Direct Upload for the long-term deployment path if you want branch previews and PR
  previews.
- Do not set the Pages root to the repo root unless you also move `apps/web/functions`.
- Do not point `corgiban.elapsedgames.com` at `*.pages.dev` before finishing the Pages custom-domain flow.
- Do not turn the Pages build command into the full validation gauntlet. Keep Pages focused on
  install plus build; let CI enforce the heavier checks.
