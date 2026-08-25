# 12 — Portal mínimo e operação do piloto

**Estado:** implementado e validado em 25 de agosto de 2026  
**Marco:** EP-08 — Portal mínimo e piloto

## Objetivo

O EP-08 transforma os domínios já implementados em uma superfície que pode ser operada por parceiros e pela equipe durante um piloto regional real.

O marco não cria versões paralelas de Organização, Unidade, Revisão, Mídia, Moderação ou Analytics. O portal compõe os serviços canônicos desses domínios e mantém todas as regras de ownership, tenant, completude e publicação no backend.

## Superfícies

### Público

A descoberta regional continua nas páginas SSR e APIs do catálogo:

```text
/cidades
/cidades/:citySlug
/cidades/:citySlug/categorias/:categorySlug
/cidades/:citySlug/estabelecimentos/:establishmentSlug
```

### Portal do parceiro

```text
/portal
/portal/organizations/new
/portal/organizations/:organizationId
/portal/organizations/:organizationId/establishments/new
/portal/establishments/:establishmentId
PUT /portal/establishments/:establishmentId/attributes
```

O portal permite:

- criar e revisar a identidade legal/comercial da organização;
- acompanhar o workflow administrativo da organização;
- criar uma ou várias unidades;
- editar identidade pública, cidade, contatos e disponibilidade;
- editar endereço e coordenadas;
- selecionar categorias e categoria principal;
- preencher os atributos efetivos da categoria, inclusive os herdados;
- informar horários semanais com múltiplos intervalos;
- enviar imagens iniciais para a composição versionada;
- acompanhar completude e bloqueios;
- enviar a ficha para moderação;
- consultar analytics após a publicação;
- registrar feedback contextual do piloto.

### Backoffice

```text
/backoffice/moderation
/backoffice/moderation/:revisionId
/backoffice/feedback
```

O backoffice permite:

- consultar a fila tenant-scoped de revisões pendentes;
- revisar a ficha, a mídia e o PublicationGate;
- aprovar e publicar atomicamente;
- solicitar correções estruturadas;
- rejeitar com motivo;
- consultar e classificar feedback do piloto.

Moderador e Administrador continuam sendo capacidades diferentes. Moderadores trabalham na moderação de conteúdo, mas não recebem automaticamente acesso ao feedback comercial do piloto.

## Atributos efetivos no editor

O editor resolve os atributos a partir da categoria principal com `EffectiveCategoryAttributesService`. A página recebe a definição efetiva, a categoria de origem, o indicador de herança, a obrigatoriedade, as opções e o valor atual. O React apenas coleta o payload canônico; validação de tipo, ownership, herança, opção, tenant e obrigatoriedade permanece em `EstablishmentAttributesService`.

Tipos cobertos:

```text
text
long_text
boolean
integer
decimal
single_select
multi_select
url
```

Quando a categoria principal muda, o backend recalcula o conjunto efetivo e remove valores que deixaram de ser aplicáveis. A completude é recalculada sobre os valores persistidos e pode chegar a 100% sem duplicar regra de domínio no frontend.

## Onboarding derivado

O onboarding não possui uma tabela de checklist paralela. Seus passos são derivados do estado real dos agregados:

```text
organização criada
→ organização ativa
→ primeira unidade criada
→ ficha completa
→ revisão submetida
→ unidade publicada
→ analytics disponível
```

Isso evita divergência entre um checkbox artificial e o estado efetivo do produto.

## Feedback estruturado

A tabela `pilot_feedback` registra observações autenticadas com:

- tenant e autor;
- contexto;
- nota de 1 a 5;
- mensagem;
- organização opcional;
- unidade opcional;
- estado de triagem;
- revisor e data;
- nota interna.

Contextos:

```text
general
onboarding
organization
establishment
catalog
analytics
moderation
```

Estados:

```text
new
in_review
resolved
dismissed
```

O feedback é privado. Ele não é avaliação pública, não altera nota de estabelecimento e não aparece no catálogo.

## Matriz operacional

| Capacidade                         |            Parceiro | Analyst da organização |      Moderador | Administrador / Root |
| ---------------------------------- | ------------------: | ---------------------: | -------------: | -------------------: |
| acessar organizações próprias      |                 sim |                    sim | não por padrão |                  sim |
| editar ficha                       |  owner/admin/editor |                    não |            não |                  sim |
| consultar analytics da organização | owner/admin/analyst |                    sim |            não |                  sim |
| submeter feedback                  |                 sim |                    sim |            sim |                  sim |
| moderar revisão                    |                 não |                    não |            sim |                  sim |
| listar feedback do piloto          |                 não |                    não |            não |                  sim |
| revisar feedback do piloto         |                 não |                    não |            não |                  sim |

A visibilidade no menu não substitui middleware nem policy de domínio.

## APIs do marco

```text
POST  /api/v1/pilot-feedback
GET   /api/v1/admin/pilot-feedback
PATCH /api/v1/admin/pilot-feedback/:id
```

Todas exigem autenticação e tenant ativo. Associação com organização ou unidade é validada em conjunto para impedir IDOR e referências cross-tenant.

## Roteiro operacional recomendado

### Preparação

1. selecionar cidades e categorias já cobertas pelo catálogo;
2. escolher parceiros com disponibilidade para cadastro assistido;
3. criar contas e confirmar o tenant da operação;
4. acompanhar o primeiro cadastro sem esconder dúvidas ou fricções;
5. não prometer recursos do backlog posterior.

### Cadastro assistido

1. criar a organização;
2. enviar para análise e ativar quando os dados estiverem corretos;
3. criar a primeira unidade;
4. preencher identidade, endereço, categorias, horários e mídia;
5. revisar o checklist de completude;
6. submeter a revisão;
7. moderar e publicar;
8. confirmar a ficha no catálogo público.

### Acompanhamento semanal

A equipe deve revisar:

- unidades que não concluíram o onboarding;
- fichas bloqueadas por completude;
- tempo entre criação e publicação;
- revisões devolvidas para correção;
- buscas sem resultado;
- visualizações e ações de contato;
- feedback com nota baixa;
- sugestões recorrentes do piloto.

## Critérios de avanço

Os critérios continuam sendo gates de trabalho, não promessas comerciais:

- ao menos 10 parceiros aceitam participar do piloto;
- a maioria consegue fornecer os dados obrigatórios;
- usuários demonstram dificuldade real nas fontes atuais de descoberta;
- cidade e categoria são compreendidas como filtros principais;
- ao menos três ações qualificadas são consideradas úteis pelos parceiros.

A decisão de avançar para recursos de retenção ou monetização deve usar evidência do piloto, não apenas volume de código entregue.

## Fora do EP-08

O marco não entrega:

- CMS genérico;
- reservas;
- pagamentos;
- avaliações públicas;
- campanhas patrocinadas;
- automação integral de suporte;
- aplicativo offline;
- Concierge IA;
- favoritos, listas ou roteiros sociais.

Esses itens permanecem no backlog posterior e dependem de políticas e evidência próprias.

## Definition of Done

- navegação pública, parceiro e backoffice separadas;
- portal protegido por membership e policies;
- onboarding derivado de dados canônicos;
- editor de unidade funcional, incluindo atributos efetivos e herdados;
- completude e submissão reutilizando os services existentes;
- fila de moderação funcional;
- feedback privado e tenant-safe;
- permissões alinhadas entre runtime e migration;
- páginas privadas com `noindex` e `private, no-store`;
- rotas, OpenAPI e exemplos HTTP reconciliados;
- migrations, testes funcionais, browser, UI e build verdes.
