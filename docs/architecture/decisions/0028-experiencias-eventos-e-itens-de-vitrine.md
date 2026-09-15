# ADR 0028 — Experiências, eventos e itens de vitrine do parceiro

**Status:** proposto, com execução autorizada

**Data:** 15 de setembro de 2026

**Marco:** EP-16 — conteúdo próprio do parceiro

**Relacionados:** [ADR-0003](0003-catalogo-publico-sem-membership.md), [ADR-0007](0007-rbac-global-com-policies-de-dominio.md), [ADR-0008](0008-modelo-fisico-de-geografia.md), [ADR-0012](0012-estabelecimentos-estaveis-e-revisoes-publicas.md), [ADR-0014](0014-midia-estavel-e-composicao-versionada.md), [ADR-0015](0015-submissao-moderacao-e-publicacao-atomica.md), [ADR-0016](0016-catalogo-publico-projecao-e-resolucao-de-operacao.md), [ADR-0019](0019-edicoes-e-ofertas-de-beneficio.md) e [ADR-0027](0027-avaliacoes-respostas-e-moderacao-de-conteudo.md)

**Dono da decisão:** dono do produto. Proposta redigida antes do código. Nada aqui se declara aceito por inferência.

**Autorização de execução — 15/09/2026:** a construção do desenho estrutural foi expressamente autorizada. Cobre as decisões de modelo: o agregado a que o conteúdo pertence, a máquina de estados própria, a nomenclatura do item de vitrine, o significado técnico de editar, desativar e excluir, a parametrização por tenant e a dependência declarada da projeção. **Não** cobre os valores dos parâmetros nem as pendências listadas ao final, que permanecem do contratante.

## Contexto

O escopo contratado prevê que o parceiro crie e edite **experiências** vinculadas ao próprio estabelecimento, crie **eventos** cuja publicação pode depender de aprovação administrativa conforme regra configurada, e cadastre **item ou oferta para exibição informativa**, explicitamente sem carrinho, estoque, pedido, logística, split de pagamento ou checkout. O administrador aprova, edita, desativa ou exclui esse conteúdo quando necessário à operação.

Nada disso existe hoje. O levantamento do repositório confirmou que `establishment_revision_events` é log de workflow, com `from_status` e `to_status`, e não evento de parceiro.

Esta ADR nasce de cinco tensões reais identificadas antes de qualquer linha de código. Elas são o motivo de o documento existir.

## As cinco tensões e como esta decisão as resolve

### 1. A palavra "oferta" já está ocupada

O ADR-0019 define `BenefitOffer` com regras, termos e resgate, e o ADR-0025 acrescentou preço, compra, acesso e reembolso. Usar o mesmo nome para conteúdo meramente informativo criaria colisão semântica no código e ambiguidade contratual na hora do aceite: duas coisas chamadas "oferta", uma que se compra e outra que não.

**Decisão:** o item informativo do escopo chama-se **item de vitrine**, `establishment_showcase_items`. O nome é novo de propósito. Ele pode exibir preço como **informação**, sem qualquer caminho de compra, carrinho, estoque ou pedido, e sem criar obrigação comercial no sistema. Nenhuma rota de compra aceita um item de vitrine como produto.

### 2. Este conteúdo não entra no workflow de revisão da unidade

O planejamento de produto registra que experiências e eventos são domínios posteriores e **não devem ser incorporados ao workflow de publicação da unidade**. Tecnicamente isso também se sustenta: revisões congelam a unidade em `pending_review`, e prender a publicação de um evento a esse congelamento significaria que anunciar um show bloqueia a edição do endereço.

**Decisão:** os três conteúdos pertencem ao **estabelecimento estável** do ADR-0012, por chave composta com tenant, exatamente como as avaliações do ADR-0027. Cada um tem **máquina de estados própria** — `draft`, `pending_review`, `published`, `archived` — independente da revisão publicada da unidade. Uma nova revisão do estabelecimento não republica, não invalida e não reatribui esse conteúdo.

### 3. "Poderá depender de aprovação" é regra configurável, não workflow fixo

Para revisões de unidade a aprovação é obrigatória. Para eventos, o escopo diz que a publicação **poderá** depender de aprovação conforme a regra configurada. São regimes diferentes, e tratar o segundo como o primeiro imporia fila humana a todo cartaz de evento.

**Decisão:** seguindo o padrão já adotado no ADR-0027, a exigência de aprovação é **política por tenant**, em `partner_content_policies`, com um parâmetro por tipo de conteúdo:

| Parâmetro                              | Default proposto |
| -------------------------------------- | ---------------- |
| exigir aprovação para experiência      | desligado        |
| exigir aprovação para evento           | **ligado**       |
| exigir aprovação para item de vitrine  | desligado        |
| máximo de mídias por conteúdo          | 6                |
| antecedência mínima para publicar evento | nenhuma        |

Com a política desligada, publicar é ato do próprio parceiro. Com ela ligada, o conteúdo entra na fila humana já existente do ADR-0015 e só se torna público após aprovação. Os defaults **não são decisão do contratante**; existem para a funcionalidade ser construível e testável antes da definição dele.

### 4. "Editar, desativar e excluir" precisam de significado técnico explícito

O escopo usa três verbos que colidem com invariantes aceitas. Revisões aprovadas são terminais e editar cria nova revisão. Estabelecimentos e ofertas são arquivados, nunca apagados. Sem definição, cada verbo vira interpretação na homologação.

**Decisão, e é o ponto mais importante deste documento:**

- **Editar** é alteração no lugar, com histórico append-only de quem alterou o quê e quando, no padrão de eventos do ADR-0015. Se o tipo exigir aprovação e o conteúdo já estiver publicado, a edição entra em `pending_review` **sem despublicar a versão corrente**: o público continua vendo o que foi aprovado até a nova versão passar. Isso evita que uma correção de vírgula derrube um evento do ar.
- **Desativar** é arquivar. O conteúdo sai da descoberta pública imediatamente e permanece referenciável por histórico e auditoria, coerente com a regra já registrada de que parceiro desativado some da busca e do mapa mas permanece no histórico do usuário.
- **Excluir**, por administrador, é também arquivamento com remoção da exibição pública, **nunca `DELETE` físico**. Preservar a trilha é requisito de auditoria e a única forma de reverter uma exclusão indevida. Se o contratante exigir destruição física de dados, isso é decisão dele, tem implicação de LGPD e retenção, e deve ser tratado como requisito próprio — não é assumido aqui.

### 5. A projeção pública não sabe destes conteúdos

A projeção reconstruível do ADR-0016 conhece hoje apenas as fontes do estabelecimento. Publicar, arquivar ou moderar um conteúdo novo não apareceria na descoberta sem decisão explícita.

**Decisão:** os três conteúdos entram como **dependências declaradas da projeção**, e sua publicação e arquivamento invalidam a projeção do estabelecimento correspondente. A projeção continua reconstruível de ponta a ponta a partir das fontes autoritativas; nada é mantido como contador incremental sem origem.

## Demais decisões de modelo

**Evento tem janela temporal.** `starts_at` e `ends_at` com timezone resolvido pela cidade do ADR-0008, nunca pelo fuso do servidor nem do aparelho. Evento encerrado sai da descoberta por vigência, sem precisar de arquivamento manual. Experiência e item de vitrine não têm vigência obrigatória.

**Mídia reutiliza o pipeline aceito.** Fotos usam `files` e `media_assets` do ADR-0014, com os mesmos formatos, limites e estados de moderação. Não se cria segundo pipeline de mídia. Vídeo permanece fora, como no ADR-0027.

**Autorização não cria papel novo.** Criar e editar é capacidade de membership da organização dona do estabelecimento, conforme ADR-0007. Aprovar é capacidade de `moderator`, e `admin` a possui por herança na hierarquia de papéis já existente. Isso resolve a ambiguidade do escopo, que menciona "Administrador" para aprovação: administrador aprova porque herda moderador, e a fila humana continua sendo uma só.

**Denúncia reaproveita a fila do ADR-0027.** O alvo tipado de `content_reports` passa a admitir `experience`, `event` e `showcase_item`. Foi para isso que a fila nasceu genérica; criar outra contradiria aquela decisão.

## Consequências

O parceiro ganha superfície de publicação própria, o que aumenta o volume da fila humana quando a política de aprovação estiver ligada. Operação contínua de moderação permanece fora do escopo contratado e é trabalho do contratante após a entrega.

A descoberta pública passa a depender de vigência temporal, o que introduz sensibilidade a fuso e exige que a projeção considere o tempo, não apenas o estado.

Não altera edições, acessos, carteira, resgate ou compra. Não introduz checkout, estoque, pedido ou split de pagamento, explicitamente fora do escopo contratado.

## Alternativas descartadas

**Modelar como campos da revisão do estabelecimento.** Reaproveitaria o workflow pronto, mas contraria o registro de produto e faria o anúncio de um evento congelar a edição da unidade.

**Uma única entidade genérica de conteúdo com um campo de tipo.** Menos tabelas, porém evento tem vigência, item de vitrine tem preço informativo e experiência não tem nenhum dos dois. Um modelo único empurraria as três formas para colunas anuláveis e validação condicional espalhada.

**Reaproveitar `BenefitOffer` para o item de vitrine.** Economizaria uma tabela e criaria exatamente a colisão que a primeira tensão descreve.

**Exclusão física por administrador.** Atenderia o verbo do escopo ao pé da letra e destruiria auditoria e reversibilidade.

## Cenários de teste identificados

1. Conteúdo sobrevive a nova revisão publicada do estabelecimento, mantendo autor, estado e vínculo.
2. Publicar evento não altera o estado da revisão da unidade nem a congela.
3. Com política de aprovação ligada, conteúdo criado pelo parceiro não aparece em rota pública antes da aprovação; com ela desligada, aparece imediatamente.
4. Editar conteúdo publicado sob política ligada mantém a versão aprovada visível e coloca a alteração em `pending_review`.
5. Arquivar remove da descoberta pública e preserva o registro para histórico e auditoria.
6. Exclusão por administrador não remove linha fisicamente e mantém trilha de quem executou.
7. Membership de outra organização não cria, edita nem arquiva conteúdo alheio — regressão de IDOR conforme ADR-0007.
8. Parceiro não aprova o próprio conteúdo quando a política exige aprovação.
9. Evento encerrado sai da descoberta por vigência, com o fuso da cidade e não o do servidor.
10. Publicação e arquivamento invalidam a projeção do estabelecimento; reconstrução do zero reproduz o estado público corrente.
11. Item de vitrine não é aceito por nenhuma rota de compra, e exibir preço não cria acesso, cota ou obrigação comercial.
12. Denúncia de experiência, evento e item de vitrine entra na mesma fila das avaliações, com alvo tipado correto.
13. Limite de mídias por conteúdo é lido da política do tenant, não de constante em código.

## Pendências que dependem do contratante

Os valores da tabela de parâmetros, em especial se evento realmente exige aprovação por padrão. O significado comercial pretendido para o item de vitrine, já que exibir preço sem caminho de compra é decisão de produto e pode gerar expectativa no consumidor. Se "excluir" precisa significar destruição física, com as implicações de LGPD e retenção que isso carrega. E se experiências devem ter vigência temporal como os eventos, hoje proposta como não obrigatória.
