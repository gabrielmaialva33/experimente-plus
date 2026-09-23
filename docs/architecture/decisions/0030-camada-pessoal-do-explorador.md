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
