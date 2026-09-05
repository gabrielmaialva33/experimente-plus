# ADR 0022 — Contrato de API móvel consumer-first

**Status:** aceito  
**Data:** 4 de setembro de 2026  
**Marco:** EP-12 — Mobile API Readiness  
**Relacionados:** ADR-0001, ADR-0003, ADR-0007, ADR-0016, ADR-0020 e ADR-0021

## Contexto

O catálogo, a carteira e o resgate já fecham o ciclo operacional no navegador. Um aplicativo móvel
precisa consumir o mesmo domínio sem duplicar autorização, recalcular disponibilidade ou transformar
decisões de apresentação em estado local. Também precisa descobrir de forma estável quando deve
mostrar o modo parceiro, pois Partner é uma membership da organização e não um papel global.

O primeiro cliente será consumer-first: **Explorar**, **Carteira** e **Conta** formam a experiência
principal. **Validar benefício** aparece somente quando as capacidades projetadas pelo servidor
permitirem. O contrato deve continuar útil para um cliente nativo ou PWA sem antecipar checkout,
favoritos, push ou operação offline.

## Decisão

### 1. Cliente fino sobre uma API canônica

O aplicativo não possui backend paralelo. Ele consome as rotas JSON canônicas de sessão, catálogo,
perfil, carteira e resgate. Toda decisão de visibilidade, disponibilidade, horário, ownership, limite
e autorização permanece no servidor.

```mermaid
flowchart LR
  App[Aplicativo móvel] --> Session[Sessão e contexto]
  App --> Catalog[Catálogo público]
  App --> Wallet[Carteira privada]
  App --> Partner[Validação condicional]
  Session --> Policies[Middleware e policies]
  Wallet --> Domain[Domínio de benefícios]
  Partner --> Policies
  Policies --> Domain
  Catalog --> Projection[(Projeção PostgreSQL reconstruível)]
  Domain --> Source[(Agregados transacionais)]
```

`GET /api/v1/me/context` é o bootstrap autenticado. Sua resposta é uma allowlist de usuário,
operação ativa, operações acessíveis e capacidades. O cliente pode usar a projeção para compor a
interface, mas ela nunca autoriza uma requisição subsequente.

### 2. Operação e cidade continuam conceitos distintos

Tenant representa uma operação isolada da plataforma. Cidade é uma dimensão pública de descoberta.
O catálogo resolve a operação pelo hostname confiável e não aceita `tenant_id` do usuário. Rotas
privadas usam o tenant assinado no access token ou `x-tenant-id`; qualquer override é revalidado
contra um vínculo ou acesso ativo do ator à operação selecionada.

O aplicativo pode trocar de cidade sem trocar de operação. Criar ou trocar a operação autenticada
exige simultaneamente o access token bearer e o refresh token corrente do mesmo usuário. A operação
consome o refresh e recebe um único par filho já vinculado ao tenant resultante.

### 3. Capabilities controlam composição, policies controlam acesso

A projeção móvel diferencia:

- `partner.enabled`: existe alguma membership ativa de organização na operação;
- `partner.redemptions.read`: o ator pode abrir histórico e comprovantes;
- `partner.redemptions.validate`: o ator pode visualizar e confirmar uma apresentação;
- `platform_access`: acesso operacional global projetado como `platform_admin`,
  `platform_moderator` ou `null`.

A interface usa as capacidades específicas de `redemptions` para mostrar ações. Não pode usar apenas
`partner.enabled`: Root e Administrador podem receber `partner.redemptions.read` e
`partner.redemptions.validate` sem membership de organização, mas somente no tenant ativo e
acessível. Moderador sem membership de organização não recebe essas capabilities nem o modo
parceiro. Em todos os casos o endpoint repete a autorização de domínio.

### 4. Sessões são curtas e renováveis

Todo par retorna:

```text
token_type = Bearer
expires_in = 900
refresh_expires_in = 259200
```

O access token é um JWT de quinze minutos. O refresh token é opaco, de uso único, armazenado no
servidor apenas como HMAC e rotacionado atomicamente. No cliente nativo, credenciais persistentes
ficam somente no Keychain/Keystore da plataforma; o cliente substitui o refresh token após cada
rotação e encerra a sessão quando a renovação retornar `401`. Essa estratégia nativa segue a
proteção indicada para clientes públicos na [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700)
e os controles de autenticação e armazenamento do
[OWASP MASVS](https://mas.owasp.org/MASVS/).

Refresh, criação de operação e troca de operação compartilham a mesma primitiva transacional de
rotação. Toda mutação de credenciais usa `users.id FOR UPDATE` como mutex e sempre bloqueia o
usuário antes dos registros de reset ou refresh. Depois ela relê e bloqueia a credencial,
revalida usuário e contexto, revoga o pai e cria exatamente um filho com `rotated_from_id`. Login
também compara, sob esse lock, o hash da senha com o snapshot acabado de verificar. Assim, reset de
senha, logout, rotação e exclusão de conta não podem deixar uma nova cadeia renovável escapar da
revogação nem adquirir locks em ordem invertida. O cliente serializa **todas** essas operações: duas
requisições concorrentes com o mesmo refresh produzem um sucesso e um `401` genérico. Bearer e
refresh de usuários diferentes também produzem o mesmo `401`, sem consumir a credencial alheia.
Falha de permissão, tenant estrangeiro ou tenant inativo produz `403` antes da revogação. Na criação,
tenant, membership owner e rotação pertencem à mesma transação e são revertidos em conjunto.

Logout com um refresh revoga esse registro e todos os descendentes ligados por `rotated_from_id`,
mesmo se o token apresentado já tiver sido consumido por uma rotação. A revogação permanece restrita
a essa cadeia: outras sessões raiz do mesmo usuário continuam ativas. Reset, alteração de senha e
exclusão de conta continuam invalidando todas as cadeias do usuário.

Reset ou alteração administrativa de senha consome links de reset ativos, revoga refresh tokens e
remove access tokens opacos persistidos na mesma transação. A mesma invalidação incrementa a versão
de credenciais do usuário. Todo access JWT, inclusive o cookie web, leva o snapshot dessa versão e o
guard o compara com o usuário ativo carregado do banco. Token sem a claim, com valor não canônico ou
com versão divergente retorna `401`; por isso reset, alteração administrativa, rotação operacional de
credenciais e exclusão revogam imediatamente também os JWTs já assinados, sem denylist por token.
A emissão e o refresh da API usam a versão da linha bloqueada. A emissão do cookie web pode partir
do snapshot já autenticado; se ele ficar stale durante uma corrida, o guard compara a claim com a
linha atual na primeira requisição e falha fechado depois do commit da rotação.

A emissão de um link de reset também usa `users.id FOR UPDATE` como mutex. A rotação e o envio
ocorrem dentro da mesma transação: se o SMTP rejeitar a mensagem, o rollback preserva o link
anterior e a resposta pública continua sendo o mesmo `202`, sem revelar existência de conta ou
estado da entrega. Somente a falha conhecida de entrega é absorvida; falhas inesperadas de banco
continuam propagando. Essa fronteira privilegia não invalidar silenciosamente um link utilizável,
mas não torna SMTP e PostgreSQL atomicamente distribuídos: se o servidor de e-mail aceitar a
mensagem e o commit falhar depois, o destinatário ainda pode receber um link não persistido. Fechar
essa janela exige outbox durável e fica para uma decisão posterior ao piloto.

Refresh, logout, criação e troca aceitam credenciais somente em JSON cujo media type base seja
`application/json`; parâmetros como `charset=utf-8` são permitidos, mas aliases JSON, form,
multipart, texto e binário resultam em `422`. JSON canônico sintaticamente inválido resulta em `400`
sanitizado, sem ecoar corpo ou credencial e sem consumir o refresh token.

Uma PWA exige estratégia de sessão própria, adequada ao modelo de ameaças da web. Em particular, o
refresh token não pode ser persistido em `localStorage`, `sessionStorage`, IndexedDB ou qualquer
outro armazenamento acessível a JavaScript. O mecanismo web deve ser definido e revisado antes de
liberar esse cliente.

### 5. Apresentação temporária não vira autorização local

O consumidor cria uma apresentação de cinco minutos a partir de um benefício que o servidor ainda
considera utilizável. O QR contém a URL de validação e um token assinado. Preview e confirmação
reavaliam tenant, ownership, estado, horário, limite e capacidade da organização.

O link usa a origem escolhida nesta ordem:

1. `BENEFIT_PRESENTATION_BASE_URL`;
2. `APP_URL`, somente em produção;
3. origem confiável da requisição, somente em desenvolvimento e teste.

Em produção, qualquer origem canônica selecionada deve usar `https://`; `http://` permanece
restrito ao desenvolvimento e aos testes.
O deploy da VPS deve fornecer `BENEFIT_PRESENTATION_BASE_URL` ou um `APP_URL` HTTPS válido antes de
iniciar a aplicação; a ausência dessa configuração interrompe o bootstrap.

O cliente não envia a origem. Repetir a confirmação do mesmo token retorna o comprovante original,
o que permite retry seguro após uma resposta de rede ambígua sem criar outro resgate.

O token aparece na query string da URL aberta pela câmera. Por isso:

- aplicativo, analytics e comprovantes não registram o token;
- respostas privadas usam `Referrer-Policy: no-referrer`;
- **o proxy/gateway deve redigir a query string completa nos access logs antes do piloto**;
- associação futura por Universal Links/App Links nunca poderá confirmar um resgate diretamente:
  abrirá apenas o preview autenticado.

### 6. Respostas privadas e contenção de abuso

Contexto, atualização de perfil, carteira, apresentação, preview, confirmação, históricos e
comprovantes, além das cinco respostas que emitem credenciais — login, cadastro, refresh, criação e
troca de operação — retornam:

```text
Cache-Control: private, no-store
Pragma: no-cache
X-Robots-Tag: noindex, nofollow
Referrer-Policy: no-referrer
```

Login e cadastro permitem cinco tentativas por quinze minutos por IP e identificador. Refresh e
logout, que não recebem bearer, permitem dez requisições por minuto por IP. As demais rotas privadas
autenticadas permitem cem requisições por minuto por usuário. Uma resposta `429` informa
`Retry-After` e headers de limite; o cliente deve respeitar esse intervalo e não criar loops
automáticos.

Os envelopes existentes continuam explícitos no OpenAPI, mesmo não sendo globalmente uniformes:

- autenticação e credenciais: `{ errors: [{ message }] }`;
- VineJS `422`: `{ errors: [{ message, field, rule, ... }] }`;
- exceções de domínio: `{ status, message }`;
- limiter `429`: `{ errors: [{ code, message, status }] }`.

Uniformizar todos os erros é uma evolução separada; o EP-12 não altera contratos legados.

### 7. O OpenAPI é verificável contra o router

`docs/openapi.yaml` é OpenAPI 3.1. DTOs móveis de resposta são objetos fechados; DTOs de request
aceitam propriedades desconhecidas e o VineJS as descarta, de modo que apenas os campos declarados
chegam aos serviços. Uma regressão funcional parseia o YAML, exige `operationId` globalmente único e
compara uma allowlist de métodos e paths móveis com `router.toJSON()`. A comparação é
deliberadamente seletiva para não confundir rotas SSR, documentação e superfícies administrativas
com o contrato do aplicativo.

## Consequências

### Positivas

- um único backend decide regras para web e aplicativo;
- navegação parceira deriva de capacidades estáveis sem confundir role global e membership;
- retries de confirmação são seguros e auditáveis;
- DTOs de resposta fechados e requests filtrados reduzem acoplamento com models Lucid;
- OpenAPI e exemplos HTTP passam a cobrir a jornada completa.

### Custos

- o aplicativo precisa coordenar refresh, criação e troca de operação em uma única fila de rotação;
- históricos ainda são listas integrais e exigirão paginação antes de grande volume;
- o QR depende de conectividade para todas as revalidações;
- os formatos de erro legados exigem um adaptador simples no cliente.

## Fora de escopo

- checkout, assinatura, cobrança, reembolso e conciliação;
- favoritos, avaliações, push e sincronização offline;
- login social e biometria como mecanismo de autenticação do servidor;
- resgate offline, cancelamento ou edição de resgate;
- arquivos e certificados de Universal Links/App Links;
- geração de SDK antes de o contrato estabilizar no piloto;
- paginação de históricos sem evidência de volume.

## Cenários obrigatórios

- login, cadastro, refresh, criação e troca de operação expõem os mesmos metadados de token;
- criação e troca exigem bearer e refresh do mesmo usuário, rejeitam replay e nunca abrem uma cadeia
  renovável apenas a partir de um access token;
- contexto não serializa campos internos de usuário ou organização;
- consumidor não recebe capacidades parceiras inventadas;
- owner/editor validam, analyst somente lê e Moderador sem membership de organização não recebe
  capabilities parceiras;
- Root/Administrador podem preservar acesso operacional sem membership de organização nem serem
  modelados como Partner, sempre no tenant ativo e acessível;
- cidade pode mudar na descoberta sem trocar o tenant autenticado;
- perfil ignora campos fora de `full_name` e `username`;
- carteira vazia é estado válido e não erro;
- apresentação inválida ou expirada orienta geração de novo código;
- retry da confirmação retorna o mesmo comprovante;
- recibos respeitam tenant, titular e organização, ocultando IDOR com `404` quando aplicável;
- todas as respostas privadas possuem os quatro headers;
- falha de entrega de reset mantém o link anterior, conserva o `202` anti-enumeração e não oculta
  falhas inesperadas de persistência;
- throttle retorna `429` recuperável;
- parser OpenAPI, unicidade de `operationId` e paridade seletiva com o router permanecem verdes;
- proxy de produção não persiste query strings de validação nos access logs.
