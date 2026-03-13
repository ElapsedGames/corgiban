# Deploying to Cloudflare Pages

This repo ships a Remix app on Cloudflare Pages. The key integration points are:

- `apps/web/functions/[[path]].ts` - Pages Functions catch-all for Remix.
- `apps/web/wrangler.jsonc` - Cloudflare project config.
- `pnpm -C apps/web preview` - local Cloudflare-style preview.
- `pnpm -C apps/web deploy:cloudflare` - manual deploy escape hatch (prefer Git-integrated Pages).

This document is intentionally environment-agnostic about Node and pnpm version numbers. Treat the
repo toolchain files (`.nvmrc`, `.node-version`, root `package.json#packageManager`) and the target
Pages environment settings as the source of truth instead of copying fixed version literals from
this guide.

Some values in a Pages project are fixed by the repo layout, while others are choices for whoever
is deploying.

## Answer First: Commit Or Build PR?

Yes: commit first.

Cloudflare Pages Git integration only builds pushed Git commits from the connected repository. It
cannot see your local uncommitted worktree.

1. Finish local validation.
2. Commit to a branch.
3. Push the branch and, if you use PR-based flow, open a PR into the production branch.
4. Let CI and the Cloudflare Pages preview deployment validate the branch.
5. Merge or push to the production branch that the Pages project watches.

Do not create a separate "build PR" branch unless you intentionally want a release branch.

## Repo Layout Requirements Vs Owner Choices

| Cloudflare field       | Value for this repo                                                            | Why                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Project type           | Git-integrated Pages project                                                   | The repo already targets Cloudflare Pages.                                                              |
| Git provider           | The provider that hosts the repo you connect to Pages                          | GitHub, GitLab, or any provider Cloudflare supports.                                                    |
| Production branch      | Your chosen production branch (e.g. `main`)                                    | Owner choice; not a repo-layout requirement.                                                            |
| Root directory         | `apps/web`                                                                     | The Pages `functions/` directory must sit at the Pages project root.                                    |
| Build command          | `cd ../.. && pnpm install --frozen-lockfile && pnpm -C apps/web build`         | Install workspace deps from repo root, then build the app package.                                      |
| Build output directory | `build/client`                                                                 | Matches `apps/web/wrangler.jsonc`.                                                                      |
| Node version           | Match the repo toolchain for the target branch/environment                     | Derive from `.nvmrc` / `.node-version`; set `NODE_VERSION` when Pages needs an explicit pin.            |
| pnpm version           | Match the root `package.json#packageManager` for the target branch/environment | Set `PNPM_VERSION` when Pages needs an explicit pin or reproducible installs across Pages environments. |
| Pages project name     | Your chosen Pages project name                                                 | Owner choice; optionally mirror it in `apps/web/wrangler.jsonc`.                                        |

## Files That Matter

- `apps/web/functions/[[path]].ts`
- `apps/web/package.json`
- `apps/web/scripts/preview-cloudflare.mjs`
- `apps/web/wrangler.jsonc`
- `package.json`
- `.nvmrc`
- `.node-version`
- `pnpm-workspace.yaml`

Toolchain policy:

- Read the current Node major from `.nvmrc` or `.node-version`.
- Read the current pnpm version from the root `package.json` `packageManager` field.
- If Pages uses explicit toolchain env vars, keep those values aligned with the repo rather than
  hard-coding them in this document.

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

### 2. Commit And Push Through Your Normal Branch Flow

Use your normal branch flow for the repo or fork that owns the deployment:

```bash
git checkout -b <feature-branch>
git add <files>
git commit -m "build: prepare Cloudflare Pages deployment"
git push -u origin <feature-branch>
```

If you use PRs, open one into your production branch. Otherwise, push directly to the branch that
your Pages project watches.

Once Cloudflare Pages is connected to Git, pushes to non-production branches also get Pages preview
deployments.

### 3. Create The Pages Project In Cloudflare

In Cloudflare:

`Workers & Pages -> Create application -> Pages -> Connect to Git`

Choose the repository you want to deploy from.

### 4. Enter The Build Settings

Use these project settings first:

- Production branch: your chosen production branch
- Root directory: `apps/web`
- Build command:

```bash
cd ../.. && pnpm install --frozen-lockfile && pnpm -C apps/web build
```

- Build output directory: `build/client`

For Node and pnpm, follow the repo's current toolchain instead of a fixed value in this guide. If
the target Pages environment needs explicit toolchain overrides, derive them from the repo files
listed above at the time you configure the environment.

Framework preset can be `Remix` if Cloudflare offers it, but keep the custom build command above.

Why these values:

- `apps/web` must be the Pages root because `functions/[[path]].ts` lives there.
- The app imports workspace packages, so dependency install must happen from the monorepo root.
- The current Pages output is `apps/web/build/client`, and `apps/web/wrangler.jsonc` already pins
  `pages_build_output_dir` to `./build/client`.
- The production branch is an owner choice, not a repo-layout requirement.

### 5. Add Build Environment Variables Deliberately

In `Pages -> Settings -> Environment variables`, always add:

```text
SKIP_DEPENDENCY_INSTALL=1
```

This keeps Pages from trying to do a package install inside `apps/web` without workspace context.

Add explicit toolchain pins when the target Pages environment needs them or when you want
reproducible preview/production installs:

```text
NODE_VERSION=<match .nvmrc or .node-version>
PNPM_VERSION=<match root package.json packageManager>
```

Notes:

- Keep Preview and Production environment values aligned unless you are intentionally testing a
  toolchain rollout.
- Because the Pages root directory is `apps/web`, treat dashboard environment variables as the
  safest explicit override path when you need to pin tool versions for that environment.
- When the repo toolchain changes, update the Pages environment overrides in the same pass.

### 6. Let The First Preview Deploy Finish

After the project is connected:

- pushes to non-production branches should create preview deployments
- pushes or merges to the configured production branch should create the production deployment

Do not use manual Wrangler deploys as the normal production path once Git integration is live.
Keep manual deploys as an escape hatch only.

### 7. Add A Custom Domain Only If You Want One

After the first successful Pages deployment, either:

- keep the default `*.pages.dev` hostname
- or add your own custom domain in:

  `Workers & Pages -> <project> -> Custom domains`

Important:

- Do not create the DNS CNAME manually before attaching the domain in Pages.
- If the zone is on Cloudflare, Pages should usually create the needed DNS record during the
  custom-domain flow.
- If the zone uses restrictive CAA records, make sure Cloudflare is allowed to issue the
  certificate.
- Use your own domain or skip this step entirely.

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
.node-version
```

Add more root files later only if the Pages build starts depending on them.

### 9. Sync Wrangler Config Back To The Repo

After the dashboard project exists, sync the Cloudflare-side config back into the checked-in
Wrangler file. For an existing Pages project, this is the safest way to confirm whether Cloudflare
has fields configured that are missing from repo docs or local assumptions.

```bash
pnpm -C apps/web exec wrangler login
pnpm -C apps/web exec wrangler pages download config <pages-project-name>
```

Recommended flow:

1. Download the Pages config from Cloudflare.
2. Compare the downloaded config against the checked-in `apps/web/wrangler.jsonc`.
3. Reconcile any meaningful differences intentionally instead of letting dashboard-only settings
   turn into undocumented deployment folklore.

Then verify `apps/web/wrangler.jsonc` still matches the intended setup:

- `"name"` matches the Pages project name you intend to keep in repo config
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
- PR review or direct push -> production branch update
- production branch deploy -> production

## What Not To Do

- Do not use Direct Upload for the long-term deployment path if you want branch previews and PR
  previews.
- Do not set the Pages root to the repo root unless you also move `apps/web/functions`.
- If you use a custom domain, do not point it at `*.pages.dev` before finishing the Pages
  custom-domain flow.
- Do not turn the Pages build command into the full validation gauntlet. Keep Pages focused on
  install plus build; let CI enforce the heavier checks.
