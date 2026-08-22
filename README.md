# Experimente+

Plataforma regional para descobrir lugares, experiências e negócios locais.

[Português](README.md) · [English](README.en.md)

## Estado do projeto

O repositório foi criado a partir do template interno e já está configurado como uma aplicação independente. A fundação técnica está pronta; a próxima etapa será o planejamento funcional e a definição dos domínios do produto.

O lançamento inicial será pensado para o norte do Paraná, na região de Cornélio Procópio, Londrina e municípios próximos. Nenhuma cidade foi transformada em tenant ou domínio definitivo nesta etapa de setup.

## Fundação técnica

- AdonisJS 7 e Node.js 24
- React 19 com Inertia e SSR
- PostgreSQL 16 e Redis
- autenticação web e API
- JWTs de acesso e refresh tokens opacos com rotação
- verificação de e-mail e recuperação de senha
- RBAC global, permissões contextuais e ownership
- workspaces N:N com tenant ativo
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

### Conta de desenvolvimento

O seeder cria uma conta determinística:

```text
E-mail: admin@experimente.local
Senha:  experimente123
```

As credenciais são configuráveis pelas variáveis `DEV_ADMIN_*` e nunca devem ser reutilizadas fora do ambiente local.

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

| Variável                                             | Finalidade                                  |
| ---------------------------------------------------- | ------------------------------------------- |
| `APP_NAME`, `VITE_APP_NAME`, `APP_URL`               | identidade e URLs da aplicação              |
| `APP_LOCALE`                                         | locale padrão (`pt` ou `en`)                |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`        | segredos independentes da API               |
| `EMAIL_VERIFICATION_SECRET`, `PASSWORD_RESET_SECRET` | HMAC de links de uso único                  |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_COOKIE_NAME`      | identidade dos tokens e cookie web          |
| `REGISTRATION_WORKSPACE_MODE`                        | permanece `none` até a modelagem do produto |
| `DEMO_PAGES_ENABLED`                                 | páginas internas de referência visual       |
| `DRIVE_DISK`                                         | `fs`, `s3`, `spaces`, `r2` ou `gcs`         |

Os segredos opcionais usam `APP_KEY` como fallback apenas durante o desenvolvimento. Produção deve utilizar valores longos, independentes e armazenados fora do repositório.

## Migrations antes da versão 1.0

Enquanto o produto ainda não possui uma versão estável publicada, o schema deve representar uma instalação nova e canônica. Mudanças em tabelas ainda não lançadas entram na migration `create_*` original; bancos descartáveis de desenvolvimento e teste devem ser recriados.

Depois da primeira versão estável, o histórico passa a ser append-only.

## Qualidade

A CI executa instalação frozen, lint, typecheck, testes Japa, testes Vitest e build de produção.

## Licença

MIT. Consulte [LICENSE](LICENSE).
