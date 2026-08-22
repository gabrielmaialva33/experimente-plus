# Experimente+

A regional platform for discovering places, experiences, and local businesses.

[Português](README.md) · [English](README.en.md)

## Project status

This repository was created from the internal template and is now configured as an independent application. The technical foundation is ready; functional planning and product-domain definition come next.

The initial launch is intended for northern Paraná, around Cornélio Procópio, Londrina, and nearby municipalities. No city has been made a tenant or definitive domain during this setup stage.

## Technical foundation

- AdonisJS 7 and Node.js 24
- React 19 with Inertia and SSR
- PostgreSQL 16 and Redis
- web and API authentication
- access JWTs and rotating opaque refresh tokens
- email verification and password recovery
- global RBAC, contextual permissions, and ownership
- N:N workspaces with an active tenant
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
