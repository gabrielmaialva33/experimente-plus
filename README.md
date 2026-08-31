# Experimente+

Guia regional multicidade e multicategoria para descobrir gastronomia, lazer e serviços locais.

[Português](README.md) · [English](README.en.md)

## Estado do projeto

O repositório foi criado a partir do template interno e já está configurado como uma aplicação independente. A fundação técnica e os cortes EP-00 a EP-08 estão implementados: Geografia, Taxonomia, Organizações, memberships, Unidades revisionadas, Mídia, Submissão e moderação, Catálogo público, Analytics de descoberta e os portais operacionais do piloto. O próximo passo é executar o piloto regional assistido, medir os gates de negócio e priorizar o backlog posterior com evidência.

O lançamento inicial será pensado para o norte do Paraná, na região de Cornélio Procópio, Londrina e municípios próximos. Cidade é uma dimensão de descoberta; tenant representa uma operação isolada da plataforma.

## Direção do produto

O Tour Londrina é uma referência de experiência para descoberta de estabelecimentos locais, mas não um contrato funcional a ser copiado. O Experimente+ amplia esse conceito em duas dimensões:

- **múltiplas cidades**, começando pela região de Cornélio Procópio, Londrina e municípios próximos;
- **múltiplas categorias**, com restaurantes, bares e cafés como núcleo, além de possibilidades como cinemas, estúdios de tatuagem, lazer, cultura, bem-estar e outros serviços locais.

O produto deverá permitir descoberta por cidade e categoria, sem ficar limitado ao setor gastronômico. Cidade não é tenant: tenant representa uma operação isolada da plataforma. Benefícios, vouchers, assinatura, avaliações e monetização permanecem evoluções planejadas; reservas internas estão fora do produto inicial.

## Planejamento de produto

O plano canônico está em [`docs/product/`](docs/product/README.md), e os contratos técnicos aceitos estão em [`docs/architecture/decisions/`](docs/architecture/decisions/README.md). O conjunto cobre:

- visão e modelo de negócio;
- atores e jornadas;
- MVP, métricas e roadmap;
- modelo de cidades, organizações e unidades;
- mapa de domínios;
- decisões aceitas e questões abertas;
- referências de mercado.

Nenhuma migration de negócio deve ser criada antes de a decisão correspondente estar registrada no planejamento e, quando estrutural, em um ADR aceito.

## Fundação técnica

- AdonisJS 7 e Node.js 24
- React 19 com Inertia e SSR
- PostgreSQL 16 e Redis
- autenticação web e API
- JWTs de acesso e refresh tokens opacos com rotação
- verificação de e-mail e recuperação de senha
- RBAC global, permissões contextuais e ownership
- operações multi-tenant N:N com tenant ativo
- regiões, cidades e catálogo geográfico público
- taxonomia hierárquica com atributos tipados e herança efetiva
- organizações, memberships, convites e claims transacionais
- unidades com identidade estável e conteúdo público revisionado
- endereço, categorias, atributos tipados, horários e exceções
- completude versionada com gates para publicação
- upload e gerenciamento de arquivos
- Mailpit para e-mails locais
- Japa, Playwright, Vitest e Testing Library
- OpenAPI/Redoc, Docker e CI

## Estrutura

```text
app/modules/<domain>/   domínio completo no backend
app/shared/             infraestrutura transversal
database/               migrations, factories e seeders
inertia/                páginas, layouts, componentes e hooks
resources/              traduções, templates Edge e e-mails
tests/                  testes unitários, funcionais e browser
docs/product/           visão, MVP, roadmap e decisões de produto
docs/architecture/      ADRs e contratos técnicos aceitos
docs/                   OpenAPI, Redoc e requisições HTTP
```

Cada domínio deve manter controllers, services, repositories, models, validators e rotas próximos. Os generators do Adonis criam arquivos no layout padrão; mova o resultado para `app/modules/<domain>/` e ajuste os aliases.

## Ambiente local

### Pré-requisitos

- Node.js 24, conforme `.nvmrc`
- pnpm 11
- Docker Compose

### Inicialização

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

| Serviço      | Endereço                     |
| ------------ | ---------------------------- |
| Aplicação    | `http://localhost:3333`      |
| PostgreSQL   | `localhost:5435`             |
| Redis        | `localhost:6381`             |
| Mailpit SMTP | `localhost:1026`             |
| Mailpit UI   | `http://localhost:8026`      |
| Redoc        | `http://localhost:3333/docs` |

As portas podem ser alteradas no `.env`.

### Contas de desenvolvimento

O seeder cria três contas determinísticas para percorrer o piloto completo:

```text
Admin:    admin@experimente.local
Parceiro: partner@experimente.local
Cliente:  cliente@experimente.local
Senha:    experimente123
```

As credenciais são configuráveis pelas variáveis `DEV_ADMIN_*`, `DEV_PARTNER_*` e `DEV_CUSTOMER_*` e nunca devem ser reutilizadas fora do ambiente local. Os dados regionais, estabelecimentos, ofertas e acessos criados pelo seeder são fictícios.

## Comandos

```bash
pnpm dev                 # servidor e Vite com HMR
pnpm build               # build client, SSR e backend
pnpm lint                # ESLint
pnpm typecheck           # TypeScript backend + frontend
pnpm test:e2e            # Japa: unit, functional e browser
pnpm test:ui             # Vitest
pnpm ace migration:run   # aplica migrations
pnpm ace migration:fresh # recria o schema
pnpm ace db:seed         # dados determinísticos de desenvolvimento
```

## Configuração

| Variável                                             | Finalidade                                   |
| ---------------------------------------------------- | -------------------------------------------- |
| `APP_NAME`, `VITE_APP_NAME`, `APP_URL`               | identidade e URLs da aplicação               |
| `APP_LOCALE`                                         | locale padrão (`pt` ou `en`)                 |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`        | segredos independentes da API                |
| `EMAIL_VERIFICATION_SECRET`, `PASSWORD_RESET_SECRET` | HMAC de links de uso único                   |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_COOKIE_NAME`      | identidade dos tokens e cookie web           |
| `REGISTRATION_WORKSPACE_MODE`                        | onboarding `none`, `personal` ou `operation` |
| `DEMO_PAGES_ENABLED`                                 | páginas internas de referência visual        |
| `DRIVE_DISK`                                         | `fs`, `s3`, `spaces`, `r2` ou `gcs`          |

Os segredos opcionais usam `APP_KEY` como fallback apenas durante o desenvolvimento. Produção deve utilizar valores longos, independentes e armazenados fora do repositório.

## Migrations antes da versão 1.0

Enquanto o produto ainda não possui uma versão estável publicada, o schema deve representar uma instalação nova e canônica. Mudanças em tabelas ainda não lançadas entram na migration `create_*` original; bancos descartáveis de desenvolvimento e teste devem ser recriados.

Depois da primeira versão estável, o histórico passa a ser append-only.

## Qualidade

A CI executa instalação frozen, lint, typecheck, testes Japa, testes Vitest e build de produção.

## Licença

MIT. Consulte [LICENSE](LICENSE).
