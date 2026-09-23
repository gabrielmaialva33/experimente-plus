# ADR 0029 — Concierge IA ancorado no catálogo

**Status:** proposto

**Data:** 15 de setembro de 2026

**Marco:** EP-17 — assistência de descoberta

**Relacionados:** [ADR-0003](0003-catalogo-publico-sem-membership.md), [ADR-0016](0016-catalogo-publico-projecao-e-resolucao-de-operacao.md), [ADR-0017](0017-analytics-de-descoberta-privacidade-e-agregacao.md), [ADR-0022](0022-contrato-api-movel-consumer-first.md), [ADR-0027](0027-avaliacoes-respostas-e-moderacao-de-conteudo.md) e [ADR-0028](0028-experiencias-eventos-e-itens-de-vitrine.md)

**Dono da decisão:** dono do produto. Proposta redigida antes do código. Nada aqui se declara aceito por inferência.

**Autorização de execução — 15/09/2026:** a construção do desenho estrutural foi expressamente autorizada. Cobre a ancoragem no catálogo, a validação determinística pós-resposta, a fronteira de assunto em código, a supressão do raciocínio, a configuração de provedor e modelos com reserva, a degradação prevista e a ausência de caminho de escrita. **Não** cobre os limites de consumo, a conta de produção do provedor nem o aviso nos termos sobre processamento por terceiro, que permanecem do contratante.

## Contexto

O escopo contratado prevê um módulo de assistência que sugere lugares **cadastrados na plataforma**, monta sugestões de roteiro a partir de estabelecimentos, experiências e eventos, explica opções com base nas informações acessíveis ao módulo, e usa **mecanismos técnicos razoáveis para reduzir a invenção de estabelecimentos, horários ou eventos inexistentes, sem garantia de infalibilidade do modelo**. Ele explicitamente **não** realiza reservas, compras ou confirmações externas em nome do usuário.

O instrumento também é claro sobre a natureza do módulo: tecnologia probabilística, dependente de terceiros, **sem promessa de precisão absoluta nem de disponibilidade contínua**, e que **não constitui serviço profissional, turístico, jurídico, médico, financeiro ou de emergência**.

Hoje não existe nada de IA no backend: nem variável de ambiente, nem módulo.

## Medições feitas antes desta proposta

Em 15/09/2026, contra a API real do provedor escolhido, com um prompt de concierge contendo três estabelecimentos e a pergunta “quero um roteiro de tarde em Londrina”:

| Observação                                                                                  | Consequência de desenho                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `nemotron-3.5-lightning` citou **“Centro Histórico”**, lugar ausente da lista fornecida     | Prompt bem escrito **não** basta. A invenção acontece e precisa ser barrada fora do modelo. |
| Três amostras: `deepseek-v4-flash` citou 3/3 sempre; `nemotron-lightning`, 2/3, 3/3 e 2/3   | Modelos diferem em aderência ao dado, mas nenhum garante.                                   |
| Latências entre **2s e 14,5s**, com variação grande no mesmo modelo                         | Chamada síncrona longa num app móvel exige limite de tempo e resposta degradada.            |
| Uma chamada retornou **HTTP 529**, sobrecarga do provedor                                   | Indisponibilidade não é hipótese; é comportamento observado.                                |
| Um modelo devolveu o próprio raciocínio dentro do conteúdo: _“Here's a thinking process…”_  | Sem tratamento explícito, o raciocínio do modelo vira texto para o consumidor.              |
| `google/gemma-3-12b-it` e `moonshotai/kimi-k2.6`, listados no catálogo, responderam **404** | Estar listado não significa servível; a configuração precisa ser verificada, não suposta.   |

## Decisão proposta

### 1. O modelo compõe linguagem; ele não é fonte de fato

O único fato admissível vem da **projeção pública do ADR-0016**. O módulo recupera do catálogo os estabelecimentos, experiências e eventos pertinentes à pergunta e os entrega ao modelo como material fechado. O modelo redige; ele não sabe nada que não tenha recebido.

Nenhum conhecimento paramétrico do modelo é tratado como informação sobre a operação. Isso decorre direto do escopo, que manda priorizar informações existentes no catálogo.

### 2. Validação pós-resposta é a salvaguarda central deste ADR

Toda resposta passa por conferência **determinística** antes de chegar ao consumidor: cada estabelecimento, evento ou experiência nomeado tem de existir no conjunto que foi entregue ao modelo. O que não existir é removido; se a remoção esvaziar a resposta, devolve-se a lista do catálogo sem texto gerado.

Esta é a interpretação técnica do que o escopo chama de mecanismo razoável contra invenção. Ela não depende de qual modelo está configurado, não degrada quando o provedor troca de versão, e é demonstrável em teste — três propriedades que um prompt não tem. A medição acima mostra por que ela é necessária e não decorativa.

Isso não promete infalibilidade, e o instrumento não exige isso: exige mecanismo razoável. Um verificador determinístico é razoável e auditável.

### 3. Fronteira de assunto é regra, não gentileza do modelo

O escopo declara que o módulo não é serviço profissional, jurídico, médico, financeiro ou de emergência. Pedir ao modelo que “não fale sobre isso” é confiar o limite contratual a um sistema probabilístico.

A fronteira é aplicada em código: pergunta fora do domínio de descoberta recebe **recusa de texto fixo**, escrita por nós, sem chamada ao modelo. Um classificador dedicado, `nvidia/llama-3.1-nemoguard-8b-topic-control`, existe no catálogo do provedor e pode reforçar essa camada; fica como **opção registrada**, não como decisão, porque dobra latência e consumo e a recusa fixa já cumpre a obrigação.

### 4. Raciocínio do modelo nunca chega ao usuário

Onde o modelo expõe raciocínio, ele é desativado explicitamente ou lido em campo separado e descartado. A medição mostra que o padrão de um dos modelos é vazá-lo dentro do conteúdo. O consumidor recebe resposta, nunca deliberação.

### 5. Provedor e modelos são configuração, com fallback

Provedor, modelo primário, modelo de reserva, limite de tempo e limites de consumo vivem em configuração por tenant, nunca em constante. Duas razões: o instrumento trata mudança futura de modelo, provedor, preço ou política como **nova contratação**, e a medição mostrou modelos listados que respondem 404 — trocar um nome não pode exigir release.

Provedor: **NVIDIA**, em `https://integrate.api.nvidia.com/v1`, compatível com a interface OpenAI. Primário **`deepseek-ai/deepseek-v4-flash-0731`**, que ancorou 3/3 em todas as amostras. Reserva **`nvidia/nemotron-3.5-lightning-30b-a3b`**, de 3 a 5 vezes mais rápido, que respondeu quando o primário devolveu 529. O raciocínio do nemotron é desativado por `chat_template_kwargs.enable_thinking = false`, conforme medido.

### 6. Degradação é caminho previsto, não erro

Estouro de tempo, 529, 404 ou resposta reprovada na validação levam, nesta ordem, ao modelo de reserva e depois à **resposta sem IA**: a lista de lugares do catálogo que responde à pergunta. O consumidor nunca vê erro cru nem tela vazia. O instrumento já afasta garantia de disponibilidade contínua; isso não autoriza quebrar a tela.

### 7. Sem efeito colateral, por construção

O módulo não tem caminho de escrita. Não reserva, não compra, não confirma, não concede acesso, não altera carteira. Lê a projeção pública e responde. Isso é exigência explícita do escopo e fica garantido pela ausência de rota, não por instrução ao modelo.

### 8. O que sai da operação para o provedor

A pergunta do consumidor e o recorte do catálogo trafegam para um terceiro. Nada além disso: sem token, sem QR, sem carteira, sem identificador de usuário, sem dado pessoal. Isto preserva a postura do ADR-0017 e do ADR-0022.

**Pendência de produto, não técnica:** o tratamento de dados pessoais e os avisos ao titular são definidos pelo contratante, e o envio de texto do usuário a um provedor externo de IA precisa constar dos termos. Não se assume esse aviso como existente.

### 9. Personalização por interesses fica fora deste corte

O escopo condiciona a personalização aos interesses do Explorador **quando aplicável**. Interesses pertencem ao conjunto de recursos do Explorador, que não tem ADR nem implementação e cujas decisões de produto seguem abertas. O Concierge entrega sem personalização por interesse, e isso é registro, não omissão.

## Parâmetros por tenant, com defaults

| Parâmetro                             | Default proposto                    |
| ------------------------------------- | ----------------------------------- |
| provedor                              | NVIDIA (`integrate.api.nvidia.com`) |
| modelo primário                       | `nvidia/nemotron-3-super-120b-a12b` |
| modelo de reserva                     | `mistralai/mistral-nemotron`        |
| limite de tempo por resposta          | 10 segundos                         |
| máximo de itens de catálogo no prompt | 20                                  |
| máximo de tokens de saída             | 400                                 |
| perguntas por usuário por dia         | 20                                  |
| guarda de tópico dedicado             | desligado                           |

Os defaults **não são decisão do contratante**. Ele ainda deve definir limites de consumo, e o custo do serviço de IA é responsabilidade dele.

### Revisão de 18/09/2026 — os modelos da proposta original duraram três dias

A tabela acima nasceu, em 15/09, com `deepseek-ai/deepseek-v4-flash-0731` como primário, medido então em 3/3 de aderência ao catálogo. Em 18/09, ao configurar a homologação, esse modelo **não respondeu a nenhuma das cinco tentativas**, de dois pontos de rede diferentes, incluindo o prompt trivial "diga ok":

| Modelo                                   | Latência, 3 amostras | Aderência ao catálogo |
| ---------------------------------------- | -------------------- | --------------------- |
| `deepseek-ai/deepseek-v4-flash-0731`     | >45s, >45s, >45s     | não avaliável         |
| `nvidia/nemotron-3-super-120b-a12b`      | 1,9s · 3,3s · 3,8s   | 3/3                   |
| `mistralai/mistral-nemotron`             | 3,7s · 4,3s · 4,3s   | 3/3                   |
| `nvidia/nemotron-3.5-lightning-30b-a3b`  | 4,1s · 8,7s · 9,7s   | 3/3                   |
| `nvidia/nemotron-nano-3-30b-a3b`         | 404                  | não servível          |
| `nvidia/llama-3.1-nemotron-70b-instruct` | 404                  | não servível          |

A aderência foi medida com três lugares, um deles em outra cidade: acerta quem responde a pergunta sobre Londrina sem citar o de Maringá.

Duas observações valem registro. A primeira é que o `nemotron-3.5-lightning` levou **12,2 segundos** para responder "diga ok" com o raciocínio ligado e **0,6 segundo** com `enable_thinking: false` — vinte vezes mais rápido pelo mesmo resultado visível, o que confirma a decisão 4 por um motivo que não era o esperado quando ela foi escrita.

A segunda é o próprio fato de a tabela ter envelhecido em três dias. É exatamente o que a decisão 5 previu ao manter provedor e modelos em configuração: a troca foi feita por variável de ambiente, sem release, sem migration e sem tocar em uma linha de código do módulo. O caminho degradado sustentou a rota enquanto os modelos não respondiam — a homologação devolveu a lista do catálogo, com `outcome: degraded`, nunca um erro cru.

## Consequências

Cria dependência de terceiro no caminho de uma tela de consumidor, com latência medida entre 1,9 e 14,5 segundos, e com modelos que deixam de responder sem aviso. A interface precisa tratar espera e degradação como estados normais, no mesmo padrão dos estados obrigatórios já definidos para o cliente móvel.

A qualidade do Concierge passa a depender da qualidade do catálogo: com poucos estabelecimentos publicados, a resposta é pobre por falta de dado, não por falha do modelo. Na homologação atual, com uma cidade e três estabelecimentos, isso será visível.

Não altera catálogo, benefícios, carteira, resgate, compra ou avaliações.

## Alternativas descartadas

**Confiar a ancoragem ao prompt.** Mais simples e já refutado pela medição: a invenção ocorreu na primeira tentativa.

**Busca semântica com embeddings sobre o catálogo.** O provedor oferece `nvidia/embed-qa-4` e `snowflake/arctic-embed-l` e a ideia é boa para catálogo grande. Descartada **neste corte**: com uma cidade e poucos estabelecimentos, filtro por cidade, categoria e vigência resolve, e um índice vetorial adicionaria infraestrutura, custo e reconstrução sem ganho observável. Reavaliar quando o catálogo crescer.

**Modelo único sem reserva.** Um provedor com 529 observado e modelos listados que respondem 404 não sustenta caminho único.

**Deixar o modelo recusar assuntos proibidos.** Transfere um limite contratual para um sistema probabilístico.

## Cenários de teste identificados

1. Resposta que nomeia estabelecimento ausente do material entregue tem esse nome removido antes de chegar ao consumidor.
2. Resposta cujo conteúdo, após a remoção, fica sem substância devolve a lista do catálogo em vez de texto vazio.
3. Nenhum estabelecimento não publicado, arquivado ou de outro tenant entra no material entregue ao modelo.
4. Pergunta de natureza jurídica, médica, financeira ou de emergência recebe a recusa fixa **sem** chamar o provedor.
5. Estouro do limite de tempo aciona o modelo de reserva; falha do reserva devolve a lista do catálogo, nunca erro cru.
6. Resposta do provedor contendo raciocínio não entrega esse raciocínio ao consumidor.
7. Nenhuma rota do módulo escreve em compra, acesso, carteira, resgate ou avaliação.
8. O material enviado ao provedor não contém token, identificador de usuário, dado de carteira nem dado pessoal.
9. Limite de perguntas por usuário por dia é lido da política do tenant, não de constante em código.
10. Modelo configurado que responde 404 é tratado como indisponível e aciona a reserva, sem derrubar a requisição.
11. Evento fora de vigência e estabelecimento desativado não aparecem em sugestão de roteiro.

## Pendências que dependem do contratante

Limites de consumo e conta de produção do provedor, que são responsabilidade dele. Se o guarda de tópico dedicado entra no escopo. O aviso, nos termos de uso, de que o texto da pergunta é processado por provedor externo de IA. E a definição sobre interesses do Explorador, que hoje mantém a personalização fora deste corte.

## Revisão de 23/09/2026 — interesses do Explorador

O Anexo I item 11 pede sugerir lugares "com base nos dados disponíveis e, quando aplicável, nos interesses do Explorador". Os interesses passaram a existir com o ADR-0030.

**Rota própria, `POST /api/v1/me/concierge`.** A rota pública continua pública e **nunca lê credencial**: um token enviado a ela é ignorado, então a resposta pública não pode depender de quem pergunta. A variante pessoal exige sessão e resolve a operação pelo mesmo middleware do restante de `/api/v1/me`.

**Os interesses escolhem o que cabe no prompt, e só isso.** Quando há mais lugares descobríveis do que o orçamento de `CONCIERGE_MAX_CATALOG_ITEMS`, os das categorias de interesse entram primeiro, dentro do mesmo conjunto descobrível e do mesmo recorte de cidade. Não acrescentam lugar, não retiram nenhum que caberia, e não tocam na ordem da busca, que o ADR-0030 mantém sem ranking pessoal. Sem interesses, a consulta é idêntica à anônima.

**Os interesses não vão para o provedor do modelo.** Preferência é dado pessoal, e o modelo não precisa dela para citar só o que recebeu. O que sai do servidor continua sendo só a pergunta e os itens do catálogo.

**Interesse em categoria desativada não é aplicado.** Continua escolhido, pelo ADR-0030, mas favorecer o que a operação retirou seria o contrário da retirada.

A resposta das duas rotas ganha `personalized`, verdadeiro quando os interesses foram aplicados, para o cliente poder dizer isso em vez de insinuar uma personalização que não houve. Na rota pública é sempre falso.

Cenários acrescentados: com orçamento curto, a categoria preferida entra no prompt; com orçamento folgado, a preferência não muda o conjunto; a rota pública não é personalizada mesmo com sessão enviada; sem interesses, a rota pessoal responde o mesmo que a pública; com interesses, informa `personalized`; interesse desativado não é aplicado; a rota pessoal exige sessão.
