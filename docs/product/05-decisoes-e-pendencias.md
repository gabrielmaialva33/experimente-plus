# 05 — Decisões, hipóteses e pendências

## Convenções

- **Aceita** — pode orientar arquitetura e roadmap.
- **Proposta** — recomendação forte, mas ainda deve ser confirmada antes do schema correspondente.
- **Hipótese** — precisa de validação com usuários, parceiros ou operação.
- **Aberta pela especificação** — o documento inicial reconhece a questão, mas não define a resposta.

## Decisões aceitas

### D-001 — Produto multicidade e multicategoria

**Status:** aceita.

O Experimente+ atende várias cidades e não fica limitado à gastronomia. Restaurantes, bares e cafés são o núcleo inicial; outras categorias entram progressivamente.

### D-002 — Tour Londrina é referência, não contrato

**Status:** aceita.

A referência inspira simplicidade comercial, descoberta e benefícios, mas o Experimente+ não deve copiar automaticamente vouchers, preço, regras ou escopo gastronômico.

### D-003 — Catálogo público sem login

**Status:** aceita.

Busca, cidade, categorias e ficha pública devem funcionar para Visitantes. Login é exigido apenas para funções pessoais ou protegidas.

### D-004 — Gastronomia como estratégia de lançamento

**Status:** aceita.

A primeira vertical prioriza restaurantes, bares, cafés, padarias e docerias. A taxonomia e o modelo de unidade permanecem genéricos.

### D-005 — Cidade não é tenant

**Status:** aceita.

Cidade é entidade de localização e descoberta. Não controla autenticação, autorização ou isolamento de dados.

### D-006 — Tenant é a operação da plataforma

**Status:** aceita e formalizada pelo [ADR-0001](../architecture/decisions/0001-tenant-representa-operacao.md).

Um tenant representa uma operação isolada, como Experimente+ ou eventual white-label. A operação inicial contém várias cidades, organizações e unidades. Catálogo público resolve a operação sem membership.

### D-007 — Organização e unidade são entidades diferentes

**Status:** aceita.

A organização representa o responsável legal/comercial. A unidade é o local público descoberto. Uma organização pode possuir várias unidades e atuar em várias cidades.

### D-008 — Sem reservas no produto inicial

**Status:** aceita e alinhada à especificação.

O MVP não possui agenda, checkout ou pagamento interno. Contato e deslocamento acontecem por canais externos e presencialmente.

### D-009 — Publicação moderada e versionada

**Status:** aceita e formalizada pelos [ADR-0004](../architecture/decisions/0004-publicacao-versionada-e-maquinas-de-estado.md) e [ADR-0005](../architecture/decisions/0005-completude-submissao-e-publicacao.md).

Organizações possuem workflow próprio. A unidade separa lifecycle, disponibilidade e revisões de conteúdo. Alterações em rascunho não modificam a revisão pública até nova aprovação.

### D-010 — Benefícios não são o núcleo do MVP

**Status:** aceita.

Vouchers, QR Code, Pass e assinatura do consumidor entram somente depois que o catálogo provar densidade e uso.

### D-011 — Concierge IA depende do catálogo

**Status:** aceita.

A IA consulta ferramentas internas e não inventa estabelecimento, horário ou evento. O domínio será desenvolvido depois da maturidade dos dados.

### D-012 — Remoção pública é diferente de exclusão física

**Status:** aceita como princípio técnico.

A especificação determina que parceiros desativados desapareçam da busca e do mapa, mas permaneçam no histórico. Também afirma que, quando um parceiro for excluído, seu material sai do aplicativo. O método de retenção interna e exclusão física ainda depende de política legal e operacional.

### D-013 — Métrica principal é intenção qualificada

**Status:** aceita.

Enquanto não houver transação interna, a plataforma mede rota, contato, site, favorito, compartilhamento e outras ações observáveis, sem chamar isso de venda.

## Contratos técnicos aceitos no EP-00

### A-001 — Operação e catálogo público

Os [ADR-0001](../architecture/decisions/0001-tenant-representa-operacao.md) e [ADR-0003](../architecture/decisions/0003-catalogo-publico-sem-membership.md) definem uma operação inicial, resolução pública por hostname/configuração e catálogo sem autenticação ou membership.

### A-002 — Organização, unidade e memberships

Os [ADR-0002](../architecture/decisions/0002-organizacao-e-unidade-sao-agregados-distintos.md) e [ADR-0007](../architecture/decisions/0007-rbac-global-com-policies-de-dominio.md) definem organização separada da unidade e papéis internos `owner`, `admin`, `editor` e `analyst`. Parceiro não é role global.

### A-003 — Estados e revisão pública

O [ADR-0004](../architecture/decisions/0004-publicacao-versionada-e-maquinas-de-estado.md) define:

```text
organization.status
  draft | pending_review | changes_requested | active | rejected | suspended | archived

establishment.lifecycle_status
  active | suspended | archived

establishment.business_status
  open | temporarily_closed | permanently_closed

establishment_revision.status
  draft | pending_review | changes_requested | approved | rejected
```

### A-004 — Gates de publicação

O [ADR-0005](../architecture/decisions/0005-completude-submissao-e-publicacao.md) centraliza completude, blockers, warnings, submissão e revalidação transacional antes do publish.

### A-005 — Catálogo e busca

Os [ADR-0003](../architecture/decisions/0003-catalogo-publico-sem-membership.md) e [ADR-0006](../architecture/decisions/0006-busca-inicial-com-postgresql.md) definem projeção allowlisted da revisão aprovada, busca PostgreSQL com FTS/trigram e patrocinado identificado separadamente.

## Propostas que ainda precisam de confirmação

### P-005 — Taxonomia hierárquica com atributos

Categorias possuem hierarquia e definições de atributos. Dados centrais para integridade e busca não ficam em JSON livre. O modelo físico será decidido no EP-01.

### P-007 — Analytics próprio de descoberta

Registrar eventos de intenção e criar agregações por dia, cidade, categoria e unidade. Armazenamento, retenção e privacidade serão decididos antes do EP-07.

## Hipóteses de negócio a validar

### H-001 — Presença básica gratuita

Hipótese: catálogo completo gera mais valor de demanda do que cobrar para uma empresa simplesmente aparecer.

Validação:

- entrevistas com parceiros;
- taxa de adesão;
- custo de moderação;
- interesse em recursos pagos.

### H-002 — Experimente+ Pro

Hipótese: parceiros pagarão por analytics, equipe, múltiplas unidades e campanhas.

Faixas de preço mencionadas no planejamento são apenas referências para entrevista e teste.

### H-003 — Campanhas patrocinadas

Hipótese: coleções temáticas e distribuição regional serão mais fáceis de vender do que publicidade genérica.

### H-004 — Experimente+ Pass

Hipótese: um passe de benefícios será atraente depois que a oferta gratuita gerar confiança e frequência.

### H-005 — Primeiro agrupamento compacto

Hipótese: lançar com densidade em poucas cidades produz mais retenção do que espalhar fichas incompletas por toda a região.

### H-006 — Meta inicial de 50–80 unidades verificadas

É um alvo operacional preliminar, não um requisito fixo. Deve ser ajustado à população, categoria e capacidade comercial do agrupamento escolhido.

## Questões abertas pela especificação

### Avaliações

- será obrigatório comprovar visita antes de avaliar;
- mínimo e máximo de caracteres;
- quantidade máxima de fotos;
- quantidade máxima de vídeos;
- limite de avaliações por dia;
- intervalo entre edições;
- prazo para editar;
- efeitos exatos de banimento sobre histórico e médias.

### Mídia

O ADR-0014 fecha a primeira vertical de mídia da unidade:

- JPEG, PNG e WebP válidos, com extensão, MIME type e assinatura binária coerentes;
- limite de 10 MiB, 12.000 pixels por dimensão e 60 megapixels;
- asset físico estável sobre `files`, com associação versionada por revisão;
- uma capa elegível por revisão, ordenação atômica, texto alternativo e legenda;
- estados `pending`, `approved`, `rejected` e `quarantined`, com histórico append-only;
- apenas mídia aprovada da revisão publicada entra na projeção pública;
- HEIC/HEIF é rejeitado explicitamente neste corte, em vez de ser armazenado sem pipeline compatível;
- conteúdo proibido pela política é tratado pela fila humana de moderação até existir análise automática confiável.

Continuam abertas:

- vídeo, duração e transcodificação;
- derivados, miniaturas e formatos responsivos;
- remoção ou preservação seletiva de EXIF;
- análise automática e quarentena assistida;
- fluxo formal de recurso contra rejeição.

### Offline

A especificação pergunta se o aplicativo fará cache sem internet, mas não responde. Definir:

- quais páginas ficam disponíveis;
- validade do cache;
- comportamento de favoritos e ações pendentes;
- prioridade PWA versus aplicativo nativo.

### GPS e Concierge

A especificação pergunta como a IA reage quando o GPS falha. Definir:

- fallback para cidade escolhida;
- permissão negada;
- localização aproximada;
- transparência sobre distância;
- ausência total de contexto geográfico.

### Segurança

A especificação menciona 2FA, login social, token e biometria. Definir:

- quais perfis exigem 2FA;
- provedores sociais iniciais;
- significado de “Android” como método de cadastro;
- biometria somente no cliente nativo;
- política de senha e recuperação;
- proteção contra criação massiva de contas.

## Questões de domínio ainda abertas

### Organização

- CNPJ será obrigatório para toda categoria;
- MEI e pessoa física terão fluxo distinto;
- escopo de unicidade do CNPJ;
- como reivindicar uma ficha existente;
- como transferir propriedade;
- como tratar redes e franquias;
- quais dados legais podem ser públicos.

### Cidade e região

- primeiro agrupamento de lançamento;
- hierarquia de região;
- bairros no MVP;
- cidades vizinhas sugeridas;
- conteúdo compartilhado entre cidades;
- expansão e ativação gradual.

### Unidade

- regra de slug;
- unidade sem endereço físico;
- atendimento em domicílio;
- negócios itinerantes;
- unidade dentro de shopping;
- fechamento temporário e sazonal;
- duplicidade de estabelecimento.

### Categoria e atributos

- árvore inicial;
- governança de novas categorias;
- atributos obrigatórios por categoria;
- filtros públicos;
- campos tipados versus atributos flexíveis;
- traduções e sinônimos de busca.

### Busca e ranking

O mecanismo inicial e os princípios estão resolvidos pelo [ADR-0006](../architecture/decisions/0006-busca-inicial-com-postgresql.md). Permanecem para calibração:

- pesos finais entre FTS, trigram, categoria e atualidade;
- estratégia geoespacial além do filtro de cidade;
- limites de similaridade por tipo de termo;
- proteção contra manipulação quando sinais de uso entrarem no ranking;
- UX e sugestões para pesquisas sem resultado.

### Moderação

- SLA;
- papéis e escalonamento;
- catálogo de motivos;
- recurso do parceiro;
- suspensão preventiva;
- moderação de atributos e mídia;
- auditoria e retenção.

### Analytics e privacidade

- retenção de eventos;
- identificação anônima;
- consentimento e cookies;
- agregação mínima antes de mostrar métricas;
- prevenção de fraude em cliques;
- exportação e exclusão de dados.

### Monetização

- momento de cobrar;
- recursos de cada plano;
- preço por organização ou unidade;
- cobrança de rede;
- comissão versus assinatura;
- regras de campanha;
- benefício ao consumidor;
- tributação e emissão fiscal.

## Próximas decisões para destravar engenharia

Tenant, organização/unidade, estados, publicação, busca e autorização foram resolvidos no EP-00.

Prioridade 1 — EP-01:

1. definir árvore inicial de gastronomia;
2. escolher agrupamento piloto e cidades iniciais;
3. definir modelo físico de famílias, categorias e atributos;
4. definir slugs, aliases e escopos de unicidade;
5. definir dados mínimos de região/cidade e timezone.

Prioridade 2 — EP-02/EP-03:

1. definir escopo de unicidade do CNPJ e exceções;
2. definir claim e transferência de organização;
3. definir endereço, geocoding e coordenadas;
4. definir representação física de horários e exceções;
5. definir catálogo de motivos e recurso de moderação;
6. definir analytics essenciais e retenção.

Prioridade 3:

1. políticas de avaliação;
2. benefícios;
3. cobrança;
4. Concierge IA;
5. offline e aplicativo nativo.
