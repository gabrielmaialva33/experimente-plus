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

| [ADR-0024](0024-compra-de-edicao-e-concessao-por-pagamento.md) | Compra de edição e concessão por pagamento | EP-14, porta agnóstica, confirmação, bloqueio, estorno e conciliação |

- [ADR-0026 — Mapa regional Protomaps em R2](0026-mapa-regional-protomaps-r2-ou-google.md): opção A aceita pelo dono em 11/09/2026; estilo e runbook preparados. Publicação, CORS, validação nativa/visual e custo real continuam pendentes.

## Propostas com execução expressamente autorizada

- [ADR-0025 — Voucher avulso e baseline de homologação](0025-voucher-avulso-e-baseline-de-homologacao.md): extensão EP-14 redigida antes do código; status proposto, implementação autorizada na tarefa de 08/09/2026. Sucede parcialmente o produto/reembolso do ADR-0024 e registra a exceção de consolidação. Banco do piloto exige recriação pelo dono, nunca upgrade automático sobre o histórico anterior.

- [ADR-0027 — Avaliações, respostas do parceiro e moderação de conteúdo](0027-avaliacoes-respostas-e-moderacao-de-conteudo.md): marco EP-15, domínio inexistente hoje; execução do desenho estrutural autorizada em 15/09/2026. A decisão central é parametrizar por tenant todos os valores que produto e instrumento contratual mantêm em aberto — comprovação de visita, limites de texto e mídia, limite diário, intervalo e prazo de edição —, para que a definição pendente vire configuração e não redesenho. Os valores desses parâmetros continuam pendentes do contratante; os defaults não são decisão dele. Registra divergência real quanto a vídeo e HEIC frente ao ADR-0014 aceito, e sinaliza que a leitura de uma avaliação por par usuário-estabelecimento carece de confirmação explícita.

- [ADR-0028 — Experiências, eventos e itens de vitrine](0028-experiencias-eventos-e-itens-de-vitrine.md): marco EP-16, domínio inexistente hoje; execução do desenho estrutural autorizada em 15/09/2026. Resolve cinco tensões levantadas antes do código: a colisão do termo "oferta" com o significado comercial do ADR-0019, a proibição de registrar este conteúdo no workflow de revisão da unidade, a aprovação como política por tenant e não workflow fixo, o significado técnico de editar, desativar e excluir sem destruir auditoria, e a dependência explícita da projeção pública.

- [ADR-0029 — Concierge IA ancorado no catálogo](0029-concierge-ia-ancorado-no-catalogo.md): marco EP-17, domínio inexistente hoje; execução do desenho estrutural autorizada em 15/09/2026. Redigida depois de medir o provedor real: um modelo inventou um lugar ausente da lista, outro vazou o próprio raciocínio no conteúdo, houve `529` de sobrecarga e modelos listados que respondem `404`. Daí a decisão central — o modelo compõe linguagem e nunca é fonte de fato, e uma validação determinística contra o catálogo remove o que ele inventar. Fronteira de assunto é recusa em código, não instrução ao modelo, e o módulo não tem caminho de escrita.
- [ADR-0030 — Camada pessoal do Explorador](0030-camada-pessoal-do-explorador.md): marco EP-18, domínio inexistente hoje. Escopo contratado do Anexo I item 10 — favoritar, seguir, escolher interesses e salvar roteiros — que ainda não tem uma linha de código. Decisões centrais: favorito e seguido são relações distintas porque uma recupera e a outra assina publicação; segue-se o estabelecimento, que é a identidade pública do parceiro, nunca a organização; roteiro é privado do autor, já que conteúdo público exigiria fila de moderação que o contrato não dimensionou; e toda leitura revalida o alvo pela definição única de descobribilidade, para que um favorito não reabra uma unidade retirada.
- [ADR-0031 — Moderação automática determinística](0031-moderacao-automatica-deterministica.md): marco EP-19, escopo contratado do Anexo I item 9 que não tinha nenhuma regra. Detectores determinísticos — link, contato, dados de pagamento e termo bloqueado —, sem modelo de linguagem, porque uma retenção que não sabe dizer por que aconteceu não pode ser contestada. Cada regra, por operação, está desligada, sinaliza ou retém; toda ocorrência abre denúncia sem autor na fila única do ADR-0027, com evidência mascarada. Reter usa estados que já existem (`hidden`, `pending_review`), e descartar a regra libera só o que ela reteve.

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
EP-14 — edição e voucher avulso                backend implementado; ADR-0025 proposto com execução autorizada; recriação/homologação comercial pelo dono
EP-15 — avaliações e moderação de conteúdo     ADR-0027 proposto com execução autorizada; parâmetros pendentes do contratante
EP-16 — conteúdo próprio do parceiro           ADR-0028 proposto com execução autorizada; parâmetros pendentes do contratante
EP-17 — assistência de descoberta              ADR-0029 proposto com execução autorizada; limites de consumo pendentes do contratante
EP-18 — recursos do Explorador                 ADR-0030 proposto; escopo contratado do Anexo I item 10, parâmetros pendentes do contratante
EP-19 — moderação automática                 ADR-0031 proposto; escopo contratado do Anexo I item 9, parâmetros pendentes do contratante
```
