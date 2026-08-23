# Architecture Decision Records — Experimente+

Este diretório contém os contratos arquiteturais aceitos para os domínios do produto. O planejamento funcional permanece em [`docs/product/`](../../product/README.md); ADRs registram decisões estruturais que precisam ser respeitadas por migrations, services, policies, APIs e testes.

## Decisões aceitas

| ADR                                                               | Decisão                                       | Impacto principal                                     |
| ----------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| [ADR-0001](0001-tenant-representa-operacao.md)                    | Tenant representa uma operação                | isolamento, URLs e expansão multicidade               |
| [ADR-0002](0002-organizacao-e-unidade-sao-agregados-distintos.md) | Organização e unidade são agregados distintos | ownership, redes e dados legais                       |
| [ADR-0003](0003-catalogo-publico-sem-membership.md)               | Catálogo público não exige membership         | rotas públicas, segurança, projeções e cache          |
| [ADR-0004](0004-publicacao-versionada-e-maquinas-de-estado.md)    | Publicação versionada e máquinas de estado    | revisão, disponibilidade e histórico                  |
| [ADR-0005](0005-completude-submissao-e-publicacao.md)             | Gates de completude, submissão e publicação   | invariantes, moderação e transações                   |
| [ADR-0006](0006-busca-inicial-com-postgresql.md)                  | Busca inicial com PostgreSQL                  | FTS, trigram, ranking e evolução futura               |
| [ADR-0007](0007-rbac-global-com-policies-de-dominio.md)           | RBAC global com policies de domínio           | autorização, memberships e prevenção de IDOR          |
| [ADR-0008](0008-modelo-fisico-de-geografia.md)                    | Modelo físico de Geografia                    | regiões, cidades, timezone e integridade cross-tenant |
| [ADR-0009](0009-modelo-fisico-de-taxonomia.md)                    | Modelo físico de Taxonomia                    | famílias, árvore de categorias e atributos tipados    |

## Regra de evolução

- Decisão estrutural nova recebe um ADR antes da migration correspondente.
- Uma mudança incompatível não reescreve silenciosamente um ADR aceito; cria um novo ADR que o substitui.
- Antes da versão 1.0, migrations ainda não publicadas podem ser consolidadas de forma canônica, desde que permaneçam alinhadas aos ADRs.
- Toda implementação deve incluir cenários de isolamento, autorização, integridade e visibilidade pública descritos no ADR.

## Estado dos marcos

```text
EP-00 — decisões arquiteturais iniciais       concluído
EP-01 — geografia e taxonomia                 implementado, em validação final
EP-02 — organizações e memberships            próximo marco
```
