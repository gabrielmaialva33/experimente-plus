# ADR 0027 — Avaliações, respostas do parceiro e moderação de conteúdo do explorador

**Status:** proposto, com execução autorizada

**Data:** 14 de setembro de 2026

**Marco:** EP-15 — avaliações e moderação de conteúdo do explorador

**Relacionados:** [ADR-0003](0003-catalogo-publico-sem-membership.md), [ADR-0007](0007-rbac-global-com-policies-de-dominio.md), [ADR-0012](0012-estabelecimentos-estaveis-e-revisoes-publicas.md), [ADR-0014](0014-midia-estavel-e-composicao-versionada.md), [ADR-0015](0015-submissao-moderacao-e-publicacao-atomica.md), [ADR-0016](0016-catalogo-publico-projecao-e-resolucao-de-operacao.md) e [ADR-0022](0022-contrato-api-movel-consumer-first.md)

**Dono da decisão:** dono do produto. Esta é uma **proposta redigida antes do código**; nada aqui se declara aceito por inferência. A regra do [README de decisões](README.md) exige aceitação explícita, impacto e dono definidos, inclusão em marco e cenários de teste identificados antes de virar migration, model, rota ou interface.

**Autorização de execução — 15/09/2026:** a construção do desenho estrutural descrito abaixo foi expressamente autorizada. Isso cobre as decisões de modelo: a que agregado a avaliação pertence, a separação da resposta do parceiro, a fila única de denúncia, a parametrização por tenant, o vínculo anulável de comprovação de visita, o efeito do banimento e a origem dos agregados na projeção. **Não** cobre os valores dos parâmetros: eles permanecem pendentes de definição do contratante, e os defaults da tabela abaixo existem para tornar a funcionalidade construível e testável antes dessa definição, nunca como decisão dele registrada por inferência.

**Ponto que carece de confirmação explícita:** a leitura de que existe **uma avaliação por par usuário-estabelecimento, editável**, é interpretação do escopo contratado, não texto literal dele. O escopo fala em limite diário, intervalo entre edições e prazo para editar, o que descreve edição de uma avaliação por lugar. Se o contratante pretender múltiplas avaliações do mesmo usuário sobre o mesmo lugar ao longo do tempo, o modelo muda e esta decisão precisa ser revista antes da migration correspondente.

## Contexto

Avaliações são escopo contratado e hoje **não existem no código**. Não há entidade de avaliação, nota, resposta do parceiro ou denúncia. O que existe com nome parecido é `establishment_revision_review_issues`, que pertence à moderação de submissão de estabelecimento descrita no ADR-0015, e `establishment_revision_events`, que é log de workflow. Nenhum dos dois serve a este domínio.

O planejamento de produto já registrou o tema, mas explicitamente como **questões abertas**, em `docs/product/05-decisoes-e-pendencias.md`: comprovação de visita, mínimo e máximo de caracteres, quantidade de fotos e vídeos, limite diário, intervalo entre edições, prazo de edição e efeitos do banimento sobre histórico e médias. O documento de atores é ainda mais direto: *a exigência de visita para avaliar ainda está aberta na especificação e não deve ser implementada até existir uma regra verificável*.

Essas mesmas perguntas aparecem no instrumento contratual como itens que **dependem de definição das partes antes da produção**. Isso não é coincidência e tem consequência de desenho, tratada abaixo.

## Costuras existentes que esta decisão deve respeitar

| Costura                                                          | Consequência para avaliações                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-0012: estabelecimento estável, revisões publicáveis          | A avaliação é sobre **o lugar**, não sobre uma revisão. Deve apontar para a identidade estável, sobrevivendo a novas revisões.        |
| ADR-0003 e ADR-0016: catálogo público sem membership             | Leitura de avaliações e de médias é pública e sai da projeção reconstruível. Escrever exige autenticação.                             |
| ADR-0007: RBAC global com policies de domínio                    | Responder é capacidade de membership da organização dona do estabelecimento; moderar é papel global `moderator`. Nada de papel novo.  |
| ADR-0014: mídia estável e composição versionada                  | Fotos de avaliação reutilizam `files` e `media_assets`. O ADR-0014 cobre **apenas imagem** e rejeita HEIC/HEIF explicitamente.        |
| ADR-0015: submissão, moderação e publicação atômica              | A fila humana, as issues e o histórico append-only já têm forma definida. Moderação de avaliação segue o mesmo padrão, não outro.     |
| ADR-0021: resgate transacional                                   | Existe evidência durável de uso de benefício. É o único sinal de visita hoje verificável no sistema.                                  |

## Decisão proposta

### 1. A avaliação pertence ao estabelecimento estável

`establishment_reviews` referencia `establishments` pela identidade estável do ADR-0012, com `tenant_id` e chave composta no padrão do repositório (`unique(['id','tenant_id'])`, FKs compostas com o tenant). Uma nova revisão publicada não invalida nem reatribui avaliações.

Nota inteira obrigatória de 1 a 5. Texto opcional, dentro dos limites parametrizados. **Uma avaliação por par (usuário, estabelecimento)**, editável dentro da janela configurada: o Anexo fala em limite *diário* de avaliações e em *intervalo entre edições* e *prazo para editar*, o que descreve uma avaliação por lugar, editável, e não múltiplas avaliações do mesmo usuário sobre o mesmo lugar.

### 2. Resposta do parceiro é entidade separada

`establishment_review_replies`, no máximo uma por avaliação, escrita por membership da organização dona. A resposta **não altera nem apaga** a avaliação, conforme o escopo contratado e o documento de atores. Apagar ou ocultar uma avaliação é ato de moderação, nunca do parceiro.

### 3. Denúncia é genérica, não específica de avaliação

`content_reports`, com alvo tipado (`review`, `reply`, `establishment`) e motivo enumerado. Uma única fila serve a todos os conteúdos denunciáveis, seguindo o padrão de issues e histórico append-only do ADR-0015. Criar uma fila por tipo de conteúdo multiplicaria moderação sem ganho.

**Revisão de 15/09/2026 — quatro elementos incorporados de desenho externo.** Um projeto irmão da mesma família de stack resolve denúncia com quatro ideias que esta proposta não previa e que valem mais que o custo de implementá-las agora, enquanto a tabela ainda não chegou a ambiente persistente:

| Elemento              | Por que entra                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Número de protocolo   | Sem ele o denunciante não tem como acompanhar o que reportou, e a operação não tem identificador humano para conversar sobre um caso.                           |
| Denúncia anônima      | O escopo contratado prevê fluxo de denúncia sem qualificá-lo; exigir identidade suprime justamente a denúncia que mais importa.                                 |
| Hash do denunciante   | Permite deduplicar e limitar abuso **sem armazenar quem denunciou**, coerente com a postura de privacidade do ADR-0017, que já evita identificador bruto.        |
| Prazo de moderação    | Sem prazo, uma denúncia fica parada indefinidamente sem que nada no sistema perceba. Com `due_at` e marca de aviso, o atraso é observável.                      |

Consequências de modelo: `content_reports` ganha protocolo único por tenant, sinalizador de anonimato, hashes de origem e de token do denunciante — nunca o valor em claro —, prazo e marca de aviso de prazo, responsável atribuído e descrição de desfecho. O denunciante autenticado continua identificado; o anônimo existe apenas como hash.

Deliberadamente **não** se adota a taxonomia do projeto de origem: subtipos, setor e comissão pertencem ao domínio dele, não a este. Copiar taxonomia alheia é como transplantes se estragam.

O prazo é operação, não obrigação contratual: o escopo coloca moderação humana contínua fora da entrega. O campo existe para que a operação do contratante possa medir, e seu valor entra na política por tenant, não em constante no código.

### 4. Parametrização é a decisão central deste ADR

Todos os valores em aberto viram **política configurável por tenant**, em `review_policies`, com defaults versionados e auditáveis:

| Parâmetro                        | Default proposto | Origem                       |
| -------------------------------- | ---------------- | ---------------------------- |
| exigir comprovação de visita     | **desligado**    | questão aberta em produto    |
| mínimo de caracteres do texto    | 0 (texto opcional) | questão aberta             |
| máximo de caracteres do texto    | 1.000            | questão aberta               |
| máximo de fotos por avaliação    | 4                | questão aberta               |
| máximo de vídeos por avaliação   | **0**            | ver seção de divergência     |
| limite de avaliações por dia     | 5                | questão aberta               |
| intervalo mínimo entre edições   | 1 hora           | questão aberta               |
| prazo para editar                | 30 dias          | questão aberta               |
| prazo de moderação de denúncia   | 5 dias           | incorporado em 15/09/2026    |

Os defaults **não são a decisão do dono**: são ponto de partida para que a funcionalidade exista e seja testável antes das definições. Quando o dono definir, muda-se configuração, não schema nem regra de negócio. Essa é a razão de o desenho ser assim: a definição pendente não pode virar redesenho.

### 5. Comprovação de visita fica preparada, não implementada

`establishment_reviews` carrega referência **anulável** a um resgate do ADR-0021. Com a política desligada, o campo fica nulo e nada é exigido. Se o dono decidir exigir visita, liga-se a política e o vínculo passa a ser obrigatório na escrita, sem migração de significado nem reinterpretação de dados antigos. Isto respeita a instrução de produto de não implementar a exigência enquanto não houver regra verificável.

### 6. Banimento oculta e desconta, mas não apaga

Usuário banido: avaliações **ocultadas das áreas públicas e excluídas das médias e contagens**, preservadas em histórico e auditoria. O efeito exato sobre médias era questão aberta; esta é a proposta, e precisa de confirmação do dono. Apagar destruiria trilha de auditoria e impediria reverter banimento indevido.

### 7. Média e contagem saem da projeção, não de consulta ao vivo

Agregados entram na projeção pública do ADR-0016, reconstruíveis a partir das avaliações visíveis. Nenhuma média é mantida como contador incremental sem fonte reconstruível: banimento, moderação e exclusão mudam agregados retroativamente.

## Divergência real entre o escopo contratado e o ADR-0014

O escopo contratado prevê **vídeos** em avaliações e fotos em **JPG, PNG, WEBP e HEIC**, este último com a ressalva *quando suportados pela infraestrutura adotada*. O ADR-0014 aceito cobre apenas imagem, com JPEG, PNG e WebP válidos, e **rejeita HEIC/HEIF explicitamente** neste corte, em vez de armazenar sem pipeline compatível.

Consequências que precisam de decisão do dono, não de inferência:

- **Vídeo** não é extensão trivial de mídia: exige transcodificação, limites de duração e tamanho, miniatura, custo de armazenamento e banda, e moderação de um formato que a fila humana atual não consegue revisar no mesmo tempo. Propõe-se corte próprio, com o default de vídeos por avaliação em zero até que exista.
- **HEIC** está coberto pela ressalva contratual de suporte da infraestrutura. Manter a rejeição do ADR-0014 é defensável, mas deve ser comunicado por escrito, não deixado implícito.

## Consequências

Cria um domínio novo com leitura pública e escrita autenticada, aumentando superfície de abuso: spam, avaliação em massa, conteúdo ofensivo e disputa entre parceiro e consumidor. A fila de moderação humana passa a receber volume que hoje não recebe, e isso é operação contínua — que o escopo contratado coloca **fora** da entrega.

Agregados públicos passam a depender de estado de moderação e banimento, então a projeção do catálogo ganha uma dependência nova e precisa ser reconstruível de ponta a ponta.

Não altera edições, acessos, carteira ou resgate. Não introduz checkout, cobrança, assinatura ou IA.

## Alternativas descartadas

**Avaliação presa à revisão publicada.** Casaria com a mídia versionada do ADR-0014, mas quebraria o significado: cada nova revisão do estabelecimento zeraria ou fragmentaria o histórico do lugar.

**Regras fixas em código, com os valores em aberto escolhidos agora.** Entregaria mais rápido, mas transformaria cada definição futura do dono em alteração de código e teste — exatamente o que a parametrização evita.

**Fila de moderação separada por tipo de conteúdo.** Simplificaria cada consulta isolada e multiplicaria a operação humana, que é o recurso escasso.

## Cenários de teste identificados

Exigidos pela regra de mudança do README de decisões:

1. Avaliação sobrevive a nova revisão publicada do estabelecimento, mantendo autor, nota e vínculo.
2. Segunda avaliação do mesmo usuário para o mesmo estabelecimento é recusada; edição da existente é aceita dentro da janela e recusada fora dela.
3. Limite diário bloqueia a avaliação seguinte do mesmo usuário em estabelecimentos distintos, respeitando o fuso do tenant.
4. Parceiro responde uma vez; segunda resposta é recusada; parceiro não consegue alterar nota nem apagar avaliação, por rota ou por policy.
5. Membership de outra organização não responde nem modera avaliação alheia — regressão de IDOR conforme ADR-0007.
6. Denúncia move o conteúdo para a fila; moderador oculta; conteúdo some das áreas públicas e da média; histórico append-only registra ator e motivo.
7. Banimento do autor remove suas avaliações das áreas públicas e recalcula média e contagem; reverter o banimento restaura ambos.
8. Projeção pública reconstruída do zero reproduz exatamente média e contagem correntes.
9. Política de comprovação de visita desligada aceita avaliação sem resgate; ligada, recusa sem resgate e aceita com resgate pertencente ao mesmo usuário e estabelecimento.
10. Limites de caracteres, fotos e vídeos são lidos da política do tenant, não de constante em código; alterar a política altera a validação sem deploy.
11. Escrita exige autenticação; leitura pública de avaliações e médias funciona sem sessão e sem membership, conforme ADR-0003.
12. Denúncia recebe protocolo único por tenant, e o mesmo protocolo identifica o caso em toda consulta posterior.
13. Denúncia anônima é aceita sem identificar o autor; nenhuma rota, projeção ou log expõe identidade a partir dela.
14. Duas denúncias anônimas da mesma origem sobre o mesmo alvo são reconhecidas como repetição pelo hash, sem que o valor em claro seja persistido.
15. Denúncia sem desfecho após o prazo da política fica observável como atrasada, e o prazo vem da política do tenant, não de constante em código.

## Pendências que dependem do dono, sem encerramento implícito

Todos os valores da tabela de parâmetros; a decisão sobre exigir comprovação de visita; o efeito do banimento sobre médias aqui proposto; se vídeo entra no escopo desta entrega ou vira corte próprio; e se HEIC permanece rejeitado conforme ADR-0014 sob a ressalva contratual de suporte da infraestrutura. Moderação humana contínua após a entrega é operação, não desenvolvimento, e não integra este ADR.
