# Architecture Decision Records — Experimente+

Este diretório contém os contratos arquiteturais aceitos para os domínios do produto. O planejamento funcional permanece em [`docs/product/`](../../product/README.md); ADRs registram decisões estruturais que precisam ser respeitadas por migrations, services, policies, APIs e testes.

## Decisões aceitas

| ADR                                                                   | Decisão                                            | Impacto principal                                           |
| --------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| [ADR-0001](0001-tenant-representa-operacao.md)                        | Tenant representa uma operação                     | isolamento, URLs e expansão multicidade                     |
| [ADR-0002](0002-organizacao-e-unidade-sao-agregados-distintos.md)     | Organização e unidade são agregados distintos      | ownership, redes e dados legais                             |
| [ADR-0003](0003-catalogo-publico-sem-membership.md)                   | Catálogo público não exige membership              | rotas públicas, segurança, projeções e cache                |
| [ADR-0004](0004-publicacao-versionada-e-maquinas-de-estado.md)        | Publicação versionada e máquinas de estado         | revisão, disponibilidade e histórico                        |
| [ADR-0005](0005-completude-submissao-e-publicacao.md)                 | Gates de completude, submissão e publicação        | invariantes, moderação e transações                         |
| [ADR-0006](0006-busca-inicial-com-postgresql.md)                      | Busca inicial com PostgreSQL                       | FTS, trigram, ranking e evolução futura                     |
| [ADR-0007](0007-rbac-global-com-policies-de-dominio.md)               | RBAC global com policies de domínio                | autorização, memberships e prevenção de IDOR                |
| [ADR-0008](0008-modelo-fisico-de-geografia.md)                        | Modelo físico de Geografia                         | regiões, cidades, timezone e integridade cross-tenant       |
| [ADR-0009](0009-modelo-fisico-de-taxonomia.md)                        | Modelo físico de Taxonomia                         | famílias, árvore de categorias e atributos tipados          |
| [ADR-0010](0010-organizacoes-identidade-legal-e-claims.md)            | Organizações, identidade legal e claims            | CNPJ, workflow, ownership e reivindicação                   |
| [ADR-0011](0011-memberships-e-convites-de-organizacao.md)             | Memberships e convites de organização              | papéis internos, último owner e tokens de uso único         |
| [ADR-0012](0012-estabelecimentos-estaveis-e-revisoes-publicas.md)     | Estabelecimentos estáveis e revisões públicas      | identidade estável, snapshots e ponteiro publicado          |
| [ADR-0013](0013-disponibilidade-categorias-e-atributos-de-unidade.md) | Disponibilidade, categorias e atributos de unidade | endereço, horários, herança, atributos tipados e completude |
| [ADR-0014](0014-midia-estavel-e-composicao-versionada.md)             | Mídia estável e composição versionada por revisão  | assets, storage, capa, ordenação, moderação e visibilidade  |
| [ADR-0015](0015-submissao-moderacao-e-publicacao-atomica.md)          | Submissão, moderação e publicação atômica          | gates, fila, issues, eventos, clonagem e ponteiro publicado |
| [ADR-0016](0016-catalogo-publico-projecao-e-resolucao-de-operacao.md) | Catálogo público, projeção e operação              | hostname confiável, projeção reconstruível, busca e SSR     |
| [ADR-0017](0017-analytics-de-descoberta-privacidade-e-agregacao.md)   | Analytics de descoberta                            | eventos pseudônimos, privacidade, agregação e retenção      |
| [ADR-0018](0018-portais-operacionais-e-feedback-piloto.md)            | Portais operacionais e feedback do piloto          | parceiro, backoffice, onboarding derivado e feedback        |
| [ADR-0019](0019-edicoes-e-ofertas-de-beneficio.md)                    | Edições e ofertas de benefício                     | campanhas sazonais, regras comerciais e autorização         |
| [ADR-0020](0020-acesso-a-edicao-e-carteira-derivada.md)               | Acesso à edição e carteira derivada                | entitlement, carteira, histórico e privacidade              |
| [ADR-0021](0021-resgate-transacional-com-apresentacao-temporaria.md)  | Resgate transacional e apresentação temporária     | QR assinado, replay, comprovante e histórico                |
| [ADR-0022](0022-contrato-api-movel-consumer-first.md)                 | Contrato de API móvel consumer-first               | contexto, capabilities, tokens, carteira e resgate          |
| [ADR-0023](0023-stack-e-navegacao-do-cliente-movel.md)                | Stack e navegação do cliente móvel                 | Expo, abas por capability, cidade local e filtro único      |

## Regra de evolução

- Decisão estrutural nova recebe um ADR antes da migration correspondente.
- Uma mudança incompatível não reescreve silenciosamente um ADR aceito; cria um novo ADR que o substitui.
- Antes da versão 1.0, migrations ainda não publicadas podem ser consolidadas de forma canônica, desde que permaneçam alinhadas aos ADRs.
- Toda implementação deve incluir cenários de isolamento, autorização, integridade e visibilidade pública descritos no ADR.

## Estado dos marcos

```text
EP-00 — decisões arquiteturais iniciais     concluído
EP-01 — geografia e taxonomia               implementado e validado
EP-02 — organizações e memberships          implementado e validado
EP-03 — unidades, horários e atributos      implementado e validado
EP-04 — mídia                               implementado e validado
EP-05 — submissão e moderação               implementado e validado
EP-06 — catálogo público                    implementado e validado
EP-07 — analytics de descoberta             implementado e validado
EP-08 — portal mínimo e piloto              implementado e validado
EP-09 — benefícios controlados              implementado e validado
EP-10 — acesso e carteira                    implementado e validado
EP-11 — apresentação e resgate               implementado e validado
EP-12 — API móvel consumer-first              implementado e validado
EP-13 — cliente móvel                         decidido, implementação pendente
```
