# 07 — Validação de negócio

O objetivo desta etapa é reduzir risco antes de transformar hipóteses comerciais em funcionalidades caras.

## Hipóteses prioritárias

| Código | Hipótese                                                        | Evidência necessária                               |
| ------ | --------------------------------------------------------------- | -------------------------------------------------- |
| H1     | pessoas têm dificuldade para descobrir opções locais confiáveis | entrevistas e tarefas de descoberta                |
| H2     | catálogo multicidade é relevante para quem circula na região    | frequência de deslocamento e buscas entre cidades  |
| H3     | gastronomia é a melhor vertical de entrada                      | uso recorrente e facilidade de aquisição de oferta |
| H4     | parceiros aceitam manter uma ficha gratuita                     | adesão e conclusão do onboarding piloto            |
| H5     | ações qualificadas são valiosas para parceiros                  | interesse em rota, WhatsApp, telefone e relatórios |
| H6     | parceiros pagarão por ferramentas Pro                           | teste de proposta e preço, sem promessa antecipada |
| H7     | categorias não gastronômicas possuem demanda real               | entrevistas e pesquisas sem resultado              |
| H8     | benefícios aumentam recorrência depois da descoberta            | teste posterior com parceiros e usuários ativos    |

## Pesquisa com Exploradores

### Amostra inicial sugerida

- 12 a 18 pessoas;
- residentes de cidades diferentes da região;
- perfis que saem com frequências diferentes;
- mistura de casais, famílias, grupos e pessoas que saem sozinhas;
- incluir pessoas que se deslocam entre Cornélio Procópio, Londrina e municípios próximos.

### Perguntas de entrevista

- Conte a última vez em que procurou um lugar para comer ou algo para fazer.
- Onde pesquisou primeiro e por quê?
- Quais informações faltaram ou estavam incorretas?
- Como decidiu entre as opções?
- Costuma procurar em cidades próximas?
- O que faz abandonar uma opção?
- Que tipo de lugar salva ou compartilha?
- Usa desconto como motivo principal ou apenas como incentivo?
- Em quais categorias teria interesse além de gastronomia?
- Que informação faria confiar em um guia regional?

Evitar perguntar “você usaria o Experimente+?”. Perguntas sobre comportamento passado geram evidência melhor do que intenção genérica.

### Tarefa de usabilidade inicial

Apresentar um protótipo simples e pedir:

1. encontre um café aberto agora;
2. encontre uma opção para sair em outra cidade;
3. compare duas unidades;
4. abra a rota;
5. salve uma opção.

Medir compreensão, tempo, dúvidas e informações ausentes.

## Pesquisa com parceiros

### Amostra inicial sugerida

- 5 restaurantes;
- 3 bares;
- 3 cafés, padarias ou docerias;
- 2 redes com mais de uma unidade;
- 3 negócios de categorias futuras, como cinema, tatuagem ou bem-estar;
- mistura de negócios com presença digital forte e fraca.

### Perguntas de entrevista

- Como novos clientes descobrem o negócio hoje?
- Quais canais exigem atualização constante?
- Que informação costuma ficar desatualizada?
- Como mede resultado de divulgação?
- Já pagou por mídia local ou guia? O que funcionou?
- Quais ações têm valor: ligação, rota, WhatsApp, reserva externa, visita ao site?
- Quem da equipe atualizaria a ficha?
- Quanto tempo conseguiria dedicar por mês?
- Que ferramenta justificaria uma assinatura?
- Que tipo de benefício consegue oferecer sem prejudicar margem?
- Participaria de uma campanha regional claramente patrocinada?

### Teste de onboarding manual

Antes de automatizar todo o portal:

1. coletar dados por formulário ou atendimento assistido;
2. montar a ficha pública manualmente;
3. pedir ao parceiro para revisar;
4. observar campos difíceis e dados faltantes;
5. medir tempo de cadastro e aprovação;
6. validar quais métricas ele entende.

## Experimentos recomendados

### E1 — catálogo concierge manual

Criar uma página ou protótipo com um conjunto pequeno e real de unidades. Divulgar para usuários piloto e medir:

- pesquisas;
- fichas abertas;
- cliques em rota e contato;
- perguntas sem resposta;
- retorno após sete dias.

### E2 — cadastro assistido de parceiros

Cadastrar 10 a 15 unidades com acompanhamento. Medir:

- tempo para obter dados completos;
- taxa de abandono;
- campos mais problemáticos;
- necessidade de múltiplos usuários;
- frequência de atualização.

### E3 — relatório simples

Enviar a parceiros piloto um relatório com:

```text
Visualizações
Aberturas de ficha
Rotas
WhatsApp
Telefone
Site
Favoritos
```

Perguntar quais números geram decisão e quais parecem vaidade.

### E4 — campanha editorial

Executar uma coleção, como “cafés para conhecer na região”, sem benefício pago. Avaliar:

- interesse do usuário;
- participação dos parceiros;
- ações geradas;
- disposição futura para patrocínio identificado.

### E5 — benefício controlado

Somente depois do catálogo piloto, testar uma campanha pequena com modalidades diferentes:

- dois por um;
- percentual;
- item cortesia;
- horário de menor movimento.

Não construir QR Code ou cobrança antes de provar uso e viabilidade operacional.

## Critérios preliminares de avanço

São gates de trabalho, não metas públicas.

### Para iniciar o catálogo completo

- ao menos 10 parceiros aceitam participar do piloto;
- a maioria consegue fornecer os dados obrigatórios;
- usuários demonstram dificuldade real nas fontes atuais;
- cidade e categoria são compreendidas como filtros principais;
- pelo menos três ações qualificadas são consideradas úteis pelos parceiros.

### Para ampliar categorias

- existem pesquisas ou pedidos recorrentes fora da gastronomia;
- a equipe consegue curar a nova categoria;
- atributos específicos estão definidos;
- há oferta suficiente para não criar uma seção vazia.

### Para lançar Experimente+ Pro

- parceiros consultam métricas de forma recorrente;
- pelo menos um recurso pago resolve dor demonstrada;
- preço foi testado em conversa real;
- suporte e custo operacional são conhecidos;
- plano gratuito permanece útil para o catálogo.

### Para lançar Experimente+ Pass

- catálogo possui uso recorrente;
- existe quantidade suficiente de benefícios fortes;
- regras são compreendidas por parceiro e consumidor;
- fraude e validação foram testadas manualmente;
- suporte, reembolso e responsabilidade estão definidos.

## Registro da pesquisa

Criar, quando a pesquisa começar:

```text
docs/research/interviews/explorers/
docs/research/interviews/partners/
docs/research/experiments/
docs/research/synthesis/
```

Não versionar CPF, CNPJ, telefone pessoal, gravações ou qualquer dado sensível. Registrar sínteses anonimizadas, decisões e evidências.

## Saída esperada

A validação deve produzir:

- agrupamento geográfico inicial;
- árvore de categorias do lançamento;
- requisitos reais de publicação;
- atributos prioritários;
- fluxo de claim e onboarding;
- ações que entram no analytics;
- decisão sobre o primeiro recurso pago;
- lista de hipóteses rejeitadas ou adiadas.
