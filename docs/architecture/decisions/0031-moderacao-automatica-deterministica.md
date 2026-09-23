# ADR 0031 — Moderação automática determinística

**Status:** proposto

**Data:** 23 de setembro de 2026

**Marco:** EP-19 — moderação automática

**Relacionados:** [ADR-0027](0027-avaliacoes-respostas-e-moderacao-de-conteudo.md), [ADR-0028](0028-experiencias-eventos-e-itens-de-vitrine.md) e [ADR-0029](0029-concierge-ia-ancorado-no-catalogo.md)

**Dono da decisão:** dono do produto. Proposta redigida antes do código. Nada aqui se declara aceito por inferência.

**Base contratual:** Anexo I, item 9 — "Regras de moderação automática serão implementadas de forma razoável; a operação humana contínua de moderação após a entrega não integra esta contratação". O mesmo item nomeia o que pode ser impedido, ocultado ou removido: conteúdo ofensivo, spam, propaganda não autorizada, links, dados de pagamento e contatos publicados em desacordo com as regras. Construir isto é escopo contratado. Os parâmetros permanecem do contratante.

## Contexto

Não existe hoje nenhuma regra automática. Todo conteúdo escrito por explorador ou parceiro — texto da avaliação, resposta do parceiro, título e descrição de experiência, evento ou item de vitrine — vai ao ar sem nenhum filtro, e a única defesa é a fila humana de denúncias do ADR-0027, que depende de alguém ver e denunciar.

O escopo pede regras "razoáveis" e, na mesma frase, deixa a operação humana contínua fora da entrega. As duas coisas juntas definem o desenho: a automação precisa reduzir o que chega ao público sem criar uma segunda fila e sem tomar decisões que depois ninguém consegue contestar.

## As quatro tensões e como esta decisão as resolve

### 1. Um modelo pegaria mais, e não saberia dizer por quê

**Decisão:** só detectores **determinísticos**, sem modelo de linguagem. Uma regra de moderação que retém o texto de alguém precisa poder dizer o que encontrou, para que a pessoa possa contestar, o moderador possa conferir e a operação possa ajustar. Um classificador não diz isso de forma estável. Ele também depende de um serviço de terceiro cujo custo e disponibilidade são item 15, e o ADR-0029 já mostrou esse provedor saindo do ar. Moderação não pode parar porque um modelo parou.

Os detectores são quatro:

| Regra          | O que procura                                                           | Como evita falso positivo                                                                                                  |
| -------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `link`         | URL explícita, `www.`, domínio com TLD conhecido, perfil `@`            | domínio exige letra antes do ponto e TLD da lista; e-mail não conta como link                                              |
| `contact`      | e-mail; telefone brasileiro com DDD; celular sem DDD com separador      | DDD de 11 a 99 sem zero final; fixo começa em 2–5; celular em 9; CEP, datas, preços e horários não fecham 10 ou 11 dígitos |
| `payment_data` | número de cartão; chave Pix aleatória ou CPF quando o texto fala em Pix | cartão exige prefixo de bandeira (3–6) **e** dígito verificador de Luhn; CPF exige dígitos verificadores válidos           |
| `blocked_term` | vocabulário definido pela operação                                      | palavra inteira, sem caixa e sem acento: "cu" não dispara em "cuscuz"                                                      |

### 2. Reter protege, e esconde texto honesto

**Decisão:** cada regra tem um modo por operação — `off`, `flag` ou `hold`.

- `flag` publica normalmente e abre a denúncia. Serve para o que é comum em texto honesto: um link para o Instagram do lugar não é, por si, propaganda.
- `hold` mantém o conteúdo fora das áreas públicas até uma pessoa decidir. Serve para o dano que é **exposição**, que uma decisão posterior não desfaz: número de cartão ou telefone publicado já foi lido.

Os padrões são **provisórios**, documentados aqui e sujeitos à definição do contratante: `link` sinaliza; `contact`, `payment_data` e `blocked_term` retêm; a lista de termos começa **vazia**. O que é ofensivo numa operação é dela dizer, e uma lista inventada neste código seria decisão de produto tomada por inferência.

### 3. Não criar uma segunda fila nem um segundo estado de espera

**Decisão:** uma regra que dispara **abre uma denúncia na fila única do ADR-0027**. Sem denunciante (`reporter_id` nulo), com `origin = 'automatic'`, a regra, a evidência **mascarada** e o motivo canônico correspondente: `link` → `spam`, `contact` e `payment_data` → `inappropriate`, `blocked_term` → `offensive`. A pessoa resolve como qualquer outra denúncia.

Reter usa estados que já existem, sem inventar outro:

- **Avaliação e resposta** ficam `hidden`, o mesmo estado da moderação humana. A média e a contagem da projeção já as excluem.
- **Conteúdo do parceiro** vai para `pending_review`, a fila de aprovação do ADR-0028 que já existe. Uma edição de conteúdo publicado mantém a versão aprovada no ar enquanto espera, como a política de aprovação já fazia.

A evidência nunca carrega o dado. A regra que dispara num cartão grava "cartão terminado em 1111", e a regra que dispara num e-mail grava "e-mail j\*\*\*@gmail.com". Pelo mesmo motivo, a fila de moderação mascara números de cartão no texto exibido: o moderador precisa ler o que foi escrito para decidir, mas não precisa do número do cartão.

### 4. Liberar só o que a regra reteve

A regra reteve, e uma pessoa discorda. Liberar precisa devolver o conteúdo sem republicar o que um moderador ocultou por conta própria — a mesma armadilha que o banimento do ADR-0027 §6 evitou.

**Decisão:** a denúncia automática registra `holds_content`. Resolvê-la sem `content_hidden`, ou descartá-la, **libera**: a avaliação ou resposta volta a `published`. Isso só não acontece se outra denúncia do mesmo alvo tiver sido resolvida com `content_hidden` — nesse caso uma pessoa ocultou pelo mérito, e o descarte da regra não é motivo para republicar.

Para conteúdo do parceiro, descartar a regra **não é aprovar o conteúdo**. O item publica só se a política da operação não exigir aprovação para aquele tipo; se exigir, continua na fila de aprovação, como estaria sem a regra.

## Demais decisões de modelo

**Onde roda.** Na escrita que pode tornar o texto público: criar e editar avaliação, criar e editar resposta, e submeter conteúdo do parceiro. Editar sem mudar o texto, ou editar algo que já não está público, não reavalia. Aprovar conteúdo na fila é ato humano e não passa pela regra.

**Uma denúncia automática aberta por alvo.** Um autor que edita de novo um texto retido atualiza o mesmo caso, em vez de empilhar denúncias sobre as mesmas palavras. Um índice único parcial garante isso no banco. Uma retenção registrada não é desfeita por edição posterior; só a decisão de uma pessoa libera.

**Política por operação.** Em `automatic_moderation_policies`, uma linha por tenant, lida e alterada só por administrador da plataforma, como a política de avaliações. Mudar a regra vale para o que for escrito dali em diante: nada já publicado é reavaliado retroativamente.

## Consequências

Parte do conteúdo passa a esperar decisão humana, e a fila recebe denúncias sem autor humano. Isso aumenta o trabalho da fila, e a operação contínua dessa fila continua fora da entrega.

O autor de uma avaliação retida vê o estado `hidden`, que o app hoje rotula como "Oculta pela moderação". O rótulo é verdadeiro, mas não diz que a decisão está pendente. Diferenciar os dois é trabalho de interface, e não fica decidido aqui.

Não altera o banimento, a denúncia feita por pessoas, a publicação do catálogo nem a política de aprovação do parceiro. Apenas usa os mesmos estados.

## Alternativas descartadas

**Classificador por modelo de linguagem.** Pegaria ironia e contexto, mas não explicaria a retenção, dependeria de provedor de terceiro e teria custo por texto. Fica como corte próprio, se o contratante quiser, sobre a mesma fila.

**Rejeitar a escrita com erro.** Mais simples e sem fila. Mas ensinaria o autor a contornar o detector por tentativa e erro, sem nenhum humano no circuito, e um falso positivo seria definitivo.

**Um estado novo `held`.** Seria mais preciso para o autor, mas criaria um terceiro estado nas avaliações e um segundo estado de espera no conteúdo do parceiro, em contradição com os ADRs 0027 e 0028.

**Lista de palavrões embutida no código.** Daria cobertura imediata e tomaria pelo contratante uma decisão de vocabulário que o anexo deixa com ele.

## Cenários de teste identificados

1. Texto comum — preços, datas, horários, CEP, abreviações — não dispara nenhuma regra.
2. Cada detector dispara no seu caso e não dispara nos falsos positivos típicos.
3. A evidência gravada nunca contém o dado encontrado.
4. Regra em `hold` deixa avaliação e resposta `hidden`, fora da listagem e da média, e abre denúncia com `holds_content`.
5. Regra em `flag` publica e abre denúncia sem retenção.
6. Descartar a denúncia automática libera o que ela reteve.
7. Resolver com `content_hidden` mantém oculto.
8. Descartar a regra não republica o que uma pessoa ocultou por outra denúncia.
9. Editar de novo um texto retido atualiza a mesma denúncia.
10. Conteúdo do parceiro retido vai para `pending_review`; descartar publica se a política não exigir aprovação e mantém na fila se exigir.
11. A regra de uma operação não afeta outra.
12. Regra em `off` não faz nada.
13. Só administrador lê e altera as regras.
14. A fila mostra que o caso foi aberto por regra, qual regra, e nunca exibe um número de cartão por inteiro.

## Pendências que dependem do contratante

O modo de cada regra; a lista de termos bloqueados da operação; se links devem ser retidos em vez de só sinalizados; se o autor deve ver "em análise" em vez de "oculta" enquanto a decisão está pendente; se texto já publicado deve ser reavaliado quando as regras mudarem; e se um classificador por modelo deve somar-se a estes detectores num corte futuro.
