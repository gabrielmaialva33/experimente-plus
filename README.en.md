<div align="center">

<img src=".github/assets/readme-hero.svg" alt="Experimente+ — Regional multi-city discovery" width="100%"/>

**Closer than you think. More interesting than you expected.**

<p>
  <a href="https://adonisjs.com/"><img src="https://img.shields.io/badge/AdonisJS-7-5A45FF?style=flat-square&labelColor=101214" alt="AdonisJS 7"/></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-1CD6F4?style=flat-square&labelColor=101214" alt="React 19"/></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&labelColor=101214" alt="PostgreSQL 16"/></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis-cache%20%2B%20queue-DC382D?style=flat-square&labelColor=101214" alt="Redis"/></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&labelColor=101214" alt="TailwindCSS v4"/></a>
  <a href="./docs/product/README.md"><img src="https://img.shields.io/badge/domain-regional%20discovery-CE4A09?style=flat-square&labelColor=101214" alt="Regional discovery"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-A1A5B7?style=flat-square&labelColor=101214" alt="MIT"/></a>
</p>

<p>
  <a href="README.md">Português</a>
  ·
  <a href="README.en.md">English</a>
</p>

---

_"City and category are discovery dimensions. A tenant is an isolated platform operation."_

</div>

---

> [!IMPORTANT]
> **Discovery first, no sign-up required.** Experimente+ is a multi-city, multi-category regional
> guide: it surfaces restaurants, cafés, culture, wellness, and local services with listings
> reviewed before publication. The public catalog is resolved per operation, not per membership —
> nobody needs an account to explore.

> [!NOTE]
> **Built for a real region.** The initial launch is northern Paraná, around Cornélio Procópio,
> Londrina, and nearby municipalities. Restaurants, bars, and cafés are the core, but the product
> stays extensible to cinemas, tattoo studios, leisure, culture, and other local services.
> Tour Londrina is a product-experience reference, not a functional contract to copy.

---

## Quick start

```bash
# Dependencies
mise use node@24
pnpm install --frozen-lockfile

# Local environment
cp .env.example .env
pnpm ace generate:key

# Infrastructure
docker compose up -d postgres redis mailpit

# Database and development data
pnpm ace migration:run
pnpm ace db:seed

# Adonis + Inertia dev server with HMR
pnpm dev
```

The app serves on `http://localhost:3333`. Prerequisites: Node.js 24 (per `.nvmrc`), pnpm 11, and
Docker Compose.

---

## What it does

| Layer              | Purpose                                                                    | Where it lives                           |
| :----------------- | :------------------------------------------------------------------------- | :--------------------------------------- |
| **Geography**      | Regions, cities, and the public geography catalog.                         | `app/modules/geography/`                 |
| **Taxonomy**       | Hierarchical categories with typed attributes and effective inheritance.   | `app/modules/taxonomy/`                  |
| **Organizations**  | Memberships, invitations, and transactional claims over establishments.    | `app/modules/organizations/`             |
| **Establishments** | Stable identity with revisioned public content and versioned completeness. | `app/modules/establishments/`            |
| **Moderation**     | Submission, publication gates, and revision history.                       | `app/modules/establishments/` · `media/` |
| **Catalog**        | Public discovery by city and category, served from a projection.           | `app/modules/catalog/`                   |
| **Benefits**       | Editions, offers, accesses, and redemptions in the consumer wallet.        | `app/modules/benefits/`                  |
| **Analytics**      | Impressions, contact clicks, and searches without results, with retention. | `app/modules/analytics/`                 |

---

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'fontFamily': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'lineColor': '#64748b',
  'primaryTextColor': '#111827',
  'clusterBkg': '#f8fafc',
  'clusterBorder': '#94a3b8'
}}}%%
flowchart LR
    subgraph Public["Public discovery (no login)"]
        Cat["Catalog<br/>cities · categories · listings"]
        Wal["Wallet<br/>benefits and redemptions"]
    end

    subgraph Ops["Authenticated portals"]
        Portal["Partner portal<br/>establishment editor"]
        Back["Backoffice<br/>moderation and benefits"]
    end

    subgraph Core["AdonisJS 7 · app/modules"]
        Resolver["Public operation resolver"]
        Domain["Domains<br/>geography · taxonomy · organizations"]
        RBAC["RBAC + ownership<br/>N:N multi-tenant"]
    end

    subgraph Data["Persistence"]
        PG[("PostgreSQL<br/>catalog projection")]
        RD[("Redis<br/>cache · session · queue")]
    end

    Cat --> Resolver
    Wal --> RBAC
    Portal --> RBAC
    Back --> RBAC
    Resolver --> Domain
    RBAC --> Domain
    Domain --> PG
    Domain --> RD
```

The public catalog resolves the operation from the hostname or `PUBLIC_TENANT_SLUG`, without
requiring membership. Authenticated areas go through RBAC, contextual permissions, and ownership.

---

## Structure

```text
app/modules/<domain>/   full backend domain
app/shared/             cross-cutting infrastructure
database/               migrations, factories, and seeders
inertia/                pages, layouts, components, and hooks
resources/              translations, Edge templates, and emails
tests/                  unit, functional, and browser tests
docs/product/           vision, MVP, roadmap, and product decisions
docs/architecture/      ADRs and accepted technical contracts
docs/                   OpenAPI, Redoc, and HTTP requests
```

Each domain keeps its controllers, services, repositories, models, validators, and routes together.
Adonis generators emit files into the default layout; move the result into `app/modules/<domain>/`
and rewrite the imports to `#modules/*` and `#shared/*`.

---

## Local environment

| Service      | Address                      |
| ------------ | ---------------------------- |
| Application  | `http://localhost:3333`      |
| PostgreSQL   | `localhost:5435`             |
| Redis        | `localhost:6381`             |
| Mailpit SMTP | `localhost:1026`             |
| Mailpit UI   | `http://localhost:8026`      |
| Redoc        | `http://localhost:3333/docs` |

Ports are configurable through `.env`.

### Development accounts

The seeder creates three deterministic accounts that cover the full pilot journey:

```text
Admin:    admin@experimente.local
Partner:  partner@experimente.local
Customer: cliente@experimente.local
Password: experimente123
```

> [!WARNING]
> These credentials exist for the local environment only and must never reach a host that is
> reachable from the internet. They are configurable through `DEV_ADMIN_*`, `DEV_PARTNER_*`, and
> `DEV_CUSTOMER_*`. The regional data, establishments, offers, and accesses the seeder creates are
> fictional.

The seeder is `static environment = ['development']`: it is skipped under `NODE_ENV=production`.

---

## Commands

```bash
pnpm dev                 # server and Vite with HMR
pnpm build               # client, SSR, and backend build
pnpm lint                # ESLint
pnpm typecheck           # TypeScript backend + frontend
pnpm test:e2e            # Japa: unit, functional, and browser
pnpm test:ui             # Vitest
pnpm ace migration:run   # apply migrations
pnpm ace migration:fresh # rebuild the schema
pnpm ace db:seed         # deterministic development data
```

> [!NOTE]
> This project runs AdonisJS 7 with TypeScript executed directly through `@poppinss/ts-exec`.
> There is no `node ace` anymore: use `pnpm ace <command>`.

---

## Configuration

| Variable                                             | Purpose                                       |
| ---------------------------------------------------- | --------------------------------------------- |
| `APP_NAME`, `VITE_APP_NAME`, `APP_URL`               | application identity and URLs                 |
| `APP_LOCALE`                                         | default locale (`pt` or `en`)                 |
| `PUBLIC_TENANT_SLUG`                                 | public operation when the host cannot resolve |
| `BENEFIT_PRESENTATION_BASE_URL`                      | canonical origin for QR validation links      |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`        | independent API secrets                       |
| `EMAIL_VERIFICATION_SECRET`, `PASSWORD_RESET_SECRET` | HMAC for single-use links                     |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_COOKIE_NAME`      | token identity and web cookie                 |
| `REGISTRATION_WORKSPACE_MODE`                        | onboarding `none`, `personal`, or `operation` |
| `DEMO_PAGES_ENABLED`                                 | internal visual reference pages               |
| `DRIVE_DISK`                                         | `fs`, `s3`, `spaces`, `r2`, or `gcs`          |

Optional secrets fall back to `APP_KEY` during development only. Production must use long,
independent values stored outside the repository.

The origin embedded in a QR code follows a closed precedence chain:
`BENEFIT_PRESENTATION_BASE_URL`; then, only in production, `APP_URL`; and the trusted request
protocol/host only during development or tests. In production, the selected origin must use
`https://`; `http://` is limited to development and tests. The variables must contain only an
absolute origin, without credentials, path, query, or fragment. Production startup fails when no
valid canonical HTTPS origin is available, preventing `Host` or `X-Forwarded-Host` from controlling
the validation link. The local `docker-compose.yml` defaults to `NODE_ENV=development`, while
`docker-compose.vps.yml` pins `NODE_ENV=production`.

> [!IMPORTANT]
> The public resolver reads the **first hostname label**. On `experimente-plus.example.com` it looks
> for an operation with slug `experimente-plus` and ignores `PUBLIC_TENANT_SLUG`. The tenant slug
> has to follow the subdomain the operation is served from.

---

## Deploy

The pipeline in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) runs on every push:
frozen install, lint, typecheck, Japa suites, Vitest, and the production build. On `master`, a
`deploy` job sends the same `github.sha` used by the validated checkout over SSH and triggers
[`deploy.sh`](deploy.sh) on the host.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'fontFamily': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'lineColor': '#64748b',
  'primaryTextColor': '#111827'
}}}%%
flowchart LR
    Push["push on master"] --> CI["CI<br/>lint · typecheck · tests · build"]
    CI -->|green| Deploy["deploy job<br/>ssh forced command"]
    Deploy --> Script["deploy.sh<br/>pinned SHA · preflight · build · migrate · up"]
    Script --> Ready{"Home responds<br/>within 120s?"}
    Ready -->|yes| Catalog{"Catalog smoke<br/>HTML · Inertia · APIs"}
    Catalog -->|passed| Ok["published"]
    Ready -->|no| Back["restore revision and image<br/>and validate rollback"]
    Catalog -->|failed| Back
```

`deploy.sh` requires a full commit SHA, fetches that exact commit, and verifies its identity. Over
forced SSH, it accepts the SHA only when it belongs to the remote `master` history fetched in the
same operation. It rejects untracked files outside the operational allowlist, including Git-ignored
files. The tracked preflight compares the index object graph with `HEAD` and manually hashes regular
worktree files with `git hash-object --no-filters`, without invoking diff filters.

The build uses a verified snapshot extracted from that commit outside the working tree, so files
appearing later cannot contaminate `COPY . .` either. To materialize the release, the script advances
the index with plain `git read-tree` (without `--reset`/`-u`) and `HEAD` with an expected-old-value guarded
`git update-ref`, then copies from that snapshot with `rsync --archive --checksum`. It never runs
checkout, any form of `git reset`, or `git clean`.

The script rebuilds the image, stops the service, and applies pending migrations exactly once in a
detached one-shot container whose name and labels are bound to the revision. It waits on the concrete
container ID for up to 600s and, regardless of the result, removes migration containers in that
namespace and proves that none remain before any `compose up`, including rollback. Only then does it
start the HTTP server. It waits up to 120s for the home page and then runs
[`scripts/smoke_catalog.sh`](scripts/smoke_catalog.sh) under an external 45s limit: home, cities, the
city catalog in HTML and Inertia, and the establishments and filters APIs must return `200` with the
expected content type. Readiness and smoke `curl` calls ignore local configuration and proxies. A
trap handles materialization, build, migration, startup, and validation failures by restoring the
last verified revision and image without rebuilding, then checking readiness and catalog again using
the smoke contract stored for that good revision. APIs are checked once after readiness to avoid
exhausting the anonymous rate limit.

A host `flock` serializes manual and CI deployments through recovery. The `last-known-good` record
lives in the common Git directory, stores revision/image/smoke SHA256, and advances only after
validation. The smoke script is retained there by hash; `HEAD` is never an implicit
fallback. The first run requires `DEPLOY_INITIAL_GOOD_REVISION` identifying the revision actually
being served and, if it has no smoke script, `DEPLOY_INITIAL_GOOD_SMOKE_REVISION` identifying a
reviewed compatible contract, as described in the [runbook](docs/runbooks/catalog_schema_reconciliation.md).
`/usr/bin/rsync`, `/usr/bin/sync`, and `/usr/bin/jq` are prerequisites: the first two materialize
snapshots and make LKG publication durable; the third validates the effective build model. The CI
job has a 75-minute limit and its SSH step a 70-minute limit, in addition to keepalives; host
operations have timeouts too.
The HTTPS fetch runs in an isolated bare repository, NEW must descend from the verified release,
and Compose uses immutable snapshots of both code and `.env` throughout rollout and rollback.

The smoke uses the operation's trusted `Host` and a real city (`londrina` by default). Configure
`CATALOG_SMOKE_BASE_URL`, `CATALOG_SMOKE_HOST`, and `CATALOG_SMOKE_CITY_SLUG` in the deploy process
environment to override them. It neither follows redirects nor prints response bodies. Its tests
use a simulated HTTP server and run without a database: `node --test tests/deploy/*.test.mjs`.

> [!WARNING]
> The rollback covers **code only**. Migrations already applied are not reverted.

[`docker-compose.vps.yml`](docker-compose.vps.yml) describes the host: the application service
alone, published on the loopback only, behind an nginx that terminates TLS. PostgreSQL and Redis are
shared containers reached over an external Docker network.

Before deploying to the VPS, configure `BENEFIT_PRESENTATION_BASE_URL` with a public `https://`
origin or ensure the `APP_URL` fallback is a valid HTTPS origin; otherwise, production bootstrap
will intentionally fail.

The CI key carries a forced command in the host's `authorized_keys`. Install the reviewed entrypoint
outside the checkout so rollback cannot downgrade it. It only accepts `SSH_ORIGINAL_COMMAND` in
the form `deploy <full lowercase SHA>`, without shell evaluation. Manual deployments also require
that SHA as their sole argument. `.dockerignore` excludes credentials, `.env.*.local`, logs,
`storage/uploads/**`, and `storage/seed-media/**`; the runbook documents the operational allowlist.

---

## Migrations before version 1.0

Consolidation into the original `create_*` migration only applies to migrations that have never
reached a persistent environment. From the first pilot or production deployment, applied history
is append-only, even before 1.0. Changes to deployed tables, constraints, indexes, functions, and
triggers require a new forward migration; editing an applied file does not upgrade the database.

The forward migration `1788556800100_reconcile_benefit_receipt_codes.ts` reconciles
`benefit_redemptions.receipt_code`: it validates existing values before applying `varchar(20) NOT NULL`
and the `^EXP-[0-9A-F]{16}$` check. Invalid data aborts without truncation or normalization; existing
databases do not need to be recreated for this repair. Scenarios and rollout coordination are in the
[persistent contracts runbook](docs/runbooks/persistent_schema_reconciliation.md).

Forward repairs must support the old schema, clean installations, and documented operational
hotfixes while preserving data. The `catalog_establishments.attribute_slugs` repair and validation
window are described in the [catalog runbook](docs/runbooks/catalog_schema_reconciliation.md).
Code rollback does not revert migrations; each repair must document that compatibility.

---

## Product planning

The canonical plan lives under [`docs/product/`](docs/product/README.md) and the accepted technical
contracts under [`docs/architecture/decisions/`](docs/architecture/decisions/README.md): business
vision and model, actors and journeys, MVP, metrics and roadmap, the city/organization/establishment
model, domain boundaries, accepted decisions, open questions, and market references.

No product-domain migration should be introduced before its decision is recorded in the plan and,
when structural, in an accepted ADR.

---

## License

MIT. See [LICENSE](LICENSE).
