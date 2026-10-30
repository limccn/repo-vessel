# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: 码之灵龛 / Repo Vessel

A GitHub public-repository discovery site: users type a GitHub username (or add either of the site's configured topics — default `repo-vessel` or `urn-of-repos` — to a repo) and see a "灵龛鉴定" — which of their public repos have gone dormant, which Forks came from where, plus share cards, achievement badges, and light leaderboards.

**The name and the topics are configuration, not literals.** The product is 码之灵龛 / Repo Vessel; the topics it advertises come from `VITE_REPO_TOPICS` (SPA) and `REPO_TOPICS` (Worker), both defaulting to `repo-vessel,urn-of-repos`, and both resolved through the one rule in `src/shared/topic.ts`. The old `urn-of-shadows` name survives only in the git history and in the name of the design document in `prompt/`.

**Current state: the frontend, GitHub login, the M1 read path, the M2 share images, the M3 collection layer and the M4 measurement layer are all implemented.** `src/frontend/` holds a working **Vite + React 19 + TypeScript + Tailwind v4** SPA — the token file, the component primitives, client-side routing, and the three Dota reference layouts (Dashboard, Hero Grid, Match Panel) — rendering **live Worker data** through `src/frontend/api/`; `?demo=` still renders the envelope-shaped mock. `src/shared/` holds the wire contract, the thresholds, the tier derivation, the topic resolver, the display copy, the metric vocabulary, and the four-locale **i18n model and dictionaries** (`i18n.ts`, `i18n-dictionaries.ts`), imported by both sides. `src/worker/` serves the four OAuth endpoints (`/api/auth/login`, `/api/auth/callback`, `/api/auth/session`, `/api/session`) plus the language-preference route (`POST /api/session/locale` — see **GitHub OAuth** below), the two read endpoints (`/api/inspect/:username`, `/api/repos/:owner/:repo` — see **GitHub reads** below), the two share routes (`/og/u/:username` renders a PNG, `/u/:username` rewrites that page's preview meta — see **Share images** below), the five M3 routes (`/api/board/:board`, `/api/collection-status`, `/api/claim/:owner/:repo`, `/api/claims`, `/api/takedown[/:ticket]` — see **Collection** below), the metrics beacon (`POST /api/metrics/event` — see **Measurement** below), plus a `scheduled` handler behind `triggers.crons`. Every other `/api/*` path still answers `501` — that is "not implemented", never "empty". `docs/roadmap.md` tracks the order — M1 真数据 (done 2026-11-01) → M2 传播 (done 2026-11-01) → M3 入龛 (done 2026-11-01) → M4 测量 (done 2026-11-01) — so the whole v4.1 MVP has shipped, and what comes next is decided by the report rather than by the roadmap.

The product design is done and lives in `prompt/` (tracked — it ships as a public design archive). `.trellis/spec/` is populated: the `backend/` and `frontend/` layers carry this project's real conventions, derived from `docs/interaction-design-spec.md` (tracked), `docs/dota2-visual-system.md` (tracked), `docs/metrics.md` (tracked), `CLAUDE.md`, and `prompt/Urn of Shadows v4.1.md`. The `frontend/` layer is **code-derived** — it describes the system that actually exists, and each file marks its evidence as `[implemented]`, `[contract]`, or `[proposed]`. The `backend/` layer is **code-derived** for authentication, the M1 read path, the M2 share images, the M3 collection layer and the M4 measurement layer; no `[proposed]` milestone items remain. `.trellis/spec/` is the source of truth (it is what gets injected into sub-agents) and this file is kept in sync with it.

The **visual system** has its own tracked specification: `docs/dota2-visual-system.md` (Chinese). It owns the colour values, the panel geometry, the rarity ladder, the motion parameters, and the measured contrast table; it supersedes the visual parts of `docs/interaction-design-spec.md` §1.2 / §1.5 / §8.5. The interaction semantics of that PRD — state machines, the three-state data model, the error taxonomy, the ARIA contract — are **not** superseded and still bind.

### Repository layout — most of what you see is gitignored

`.gitignore` excludes `.trellis/`, `.claude/`, `.codegraph/`, and `AGENTS.md`. Those are **local-only** and never reach a commit. Effectively tracked: `src/`, `prompt/`, `media/`, `docs/`, `scripts/`, `public/`, `README.md`, `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `eslint.config.js`, `index.html`, `wrangler.jsonc`, `LICENSE` (MIT), `.gitignore`, and this `CLAUDE.md`.

| Path | Tracked | Purpose |
|---|---|---|
| `src/frontend/` | yes | The SPA — `styles/tokens.css` (the only place a hex/duration/easing is **hand-written**; the share card paints from the same tokens and `src/shared/tokens.generated.ts` mirrors them), `api/`, `components/`, `layouts/`, `routes/`, `lib/`, `i18n/` (provider, the `/manage` language preference, `Trans`, `errorMessage`), `mock/` |
| `src/shared/` | yes | The wire contract, the threshold table, the tier derivation, the topic resolver, the display copy, the number/date formatters, the i18n model + dictionaries, and the generated token mirror — imported by the SPA **and** the Worker, never re-declared |
| `src/worker/` | yes | The Cloudflare Worker — OAuth login, the two GitHub read endpoints, the two share routes, the five M3 collection routes, the metrics beacon, the `scheduled` cron handler, and a `501` stub for every other `/api/*` path (`auth/`, `api/`, `github/`, `derive/`, `cache/`, `share/`, `collect/`, `db/`, `env.ts`, `index.ts`) |
| `src/worker/collect/` | yes | The cron run: `budget.ts` (the per-run caps and `MAX_VERIFY_FAILURES`), `classify.ts` (one GitHub repo → verified / delisted / unverified), `run.ts` (discovery via `/search/repositories`, budgeted verification, the resumable cursor, cache invalidation, cache pruning) |
| `src/worker/db/` | yes | D1 access for the site's own tables: `schema.ts` (row types, `toBool`, `normalizeFullName`), `collect-store.ts`, `claim-store.ts`, `takedown-store.ts`, `metrics-store.ts` (`recordMetric`, the only metrics write path). Every read that fails returns an error, never an empty list |
| `src/worker/share/` | yes | The OG card: hand-written SVG (`svg.ts`), the data adapter (`facts.ts`), the resvg renderer plus its three per-locale subset font pairs (`render.ts`, `og-font.zh-Hans|zh-Hant|ja[-bold].ttf`), the glyph vocabulary (`og-vocabulary.json`), and the HTTP routes (`routes.ts`) |
| `migrations/` | yes | D1 migrations — `0001_repo_cache.sql` (`repo_cache`), `0002_collection.sql` (`collected_repo`, `repo_claim`, `takedown_request`, `collection_state`) and `0003_metrics.sql` (`metrics_daily`) |
| `README.md` | yes | The public front page — banner, CI / license / stack badges, the Deploy to Cloudflare button, the product boundaries, the environment-variable table, deploy steps, and the acknowledgements (English primary, Chinese summary) |
| `media/` | yes | Brand assets — `icon.jpg`, and the hand-authored `banner.svg` / `social-preview.svg` with the PNGs rendered from them (1600×480 and 1280×640) |
| `public/` | yes | Files copied verbatim into the build root, e.g. `favicon.svg` |
| `docs/` | yes | Shipped product specs and ops (Chinese) — `docs/interaction-design-spec.md` is the interaction PRD, `docs/dota2-visual-system.md` is the visual system, `docs/roadmap.md` is the advancement route, `docs/runbook.md` is the operator manual (deploy order, cron, takedown handling), `docs/metrics.md` is the measurement contract (the seven metrics, the event vocabulary, the privacy boundary, how to read the report) |
| `scripts/` | yes | The build/audit scripts and the metrics report — `audit-design-tokens.mjs` (the design-system guardrail), `build-tokens.mjs` (mirrors `tokens.css` into `src/shared/tokens.generated.ts`), `build-og-vocabulary.mjs` (reads the dictionaries and writes `og-vocabulary.json`), `build-og-font.mjs` (the three pinned font subsets, two weights each), `audit-og-font.mjs` (glyph coverage), `metrics-report.mjs` (read-only D1 report behind `npm run metrics`) |
| `package.json` / `package-lock.json` | yes | The pinned dependency set, the scripts, and the lockfile |
| `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `eslint.config.js` | yes | The build, test, type, and lint configuration |
| `wrangler.jsonc` | yes | The Cloudflare deployment configuration — static assets + SPA fallback + D1 + `run_worker_first` (`/api/*`, `/og/*`, `/u/*`) + the wasm/font bundle `rules` + the `REPO_TOPICS` var. Deliberately route-free with `workers_dev: true` (the Deploy-button template); CI injects the production domain and `workers_dev: false` |
| `.env.example` | yes | The documented environment variables — the topics list (`VITE_REPO_TOPICS` / `REPO_TOPICS`, defaulting to `repo-vessel,urn-of-repos`), the social links, the GitHub OAuth keys (`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `SESSION_SECRET` / `OAUTH_REDIRECT_URI`), and the server-side read token (`GITHUB_API_TOKEN`) |
| `.github/workflows/` | yes | `ci.yml` (typecheck · lint · test · build · audit:design · audit:og-font) and `deploy.yml` (`wrangler deploy` → Cloudflare Workers on `main`) |
| `public/badges/` | yes | The two achievement badge PNGs, served as-is and offered as downloads |
| `prompt/` | yes | The design revision chain (v1 → v4.1) and the competitor analysis (Chinese), kept as a public design archive |
| `.trellis/` | no | Workflow system: workflow.md, spec/, tasks/, scripts/, workspace/ |
| `.claude/` | no | Claude Code platform files: hooks, skills, sub-agents, settings.json |

`prompt/` and `.trellis/` are where all the project's knowledge lives. Read them before assuming anything about intent.

`prompt/` and `docs/` both ship with the repo. `prompt/` holds the design revision chain — kept public
as an archive of how the product was decided; `docs/` holds documents that are final enough to
implement against. When a `prompt/` document graduates to an implementation contract, promote it into
`docs/` rather than duplicating it.

### The stack (implemented)

- **Vite 8** + **React 19** + **TypeScript 5.9** + **Tailwind v4** SPA in `src/frontend/`. The build
  emits a **static** bundle into `dist/` — there is no Node SSR anywhere. Tailwind v4 is CSS-first:
  `src/frontend/styles/tokens.css` is one `@theme static` block, and Tailwind turns each token into
  both a CSS variable and a utility class, so `bg-gold` and `var(--color-gold)` cannot drift.
- **Cloudflare Workers** (`wrangler`, `.wrangler/`) + **D1** database (`wrangler d1 export` backups
  under `.release-backup-*/`). `wrangler.jsonc` binds `./dist` as static assets with a
  `single-page-application` fallback and `run_worker_first: ["/api/*", "/og/*", "/u/*"]`, so the SPA
  and the API share one origin and there is no CORS. The site was a static Cloudflare Pages project until GitHub OAuth
  landed; it now deploys with `wrangler deploy` to the custom domain `repovessel.lmlh.net`, and the old
  Pages project (`repo-vessel.pages.dev`) has been deleted. The committed `wrangler.jsonc` is
  deliberately route-free with `workers_dev: true`: it is the fork-friendly template behind the
  README's Deploy to Cloudflare button, which cannot know the deployer's domain. Production's route +
  `workers_dev: false` live in `wrangler.prod.jsonc` and in the CI patch step (below). `public/_redirects` was removed — under
  Workers assets its `/* /index.html 200` rule is an infinite loop, and `not_found_handling` already
  covers deep links.
- **D1 migrations** live in `migrations/` and are applied with
  `npx wrangler d1 migrations apply repo-vessel --remote --config wrangler.prod.jsonc` — **before**
  `wrangler deploy`. `0001_repo_cache.sql` creates `repo_cache` (`cache_key` PK, `payload`, `fetched_at`);
  `0002_collection.sql` creates `collected_repo`, `repo_claim`, `takedown_request` and `collection_state`;
  `0003_metrics.sql` creates `metrics_daily` (`day`, `event`, `dim`, `count`, PK on the first three).
  A missing table is not fatal but it is visible: cache reads/writes degrade to a miss, boards answer
  `failed` (never an empty list), the cron run returns early, and the metrics report says
  「未采集（迁移未应用）」. `docs/runbook.md` carries the exact production commands.
- **Share images** run on `@resvg/resvg-wasm` (a wasm SVG rasteriser) + two committed font subsets.
  Two `rules` entries in `wrangler.jsonc` are what make that work: `CompiledWasm` for `**/*.wasm` and
  `Data` for `**/*.ttf`. Without them the bundle fails to resolve the imports at deploy time. Any
  `wrangler*.jsonc` fork must carry the same two rules as well as the same `run_worker_first` list.
- Worker secrets are set once with `wrangler secret put GITHUB_CLIENT_SECRET` / `SESSION_SECRET` /
  `GITHUB_API_TOKEN` (`--config wrangler.prod.jsonc` for production); CI never touches them.
- `wrangler.prod.jsonc` — the maintainer's production deploy fork (real routes, resource ids, PII). Never commit it. **It must change in lockstep with `wrangler.jsonc`**: the `main` entry point, the Worker name, the D1 `database_name`, and the `REPO_TOPICS` var all have to match (the one intentional difference is `workers_dev` / `routes`: the tracked template stays deployable to `*.workers.dev`, production is the custom domain only), or `wrangler deploy` warns about a name / id mismatch — or refuses to deploy at all, because an assets-bound config without `main` is an assets-only Worker. It is not in the repository, so the maintainer carries that edit by hand.
- `.github/workflows/deploy.yml` needs three repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `D1_DATABASE_ID` (the workflow substitutes the latter for the all-zero placeholder in `wrangler.jsonc` and fails loudly if the placeholder is gone). The same patch step injects the production `routes` entry and flips `workers_dev` to `false`, also failing loudly if either anchor disappears.
- `.dev.vars` / `.dev.vars.example` — local Wrangler secrets.
- **`triggers.crons`** carries one line, `17 */6 * * *`. Both `wrangler.jsonc` and `wrangler.prod.jsonc`
  must have it — a prod fork without it deploys cleanly and then simply never collects.
- **Wrangler has no pin in `package.json`**, so `npx wrangler` resolves whatever is cached — and an
  older build refuses to start against `compatibility_date: 2026-10-30` ("the newest date supported by
  this server binary is …"). Locally use `npx --yes wrangler@4.156.0 dev` / `deploy`; CI pins the same
  version through `wranglerVersion: "4.156.0"` in `deploy.yml` — without it the action installs
  wrangler 3.90, which cannot read `wrangler.jsonc`'s `main` field and fails with `Missing entry-point`.
- Local-only, **not in the repo** (both are gitignored): `.deepseek-vl/` — local model assets;
  `scripts/ui-audit/` — Playwright MCP audit scripts, whose screenshots stay local.

Pinned versions (`package.json` has no floating ranges):

| Package | Version | | Package | Version |
|---|---|---|---|---|
| `react` / `react-dom` | 19.3.1 | | `vite` | 8.3.5 |
| `react-router-dom` | 7.18.5 | | `@vitejs/plugin-react` | 6.1.2 |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | | `typescript` | 5.9.3 |
| `eslint` | 10.13.0 | | `typescript-eslint` | 8.72.1 |
| `vitest` | 4.1.12 | | `jsdom` | 29.1.1 |
| `@testing-library/react` | 16.3.3 | | `@testing-library/jest-dom` | 7.0.1 |
| `@resvg/resvg-wasm` | 2.6.2 | | `subset-font` | 2.9.0 |

Node `>= 20.19.0`. `subset-font` is a build-time tool only — it never enters the Worker bundle. The
wasm and the fonts are the reason the Worker bundle is ~1 MB gzipped rather than ~38 KB; measured, the
startup cost is unchanged (3 ms), because the wasm is compiled at build time and instantiated lazily on
the first `/og/*` request.

### Build and check

```bash
npm install
npm run dev            # local dev server (Vite)
npm run build          # typecheck, then the static SPA into dist/
npm run preview        # serve the built output
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run test           # vitest run
npm run test:watch     # vitest, in watch mode
npm run tokens         # regenerate src/shared/tokens.generated.ts from tokens.css (design audit checks drift)
npm run og-vocabulary  # regenerate og-vocabulary.json from the dictionaries (run before og-font)
npm run og-font        # regenerate the six OG font subsets (three locales × two weights)
npm run audit:design   # the design-system guardrail: tokens, contrast, forbidden vocabulary
npm run audit:og-font  # does each subset font cover every glyph the OG card can draw?
npm run metrics -- --config wrangler.prod.jsonc   # read-only D1 report (see docs/metrics.md)
```

`trellis-check` runs `npm run typecheck` and `npm run lint`; `npm run test`, `npm run audit:design`,
`npm run build` and `npm run audit:og-font` are the other five gates (six in all, all of them in
`ci.yml`). `npm run audit:design` enforces the token rule — it fails the build if a hex, a duration,
or an easing curve appears outside `tokens.css`, if a token is missing from the built CSS, or if any
foreground colour drops below 4.5:1 on a surface. `npm run audit:og-font` catches the one failure that
no compiler or test can see: copy changed, font subset not regenerated, and a glyph silently renders
as a tofu box on the share image.

**Generated files — never hand-edit.** `src/shared/tokens.generated.ts` mirrors `tokens.css`
(`npm run tokens`; the design audit fails on drift, and ESLint's hex ban is switched off for this one
file for that reason), `src/worker/share/og-vocabulary.json` is generated by `build-og-vocabulary.mjs`,
and the six `og-font.*.ttf` files are `subset-font` output. All are committed so a plain
`npm install && npm run build` needs none of the scripts to run.

## Commands

All project workflow runs through Trellis. Python scripts are invoked from the repo root.

### Task lifecycle

```bash
python ./.trellis/scripts/task.py create "<title>" --slug <name>   # adds MM-DD- prefix itself
python ./.trellis/scripts/task.py current --source                 # active task + how it was resolved
python ./.trellis/scripts/task.py start <name>                     # planning -> in_progress
python ./.trellis/scripts/task.py finish                           # clear active pointer (status unchanged)
python ./.trellis/scripts/task.py archive <name>                   # -> completed, moves dir to archive/
python ./.trellis/scripts/task.py list [--mine] [--status <s>]
python ./.trellis/scripts/task.py validate <name>
```

Task directories live at `.trellis/tasks/{MM-DD-name}/` and hold `task.json`, `prd.md`, optional `design.md` / `implement.md`, optional `research/`, and the `implement.jsonl` / `check.jsonl` context manifests.

```bash
python ./.trellis/scripts/task.py add-context <name> implement "<path>" "<reason>"
python ./.trellis/scripts/task.py add-context <name> check "<path>" "<reason>"
python ./.trellis/scripts/task.py set-branch <name> <branch>
python ./.trellis/scripts/task.py create-pr [name] [--dry-run]
```

### Context, specs, session journal

```bash
python ./.trellis/scripts/get_context.py                            # full session runtime
python ./.trellis/scripts/get_context.py --mode packages            # packages + spec layers
python ./.trellis/scripts/get_context.py --mode phase --step 1.1    # detailed guide for one workflow step
python ./.trellis/scripts/get_context.py --mode record              # active tasks + git status + recent commits
python ./.trellis/scripts/add_session.py --title "T" --commit "hash1,hash2" --summary "S"
python ./.trellis/scripts/init_developer.py <your-name>            # first run only
```

### Trellis CLI

```bash
trellis mem search "keyword" --global --limit 20   # recall past sessions
trellis mem projects                               # which projects have session history
trellis channel spawn --agent implement            # multi-agent runtime
trellis workflow                                   # list/switch workflow.md template
trellis update                                     # push template updates into .trellis/
```

### Claude Code entries

Slash commands: `/trellis:continue`, `/trellis:finish-work`.
Skills: `trellis-brainstorm` (Phase 1 planning), `trellis-before-dev` (load specs before editing), `trellis-check` (verify), `trellis-update-spec` (Phase 3.3), `trellis-break-loop` (post-debug retrospective), `trellis-meta` (customize Trellis itself), `trellis-channel`, `trellis-session-insight`, `trellis-spec-bootstrap`.

**Gotcha:** `trellis-implement`, `trellis-check`, and `trellis-research` are **sub-agent types** (Task/Agent tool), not skills. There is no skill by those names.

## Product boundaries — these constrain any implementation

The latest design (`prompt/Urn of Shadows v4.1.md`) narrowed scope deliberately. Treat these as hard constraints, not preferences:

- **Public repos only.** No private repos, no org repos, no repos where the user is only a collaborator.
- **Personal accounts only.** An org account input is rejected without scanning.
- **Read-only.** The site never archives, deletes, syncs, renames, or modifies a GitHub repo. No write scopes in OAuth.
- **No repo code content.** Metadata only; no file trees, no README bodies, no secret/CVE scanning.
- **Opt-in for leaderboards.** Looking up a username previews; it never publishes. Only a personal public repo carrying the site's configured topic (default `repo-vessel`), discovered and verified by the site and not hidden by its owner, appears on a board.
- **Owner control.** The owner can claim a repo (GitHub login) to hide or restore it. A hidden repo stays hidden even if the topic remains. There must be a takedown path that does not require GitHub login.
- **Unknown ≠ zero.** Unavailable data (rate limit, pagination, unreachable upstream) must be shown as unknown/incomplete, never coerced to `0` or silently dropped. Rate limits must not be presented as an empty result set.
- **No inferred conclusions.** The product states facts, not verdicts: not "upstream is dead", not "your changes are all merged", not "this project failed". No work-hour estimates, no failure scores, no "most lazy developer" rankings.
- **Tone.** Tool surfaces say 沉睡 / 整理 / 保留 / 归档. Playful wording (余烬, 入龛, 时光收藏家) is allowed in leaderboards and share cards. Never shaming: no 废物项目 / 失败作者 / 垃圾代码.
- **Data must carry a timestamp** — verified-at time on cards, boards, and reports; stale data is shown as stale.
- **No auto-publishing.** Sharing is user-initiated, with a preview first. Never @ another user, never publish to a third platform.

A repo that turns private, moves to an org, or loses its topic must be delisted; if its state cannot be re-verified, hide it rather than assume it is still public.

## Product mechanics — the topics, the badges, the charge ladder, the slogan

### The topics are configuration

| Side | Variable | Default | Read at |
|---|---|---|---|
| SPA | `VITE_REPO_TOPICS` | `repo-vessel,urn-of-repos` | `src/frontend/lib/env.ts` (`import.meta.env.VITE_REPO_TOPICS`) |
| Worker | `REPO_TOPICS` (a `vars` binding) | `repo-vessel,urn-of-repos` | `src/worker/index.ts` (`env.REPO_TOPICS`) |

The value is a **comma-separated list**: a repository carrying **any** of the topics is enrolled. Both sides go through `resolveRepoTopicList()` in `src/shared/topic.ts` — the one rule (split → trim → lower-case → replace invalid characters → collapse separators → strip → cap at 35 → dedupe → fall back to the default list). **Never write a topic as a literal** in a component, a fixture, or a doc: import `REPO_TOPICS` / `REPO_TOPIC_LABEL` from `src/frontend/lib/env.ts` and render it. The Worker echoes its resolved list in an `x-repo-topics` response header, so a disagreement between the two sides shows up in one `curl`. The two defaults are the new name and the old name (`urn-of-repos`) — a rename should not drop the repos that already carry the old topic.

### The achievements (成就徽章)

Two badges, derived from the same count as the charge ladder — no new thresholds:

| Badge | Unlock | Art |
|---|---|---|
| `urn-of-repos` | ≥ 10 topic-carrying public repos (Ⅲ 阶) | `public/badges/urn-of-repos.png` |
| `repo-vessel` | ≥ 25 topic-carrying public repos (Ⅳ 阶) | `public/badges/repo-vessel.png` |

- The definitions live in `src/shared/achievements.ts` (`ACHIEVEMENTS`, `earnedAchievements`, `achievementRemaining`); the thresholds come from `src/shared/thresholds.ts` and are never re-typed.
- **Unknown ≠ zero.** `earnedAchievements(null)` returns `null`, not `[]`; the UI renders `? 未知` and claims nothing.
- An earned badge can be downloaded (the original PNG) and shared. Achievements are derived from the current count, not stored — if the count drops, the badge is no longer shown.

### The social links and the GitHub seam

All are configuration, documented in `.env.example`; an empty value falls back to the default
rather than producing a broken link. The first four are read once in `src/frontend/lib/env.ts`;
`VITE_SITE_URL` is read by `vite.config.ts` at build time, because Open Graph needs an absolute URL.

| Variable | Default | Used by |
|---|---|---|
| `VITE_TWITTER_HANDLE` | `limccn` | The footer's Twitter / X link (`TWITTER_URL`); a leading `@` is stripped |
| `VITE_GITHUB_REPO_URL` | `https://github.com/limccn/repo-vessel` | The footer's repository link (`GITHUB_REPO_URL`) |
| `VITE_SITE_URL` | `https://repovessel.lmlh.net` | `og:url` / `og:image` / `twitter:image` in `index.html`, substituted for `%SITE_URL%` by the `inject-site-url` plugin. **Not** the same as the runtime `SITE_URL` in `env.ts`, which takes `location.origin` for share links. `/u/:username` overrides the three per-user values at request time from the actual request origin |
| `GITHUB_CLIENT_ID` | empty | The OAuth flow — a public value, so it may sit in a `vars` block |
| `GITHUB_CLIENT_SECRET` | empty | The OAuth token exchange — a Wrangler **secret** (`wrangler secret put`), never in a `vars` block or a committed file |
| `SESSION_SECRET` | empty | The HMAC key that signs the session cookie (`src/worker/auth/session.ts`). Missing → every login fails closed with `?auth=unconfigured`; there is no unsigned fallback |
| `OAUTH_REDIRECT_URI` | derived | Optional override for the callback URL; by default it is `<origin>/api/auth/callback` |
| `GITHUB_API_TOKEN` | empty | The **server-side read token** — a classic PAT with **zero scopes**, used only for `api.github.com` reads. A Wrangler **secret**; missing → reads fail with `upstream_unavailable`, never an anonymous fallback |

- The sign-in control in the header is the **Octocat mark alone** (`components/common/OctocatIcon.tsx`), with `COPY.nav.signIn` as its `aria-label` — the text is in the accessible name, never dropped. It is a real `<a href="/api/auth/login">`, not a button, because sign-in must be a full-page navigation.
- Sharing is the `SharePanel` on the dashboard: a **preview first** (`blockquote`), then a real `<a>` to the Twitter intent URL, clipboard buttons, a **save-image** button (1080×1440 PNG), and a badge download. 系统分享 appears only when `navigator.canShare({ files })` is true — the panel never shows a button that would do nothing. 朋友圈 has no web share API, so the panel says to copy the text and paste it. Nothing is auto-published and no one is ever `@`-mentioned — the share text builder in `src/frontend/lib/share.ts` returns `null` rather than a sentence with a fabricated count, and `buildShareCardModel` in `src/frontend/lib/shareCard.ts` returns `? 未知` rather than a zero.

### GitHub OAuth — read-only, stateless, fails closed

Five endpoints in `src/worker/auth/`:

| Route | Method | Behaviour |
|---|---|---|
| `/api/auth/login` | GET | Sets a `rv_oauth_state` cookie (10 min, `HttpOnly`, `SameSite=Lax`) and 302s to GitHub with `scope=read:user` |
| `/api/auth/callback` | GET | Verifies `state`, exchanges the code, reads `/user`, sets the signed session cookie, 302s to `/manage` |
| `/api/auth/session` | GET | `{ login, lang }` when signed in, `401` when not — never a fabricated user |
| `/api/session/locale` | POST | Re-signs the session with `{ lang: "en" \| "zh" \| "ja" \| null }`, same `exp`; `401` without a session |
| `/api/session` | DELETE | Clears the session cookie, `204` |

- **`read:user` is the only scope.** The site never asks for repo write access, and there is no token in the browser — the GitHub access token is used in the Worker and discarded.
- **The session is stateless**: a `v1.<b64url(payload)>.<b64url(hmac)>` cookie signed with `SESSION_SECRET` via Web Crypto, 30-day TTL, `HttpOnly` + `Secure` + `SameSite=Lax`. No D1 row, no KV entry. Tamper, wrong key, or expiry all verify to `null` → signed out.
- **Fails closed**: if any of the client id / client secret / session secret is missing, login 302s to `/manage?auth=unconfigured` rather than starting a half-configured flow. Failures use reason codes (`denied | state | exchange | profile | personal-only`) that `ManageRoute` maps to Chinese copy.
- **Personal accounts only** applies here too: a token whose `/user.type` is not `User` is rejected with `?auth=personal-only`.
- The site has exactly **one** origin: `https://repovessel.lmlh.net`, a Workers custom domain declared in `wrangler.prod.jsonc` and injected into `wrangler.jsonc` by the CI patch step, with `workers_dev: false`. The `*.workers.dev` subdomain is switched off on purpose — it is DNS-poisoned on some networks, and a second dead URL only invites confusion. A fork that uses the Deploy button gets the `*.workers.dev` URL instead, because the template cannot claim a domain it does not own. The GitHub OAuth App's Authorization callback URL must be `https://repovessel.lmlh.net/api/auth/callback`; GitHub allows one callback per app, so local development needs a separate OAuth App pointing at `http://localhost:8787/api/auth/callback`. Signing in is not a claim, a hide, or a publish — the manage page says so.

### GitHub reads — server-side, cached, derived

Two endpoints in `src/worker/api/` serve the SPA's data:

| Route | Behaviour |
|---|---|
| `/api/inspect/:username` | Validates the username, rejects organizations, reads the personal account's **public owned repos** (`type=owner`, `pushed asc`), resolves Fork upstreams, derives every field server-side, returns `Envelope<InspectPayload>` |
| `/api/repos/:owner/:repo` | One repo's public metadata + its `parent` — the reliable upstream source and the future share-card input |

- **`GITHUB_API_TOKEN` is a classic PAT with zero scopes** — an authenticated anonymous visitor: 5 000 requests/hour, no private or write access. Fine-grained PATs are owner-scoped and cannot read arbitrary users' public repos; `public_repo` carries write permission and is forbidden. It is separate from the OAuth credentials: one reads data, the other proves identity.
- `src/worker/github/client.ts` is the **only** place that calls `api.github.com`. It sets the auth header, a `user-agent`, an 8 s abort, and classifies failures (`not-found | rate-limited | timeout | unavailable | unconfigured`). `src/worker/api/respond.ts` is the only translator from those to the product error taxonomy.
- **All derivation happens server-side** (`src/worker/derive/`): `dormantDays`, tags, counts, title, representatives. The client renders ids; it never re-derives a rule.
- **D1 caches the assembled envelope**, not the raw JSON, so `readAt` and every derived number share one instant. TTL: 6 h per user, 24 h per repo. `failed` envelopes are never cached; cache failures degrade to a miss. An expired hit is served **as-is** while `ctx.waitUntil` refreshes it — `completeness` describes that read, and age is carried by `readAt`.
- **Pagination reads 10 pages / 1 000 repos maximum**, newest-pushed last. Truncation drops the *most recently active* repos, so only `longestDormantDays` stays trustworthy; every other count becomes `null` rather than a partial sum.
- **Fork upstreams** need one extra `GET /repos/:owner/:repo` per fork because the list endpoint omits `parent`. At most 25 forks (the most dormant) are resolved, 8 at a time; the rest stay `unresolved` — an honest "we could not tell where it came from".

### Share images — two PNGs, one set of facts

A result leaves the site in two forms, both of them images: the **client card** and the **link preview**.

| Surface | What it is | Where |
|---|---|---|
| `SharePanel` → 保存图片 | A 1080×1440 PNG painted on a `<canvas>` in the browser | `src/frontend/lib/shareCard.ts` |
| `GET /og/u/:username` | A 1200×630 PNG rendered server-side | `src/worker/share/routes.ts` → `render.ts` |
| `GET /u/:username` | The SPA's `index.html` with that user's preview meta swapped in | `src/worker/share/routes.ts` → `HTMLRewriter` |

- **The client card writes no hex.** `readCardPalette()` reads the CSS custom properties off
  `document.documentElement`; if any of them is empty the canvas is treated as unavailable and the
  image buttons simply do not render — no broken button, no fallback palette.
- **The server card writes no copy of its own.** Labels come from `SITE_COPY.shareCard` /
  `TIER_COPY`, the title name from `TITLE_LABELS`, numbers from `src/shared/format.ts` — the page and
  the card say the same sentence about the same fact. Colours come from
  `src/shared/tokens.generated.ts`, the read-only mirror of `tokens.css`, because resvg does not
  resolve CSS variables and a real value still needs one handwritten source.
- **Unknown is drawn, not hidden.** A missing user, an organisation, a rate limit — the card still
  renders, with `? 未知` in every slot that has no fact (including the title). Only a *render* failure
  (wasm, font) falls back with a `302` to `/icon.jpg`: a brand image beats a broken one.
- **The two routes are fed by the same loader.** `/og/u/:username` calls `loadInspectEnvelope`, the
  exact function `/api/inspect` uses, so the card's `readAt` and the page's numbers are one instant.
- **`/u/*` rewrites only what the URL decides** — `og:title`, `og:url`, `og:image`, and the
  `twitter:card: summary_large_image` override. The statistics are read by the crawler afterwards,
  when it fetches the image; doing a GitHub read before returning HTML would cost seconds of TTFB.
- **PNGs live in the Cache API, not D1** (`caches.default`, 6 h, key normalised to lower case and to
  `?lang=<locale>` — every other query parameter is dropped). A 40 KB reproducible image does not
  deserve a table, a migration and a backup. The image is rendered only when the key misses.
- **The font is six pinned static subsets, not variable fonts.** resvg does not interpolate a
  variable font's weight axis — measured, `font-weight="700"` and `400` produced byte-identical PNGs
  from a single-axis subset. So each locale gets a wght-400 and a wght-700 file
  (`og-font.zh-Hans|zh-Hant|ja[-bold].ttf`, 76–84 KB each, ~476 KB in all), and `en` reuses the SC pair
  because every subset carries the printable ASCII range. Family names (`Noto Sans SC` / `TC` / `JP`)
  are declared once in `src/worker/share/svg.ts` (`ogFontFamily()`); if a subset's family name and that
  table ever disagree, the text vanishes from the card without an error.
- **The glyph vocabulary is data.** `src/worker/share/og-vocabulary.json` lists every fixed character
  the card can draw, per locale, plus the printable ASCII range. It is **generated** from the
  dictionaries by `build-og-vocabulary.mjs` (`CARD_MSGIDS` there names every string the card draws);
  `build-og-font.mjs` and `audit-og-font.mjs` read it. Edit the copy → `npm run og-vocabulary` →
  `npm run og-font` → `npm run audit:og-font`. `svg.test.ts` closes the loop from the other side: every
  character a rendered card actually contains must be in the vocabulary. It is JSON, not `.ts`,
  because the `.mjs` scripts must run on Node 20, which cannot import TypeScript.
- **Licences.** `@resvg/resvg-wasm` is **MPL-2.0**, used unmodified as a dependency (no file-level
  changes, so nothing to publish back). The subset fonts are derived from **Noto Sans SC / TC / JP**,
  which are **OFL-1.1** — redistributable, including as a subset, with the licence notice retained.
  All are compatible with this repo's MIT `LICENSE`.

### Collection — the cron, the boards, the exit hatches

M3 turned the site from "look at yourself" into "look at everyone", so it shipped as one unit: a board
without an exit is a listing of other people's repos with no way to take yours back.

**The cron** (`src/worker/collect/run.ts`, `scheduled` in `src/worker/index.ts`) runs every six hours
and spends two budgets: `SEARCH_BUDGET = 8` search pages (`/search/repositories?q=topic:<t>`,
`sort=updated`) and `VERIFY_BUDGET = 40` confirmations (`GET /repos/:owner/:name`, 8 at a time).
A cursor in `collection_state` makes the walk resumable across runs; `cycle` counts completed sweeps.

- **Discovery is free.** The search payload already carries every field `collected_repo` stores, so a
  discovered repo is written from that payload. Verification re-reads it later and refreshes the row.
- **Six consecutive failures, not one.** `MAX_VERIFY_FAILURES = 6` (`src/worker/collect/budget.ts`):
  one failed read is far more often a rate limit or a timeout than a vanished repo, and flipping on the
  first would turn "the network hiccuped" into "it's gone". A successful read clears the count.
  **A rate-limited run records no failure at all** — a quota problem is not the repository's problem.
- **A 404 delists as `private`.** Deleted and private are indistinguishable from outside, and both mean
  "cannot be shown".
- **`hidden_by` is never cleared by an upsert.** The `ON CONFLICT` clause in `collect-store.ts` lists its
  columns explicitly for exactly this reason: a rescan must not resurrect a repo the owner hid.

Five routes serve the SPA:

| Route | Auth | Behaviour |
|---|---|---|
| `GET /api/board/:board` | none | D1 only, **zero upstream calls**. `longest-sleep` (dormant ≥ 181 d, pushed asc), `embers` (≥ 365 d and ≥ 32 stars, stars desc), `forks` (`is_fork = 1`). Top 50 |
| `GET /api/collection-status?repo=owner/name` | none | D1 first; a live GitHub read only when D1 has no answer. Five states — `collected / pending / no-topic / not-eligible / unconfirmed` |
| `GET POST PATCH /api/claim/:owner/:repo` | session | GET is 200 for anyone (claiming is per-account); POST runs the four checks; PATCH toggles `hidden` |
| `GET /api/claims` | session | The manage page's list, joined against the repo's current state |
| `POST /api/takedown` · `GET /api/takedown/:ticket` | none | The anonymous exit hatch: a ticket and a status lookup |

- **`unconfirmed` is a first-class answer.** It says "we could not confirm this time", not "it has no
  topic" — only `no-topic` may tell a user to go change something. The board and the status route never
  degrade a read failure into a factual answer.
- **A board is D1-only.** Its `readAt` is the D1 read instant; age is carried by that timestamp. A D1
  failure is `failed`, never "no repos are sleeping today". Boards are cached in `repo_cache` for an hour
  with the usual stale-serve-while-refreshing rule.
- **Claiming does not create enrolment.** Only a `verified` row can be claimed (`not_enrolled`
  otherwise), and restoring a hidden repo re-checks that it is still `verified`. The four checks run in
  a deliberate order: not yours → not enrolled → it's an org → it's private.
- **Takedown submissions do not auto-hide.** An anonymous submission cannot distinguish the owner from
  anyone else; applying it immediately would hand everyone a "make any repo disappear" button. The
  ticket is stored (`status = 'received'`, 24-hour SLA in the payload) and a maintainer processes it
  with `wrangler d1 execute` — `docs/runbook.md` §3. Takedown requests store only `HMAC(ip, SESSION_SECRET)`:
  rate limiting needs "same source", not "who".
- **Invalidation is targeted.** `src/worker/cache/invalidate.ts` deletes the user's envelope key, the
  three board keys and the OG Cache-API entry. A stale board would otherwise keep showing a repo the
  owner just hid for up to an hour.

### Measurement — anonymous counters, one read-only report

M4 answers v4.1 §17's seven metrics without a third-party analytics service, a new secret, or an admin
interface. The contract is `docs/metrics.md`; `POST /api/metrics/event` is the only route added.

| Piece | Where |
|---|---|
| Event vocabulary + per-event `dim` validation | `src/shared/metrics.ts` — imported by both sides; `dim` is a controlled string (`route=home,src=direct`, `topic=<slug>`, `claim:ok`, …), never free text |
| Storage | `metrics_daily (day, event, dim, count)`, PK on the first three — **day × event × dim is one row**, so the table never grows with visitors and no row can be resolved to a person. `migrations/0003_metrics.sql` |
| Write path | `recordMetric` in `src/worker/db/metrics-store.ts`: validates the dim, skips `amount === 0`, swallows failures, uses `ctx.waitUntil` on request paths. It is the only metrics writer |
| Client events | `page_view`, `share_card`, `topic_copy` — sent by `src/frontend/lib/analytics.ts` via `sendBeacon` (fetch fallback with `keepalive`); DNT / GPC send nothing; every failure is silent |
| Server events | `inspect_read`, `claim_action`, `takedown_submit`, `userpage_view`, `collect_run` — recorded in the inspect / claim / takedown / user-page handlers and at the end of the cron run |
| Report | `scripts/metrics-report.mjs` — two `SELECT`s through `wrangler d1 execute`, aggregation in Node, Markdown or `--json`; `npm run metrics -- --config wrangler.prod.jsonc` |

- **Metrics are a side channel.** The beacon answers `204` even when D1 is missing or the write fails.
  No main-path response depends on a metric, and a metric failure is never surfaced to a user.
- **Unknown ≠ zero.** The report distinguishes 未采集 (no rows / no table) from `0` (a real zero) and
  flags windows under 100 events as 样本不足. `handleInspect` records `failed:<code>` per reason, so a
  rate limit and a typo never merge into one "failure" number.
- **No identifiers.** The table has no IP, UA, cookie, session or user column; the `dim` charset cannot
  carry a username, repo name, URL, or path parameter. `/how` §五 states the same promise, and
  `docs/metrics.md` §七 is the normative copy — change them together.
- **Report command:** `npm run metrics` (remote, 30 days) · `--days 7 --out <path>` · `--local` ·
  `--json`. A missing `metrics_daily` prints 「未采集（迁移未应用）」 and exits 0; the report never runs
  in CI and is never auto-committed.

### The charge ladder (灵龛充能等级)

A **user**-side ladder derived from the count of topic-carrying public repos — the Dota mechanic we borrowed: the urn fills with the fallen, and at the top it upgrades into the vessel (影之灵龛 → 魂之灵龛 → 码之灵龛).

| Tier | Repos | Label | Stars |
|---|---|---|---|
| `unsealed` | 0 | 未启封 | — |
| `i` | 1–4 | Ⅰ 阶 | ★ |
| `ii` | 5–9 | Ⅱ 阶 | ★★ |
| `iii` | 10–24 | Ⅲ 阶 | ★★★ |
| `iv` | 25+ | Ⅳ 阶 | ★★★★ |

- The thresholds live in `src/shared/thresholds.ts` (`tierIMinRepos` / `tierIIMinRepos` / `tierIIIMinRepos` / `tierIVMinRepos`), beside every other published threshold; the labels in `src/shared/ids.ts` (`TIER_LABELS`); the derivation in `src/shared/tier.ts`.
- **The tier is derived, never transmitted.** The payload carries `enrolledCount: number | null`; `null` — or the field being absent — means **unknown**, and the UI renders `? 未知`. It never falls back to 未启封, which would be a claim about zero.
- **No 金 / 银 / 铜.** The tier reads as a Roman numeral plus the 阶 suffix and the star stack carries the magnitude. Both are always visible, so the tier is never carried by colour alone.
- This ladder grades a **user**; the rarity ladder (`docs/dota2-visual-system.md` §4) grades a **repository** by dormancy. Two axes: the tier borrows **no** `--rarity-*` variable and wears no rarity badge, and its charge meter uses the base meter gradient — deliberately different from every rarity gradient, so one gold bar never carries two meanings on the same screen.
- The charge meter fills toward the **top of the current band**, so it is never empty for a tier ≥ Ⅰ; the remaining count is carried by text, not by the bar.

### The slogan

> 当一个项目在战场上倒下，它的灰烬便会归于此龛。充能完毕，随时准备为下一个项目注入生命。

It lives once, in `src/shared/copy.ts`. It appears in the landing hero (under the nameplate, above the `h1`), and its second sentence is the Ⅳ 阶 description. It never appears on a card, a board, or a report, where a factual reading would be possible.

### i18n — four locales, English by default

Four locales ship: **`en` (default), `zh-Hans`, `zh-Hant`, `ja`**. English is the product's default
and its fallback — a visitor whose browser asks for anything the site does not speak lands on English.

**The Simplified-Chinese source string is the msgid.** There is no key namespace and no separate
English source table: `t("码之灵龛", undefined, "zh-Hans")` returns the argument unchanged, and
`src/shared/i18n-dictionaries.ts` holds only `EN` / `ZH_HANT` / `JA`. Adding a string means writing
the Chinese sentence where it is used and adding its translation to the three tables; a missing entry
falls back to the Chinese msgid, never to English (a Chinese reader seeing an untranslated English
sentence is worse than seeing an untranslated Chinese one).

- **Detection, client:** URL `?lang=` → the signed-in preference → `localStorage["rv_locale"]` →
  `navigator.languages` → `en` (`detectLocale()` in `src/shared/i18n.ts`, wrapped by
  `LocaleProvider`). `?lang=` always wins, because a shared link must open in the sharer's language;
  the signed-in preference is applied by `LocaleProvider` after it reads `/api/auth/session`.
- **There is no language control in the header.** An anonymous visitor gets their browser's language.
  A signed-in user picks one of **three** values — ENGLISH / 中文 / 日本語 — in `/manage`
  (`src/frontend/i18n/LanguagePreference.tsx`). 中文 is a single choice: `resolveLocalePreference()`
  turns it into `zh-Hans` or `zh-Hant` from the browser's region (`zh-TW` / `zh-HK` / `zh-MO` →
  Traditional, every other `zh` → Simplified), so the user never has to know the two tags exist.
- **The preference is a claim in the session cookie**, not a table row: `POST /api/session/locale`
  re-signs the same session with `lang: "en" | "zh" | "ja" | null` and the **same `exp`** (changing
  language must not silently renew a 30-day login). An old session without `lang` stays valid; an
  unrecognised `lang` is dropped rather than failing the session. The SPA mirrors the resolved locale
  into `localStorage`, so the next first paint in that browser is already correct and the async
  correction only happens on a new device. Choosing a language writes `?lang=` to the URL (that is the
  share carrier); the session-driven correction deliberately does **not**.
- **Detection, server:** `?lang=` → `x-rv-locale` header → `Accept-Language` → `en`
  (`localeFromRequest()`). The SPA sends `x-rv-locale` on every read; the Worker echoes the resolved
  list in `x-repo-topics` while the locale picks the payload's prose.
- **What is localized server-side.** Only payload text the client renders as-is: the title name and
  its evidence, the board name / description / criteria, and the plain-text error bodies. Everything
  else — buttons, labels, errors carried in an envelope — is localized in the client. Server `message`
  strings are **written as msgids**, so `errorMessage(error, locale)` is `t(error.message)` and a new
  server error needs no second table.
- **Caches are per-locale.** `user:<login>:<locale>`, `board:<id>:<locale>`, and the OG Cache-API key
  `/og/u/<login>?lang=<locale>`. Without the locale in the key the first card rendered in Chinese
  would feed every later language for six hours. `invalidate.ts` clears all four locales at once.
- **The OG card speaks the sharer's language.** `?lang=` on the share URL is the only carrier a
  crawler will pass along, so `/u/:login` writes it into `og:image` (omitted for the default locale),
  and `/og/u/:login` reads it back. Three static font pairs — `og-font.zh-Hans|zh-Hant|ja[-bold].ttf`
  — because resvg cannot pick fallbacks; `en` reuses the SC pair (Latin glyphs are in every subset).
  `:lang(ja)` / `:lang(zh-Hant)` in `global.css` swap the UI and display font stacks, so 直 / 骨 / 說
  are drawn with the right regional glyphs.
- **Room:** copy is never truncated, text controls have no fixed width, and no line has a hard-coded
  Chinese break. `truncate` stays on repository content and monospace identifiers — user data, not copy.
- **`npm run test` guards the dictionaries**: every entry non-empty, every `{placeholder}` set equal to
  its msgid's, and no CJK left in an English value (that is always a missed translation).

## Design source of truth

`prompt/` is a revision chain — each file supersedes the previous one, and older files contain features that were deliberately cut:

| File | Status |
|---|---|
| `Urn of Shadows v1.md` | Initial vision (community, gamification). **Superseded.** |
| `Urn of Shadows v2.md` | Product definition v0.1 (Dota metaphors, charging/badges, Agent Skill, MCP). **Superseded.** |
| `Urn of Shadows v3.md` | Product design v3.0 (Fork provenance, "余热" extraction, private-repo path). **Superseded.** |
| `Urn of Shadows v4.md` | Product design v4.0 (lightweight, Topic-first). **Superseded.** |
| `Urn of Shadows v4.1.md` | **Latest.** Entertainment-first, read-only, personal public repos only. Authoritative. |
| `沉睡仓库产品竞品分析.md` | Competitor analysis (VibeCemetery, Lazarus, CodeFossils, Stale Fork Manager, repjan, …). Positioning input, not scope. |

The file names in that table are the **historical revision chain** and are kept as they are — they are how the design archive is indexed, not how the product is called. The product is 码之灵龛 / Repo Vessel as of 2026-10-31; `prompt/` ships as a public design archive, and its internal product names were left alone rather than rewritten in place.

When a feature appears only in v1–v3 (回魂录 stories, annual reports, Agent Skill/MCP, private-repo scanning, org repos, batch archiving, secret scanning), it is **out of scope** — do not implement it without the user explicitly re-opening the decision.

One v1–v3 feature **was** re-opened, on 2026-10-31: 充能 / charging. What exists now is the 灵龛充能等级 — a ladder **derived** from the number of topic-carrying public repos, published as thresholds, and read-only. The v1–v3 idea of *earning* charge (points, purchase, badges, a leaderboard of charge) was not re-opened and stays out of scope: a user cannot buy, farm, or convert charge.

## Trellis workflow

`AGENTS.md` and `.trellis/workflow.md` own the workflow; `.trellis/spec/` owns the coding conventions. Three phases: **Plan** (create task → brainstorm → research → curate context → start) → **Execute** (implement → check → rollback) → **Finish** (retrospective → spec update → commit → `/trellis:finish-work`).

Key mechanics:

- A per-turn `<workflow-state>` breadcrumb is injected by `.claude/hooks/inject-workflow-state.py`; the `[workflow-state:*]` blocks in `.trellis/workflow.md` are the single source of truth for that text. The hook has no fallback dict — if a status block is missing, the breadcrumb degrades visibly.
- With no active task, **classify the request and ask for task-creation consent before creating any Trellis task.** Task-creation approval is not implementation approval; `task.py start` is the gate.
- Complex tasks need `prd.md` + `design.md` + `implement.md` before `start`. Lightweight tasks may be PRD-only.
- `implement.jsonl` / `check.jsonl` are the context manifests injected into the implement/check sub-agents. Both need at least one real entry before `task.py start` on sub-agent-dispatch platforms (Claude Code).
- Phase 3.4 commits are batched and AI-driven: classify dirty files into "edited this session" vs. unrecognized, present one plan, get one confirmation, then commit. Never amend, never push. Work commits land before the archive commit and the journal commit.
- Sub-agent dispatch prompt starts with `Active task: <path from task.py current>`.

## Conventions

- **Language:** product design docs and user-facing copy are Chinese; `.trellis/spec/` documentation is English (stated in both spec index files). Code identifiers in English.
- **Spec files** live at `.trellis/spec/<package>/<layer>/index.md` plus detail files. Each index carries a Pre-Development Checklist and a Quality Check section. The `frontend/` specs are **code-derived** — they describe the SPA that exists, so read the "Status — read this first" note at the top of the index before relying on a `[proposed]` item. The `backend/` specs are still **contract-derived** — no server code exists yet, so its `[proposed]` items are proposals.
- `.trellis/spec/guides/` holds cross-cutting thinking guides (code reuse, cross-layer data flow). Read them before adding a utility or a new field that crosses layers.
- `trellis-check` auto-fixes findings it finds; it does not just report.
