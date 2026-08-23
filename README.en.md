# Experimente+

A multi-city, multi-category regional guide for discovering food, leisure, and local services.

[Português](README.md) · [English](README.en.md)

## Project status

This repository was created from the internal template and is now configured as an independent application. The technical foundation, initial product plan, EP-00 ADRs, and EP-01 Geography and Taxonomy implementation are complete; the next steps are local validation and EP-02 — Organizations and memberships.

The initial launch is intended for northern Paraná, around Cornélio Procópio, Londrina, and nearby municipalities. City is a discovery dimension; tenant represents an isolated platform operation.

## Product direction

Tour Londrina is a product-experience reference for local discovery, not a functional contract to copy. Experimente+ broadens that idea in two directions:

- **multiple cities**, initially around Cornélio Procópio, Londrina, and nearby municipalities;
- **multiple categories**, with restaurants, bars, and cafés at the core, while remaining open to cinemas, tattoo studios, leisure, culture, wellness, and other local services.

Discovery by city and category is part of the product direction. A city is not a tenant: tenant represents an isolated platform operation. Benefits, vouchers, subscriptions, reviews, and monetization remain staged evolutions; internal bookings are outside the initial product.

## Product planning

The canonical plan is stored under [`docs/product/`](docs/product/README.md), and accepted technical contracts live under [`docs/architecture/decisions/`](docs/architecture/decisions/README.md). Together they define the business vision, actors, journeys, MVP, roadmap, city/organization/establishment model, domain boundaries, accepted decisions, open questions, and market references.

No product-domain migration should be introduced before its decision is recorded in the plan and, when structural, in an accepted ADR.

## Technical foundation

- AdonisJS 7 and Node.js 24
- React 19 with Inertia and SSR
- PostgreSQL 16 and Redis
- web and API authentication
- access JWTs and rotating opaque refresh tokens
- email verification and password recovery
- global RBAC, contextual permissions, and ownership
- N:N multi-tenant operations with an active tenant
- regions, cities, and public geography catalog
- hierarchical taxonomy with typed attributes
- file upload and management
- Mailpit for local email testing
- Japa, Playwright, Vitest, and Testing Library
- OpenAPI/Redoc, Docker, and CI

## Local setup

```bash
mise use node@24
pnpm install --frozen-lockfile
cp .env.example .env
pnpm ace generate:key
docker compose up -d postgres redis mailpit
pnpm ace migration:run
pnpm ace db:seed
pnpm dev
```

Default local services:

| Service      | Address                      |
| ------------ | ---------------------------- |
| Application  | `http://localhost:3333`      |
| PostgreSQL   | `localhost:5435`             |
| Redis        | `localhost:6381`             |
| Mailpit SMTP | `localhost:1026`             |
| Mailpit UI   | `http://localhost:8026`      |
| Redoc        | `http://localhost:3333/docs` |

The development seeder creates `admin@experimente.local` with password `experimente123`. These credentials are local-only and configurable through the `DEV_ADMIN_*` environment variables.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test:e2e
pnpm test:ui
pnpm ace migration:run
pnpm ace migration:fresh
pnpm ace db:seed
```

## Pre-1.0 migrations

Before the first stable release, the schema should describe a clean canonical installation. Changes to unpublished tables belong in their original `create_*` migration, and disposable development/test databases should be recreated. After the first stable release, migration history becomes append-only.

## License

MIT. See [LICENSE](LICENSE).
