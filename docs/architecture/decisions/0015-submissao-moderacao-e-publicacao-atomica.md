# ADR 0015 — Submissão, moderação e publicação atômica da unidade

**Status:** aceito  
**Data:** 24 de agosto de 2026  
**Marco:** EP-05 — Submissão e moderação

## Contexto

Os EP-03 e EP-04 já entregam:

- estabelecimento estável;
- revisão versionada;
- conteúdo editável em `draft` ou `changes_requested`;
- completude estruturada;
- mídia versionada e moderada;
- ponteiro `published_revision_id` tenant-safe.

Ainda falta transformar esses elementos em workflow operacional completo. Alterar diretamente o `status` da revisão em controllers seria insuficiente porque submissão e publicação exigem:

- autorização organizacional;
- revalidação de completude;
- bloqueio concorrente;
- histórico imutável;
- motivos e campos acionáveis;
- revalidação de mídia e taxonomia;
- troca atômica do ponteiro publicado;
- isolamento entre tenants;
- preservação da revisão atualmente pública enquanto outra está em análise.

A SOBRAL SPEC reforça a necessidade de moderador, retirada de parceiros desativados da descoberta e preservação de histórico, mas suas regras informais precisam ser reconciliadas com os ADRs anteriores.

## Decisão

### Máquina de estados da revisão

O workflow canônico continua:

```text
draft
  -> pending_review

pending_review
  -> approved
  -> changes_requested
  -> rejected

changes_requested
  -> pending_review
```

Regras:

- somente `draft` e `changes_requested` são editáveis;
- `pending_review` fica congelada;
- `approved` e `rejected` são terminais e imutáveis;
- nova tentativa após rejeição cria outra revisão;
- nova edição após publicação cria revisão baseada na publicada;
- existe no máximo uma revisão aberta por estabelecimento entre `draft`, `pending_review` e `changes_requested`.

### Gate de submissão

A transição para `pending_review` é permitida a `owner`, `admin` ou `editor` da organização quando:

- tenant está ativo;
- organização está `active`;
- unidade está `active` e não está permanentemente fechada;
- membership está ativa;
- revisão é `draft` ou `changes_requested`;
- o relatório de completude da versão vigente está elegível;
- existe exatamente uma capa de mídia elegível entre `pending` e `approved`;
- não existe mídia `quarantined` associada;
- cidade, categoria, opções e atributos continuam válidos;
- não existe conflito de slug no escopo definido.

A submissão:

1. bloqueia estabelecimento e revisão;
2. recalcula o gate dentro da transação;
3. resolve issues abertos da decisão anterior;
4. limpa campos correntes de revisão administrativa;
5. define `submitted_at`;
6. move a revisão para `pending_review`;
7. persiste evento append-only com snapshot seguro do gate;
8. registra auditoria.

O parceiro não controla status, ator, timestamps, issues ou ponteiro publicado pelo payload.

### Fila de moderação

A fila administrativa contém somente revisões `pending_review` e aceita filtros seguros por:

- tenant;
- organização;
- cidade;
- data de submissão;
- paginação.

Ordenação padrão:

```text
submitted_at ASC
id ASC
```

A fila não depende de membership organizacional do moderador. Ela exige role global `root`, `admin` ou `moderator` e as permissions específicas `establishments.list`, `establishments.approve`, `establishments.request_changes` ou `establishments.reject`, conforme a ação. Consultas continuam tenant-scoped pela operação ativa.

### Solicitação de correções

`pending_review -> changes_requested` exige:

- moderador autorizado;
- resumo não vazio;
- uma ou mais pendências estruturadas.

Cada pendência contém:

```text
code
field
message
severity
```

As pendências atuais ficam em `establishment_revision_review_issues`. O histórico completo da decisão fica em evento imutável.

Ao ressubmeter:

- issues abertos são marcados como resolvidos;
- a revisão volta para `pending_review`;
- a decisão anterior permanece no histórico.

### Rejeição

`pending_review -> rejected` exige motivo não vazio. A revisão torna-se terminal. O ponteiro publicado não muda.

Uma nova tentativa cria revisão posterior baseada:

1. na revisão publicada atual, quando existir;
2. na revisão rejeitada, somente quando não existir publicada e o parceiro solicitar explicitamente reutilização.

### Aprovação e publicação

`pending_review -> approved` executa o `PublicationGate` dentro da mesma transação.

O gate revalida:

- todas as regras estruturais do `SubmissionGate`;
- organização, cidade, categorias, definições e opções ainda ativas;
- coordenadas publicáveis;
- exatamente uma capa `approved`;
- nenhuma mídia `pending` ou `quarantined`;
- nenhuma pendência de revisão aberta;
- slug público disponível;
- estabelecimento e revisão pertencentes ao mesmo tenant;
- revisão em análise é a revisão bloqueada do estabelecimento.

Se elegível, a transação:

1. bloqueia estabelecimento e revisão;
2. define revisão como `approved`;
3. registra revisor, data e observação opcional;
4. troca `establishments.published_revision_id` para a revisão aprovada;
5. mantém o estabelecimento `active`;
6. registra evento append-only com snapshot do gate;
7. registra auditoria.

Nenhum estado intermediário pode deixar uma revisão aprovada sem ponteiro atualizado ou um ponteiro apontando para revisão ainda não aprovada.

### Eventos imutáveis

`establishment_revision_events` registra:

- tenant;
- estabelecimento;
- revisão;
- tipo de evento;
- status anterior e posterior;
- ator;
- motivo;
- metadata segura;
- timestamp.

Tipos iniciais:

```text
created
submitted
changes_requested
resubmitted
approved
rejected
published
draft_cloned
```

A tabela é append-only por trigger. Metadata não pode conter CNPJ completo, tokens, hashes de convite, evidence privada de claims ou dados não necessários à auditoria do workflow.

### Issues estruturados

`establishment_revision_review_issues` registra a pendência atual e seu ciclo de resolução:

- `tenant_id`;
- `establishment_id`;
- `revision_id`;
- código estável;
- campo;
- mensagem;
- severidade `blocking` ou `warning`;
- autor;
- criação;
- resolução.

Somente issues `blocking` impedem nova aprovação. `changes_requested` exige pelo menos um issue aberto. Rejeição pode possuir apenas motivo geral.

### Criação de nova revisão

Quando não existir revisão aberta, `POST /establishments/:id/revisions` cria uma nova revisão editável.

Fonte padrão:

- revisão publicada atual;
- caso não exista, revisão terminal mais recente quando solicitado e permitido;
- caso não exista fonte, operação é rejeitada porque a criação inicial já produz a versão 1.

A clonagem é transacional e copia:

- identidade pública;
- endereço;
- categorias;
- atributos e opções;
- horários semanais;
- dias e horários especiais;
- associações de mídia, reutilizando assets e reiniciando apenas o estado necessário para a nova composição.

A revisão publicada permanece inalterada.

### Suspensão e descoberta

A suspensão do estabelecimento continua separada do workflow de revisão:

- somente equipe global autorizada suspende ou restaura;
- unidade suspensa não participa da descoberta pública;
- `published_revision_id` e histórico permanecem preservados;
- restauração não exige republicação quando a revisão publicada continua válida, salvo decisão administrativa explícita.

O arquivamento permanece ação própria e não apaga avaliações, mídia histórica ou eventos por efeito cascata de negócio.

### Compatibilidade com aliases

`/api/v1` é a superfície canônica. Aliases sem versão podem existir durante o período pré-1.0, mas:

- não recebem nomes de rota;
- não aparecem como contrato principal no OpenAPI;
- devem executar exatamente as mesmas policies e services;
- serão removidos antes do primeiro release estável.

## Integridade de banco

O schema deve garantir:

- FKs compostas com `tenant_id` e `establishment_id` para revisão, issues e eventos;
- no máximo uma revisão aberta;
- coerência entre status, submissão e campos de revisão;
- events append-only;
- issue aberto único por `revision_id + code + field`;
- status terminal imutável pela aplicação;
- ponteiro publicado pertencente ao mesmo tenant e estabelecimento;
- nenhuma referência cross-tenant por escrita direta.

## API inicial

Parceiro:

```text
GET  /api/v1/establishments/:id/review
POST /api/v1/establishments/:id/revisions
POST /api/v1/establishments/:id/submit
```

Moderação:

```text
GET  /api/v1/admin/establishment-revisions
GET  /api/v1/admin/establishment-revisions/:id
POST /api/v1/admin/establishment-revisions/:id/approve
POST /api/v1/admin/establishment-revisions/:id/request-changes
POST /api/v1/admin/establishment-revisions/:id/reject
```

Lifecycle administrativo:

```text
POST /api/v1/admin/establishments/:id/suspend
POST /api/v1/admin/establishments/:id/restore
```

## Cenários obrigatórios de teste

- submissão elegível de `draft`;
- ressubmissão de `changes_requested`;
- bloqueio de submissão incompleta;
- bloqueio de organização, cidade ou categoria inativa;
- bloqueio de usuário sem membership ou papel permitido;
- congelamento de `pending_review`;
- fila escopada e permissionada;
- solicitação de correção com fields estruturados;
- rejeição com motivo;
- aprovação com mídia pendente bloqueada;
- aprovação com capa aprovada;
- troca atômica do ponteiro publicado;
- preservação da revisão publicada anterior durante análise;
- criação e clonagem da próxima revisão;
- histórico append-only;
- issue aberto resolvido na ressubmissão;
- payload tentando controlar status ou revisor;
- duas decisões concorrentes sobre a mesma revisão;
- referências cross-tenant rejeitadas no banco;
- suspensão removendo a unidade da projeção pública sem apagar histórico;
- serialização sem dados legais privados.

## Consequências

### Positivas

- workflow e publicação passam a ter uma única implementação canônica;
- parceiros recebem pendências acionáveis;
- moderação concorrente é segura;
- publicação não vaza conteúdo incompleto;
- histórico permanece auditável;
- revisão pública anterior não é derrubada por edição ou rejeição;
- o EP-06 pode consumir apenas o ponteiro publicado.

### Custos

- aprovação envolve locks e múltiplas validações;
- clonagem precisa copiar vários filhos de forma transacional;
- evolução dos gates exige versionamento explícito;
- eventos e issues aumentam o volume de dados, por design;
- aliases pré-1.0 precisam ser removidos posteriormente.

## Relações

- concretiza ADR-0004: publicação versionada e máquinas de estado;
- concretiza ADR-0005: `SubmissionGate` e `PublicationGate` distintos;
- segue ADR-0007: RBAC global com policies de domínio;
- complementa ADR-0012: revisão estável e ponteiro publicado;
- complementa ADR-0014: mídia versionada e elegibilidade pública;
- incorpora requisitos úteis da revisão da SOBRAL SPEC sem adotar exclusões destrutivas.
