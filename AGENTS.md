# Guia do repositório — Experimente+

## Escopo e fontes de verdade

Este repositório contém a API, a aplicação web e as regras de negócio do Experimente+. O cliente Expo fica no repositório independente `../experimente-plus-app/`. Este arquivo é o guia canônico de agentes; `CLAUDE.md` o importa.

Leia [README.md](README.md). Os documentos de produto, os ADRs, os runbooks e a especificação de design saíram do repositório em 26/09/2026; em `docs/` ficam apenas `openapi.yaml`, `redoc.html` e `api.http`. As regras que aqueles textos carregavam e que o código precisa respeitar estão resumidas neste guia. O histórico Git ainda guarda os originais (por exemplo, `git show 6b858d6^:docs/architecture/decisions/README.md`) para entender uma decisão, mas eles não são mais a fonte vigente: o código, os testes e este guia são.

Estão implementados: catálogo público, portais do parceiro e da operação, benefícios com carteira e resgate, API móvel consumer-first, compras (pacote da edição e voucher avulso, com Pix e cartão por PSP), avaliações e denúncias, moderação automática, conteúdo do parceiro (experiências, eventos e vitrine), Concierge IA e a camada pessoal do Explorador. Vários parâmetros dessas áreas são por operação e seguem pendentes do contratante; os valores padrão não são decisão dele. O foco do piloto é validação operacional e priorização por evidências, sem expansão automática de escopo.

## Contratos de domínio

- O produto é regional, multicidade e multicategoria, inicialmente no norte do Paraná. Gastronomia é a primeira vertical, mantendo extensibilidade para lazer, cultura, bem-estar e serviços.
- Tour Londrina é referência de experiência, não contrato funcional. `Sobral` é uma pessoa; nunca trate o nome como cidade, tenant, produto ou codinome.
- Cidade e categoria são dimensões de descoberta. Tenant é uma operação isolada; organização e estabelecimento são agregados distintos, e uma organização pode administrar unidades em várias cidades.
- Catálogo público não exige login ou membership. A operação é resolvida pelo hostname confiável, com fallback configurado por `PUBLIC_TENANT_SLUG` nos casos previstos pelo resolver. Não aceite `tenant_id` fornecido pelo visitante como seleção pública de operação.
- Conteúdo público e composição de mídia são versionados. Preserve completude, submissão, moderação e publicação atômica. Busca pública lê uma projeção PostgreSQL reconstruível, não rascunhos de edição.
- Partner é membership de organização. Roles, permissions e audit logs são globais no modelo atual; policies de domínio autorizam acesso às organizações e unidades.
- Nas rotas privadas que exigem tenant, valide membership e escopo em toda leitura/escrita. O middleware resolve header, claim do JWT e fallback de membership conforme o contrato existente. Não aplique essa exigência ao catálogo público.
- Benefícios, carteira e resgate: edição, oferta, acesso, benefício derivado, apresentação, utilização e comprovante são o vocabulário; "resgate" pode ficar no domínio interno. Preview não resgata; confirmação é transacional e repetir o mesmo token devolve o comprovante original. O cliente não decide elegibilidade nem validade localmente.
- Compras: `PAYMENT_PROVIDER` escolhe `disabled`, `fake` (nunca em produção), `stripe` ou `mercado_pago`, sem fallback entre eles. O acesso nasce apenas da conciliação autenticada com o PSP (`purchases:process`), nunca do corpo de um webhook ou do cliente. Preço e termos ficam congelados na compra; `purchase_events` é append-only; estorno total revoga só o acesso vinculado e o parcial o mantém; bloqueios financeiros suspendem o uso até conciliação conclusiva.
- Avaliações, respostas e denúncias seguem a política da operação (comprovação de visita, limites de texto e mídia, prazos), parametrizada e não fixa no código. A moderação automática é determinística, sem modelo de linguagem: cada regra fica desligada, sinaliza ou retém, e toda ocorrência abre denúncia sem autor na fila única.
- Conteúdo do parceiro (experiências, eventos, vitrine) tem ciclo próprio, fora da revisão da unidade; "oferta" continua sendo o termo comercial de benefícios.
- Concierge IA: o modelo compõe linguagem e nunca é fonte de fato; uma validação determinística contra o catálogo publicado remove o que ele inventar, a fronteira de assunto é recusa em código e o módulo não escreve dados.
- Explorador: favoritos, seguidos, interesses e roteiros são privados da pessoa; segue-se o estabelecimento, não a organização, e toda leitura revalida se o alvo continua descobrível.
- Decisões estruturais novas exigem aceite explícito do dono antes da migration correspondente, com domínio, cenários de teste e impacto no schema definidos. Backlog não autoriza ampliar a tarefa.

## Arquitetura e organização

Stack: AdonisJS 7, Lucid/PostgreSQL, Redis, React 19, Inertia 3, Tailwind CSS 4 e VineJS. O backend executa TypeScript via `@poppinss/ts-exec`.

| Caminho                           | Responsabilidade                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `app/modules/<domain>/`           | Controllers, services, repositories, models, validators, interfaces, policies e rotas do domínio |
| `app/shared/`                     | Middleware, JWT, repositório Lucid base, serviços e utilitários transversais                     |
| `app/exceptions/`                 | Exceções tipadas e handler                                                                       |
| `start/`, `config/`, `providers/` | Registro de rotas/middleware, ambiente e configuração do framework                               |
| `database/`                       | Migrations, factories e seeders                                                                  |
| `inertia/`                        | Páginas, layouts, componentes, hooks, providers, estilos e testes web                            |
| `resources/`                      | Views Edge, traduções e templates                                                                |
| `tests/`                          | Suítes Japa e regressões de deploy                                                               |
| `docs/`                           | OpenAPI, Redoc e requisições HTTP de exemplo                                                     |

Domínios de produto: `geography`, `taxonomy`, `organizations`, `establishments`, `media`, `catalog`, `analytics`, `benefits`, `purchases`, `reviews`, `partner_content`, `concierge`, `explorer`, `portal` e `pilot_feedback`. A base inclui `auth`, `users`, `roles`, `permissions`, `tenants`, `files`, `audits`, `health` e `web`.

Mantenha o fluxo controller → service → repository → model conforme o módulo vizinho; lógica de negócio fica em services e dependências usam `@inject()` quando aplicável. Cada módulo registra `routes.ts`, importado por `start/routes.ts`.

Generators `pnpm ace make:*` produzem o layout padrão do Adonis. Mova o resultado para o módulo correto e ajuste imports; migrations permanecem em `database/migrations/`. Não recrie `app/controllers/`, `app/models/` ou aliases legados por camada.

Use os aliases de `package.json`: `#modules/*`, `#shared/*`, `#exceptions/*`, `#providers/*`, `#database/*`, `#tests/*`, `#start/*` e `#config/*`. No frontend, `~/*` aponta para `inertia/*`. Evite travessias relativas entre módulos.

## Ambiente e comandos

Use Node 24 (`.nvmrc`: `v24.13.0`) e pnpm 11 (`packageManager` fixa `11.22.0`). `mise.toml` fixa a mesma versão para quem usa mise: o Node global mais novo não sobe o ace deste projeto, e o erro aparece como falha de metadados de comando, não como versão errada. Execute comandos na raiz deste repositório. Use `pnpm ace`, que encapsula o loader TypeScript.

Em um checkout novo, instale com `pnpm install --frozen-lockfile`. Crie `.env` a partir de `.env.example` apenas se ainda não existir, ajuste o ambiente local e gere `APP_KEY` com `pnpm ace generate:key`. Não sobrescreva um `.env` existente.

`docker compose up -d postgres redis mailpit` inicia a infraestrutura local. As portas padrão do Compose são PostgreSQL 5435, Redis 6381, SMTP 1026 e Mailpit UI 8026; confira overrides do ambiente antes de conectar. A aplicação usa a porta 3333 na configuração de desenvolvimento documentada.

| Comando                                 | Finalidade                                                     |
| --------------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                              | Adonis e Vite com HMR                                          |
| `pnpm build`                            | Build backend, client e SSR                                    |
| `pnpm start`                            | Servidor compilado; executar no artefato de produção preparado |
| `pnpm ace migration:run`                | Aplicar migrations pendentes ao banco configurado              |
| `pnpm ace db:seed`                      | Executar os seeders habilitados para o ambiente                |
| `pnpm typecheck`                        | TypeScript backend e `inertia/`                                |
| `pnpm lint`                             | ESLint do projeto                                              |
| `pnpm exec prettier --check <arquivos>` | Conferir formatação dos arquivos alterados                     |
| `pnpm test`                             | Apenas suíte Japa unit                                         |
| `pnpm test:e2e`                         | Todas as suítes Japa: unit, functional e browser               |
| `pnpm test:ui`                          | Vitest em execução única                                       |
| `pnpm test:ui:watch`                    | Vitest em modo watch                                           |
| `node --test tests/deploy/*.test.mjs`   | Regressões de deploy e infraestrutura sem banco                |

`pnpm format` formata o repositório inteiro; prefira Prettier restrito aos arquivos alterados em tarefas pontuais. `pnpm lint:fix` cobre apenas os diretórios explicitados no script, não substitui `pnpm lint`. `pnpm docker` executa migrations e seeders antes de iniciar o servidor; não é um comando genérico para subir infraestrutura.

Preserve a configuração de TypeScript duplo do `package.json`: `typescript` aponta para TS 6 e `typescript-native` para TS 7, compatibilizando lint e compilação. Não simplifique os aliases ou as permissões `allowBuilds` de pnpm sem verificar a compatibilidade das ferramentas.

Mantenha `pg` na major 8 até Lucid e Knex serializarem consultas na mesma conexão. O Lucid 22 executa em paralelo os preloads de relações irmãs; dentro de `db.transaction`, eles disputam um único cliente, o que o `pg` 8 enfileira com aviso de descontinuação e o `pg` 9 deixará de aceitar. Em código novo dentro de transação, não use `Promise.all` com o cliente transacional.

## Estilo e interface

TypeScript strict, indentação de dois espaços, LF, classes/componentes em PascalCase e funções/variáveis em camelCase. Backend e páginas seguem predominantemente snake_case; componentes de `inertia/components/ui/` usam kebab-case. Siga os arquivos vizinhos, `.editorconfig`, ESLint e Prettier.

Reutilize componentes Metronic/shadcn-style em `inertia/components/ui/`; os de `ui/core/` são legados. Preserve layouts, acessibilidade e os tokens de `inertia/css/app.css`: `primary` representa marca/navegação; `cta` representa conversão. O app móvel deriva sua identidade desses tokens.

## Testes e validação

Japa usa `tests/{unit,functional,browser}/**/*.spec.ts`. Vitest usa `inertia/**/*.{test,spec}.{ts,tsx}`, com Testing Library, jsdom e MSW. Browser Japa precisa de Chromium instalado por `pnpm exec playwright install chromium`.

Antes de Japa, confira a configuração de `.env.test` e os overrides do processo: `tests/bootstrap.ts` migra e semeia o banco e executa `redis.flushdb()` nas suítes functional/browser. Use banco e Redis de teste isolados. PostgreSQL e Redis são requisitos dessas suítes; a conexão SQLite existente não substitui as regressões PostgreSQL do catálogo.

Para mudanças de código, execute lint, typecheck e as suítes afetadas; acrescente regressões para comportamento alterado. A CI completa executa lint, typecheck, testes de deploy, todas as suítes Japa, Vitest e build, conforme `.github/workflows/ci-cd.yml`. Para documentação, valide referências, comandos e diff sem iniciar infraestrutura desnecessária.

Ao alterar APIs, mantenha `docs/openapi.yaml` e os testes de paridade com o router consistentes. Se houver impacto móvel, regenere os tipos no checkout irmão com `pnpm api:types` e valide seus consumidores; não edite o arquivo gerado à mão.

## Persistência e deploy

Migrations que chegaram a qualquer ambiente persistente, inclusive o piloto pré-1.0, são histórico publicado: altere o schema por novas migrations forward. Somente migrations nunca implantadas podem ser consolidadas. `migration:fresh`, reset e recriação de banco destinam-se exclusivamente a ambientes descartáveis.

Reparos devem aceitar schema antigo, instalação limpa e hotfixes documentados sem perda de dados. SQL de reparo deve ser autocontido e versionado; reconstrua projeções a partir das fontes autoritativas (o catálogo público, a partir das revisões publicadas). Registre no PR como a mudança é implantada, como se reverte o código e o que a migration deixa para trás, já que o rollback não a desfaz.

O repositório não agenda comandos; cada ambiente instala o agendador: `purchases:process` a cada minuto, `reports:notify-overdue` de hora em hora e `analytics:prune` uma vez por dia (detalhes no README).

Mudanças operacionais devem preservar o deploy por SHA validado, snapshots imutáveis, isolamento da migration e readiness/smoke de catálogo. O rollback existente restaura código/imagem, não desfaz migrations. Push em `master` aciona deploy após a CI; considere esse efeito no fluxo de release.

Não exponha `.env`, credenciais, tokens, QR de apresentação ou dados privados em logs, documentação ou commits. Preserve autenticação JWT/cookie/bearer, rotação opaca de refresh e separação entre autorização global e policies de domínio.

## Commits e pull requests

O histórico usa Conventional Commits com scopes, como `feat(ui):`, `fix(auth):` e `fix(deploy):`. Mantenha commits focados. PRs devem explicar problema e resultado, vincular issues quando houver, destacar migrations/ambiente, incluir imagens para alterações visuais e informar verificações executadas e limitações.
