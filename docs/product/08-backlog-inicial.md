# 08 — Backlog inicial de produto e engenharia

Este backlog começa depois da aprovação do planejamento. Ele organiza a primeira vertical sem antecipar funcionalidades posteriores.

## Ordem de execução

```text
EP-00 Decisões e ADRs ✅
  ↓
EP-01 Geografia e taxonomia ✅
  ↓
EP-02 Organizações e memberships ✅
  ↓
EP-03 Unidades, horários e atributos ✅
  ↓
EP-04 Mídia e completude ← próximo
  ↓
EP-05 Submissão e moderação
  ↓
EP-06 Catálogo público
  ↓
EP-07 Analytics de descoberta
  ↓
EP-08 Portal mínimo e piloto
```

## EP-00 — Decisões técnicas

**Status:** concluído em 22 de agosto de 2026.

Os contratos aceitos estão em [`docs/architecture/decisions/`](../architecture/decisions/README.md):

- ADR-0001 — tenant representa operação;
- ADR-0002 — organização e unidade são agregados distintos;
- ADR-0003 — catálogo público sem membership;
- ADR-0004 — publicação versionada e máquinas de estado;
- ADR-0005 — gates de completude, submissão e publicação;
- ADR-0006 — busca inicial com PostgreSQL;
- ADR-0007 — RBAC global com policies de domínio.

### Objetivo

Transformar as decisões aceitas em contratos técnicos antes do schema.

### Entregas

- ADR de tenant como operação;
- ADR de organização versus unidade;
- ADR de catálogo público sem membership;
- estados e transições;
- requisitos de publicação;
- estratégia inicial de busca;
- permissions do primeiro corte.

### Critérios atendidos

- documentação e arquitetura foram reconciliadas;
- migrations de Geografia e Taxonomia podem ser desenhadas sem decidir tenancy, publicação, busca ou autorização implicitamente;
- cenários de isolamento, visibilidade, transição e IDOR estão listados nos ADRs;
- nenhuma migration de negócio foi criada antes da decisão arquitetural.

## EP-01 — Geografia e taxonomia

**Status:** implementado e validado em 23 de agosto de 2026.

Contratos e entregas concluídos:

- [ADR-0008 — Modelo físico de Geografia](../architecture/decisions/0008-modelo-fisico-de-geografia.md);
- [ADR-0009 — Modelo físico de Taxonomia](../architecture/decisions/0009-modelo-fisico-de-taxonomia.md);
- migrations canônicas para regiões, cidades, famílias, categorias, definições e opções;
- models, repositories, services, validators e APIs administrativas;
- catálogo público de regiões, cidades e árvore taxonômica sem membership;
- slug e constraints tenant-scoped;
- seeder determinístico de desenvolvimento;
- permissions globais para administração;
- regressões de isolamento, hierarquia, catálogo e integridade;
- documentação OpenAPI.

### Histórias

- como Administrador, cadastro uma região;
- como Administrador, cadastro e ativo uma cidade;
- como Visitante, seleciono uma cidade ativa;
- como Administrador, crio família, categoria e subcategoria;
- como Administrador, ordeno e desativo categorias;
- como sistema, impeço slugs duplicados no mesmo escopo;
- como sistema, excluo cidades e categorias inativas do catálogo.

### Entregas técnicas

- migrations canônicas;
- models e repositories;
- validators;
- services;
- APIs administrativas;
- testes de constraints e isolamento;
- seed mínimo da árvore gastronômica para desenvolvimento.

## EP-02 — Organizações e memberships

**Status:** implementado e validado em 23 de agosto de 2026.

Contratos e entregas concluídos:

- organizações com identidade legal, CNPJ normalizado e workflow de revisão;
- memberships `owner`, `admin`, `editor` e `analyst` com proteção transacional do último owner;
- convites com token de uso único persistido somente como HMAC;
- claims de organizações importadas e rejeição atômica de concorrentes;
- onboarding público no modo `operation`;
- regressões de autorização, concorrência, replay e isolamento.

### Histórias

- como usuário autenticado, solicito criação de organização;
- como responsável, informo CNPJ e contatos;
- como owner, convido membro;
- como owner, altero papel interno permitido;
- como membro sem permissão, não edito dados legais;
- como Moderador, analiso organização pendente;
- como sistema, não exponho dados privados no catálogo.

### Entregas técnicas

- organização e membership;
- normalização e validação de CNPJ;
- status e transições;
- ownership por organização;
- auditoria;
- testes de IDOR e acesso cruzado.

### Dependência aberta

Definir fluxo para pessoa física, MEI e claim de organização existente.

## EP-03 — Unidades, endereço, horários e atributos

**Status:** implementado e validado em 23 de agosto de 2026.

Contratos e entregas concluídos:

- identidade estável da unidade separada de revisões públicas;
- uma única revisão aberta por unidade e ponteiro explícito para a revisão publicada;
- endereço e coordenadas revisionados com integridade por tenant;
- categorias sem hierarquia redundante e exatamente uma primária no gate;
- atributos efetivos herdados, tipados e validados por opções;
- horários semanais, intervalos noturnos e dias especiais;
- status operacional separado do ciclo de vida;
- relatório de completude versionado;
- regressões de IDOR, capabilities, constraints e snapshots.

### Histórias

- como parceiro autorizado, crio uma unidade;
- como parceiro, vinculo unidade a cidade e categorias;
- como parceiro, informo endereço e contatos;
- como parceiro, configuro horários semanais;
- como parceiro, marco fechamento temporário;
- como parceiro, preencho atributos relevantes da categoria;
- como sistema, calculo se a unidade está completa;
- como usuário não autorizado, não edito unidade alheia.

### Entregas técnicas

- unidade;
- endereço;
- horários e exceções mínimas;
- categorias da unidade;
- valores de atributos;
- máquina de estados;
- testes de completude.

## EP-04 — Mídia

**Estado:** concluído em 24 de agosto de 2026.

### Histórias

- como parceiro, envio foto para uma unidade própria;
- como parceiro, escolho imagem de capa;
- como Moderador, aprovo ou rejeito mídia;
- como Visitante, vejo apenas mídia aprovada;
- como sistema, impeço associação de arquivo de outra operação ou organização.

### Entregas técnicas

- semântica de media sobre o domínio `files`;
- finalidade, ordem, legenda e alt text;
- status de moderação;
- compensação de falhas;
- testes de ownership e visibilidade.

## EP-05 — Submissão e moderação

**Estado:** concluído em 24 de agosto de 2026.

### Histórias

- como parceiro, vejo pendências da unidade;
- como parceiro, submeto unidade completa;
- como Moderador, acesso fila;
- como Moderador, aprovo, rejeito ou solicito correção;
- como parceiro, vejo motivo e corrijo;
- como Administrador, suspendo e reativo;
- como sistema, audito toda transição.

### Regras mínimas

Uma unidade só pode ser submetida quando possuir:

- organização elegível;
- cidade ativa;
- endereço;
- categoria ativa;
- horário;
- contato;
- foto aprovada ou pronta para revisão;
- responsável autorizado.

### Testes críticos

- transição inválida;
- bypass de status por payload;
- publicação direta pelo parceiro;
- moderação sem permission;
- vazamento de pendente no catálogo;
- suspensão removendo busca e mapa;
- histórico preservado.

## EP-06 — Catálogo público

**Estado:** concluído em 24 de agosto de 2026.

**Estado:** próximo marco de implementação.

### Histórias

- como Visitante, vejo cidades ativas;
- como Visitante, navego por categoria;
- como Visitante, pesquiso por nome ou termo;
- como Visitante, filtro “aberto agora”;
- como Visitante, abro uma ficha pública;
- como Visitante, abro rota ou contato;
- como motor de busca, recebo páginas SSR indexáveis;
- como sistema, identifico patrocinado sem alterar nota ou verificação.

### Entregas técnicas

- rotas públicas sem autenticação;
- resolução pública da operação;
- read model seguro;
- paginação e filtros;
- página de cidade;
- página de categoria;
- página da unidade;
- cache;
- sitemap e dados estruturados em fase apropriada.

## EP-07 — Analytics de descoberta

**Estado:** concluído em 24 de agosto de 2026.

### Histórias

- como plataforma, registro impressão e abertura;
- como plataforma, registro cliques externos;
- como parceiro, vejo agregados da própria unidade;
- como Administrador, vejo pesquisas sem resultado;
- como sistema, não exponho eventos de outro parceiro;
- como usuário, tenho privacidade respeitada.

### Entregas técnicas

- contrato de eventos;
- endpoint ou ingestão server-side;
- prevenção básica de duplicidade e abuso;
- agregação diária;
- painel simples;
- política de retenção inicial.

## EP-08 — Portal mínimo e piloto

### Entregas

- navegação separada de público, parceiro e backoffice;
- onboarding assistido;
- formulário de organização;
- editor de unidade;
- checklist de completude;
- fila de moderação;
- catálogo visual real;
- painel de métricas piloto;
- feedback estruturado.

## Backlog posterior, sem compromisso de data

```text
Favoritos e interesses
Lists e roteiros
Follows
Avaliações e respostas
Denúncias
Experiências e eventos
Campanhas patrocinadas
Experimente+ Pro
Benefícios e Pass
Notificações
Aplicativo/PWA offline
Concierge IA
```

## Definition of Done do primeiro marco

- migration nova é canônica e reversível;
- domínio segue controller → service → repository → model;
- toda leitura/escrita privada possui escopo de operação e organização;
- API pública expõe apenas campos permitidos;
- status não é controlável por mass assignment;
- regra possui teste unitário ou funcional adequado;
- fluxo crítico possui teste browser quando houver interface;
- OpenAPI é atualizado;
- auditoria registra decisões administrativas;
- lint, typecheck, testes e build passam;
- documentação de produto permanece consistente.
