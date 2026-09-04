# Plano 02 — EP-12 Mobile API Readiness

## Objetivo

Preparar a API canônica do Experimente+ para um aplicativo móvel consumer-first, sem duplicar
serviços ou antecipar domínios ainda não validados. O primeiro cliente terá **Explorar**,
**Carteira** e **Conta**; **Validar benefício** aparece apenas quando o servidor projetar a
capacidade de parceiro.

O aplicativo permanece um cliente fino. Catálogo, disponibilidade, autorização, apresentação e
resgate continuam decididos pelo backend existente.

## Phase 0 — documentação descoberta e APIs permitidas

### Contratos de produto permitidos

- Tenant representa uma operação isolada; cidade continua dimensão de descoberta:
  `docs/architecture/decisions/0001-tenant-representa-operacao.md:64-128`.
- O catálogo público resolve a operação pelo hostname e não aceita seleção pública por tenant:
  `docs/architecture/decisions/0003-catalogo-publico-sem-membership.md:25-64` e
  `0016-catalogo-publico-projecao-e-resolucao-de-operacao.md:25-42`.
- Partner deriva de membership ativa da organização, nunca de um papel global:
  `docs/architecture/decisions/0007-rbac-global-com-policies-de-dominio.md` e
  `0021-resgate-transacional-com-apresentacao-temporaria.md:67-88`.
- Carteira é uma projeção privada e benefício não é materializado por usuário:
  `docs/architecture/decisions/0020-acesso-a-edicao-e-carteira-derivada.md:47-91`.
- QR é uma apresentação temporária; toda autorização é reavaliada no resgate:
  `docs/architecture/decisions/0021-resgate-transacional-com-apresentacao-temporaria.md:29-66`.
- Checkout, favoritos, push, offline, avaliações, geolocalização obrigatória e antifraude genérico
  não entram no EP-12: `docs/product/16-piloto-operacional.md:104-122` e
  `docs/architecture/decisions/0021-resgate-transacional-com-apresentacao-temporaria.md:103-115`.

### Superfície existente permitida

- Sessão: `app/modules/auth/routes.ts:16-59` e
  `app/modules/auth/services/jwt_auth_tokens_service.ts:22-101`.
- Catálogo público allowlisted: `app/modules/catalog/routes.ts:7-21` e
  `app/modules/catalog/interfaces/catalog_interface.ts:11-320`.
- Carteira: `GET /api/v1/me/wallet`, implementado em
  `app/modules/benefits/controllers/benefit_wallet_controller.ts:14-39`.
- Apresentação e resgate: `app/modules/benefits/routes.ts:196-227`, com contratos em
  `app/modules/benefits/interfaces/benefit_redemption_interface.ts:1-85`.
- Capabilities organizacionais: copiar a projeção de
  `app/modules/organizations/services/organization_resource_authorization_service.ts:14-130,282-325`.
- Perfil editável: mover o padrão de
  `app/modules/web/services/update_profile_service.ts:1-25` e
  `app/modules/web/validators/settings_validator.ts:1-25` para o domínio `users`.
- Comprovante do parceiro: expor o service já existente em
  `app/modules/benefits/services/benefit_redemption_service.ts:324-335`.

### Referências externas aceitas

- RFC 9700, seção 2.2.2/4.14: refresh token de cliente público deve ser sender-constrained ou
  rotacionado; o backend já usa rotação de uso único.
- OWASP MASVS-STORAGE e MASVS-AUTH: tokens persistentes ficam no Keychain/Keystore do aparelho;
  autorização continua no endpoint remoto.
- Apple Universal Links e Android App Links: links recebidos são validados e associados ao domínio
  público; nenhum deep link executa uma mutação diretamente.

### Gaps comprovados

- Wallet, apresentação e resgate existem no runtime, mas estão ausentes de `docs/openapi.yaml` e
  `docs/api.http`.
- O app não possui uma projeção leve de usuário, operação ativa e capacidades de parceiro.
- Falta `PATCH /api/v1/me`, apesar de a edição do mesmo perfil existir no fluxo web.
- Falta `GET /api/v1/benefit-redemptions/:receiptCode`, apesar de o service já existir.
- Tokens não informam `token_type`, `expires_in` ou `refresh_expires_in`.
- Respostas privadas de apresentação/resgate não aplicam todas `private, no-store`.
- A origem do link do QR depende do hostname técnico da requisição.
- Documentação diverge do runtime no literal de exclusão, no filtro `category` e no status de
  verificação de e-mail inválida.

## Phase 1 — contrato móvel e contexto autenticado

### O que implementar

1. Criar `GET /api/v1/me/context` com DTO allowlisted:
   - usuário;
   - operação ativa e operações disponíveis;
   - `platform_access`;
   - capabilities `consumer.wallet.read`, `partner.redemptions.read` e
     `partner.redemptions.validate`.
2. Projetar capabilities pelo `OrganizationResourceAuthorizationService`; a resposta orienta a UI,
   mas nunca substitui middleware e policies.
3. Adicionar `token_type`, `expires_in` e `refresh_expires_in` a todo par emitido ou rotacionado.
4. Criar `PATCH /api/v1/me` para `full_name` e `username`, movendo validator/service canônicos para
   `app/modules/users/` e reutilizando-os no formulário web.
5. Permitir `PATCH` no CORS para um cliente web/PWA futuro, sem abrir origens por padrão.

### Verificação

- consumidor recebe capacidades de parceiro falsas;
- owner/editor recebem leitura e validação; analyst recebe apenas leitura;
- moderador sem membership não recebe modo parceiro; moderador híbrido recebe apenas sua
  membership; root/admin preservam o acesso da operação;
- tenant do token e override continuam revalidados pelo middleware;
- perfil não aceita e-mail, senha ou campos administrativos;
- login, cadastro, refresh e troca de operação retornam os mesmos metadados de expiração.

### Anti-pattern guards

- não inferir Partner por role global ou `/me/permissions` isolado;
- não chamar tenant de cidade;
- não serializar `Organization` ou `User` completo no contexto;
- não permitir que capability do cliente autorize uma mutação.

## Phase 2 — API de benefícios pronta para dispositivo

### O que implementar

1. Expor `GET /api/v1/benefit-redemptions/:receiptCode` copiando a chamada já usada pela página
   parceira.
2. Aplicar `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow` e
   `Referrer-Policy: no-referrer` em wallet, apresentação, preview, confirmação, históricos e
   comprovantes JSON.
3. Aplicar o throttle autenticado existente nas rotas privadas de carteira/resgate.
4. Adicionar `BENEFIT_PRESENTATION_BASE_URL` opcional. Quando definido, ele é a origem canônica do
   link no QR; quando ausente, preservar a origem confiável da requisição para desenvolvimento e
   instalações multi-host.
5. Preservar replay idempotente, TTL de cinco minutos e todas as revalidações transacionais.

### Verificação

- comprovante do parceiro respeita tenant, organização, role e IDOR;
- todas as respostas privadas possuem os três headers;
- origem configurada vence o hostname técnico sem alterar o token;
- QR inválido/expirado mantém código e mensagem recuperáveis;
- concorrência e replay continuam verdes.

### Anti-pattern guards

- não criar tabela de QR ou sessão temporária;
- não aceitar URL de validação enviada pelo cliente;
- não incluir token em logs, analytics ou comprovantes;
- não permitir deep link confirmar um uso sem preview e ação autenticada.

## Phase 3 — OpenAPI executável e exemplos

### O que implementar

1. Documentar em `docs/openapi.yaml`:
   - metadados de sessão;
   - `PATCH /api/v1/me` e `GET /api/v1/me/context`;
   - wallet;
   - apresentação;
   - histórico e comprovante do consumidor;
   - preview, confirmação, histórico e comprovante do parceiro;
   - headers privados e erros relevantes.
2. Acrescentar os mesmos fluxos a `docs/api.http` sem tokens reais.
3. Corrigir as três divergências verificadas entre documentação e runtime.
4. Tornar o teste de documentação capaz de parsear o YAML e provar que cada operação móvel
   canônica existe com `operationId` único.
5. Registrar o contrato aceito em ADR e documentar o escopo consumer-first no planejamento de
   produto.

### Verificação

- parser YAML aceita a especificação;
- Redocly valida OpenAPI 3.1 sem erro estrutural;
- paths/métodos móveis existem simultaneamente no router e no OpenAPI;
- exemplos usam `category`, `EXCLUIR MINHA CONTA` e os status reais;
- nenhum secret ou token utilizável entra na documentação.

### Anti-pattern guards

- não documentar rotas Inertia como API;
- não anunciar filtros ou estados que o controller ignora;
- não gerar SDK antes de o contrato passar pela paridade automatizada;
- não usar `GET /api/v1/benefit-editions` como marketplace do consumidor.

## Phase 4 — verificação final

1. Rodar Prettier e `git diff --check`.
2. Rodar testes focados de sessão, perfil/contexto, benefícios, documentação e rotas.
3. Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test:ui`, `pnpm test:e2e` e `pnpm build` em Node 24.
4. Validar o OpenAPI 3.1 e revisar que o worktree contém somente o lote EP-12.
5. Manter como dependências externas para o cliente: escolha de stack, bundle IDs, certificados,
   domínio público e arquivos de associação Universal Links/App Links.
