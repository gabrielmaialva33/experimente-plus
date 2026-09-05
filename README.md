<div align="center">

<img src=".github/assets/readme-hero.svg" alt="Experimente+ — Descoberta regional multicidade" width="100%"/>

**Mais perto do que você imagina. Mais interessante do que você esperava.**

<p>
  <a href="https://adonisjs.com/"><img src="https://img.shields.io/badge/AdonisJS-7-5A45FF?style=flat-square&labelColor=101214" alt="AdonisJS 7"/></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-1CD6F4?style=flat-square&labelColor=101214" alt="React 19"/></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&labelColor=101214" alt="PostgreSQL 16"/></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis-cache%20%2B%20fila-DC382D?style=flat-square&labelColor=101214" alt="Redis"/></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&labelColor=101214" alt="TailwindCSS v4"/></a>
  <a href="./docs/product/README.md"><img src="https://img.shields.io/badge/dom%C3%ADnio-descoberta%20regional-CE4A09?style=flat-square&labelColor=101214" alt="Descoberta regional"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-A1A5B7?style=flat-square&labelColor=101214" alt="MIT"/></a>
</p>

<p>
  <a href="README.md">Português</a>
  ·
  <a href="README.en.md">English</a>
</p>

---

_"Cidade e categoria são dimensões de descoberta. Tenant é uma operação isolada da plataforma."_

</div>

---

> [!IMPORTANT]
> **Descoberta primeiro, sem exigir cadastro.** O Experimente+ é um guia regional multicidade e
> multicategoria: encontra restaurantes, cafés, cultura, bem-estar e serviços locais com fichas
> revisadas antes da publicação. O catálogo público é resolvido por operação, não por membership —
> ninguém precisa de conta para explorar.

> [!NOTE]
> **Feito para uma região real.** O lançamento inicial é o norte do Paraná, na região de Cornélio
> Procópio, Londrina e municípios próximos. Restaurantes, bares e cafés são o núcleo, mas o produto
> permanece extensível a cinemas, estúdios de tatuagem, lazer, cultura e outros serviços locais.
> Tour Londrina é referência de experiência, não contrato funcional a ser copiado.

---

## Início rápido

```bash
# Dependências
mise use node@24
pnpm install --frozen-lockfile

# Ambiente local
cp .env.example .env
pnpm ace generate:key

# Infraestrutura
docker compose up -d postgres redis mailpit

# Banco e dados de desenvolvimento
pnpm ace migration:run
pnpm ace db:seed

# Servidor Adonis + Inertia com HMR
pnpm dev
```

A aplicação sobe em `http://localhost:3333`. Pré-requisitos: Node.js 24 (conforme `.nvmrc`),
pnpm 11 e Docker Compose.

---

## O que faz

| Camada           | Propósito                                                                    | Onde vive                                |
| :--------------- | :--------------------------------------------------------------------------- | :--------------------------------------- |
| **Geografia**    | Regiões, cidades e catálogo geográfico público.                              | `app/modules/geography/`                 |
| **Taxonomia**    | Categorias hierárquicas com atributos tipados e herança efetiva.             | `app/modules/taxonomy/`                  |
| **Organizações** | Memberships, convites e claims transacionais sobre estabelecimentos.         | `app/modules/organizations/`             |
| **Unidades**     | Identidade estável com conteúdo público revisionado e completude versionada. | `app/modules/establishments/`            |
| **Moderação**    | Submissão, gates de publicação e histórico de revisões.                      | `app/modules/establishments/` · `media/` |
| **Catálogo**     | Descoberta pública por cidade e categoria, servida de uma projeção.          | `app/modules/catalog/`                   |
| **Benefícios**   | Edições, ofertas, acessos e resgates da carteira do consumidor.              | `app/modules/benefits/`                  |
| **Analytics**    | Impressões, cliques de contato e buscas sem resultado, com retenção.         | `app/modules/analytics/`                 |

---

## Arquitetura

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'fontFamily': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'lineColor': '#64748b',
  'primaryTextColor': '#111827',
  'clusterBkg': '#f8fafc',
  'clusterBorder': '#94a3b8'
}}}%%
flowchart LR
    subgraph Publico["Descoberta pública (sem login)"]
        Cat["Catálogo<br/>cidades · categorias · fichas"]
        Wal["Carteira<br/>benefícios e resgates"]
    end

    subgraph Operacao["Portais autenticados"]
        Portal["Portal do parceiro<br/>editor de unidades"]
        Back["Backoffice<br/>moderação e benefícios"]
    end

    subgraph Core["AdonisJS 7 · app/modules"]
        Resolver["Public operation resolver"]
        Domain["Domínios<br/>geografia · taxonomia · organizações"]
        RBAC["RBAC + ownership<br/>multi-tenant N:N"]
    end

    subgraph Dados["Persistência"]
        PG[("PostgreSQL<br/>projeção de catálogo")]
        RD[("Redis<br/>cache · sessão · fila")]
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

O catálogo público resolve a operação pelo hostname ou por `PUBLIC_TENANT_SLUG`, sem exigir
membership. As áreas autenticadas passam por RBAC, permissões contextuais e ownership.

---

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

Cada domínio mantém controllers, services, repositories, models, validators e rotas próximos. Os
generators do Adonis criam arquivos no layout padrão; mova o resultado para `app/modules/<domain>/`
e ajuste os aliases para `#modules/*` e `#shared/*`.

---

## Ambiente local

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

> [!WARNING]
> Essas credenciais existem apenas para o ambiente local e nunca devem alcançar um host acessível
> pela internet. Elas são configuráveis por `DEV_ADMIN_*`, `DEV_PARTNER_*` e `DEV_CUSTOMER_*`.
> Os dados regionais, estabelecimentos, ofertas e acessos criados pelo seeder são fictícios.

O seeder é `static environment = ['development']`: com `NODE_ENV=production` ele é ignorado.

---

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

> [!NOTE]
> Este projeto roda AdonisJS 7 com TypeScript direto via `@poppinss/ts-exec`. Não existe mais
> `node ace`: use `pnpm ace <comando>`.

---

## Configuração

| Variável                                             | Finalidade                                   |
| ---------------------------------------------------- | -------------------------------------------- |
| `APP_NAME`, `VITE_APP_NAME`, `APP_URL`               | identidade e URLs da aplicação               |
| `APP_LOCALE`                                         | locale padrão (`pt` ou `en`)                 |
| `PUBLIC_TENANT_SLUG`                                 | operação pública quando o host não a resolve |
| `BENEFIT_PRESENTATION_BASE_URL`                      | origem canônica dos links de validação QR    |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`        | segredos independentes da API                |
| `EMAIL_VERIFICATION_SECRET`, `PASSWORD_RESET_SECRET` | HMAC de links de uso único                   |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_COOKIE_NAME`      | identidade dos tokens e cookie web           |
| `REGISTRATION_WORKSPACE_MODE`                        | onboarding `none`, `personal` ou `operation` |
| `DEMO_PAGES_ENABLED`                                 | páginas internas de referência visual        |
| `DRIVE_DISK`                                         | `fs`, `s3`, `spaces`, `r2` ou `gcs`          |

Os segredos opcionais usam `APP_KEY` como fallback apenas durante o desenvolvimento. Produção deve
utilizar valores longos, independentes e armazenados fora do repositório.

A origem incorporada ao QR segue uma precedência fechada: `BENEFIT_PRESENTATION_BASE_URL`; depois,
somente em produção, `APP_URL`; e protocolo/host confiáveis da requisição apenas em desenvolvimento
ou teste. Em produção, a origem selecionada deve usar `https://`; `http://` fica restrito ao
desenvolvimento e aos testes. As variáveis devem conter somente uma origem absoluta, sem
credenciais, caminho, query ou fragmento. O bootstrap de produção falha quando nenhuma origem
canônica HTTPS válida está disponível, evitando que `Host` ou `X-Forwarded-Host` controle o link de
validação. O `docker-compose.yml` local usa `NODE_ENV=development` por padrão, enquanto
`docker-compose.vps.yml` fixa `NODE_ENV=production`.

> [!IMPORTANT]
> O resolver público lê o **primeiro rótulo do hostname**. Em `experimente-plus.exemplo.com` ele
> procura uma operação de slug `experimente-plus` e ignora `PUBLIC_TENANT_SLUG`. O slug do tenant
> precisa acompanhar o subdomínio em que a operação é servida.

---

## Deploy

A pipeline em [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) roda em todo push:
instalação frozen, lint, typecheck, suítes Japa, Vitest e build de produção. Em `master`, um job
`deploy` envia por SSH o mesmo `github.sha` usado no checkout validado e dispara
[`deploy.sh`](deploy.sh) no host.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'fontFamily': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'lineColor': '#64748b',
  'primaryTextColor': '#111827'
}}}%%
flowchart LR
    Push["push em master"] --> CI["CI<br/>lint · typecheck · testes · build"]
    CI -->|verde| Deploy["job deploy<br/>ssh forced command"]
    Deploy --> Script["deploy.sh<br/>SHA fixo · preflight · build · migrate · up"]
    Script --> Ready{"Home responde<br/>em até 120s?"}
    Ready -->|sim| Catalog{"Smoke de catálogo<br/>HTML · Inertia · APIs"}
    Catalog -->|passou| Ok["publicado"]
    Ready -->|não| Back["restaurar revisão e imagem<br/>e validar rollback"]
    Catalog -->|falhou| Back
```

`deploy.sh` exige um SHA completo, faz fetch desse commit e verifica sua identidade. Pelo _forced
SSH_, aceita o SHA somente quando ele pertence ao histórico da `master` remota obtido no mesmo
fetch. Recusa arquivos não rastreados fora da allowlist operacional, inclusive arquivos ignorados
pelo Git. O preflight rastreado compara o grafo do index com `HEAD` e calcula manualmente os hashes
dos arquivos regulares da working tree com `git hash-object --no-filters`, sem acionar filtros de diff.

O build usa um snapshot verificado extraído desse commit, fora da working tree; assim um arquivo
tardio também não contamina `COPY . .`. Para materializar a release, o script avança somente
o index com `git read-tree` sem `--reset`/`-u` e `HEAD` com `git update-ref` protegido pelo valor
anterior; então copia desse snapshot com `rsync --archive --checksum`. Não executa checkout,
nenhuma forma de `git reset` nem `git clean`.

O script reconstrói a imagem, para o serviço e aplica as migrations uma única vez em um container
one-shot destacado, com nome e labels vinculados à revisão. Espera pelo ID concreto por até 600s e,
em qualquer resultado, remove os containers de migration desse namespace e confirma que nenhum
restou antes de qualquer `compose up`, inclusive no rollback. Só então sobe o servidor HTTP. Depois
espera a home responder por até 120s e executa
[`scripts/smoke_catalog.sh`](scripts/smoke_catalog.sh) sob um limite externo de 45s: home, cidades,
catálogo da cidade em HTML e Inertia, API de establishments e API de filters precisam retornar
`200` com o tipo de conteúdo esperado. Os `curl` de readiness e smoke ignoram configuração local e
proxies. Falhas de materialização, build, migration, subida ou validação acionam um trap que restaura
a última revisão e imagem validadas, sem rebuild, e repete readiness e smoke no rollback, usando o
contrato de smoke armazenado para essa revisão boa. As APIs são verificadas uma vez após readiness
para não esgotar o rate limit anônimo.

Um `flock` no host serializa deploys manuais e da CI até o fim da recuperação. O registro
`last-known-good` guarda revisão, imagem e SHA256 do smoke no diretório Git comum e só avança após
validação; o script de smoke fica preservado por hash nesse diretório. `HEAD` não é usado como
fallback implícito. A primeira execução exige `DEPLOY_INITIAL_GOOD_REVISION` da versão realmente
servida e, se ela não contiver smoke, `DEPLOY_INITIAL_GOOD_SMOKE_REVISION` de um contrato compatível
revisado, conforme o [runbook](docs/runbooks/catalog_schema_reconciliation.md). `/usr/bin/rsync`,
`/usr/bin/sync` e `/usr/bin/jq` são pré-requisitos: os dois primeiros materializam snapshots e
tornam durável a LKG; o terceiro valida o modelo efetivo do build. O job da CI tem limite de 75
minutos e o passo SSH, 70 minutos, além de keepalive;
operações no host também têm timeout.
O fetch HTTPS roda em um repositório bare isolado, o SHA deve suceder a versão boa, e Compose usa
snapshots imutáveis tanto do código quanto do `.env` durante NEW e rollback.

O smoke usa o `Host` confiável da operação e uma cidade real (`londrina` por padrão). Pode ser
configurado por `CATALOG_SMOKE_BASE_URL`, `CATALOG_SMOKE_HOST` e `CATALOG_SMOKE_CITY_SLUG` no ambiente
do processo de deploy. Ele não segue redirects nem imprime corpos de resposta. Seus testes usam
um servidor HTTP simulado e rodam sem banco com `node --test tests/deploy/*.test.mjs`.

> [!WARNING]
> O rollback é **apenas de código**. Migrations já aplicadas não são revertidas.

[`docker-compose.vps.yml`](docker-compose.vps.yml) descreve o host: apenas o serviço da aplicação,
publicando somente no loopback, atrás de um nginx que termina TLS. PostgreSQL e Redis são
containers compartilhados alcançados por rede Docker externa.

Antes do deploy na VPS, configure `BENEFIT_PRESENTATION_BASE_URL` com uma origem `https://` pública
ou garanta que o fallback `APP_URL` seja uma origem HTTPS válida; caso contrário, o bootstrap de
produção falhará intencionalmente.

A chave usada pela CI carrega um _forced command_ no `authorized_keys`. O entrypoint revisado deve
ser instalado fora da working tree para sobreviver ao rollback. Ele aceita somente
`SSH_ORIGINAL_COMMAND` no formato `deploy <sha completo minúsculo>`, sem avaliar shell. Deploy manual
também exige esse SHA como argumento único. As exclusões de credenciais, `.env.*.local`, logs,
`storage/uploads/**` e `storage/seed-media/**` estão em `.dockerignore`; detalhes e allowlist no runbook.

---

## Migrations antes da versão 1.0

A consolidação na migration `create_*` original só se aplica a migrations que nunca chegaram a
um ambiente persistente. Desde o primeiro deploy em piloto ou produção, o histórico aplicado é
append-only, mesmo antes da versão 1.0. Alterações de tabelas, constraints, índices, funções e
triggers já implantados exigem uma nova migration forward; editar o arquivo aplicado não atualiza
o banco.

O contrato de `benefit_redemptions.receipt_code` é reconciliado pela migration forward
`1788556800100_reconcile_benefit_receipt_codes.ts`: valida os valores existentes antes de aplicar
`varchar(20) NOT NULL` e o check `^EXP-[0-9A-F]{16}$`. Dados inválidos abortam sem truncamento ou
normalização; bancos existentes não precisam ser recriados para receber esse reparo. Os cenários
e a janela estão no [runbook dos contratos persistidos](docs/runbooks/persistent_schema_reconciliation.md).

Correções forward devem funcionar sobre o schema antigo, sobre uma instalação limpa e sobre
hotfixes operacionais documentados, preservando dados. O reparo de `catalog_establishments.attribute_slugs`
e a janela de validação estão descritos no [runbook do catálogo](docs/runbooks/catalog_schema_reconciliation.md).

O reverse proxy preserva políticas privadas emitidas pela aplicação e evita headers de segurança
duplicados conforme o [runbook do Nginx](docs/runbooks/nginx_security_headers.md).

Rollback de código não reverte migrations; cada reparo deve documentar essa compatibilidade.

---

## Planejamento de produto

O plano canônico está em [`docs/product/`](docs/product/README.md) e os contratos técnicos aceitos
em [`docs/architecture/decisions/`](docs/architecture/decisions/README.md): visão e modelo de
negócio, atores e jornadas, MVP, métricas e roadmap, modelo de cidades, organizações e unidades,
mapa de domínios, decisões aceitas, questões abertas e referências de mercado.

Nenhuma migration de negócio deve ser criada antes de a decisão correspondente estar registrada no
planejamento e, quando estrutural, em um ADR aceito.

---

## Licença

MIT. Consulte [LICENSE](LICENSE).
