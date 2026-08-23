# Copilot Instructions for Experimente+

## Product context

Experimente+ is a multi-city, multi-category regional discovery platform initially intended for northern Paraná, around Cornélio Procópio, Londrina, and nearby municipalities.

Tour Londrina is a product-experience reference, not an implementation contract. Experimente+ must not be reduced to restaurants or to a voucher model. Restaurants, bars, and cafés are the primary categories, with future coverage for cinemas, tattoo studios, leisure, culture, wellness, and other local services.

`Sobral` is the name of a person involved with the project. It is not a city, tenant, product name, repository name, or codename. Do not model it as geographic data.

City and category are core discovery dimensions. A city is not a tenant: tenant represents an isolated platform operation, while organizations may own multiple public establishments across multiple cities. Public discovery must not require tenant membership. Monetization, benefits, review policies, and AI behavior remain staged decisions documented under `docs/product/`.

Accepted architecture contracts live under `docs/architecture/decisions/`. Product-domain code must follow them: public catalog routes use a public operation resolver instead of tenant membership; organization access uses domain policies; public establishment content is versioned; search begins in PostgreSQL; Partner is an organization membership, not a global role. EP-01 — Geography and Taxonomy is implemented; EP-02 — Organizations and memberships is the next implementation milestone.

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

For Experimente+, tenant represents an isolated platform operation. Never map one tenant per city or one tenant per establishment. Organization membership and tenant membership are separate authorization layers. Public catalog routes must not reuse the authenticated tenant middleware; follow ADR-0001 and ADR-0003.

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
