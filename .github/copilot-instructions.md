# Copilot Instructions for Experimente+

## Product context

Experimente+ is a regional discovery platform initially intended for northern Paraná, around Cornélio Procópio, Londrina, and nearby municipalities.

`Sobral` is the name of a person involved with the project. It is not a city, tenant, product name, repository name, or codename. Do not model it as geographic data.

Product domains have not been finalized yet. Do not invent city, partner, catalog, booking, review, or AI architecture before the planning stage records those decisions.

## Architecture

This is an AdonisJS 7, React 19, and Inertia application organized by domain.

Backend code belongs under `app/modules/<domain>/`. A domain owns its controllers, services, repositories, models, validators, interfaces, and `routes.ts`. Cross-cutting code belongs in `app/shared/`; typed exceptions belong in `app/exceptions/`.

Use these aliases:

- `#modules/*`
- `#shared/*`
- `#exceptions/*`
- `#providers/*`
- `#database/*`
- `#tests/*`
- `#start/*`
- `#config/*`

Never restore removed aliases such as `#controllers/*`, `#models/*`, or `#services/*`.

## Adonis generators

Run Ace through pnpm:

```bash
pnpm ace <command>
```

Adonis generators use the framework's default directory layout. After using `make:*`, move generated files into the owning `app/modules/<domain>/` directory and replace default imports with the aliases above. Copying a neighboring module is often safer.

## Multi-tenancy

Tenant-scoped tables must have a non-null `tenant_id`. Protect their routes with tenant middleware and scope every read and write by `ctx.tenant.id`. Roles, permissions, and audit logs are global in the current foundation.

Do not decide what a tenant represents for the Experimente+ product until the planning stage explicitly defines it.

## Migrations before 1.0

The application has not published a stable schema. Fold changes to unpublished tables and constraints into their original `create_*` migration, then recreate disposable databases. Add a new migration only for a genuinely new table or schema object. After the first stable release, migrations become append-only.

## Validation

Use Node.js 24 and run:

```bash
pnpm lint
pnpm typecheck
pnpm test:e2e
pnpm test:ui
pnpm build
```

Add regression coverage in the closest unit, functional, browser, or frontend suite whenever behavior changes.
