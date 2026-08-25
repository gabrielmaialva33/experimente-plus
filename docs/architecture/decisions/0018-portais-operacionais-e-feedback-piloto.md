# ADR 0018 — Portais operacionais e feedback do piloto

**Status:** aceito  
**Data:** 24 de agosto de 2026  
**Marco:** EP-08 — Portal mínimo e piloto

## Contexto

Os marcos anteriores concluíram os domínios transacionais, o catálogo público, a moderação, a publicação e analytics. A operação ainda depende, porém, de chamadas diretas à API e de telas genéricas do template. Isso não é suficiente para conduzir o primeiro piloto com parceiros e moderadores.

A especificação de origem diferencia Explorador, Parceiro, Administrador e Moderador. No modelo canônico do Experimente+, Parceiro continua sendo uma membership em uma organização, nunca uma role global. O portal precisa respeitar essa diferença sem criar uma segunda fonte de autorização.

O EP-08 deve entregar navegação e fluxos assistidos sobre os serviços existentes, sem duplicar regras de domínio em controllers Inertia ou no frontend.

## Decisão

### Três superfícies explícitas

A aplicação passa a distinguir:

1. **Público** — descoberta regional, páginas e ações do catálogo;
2. **Portal do parceiro** — organizações, unidades, checklist, publicação e métricas;
3. **Backoffice** — moderação, feedback do piloto e ações administrativas.

As superfícies podem compartilhar o mesmo processo Adonis/Inertia, mas possuem rotas, navegação, capabilities e projeções próprias.

### Portal como camada de aplicação

O portal não cria novas tabelas paralelas para organizações, unidades, revisões, mídia, moderação ou analytics. Ele compõe os serviços canônicos já existentes:

- `OrganizationService` e `OrganizationPolicyService`;
- serviços de `establishments`, `EffectiveCategoryAttributesService` e `EstablishmentCompletenessService`;
- `EstablishmentSubmissionService`;
- `EstablishmentModerationService`;
- `AnalyticsDashboardService`;
- domínio de mídia.

Toda mutação feita por uma página Inertia chama o mesmo service usado pela API. Nenhuma regra relevante de ownership, status, completude ou publicação fica apenas no React.

### Onboarding assistido

O estado do onboarding é derivado, não persistido separadamente. Os passos são calculados a partir de:

- organização criada;
- organização ativa;
- ao menos uma unidade;
- ficha operacional completa;
- mídia elegível;
- revisão submetida;
- revisão publicada;
- analytics disponível após publicação.

Isso impede divergência entre um checklist armazenado e o estado real dos agregados.

### Editor mínimo de unidade

O editor do piloto organiza a ficha em seções:

- identidade e contatos;
- endereço;
- categoria principal;
- atributos efetivos tipados, diretos e herdados;
- horários semanais;
- mídia inicial;
- checklist de completude;
- submissão para moderação.

O editor mostra bloqueios e warnings fornecidos pelo `EstablishmentCompletenessService`. Ele não tenta recalcular completude no navegador.

A categoria principal define o conjunto de atributos efetivos. O Portal recebe do backend definição, origem, herança, obrigatoriedade, opções e valor atual, renderiza `text`, `long_text`, `boolean`, `integer`, `decimal`, `single_select`, `multi_select` e `url`, e envia o mesmo payload aceito pela API. Tipos, opções, ownership, tenant e limpeza de valores obsoletos continuam sob responsabilidade dos services canônicos.

### Backoffice

O backoffice inicial expõe:

- fila de revisões pendentes;
- aprovação;
- solicitação estruturada de correções;
- rejeição;
- fila de feedback do piloto.

As decisões de moderação continuam usando o workflow, locks, gates e eventos append-only do EP-05.

### Feedback estruturado do piloto

`pilot_feedback` registra observações autenticadas sobre o piloto. O registro contém:

- tenant;
- autor;
- contexto;
- nota de 1 a 5;
- mensagem;
- organização e unidade opcionais;
- status administrativo;
- responsável e data da revisão;
- nota interna.

Contextos aceitos:

```text
general
onboarding
organization
establishment
catalog
analytics
moderation
```

Status aceitos:

```text
new
in_review
resolved
dismissed
```

Feedback é privado. Ele não aparece no catálogo, não altera nota pública e não é uma avaliação de estabelecimento.

### Autorização

- usuário autenticado com tenant ativo pode enviar feedback;
- referência a organização ou unidade exige membership ativa ou privilégio de plataforma;
- owner, admin e editor gerenciam a ficha conforme as policies existentes;
- analyst possui leitura e analytics, mas não edita a ficha;
- Administrador e Root acessam filas globais do backoffice;
- Moderador acessa a fila de moderação, mas não recebe automaticamente feedback comercial ou analytics de parceiros;
- IDs de tenant, organização, unidade e revisão são sempre validados em conjunto.

### Navegação por capability

O menu é filtrado pelas permissions já carregadas no contexto autenticado. Esconder um item não substitui middleware e policy; cada rota permanece protegida no servidor.

### Limites do marco

O EP-08 não entrega:

- um CMS genérico;
- reservas;
- pagamentos;
- avaliações públicas;
- campanhas patrocinadas;
- automação completa de suporte;
- aplicativo offline.

Ele entrega a superfície mínima para operar um piloto real com os domínios já implementados.

## Integridade

O banco deve garantir para `pilot_feedback`:

- referência tenant-safe de organização e unidade;
- rating entre 1 e 5;
- contexto e status válidos;
- mensagem não vazia e limitada;
- coerência entre status de revisão, revisor e timestamp;
- índices para fila por tenant, status e data.

A aplicação complementa as constraints com policies, auditoria e projeções allowlisted.

## Cenários obrigatórios de teste

- parceiro vê apenas organizações em que possui membership;
- plataforma pode operar organizações do tenant sem membership local;
- analyst lê o portal, mas não altera unidade;
- editor altera ficha, mas não acessa funções administrativas;
- atributos herdados e diretos são projetados com precedência da categoria específica;
- troca de categoria remove valores incompatíveis sem apagar valores ainda aplicáveis;
- atributo obrigatório bloqueia a completude até ser preenchido;
- checklist reflete imediatamente o estado canônico;
- submissão pelo portal usa os mesmos gates da API;
- fila de moderação é tenant-scoped;
- aprovação e solicitação de correções pelo backoffice preservam eventos;
- feedback aceita contexto, nota e mensagem válidos;
- feedback cross-tenant ou sem membership é rejeitado sem revelar dados;
- somente Administrador ou Root revisa feedback;
- navegação escondida não permite bypass direto da rota.

## Consequências

### Positivas

- o piloto pode ser operado sem ferramentas externas;
- regras de domínio permanecem centralizadas;
- onboarding e completude não divergem;
- público, parceiro e backoffice ficam visual e semanticamente separados;
- feedback vira dado acionável sem se confundir com avaliação pública.

### Custos

- controllers web precisam adaptar respostas de domínio para props Inertia;
- o editor inicial cobre apenas as seções necessárias ao piloto;
- a experiência administrativa ainda é deliberadamente enxuta.

## Relações

- mantém ADR 0002: organização e unidade são agregados distintos;
- mantém ADR 0007: RBAC global com policy de domínio;
- reutiliza ADR 0012 e ADR 0013: revisão e completude canônicas;
- reutiliza ADR 0015: submissão, moderação e publicação atômica;
- reutiliza ADR 0017: analytics privado e tenant-scoped.
