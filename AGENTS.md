# Repository Guidelines

## Product Context

Experimente+ is a multi-city, multi-category regional discovery platform initially intended for northern Paraná, around Cornélio Procópio, Londrina, and nearby municipalities.

Tour Londrina is a product-experience reference, not an implementation contract. Experimente+ must not be reduced to restaurants or to a voucher model. Restaurants, bars, and cafés are the primary categories, but the product must remain extensible to cinemas, tattoo studios, leisure, culture, wellness, and other local services.

`Sobral` is a person's name. It is not a city, tenant, repository name, product name, or codename. Do not model it as geographic data.

City and category are core discovery dimensions. A city is not a tenant: tenant represents an isolated platform operation, while organizations may own multiple public establishments across multiple cities. Public discovery must not require tenant membership. Monetization, benefit rules, review policies, and later AI behavior remain staged product decisions documented under `docs/product/`.

Accepted architecture contracts live under `docs/architecture/decisions/`. Product-domain code must follow them: public catalog routes use a public operation resolver instead of tenant membership; organization access uses domain policies; public establishment content and media composition are versioned; search begins in PostgreSQL; Partner is an organization membership, not a global role. EP-01 through EP-04 are implemented. EP-05 — establishment submission, moderation and publication — is the next implementation milestone.

## Project Structure & Module Organization

This is an AdonisJS 7, React 19, and Inertia application. Backend features live in `app/modules/<domain>/`; each domain owns its controllers, services, repositories, models, validators, and `routes.ts`. Put cross-cutting middleware, JWT support, the shared Lucid repository, and shared services in `app/shared/`, and typed errors in `app/exceptions/`.

Frontend pages, layouts, components, hooks, and styles live under `inertia/`. Database migrations, factories, and seeders are in `database/`; server-rendered views and translations are in `resources/`. Backend tests mirror their suite under `tests/{unit,functional,browser}/`, while frontend tests live in `inertia/tests/`.

Adonis generators target the framework's default layout, which this repository does not use. If you run `pnpm ace make:*`, move generated code into the owning module and replace default aliases with `#modules/*`, `#shared/*`, or another alias declared in `package.json`.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile` installs the locked dependency graph using pnpm.
- `pnpm dev` starts the application and Vite with HMR; PostgreSQL and Redis must be available.
- `pnpm ace migration:run` applies pending migrations; `pnpm ace db:seed` loads seed data.
- `pnpm build` creates the production backend and frontend bundles.
- `pnpm typecheck && pnpm lint` checks both TypeScript projects and ESLint rules.
- `pnpm test:e2e && pnpm test:ui` runs all Japa suites, then Vitest. Use `pnpm test` for backend unit tests only.

Use Node 24 from `.nvmrc`. Copy `.env.example` to `.env` for local development; never commit real credentials.

## Migration Policy Before 1.0

This application has not published a stable schema. Keep migrations optimized for a clean installation: when an unshipped table or constraint changes, update its original `create_*` migration and recreate the development/test database. Add a new migration only for a genuinely new table or other new schema object. After the first stable release, switch to append-only forward migrations and never rewrite published history.

## Coding Style & Naming Conventions

TypeScript is strict. Use two-space indentation, LF endings, snake_case filenames, PascalCase classes and React components, and camelCase functions and variables. Run `pnpm format` (Prettier) and `pnpm lint` before submitting. Follow neighboring modules instead of introducing a new layering pattern. Do not restore removed aliases such as `#controllers/*` or `#models/*`.

## Testing Guidelines

Japa backend tests use `*.spec.ts`; Vitest/Testing Library frontend tests use `*.test.tsx` or `*.spec.tsx`. Add regression coverage in the closest matching suite. Tests migrate and seed the database automatically from `.env.test`; browser tests require Playwright Chromium. No coverage threshold is enforced, but changed behavior should be exercised.

## Commit & Pull Request Guidelines

History follows Conventional Commits, usually with scopes: `feat(ui): ...`, `fix(auth): ...`, `refactor(jwt): ...`, or `chore(ci): ...`. Keep commits focused and imperative. Pull requests should explain impact, link relevant issues, call out migrations or environment changes, include screenshots for UI work, and report results for lint, typecheck, tests, and build.
