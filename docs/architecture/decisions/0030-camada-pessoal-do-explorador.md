# ADR 0030 — Camada pessoal do Explorador: favoritos, seguidos, interesses e roteiros

**Status:** proposto

**Data:** 23 de setembro de 2026

**Marco:** EP-18 — recursos do Explorador

**Relacionados:** [ADR-0003](0003-catalogo-publico-sem-membership.md), [ADR-0007](0007-rbac-global-com-policies-de-dominio.md), [ADR-0008](0008-modelo-fisico-de-geografia.md), [ADR-0012](0012-estabelecimentos-estaveis-e-revisoes-publicas.md), [ADR-0016](0016-catalogo-publico-projecao-e-resolucao-de-operacao.md), [ADR-0022](0022-carteira-e-acesso-do-consumidor.md), [ADR-0027](0027-avaliacoes-respostas-e-moderacao-de-conteudo.md) e [ADR-0029](0029-concierge-ia-ancorado-no-catalogo.md)

**Dono da decisão:** dono do produto. Proposta redigida antes do código. Nada aqui se declara aceito por inferência.

**Base contratual:** Anexo I, item 10 — "Recursos do Explorador" — lista favoritar estabelecimentos, seguir parceiros, compartilhar experiências, escolher interesses para personalização, criar e salvar roteiros, visualizar histórico e denunciar conteúdos. Construir isto **não é ampliação de escopo**: é escopo contratado que ainda não existe no código. O que permanece do contratante são os parâmetros e as pendências listadas ao final.

## Contexto

Denunciar conteúdos já existe (ADR-0027) e visualizar histórico existe pela carteira (ADR-0022). O restante do item 10 não tem nenhuma linha de código: não há tabela, rota, modelo ou tela para favoritar, seguir, escolher interesses ou salvar roteiro.

O registro de produto já antecipava este corte. O mapa de domínios descreve `explorer_profiles` com interesses e preferências de descoberta, e `favorites` e `collections` com favoritos, listas e roteiros pessoais, ambos sob "domínios posteriores". Este ADR é a decisão que os tira do posterior.

Compartilhar experiências, do mesmo item 10, é resolvido pelo mecanismo do sistema operacional no cliente e **não cria entidade no servidor**. Ele aparece aqui apenas para ficar registrado por que não aparece no modelo.

## As cinco tensões e como esta decisão as resolve

### 1. Favoritar e seguir têm a mesma forma e não são a mesma coisa

O escopo lista os dois como itens distintos, e ambos são uma linha ligando um usuário a um parceiro. A tentação é uma tabela só com um campo de tipo.

**Decisão:** duas tabelas, `explorer_favorites` e `explorer_follows`. Favoritar é um marcador de recuperação — "quero achar isto de novo" — e é assunto exclusivamente de quem favoritou. Seguir é assinatura da publicação de um parceiro — "me interessa o que este lugar publicar" — e é a relação que um dia define **quem recebe um aviso**. Colapsar as duas faz com que uma decisão de produto sobre notificação passe a ser tomada por um valor de coluna, e faz com que desfazer um favorito cancele um aviso que ninguém pediu para cancelar.

### 2. "Seguir parceiros" não diz qual entidade é o parceiro

Uma organização pode administrar unidades em várias cidades (ADR-0008). "Parceiro" no Anexo I item 3 é quem edita horários, fotos e conteúdos **do próprio estabelecimento**.

**Decisão:** segue-se o **estabelecimento estável** do ADR-0012, nunca a organização. A organização não é entidade pública: o visitante não a encontra, não a abre e não tem endereço para ela. A identidade pública de um parceiro é o par cidade + slug do ADR-0016 §6, que pertence ao estabelecimento. Seguir uma organização seria seguir algo que quem segue nunca viu.

### 3. Roteiro é conteúdo escrito por usuário, e conteúdo público exige moderação

O item 10 pede "criar e salvar roteiros". Um roteiro tem nome e anotações escritos por uma pessoa.

**Decisão:** roteiros são **privados do autor**. Não existe rota pública de roteiro, não existe roteiro de outro usuário e não existe listagem de roteiros por estabelecimento. O escopo diz criar e salvar, não publicar, e o item 9 — moderação e conteúdo proibido — dimensiona a fila humana para avaliações, respostas e conteúdo de parceiro. Tornar roteiro público criaria uma superfície de texto livre que nenhuma fila foi dimensionada para revisar, e a operação contínua de moderação está declaradamente fora da contratação.

### 4. Um favorito aponta para algo que pode sair do catálogo

Estabelecimento suspenso, organização desativada, revisão retirada ou cidade inativa deixam de ser descobríveis, e a projeção do ADR-0016 é reconstruível e não autoritativa.

**Decisão:** toda leitura da camada pessoal revalida o alvo pela **mesma definição única** de `catalog_discoverability`, que já serve ao catálogo, ao conteúdo do parceiro (ADR-0028) e ao Concierge (ADR-0029). Um favorito de estabelecimento retirado **permanece gravado e não é devolvido como item navegável**: apagar a linha destruiria a intenção da pessoa por um estado que pode ser revertido amanhã, e devolvê-la como se estivesse no ar reabriria pela porta lateral exatamente o que a retirada fechou. A contagem de favoritos de uma unidade, se um dia existir, sai da fonte e não de contador incremental.

### 5. Interesse é taxonomia, e taxonomia é por operação

Interesses personalizam descoberta, e descoberta é por cidade e categoria (ADR-0008). Categoria pertence ao tenant.

**Decisão:** interesse é vínculo entre usuário e **categoria do próprio tenant**, com a chave composta que carrega o tenant. Não se cria vocabulário paralelo de "interesses" desacoplado da taxonomia: seriam dois dicionários para a mesma ideia, e o segundo envelheceria sozinho. Categoria inativa deixa de ser oferecida para escolha e o vínculo existente é preservado, pela mesma razão do favorito.

**A escolha é feita pelo slug da categoria, não pelo id.** O catálogo público identifica categoria por slug — único por tenant — e nunca publica o id numérico, pela mesma regra que identifica estabelecimento por cidade + slug no ADR-0016 §6. Uma API de interesses que pedisse id obrigaria a alargar o contrato público do catálogo só para servi-la, ou seria impossível de usar a partir da lista que o aplicativo de fato mostra. O servidor resolve o slug dentro da operação; slug de outra operação não resolve e é tratado como inexistente.

## Demais decisões de modelo

**Escopo e unicidade.** As cinco tabelas — `explorer_favorites`, `explorer_follows`, `explorer_interests`, `explorer_itineraries` e `explorer_itinerary_items` — carregam `tenant_id`, usam `unique(['id','tenant_id'])` e chaves estrangeiras compostas que levam o tenant junto, como o restante do schema. Favorito, seguido e interesse são únicos por `(tenant_id, user_id, alvo)`: favoritar duas vezes é o mesmo favorito, não dois.

**Nada disto é público.** Todas as rotas exigem autenticação e devolvem apenas o que pertence a quem chama. Não há rota que liste quem favoritou ou quem segue um estabelecimento: seria transformar uma preferência privada em dado observável por terceiros, e o escopo não pede isso em lugar nenhum.

**Exclusão da conta apaga a camada pessoal, e isso precisa ser explícito.** O Anexo I item 2 dá ao Explorador a exclusão da própria conta, e o serviço que a implementa **não apaga a linha do usuário**: ele grava uma lápide — `is_deleted`, nome e e-mail anonimizados, credenciais invalidadas — e apaga papéis e permissões um a um, dentro da mesma transação. Isso é deliberado, porque conteúdo que sobrevive à conta, como uma avaliação publicada, precisa de uma linha para apontar.

Consequência direta: **cascata de schema a partir de `users` nunca dispararia**, e declará-la seria escrever uma garantia que o produto não cumpre. A camada pessoal é apagada pelo próprio serviço de exclusão, junto de papéis e permissões, na mesma transação. Ela é preferência da pessoa e não conteúdo público: some inteira, e não vira lápide.

A cascata que existe no schema é outra e vale a pena: sair da operação — perder a membership — leva junto as preferências daquela operação, porque elas nunca fizeram sentido fora dela.

**Roteiro tem ordem explícita.** `explorer_itinerary_items` guarda `position`, porque um roteiro é uma sequência e ordenar por data de inserção perderia a reordenação assim que ela existisse. Um mesmo estabelecimento pode aparecer mais de uma vez no roteiro — almoço e volta à noite são duas paradas —, então não há unicidade por estabelecimento dentro do roteiro.

**Sem ranking nesta entrega.** Interesse é registrado e devolvido; ele ainda **não altera a ordenação** de nenhuma busca. Ranking personalizado é o domínio `recommendations` do mapa de domínios, e fazê-lo aqui por dentro criaria prominência sem contrato de prominência.

## Consequências

O aplicativo ganha estado por usuário que hoje não tem, e com ele a primeira superfície em que apagar a conta precisa apagar dados vinculados de fato.

Seguir cria a base de uma futura notificação sem criar a notificação. Push não integra esta entrega e permanece decisão de produto.

Não altera catálogo, benefícios, carteira, resgate, compra, avaliações ou conteúdo do parceiro. Não cria superfície pública nova nem entra na fila de moderação.

## Alternativas descartadas

**Uma tabela genérica de "relação do usuário com entidade", com tipo e alvo polimórfico.** Menos tabelas e nenhuma chave estrangeira real: o banco deixaria de saber o que a linha aponta, e a integridade passaria a depender de disciplina de aplicação — o oposto do que o schema faz hoje.

**Favorito e seguido na mesma tabela com um campo de tipo.** É a tensão 1. Economiza uma tabela e faz duas intenções diferentes compartilharem destino.

**Roteiro público com moderação.** Atenderia a leitura generosa de "compartilhar" e criaria fila humana que o contrato não dimensionou nem contratou.

**Interesses como lista de texto livre no perfil.** Simples de gravar e impossível de cruzar com a taxonomia que organiza a descoberta.

**Contador de favoritos na projeção do catálogo.** Daria ordenação por popularidade de graça e introduziria número público sem origem reconstruível, contra o ADR-0016.

## Cenários de teste identificados

1. Favoritar duas vezes o mesmo estabelecimento não cria duas linhas e não é erro para quem chama.
2. Desfavoritar remove o vínculo e não remove o estabelecimento nem qualquer outro dado.
3. Favorito de estabelecimento que deixou de ser descobrível não aparece na listagem navegável do Explorador, e volta a aparecer se a unidade for republicada.
4. Um usuário nunca lê favorito, seguido, interesse ou roteiro de outro — regressão de IDOR conforme ADR-0007.
5. Nenhuma rota pública revela quem favoritou ou quem segue um estabelecimento.
6. Seguir e favoritar são independentes: desfazer um não desfaz o outro.
7. Interesse só aceita categoria do próprio tenant; categoria de outra operação é recusada como inexistente.
8. Categoria desativada não é oferecida para escolha e o interesse já registrado é preservado.
9. Roteiro pertence a quem criou: outro usuário recebe não encontrado, nunca proibido, para não confirmar existência.
10. Itens do roteiro mantêm a ordem escolhida após reordenação, e o mesmo estabelecimento pode figurar duas vezes.
11. Excluir a conta do Explorador apaga favoritos, seguidos, interesses e roteiros na mesma transação da exclusão, embora a linha do usuário permaneça como lápide.
12. Nenhuma ordenação de busca muda por causa de interesse registrado nesta entrega.

## Pendências que dependem do contratante

Se seguir um parceiro deve gerar aviso, por qual canal e com qual frequência — o que traz push para dentro ou o mantém fora. Limite de roteiros por Explorador e de paradas por roteiro, hoje propostos sem teto. Se o roteiro deve poder ser compartilhado de forma que outra pessoa o abra dentro do produto, o que o transformaria em conteúdo público sujeito ao item 9. Se interesses devem efetivamente alterar a ordenação da descoberta, e sob qual regra, já que isso cria prominência. E se favoritar deve exigir conta confirmada ou basta sessão autenticada.

## Revisão de 23/09/2026 — favoritar conteúdo do parceiro

O Anexo I item 10 diz "favoritar estabelecimentos **e conteúdos** previstos no aplicativo", e a primeira entrega só cobria estabelecimentos.

**Tabela própria, `explorer_content_favorites`, em vez de alargar `explorer_favorites`.** Aquela tabela aponta para estabelecimentos com chave estrangeira real. Fazer o alvo virar "estabelecimento ou experiência ou evento" exigiria ou perder a chave — a referência polimórfica que este ADR descartou, em que o banco deixa de saber para onde a linha aponta — ou encher de colunas anuláveis e checagem de espécie uma tabela cujas linhas hoje são todas a mesma coisa. Na tabela nova, cada espécie tem coluna anulável própria com chave composta para sua tabela de conteúdo, e exatamente uma é preenchida: o mesmo formato que `partner_content_media` já usa para essas tabelas.

**Experiências e eventos, não itens de vitrine.** Item de vitrine é produto exibido com preço informativo; favoritá-lo é lista de desejos, o primeiro passo do carrinho e do checkout que o Anexo I item 16 põe fora da entrega. Fica como pendência se o contratante quiser.

**Mesmas regras dos favoritos de estabelecimento.** Privado, `PUT` idempotente, e só se favorita o que o público vê agora: snapshot aprovado, não arquivado, estabelecimento descobrível e, para evento, janela não encerrada. Título e janela vêm do snapshot, nunca das colunas vivas, porque uma edição à espera de moderação nunca foi pública. Evento que terminou **continua gravado**, deixa de ser navegável e entra na contagem `unavailable`, como a unidade retirada; e continua podendo ser removido, porque desfavoritar não revalida.

A exclusão de conta apaga também estas linhas, pela mesma purga explícita.

Cenários acrescentados: favoritar duas vezes é um favorito; rascunho, arquivado, evento encerrado e item de vitrine respondem como inexistentes; evento que termina depois de favoritado vira indisponível e pode ser removido; conteúdo de unidade retirada é contado e não listado; um Explorador não lê os favoritos de outro; excluir a conta apaga os favoritos de conteúdo.

## Revisão de 26/09/2026 — a faixa "Para você"

O Anexo I item 10 diz "escolher interesses para personalização de descoberta e recomendações". A primeira entrega registrava os interesses e só o Concierge os lia (ADR-0029, revisão de 23/09/2026); a tela de descoberta não mudava com eles, e o item ficava parcial na rastreabilidade.

**Uma faixa própria, não a busca reordenada.** `GET /api/v1/me/for-you?city=<slug>` devolve os estabelecimentos descobríveis da cidade classificados em qualquer interesse ativo da pessoa ou em categoria descendente ativa dele, com a mesma leitura de árvore do filtro de categoria do catálogo. A busca orgânica continua igual para todo mundo: a decisão "sem ranking" deste ADR e o cenário 12 seguem de pé, e a pendência sobre interesses alterarem a ordenação da descoberta continua do contratante.

**A ordem é a que a busca já usa sem termo** — nome normalizado, depois id —, **sem pontuação e sem vaga de patrocínio.** Patrocinado aparece na posição alfabética que teria de qualquer forma. Assim a faixa estreita o que se mostra sem decidir quem vem primeiro, e não cria a prominência sem contrato que motivou a decisão original.

**Mesmas regras públicas, lidas do mesmo lugar.** A consulta parte da definição única de descobribilidade (`catalog_discoverability`), não da cópia que a busca embute, e cada linha passa pela mesma projeção dos resultados orgânicos: o aplicativo desenha a faixa com o mesmo cartão e ela nunca mostra mais do que a busca mostraria. Cidade desconhecida, de outra operação, inativa ou malformada é recusada como o catálogo público recusa.

**Limite de dez lugares.** É uma faixa de entrada, não uma segunda listagem paginada.

**Só interesses em categoria ativa contam**, como no Concierge. A resposta traz `has_interests`, que separa a faixa vazia porque nada foi escolhido — onde cabe um convite para escolher — da faixa vazia porque nada escolhido está publicado na cidade, onde não cabe. A rota é privada, como o resto de `/api/v1/me`.

Cenários acrescentados: sem sessão, recusa; sem interesse, faixa vazia com `has_interests` falso, e com interesse, os lugares escolhidos; o cartão é idêntico ao do resultado orgânico; unidade suspensa, retirada, sem capa ou de organização suspensa fica fora, inclusive quando a projeção ainda a lista; categoria pai traz as filhas; lugar fora das categorias escolhidas fica fora; interesse em categoria desativada não conta; interesses de uma pessoa não moldam a faixa de outra; a faixa respeita a cidade pedida e nunca alcança outra operação; ordem alfabética com patrocinado na sua posição; no máximo dez; a busca pública fica idêntica antes e depois.
