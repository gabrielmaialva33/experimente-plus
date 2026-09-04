# 06 — Referências de mercado

Revisão inicial realizada em 22 de agosto de 2026, usando páginas oficiais, e ampliada em 4 de setembro de 2026 com a inspeção direta do aplicativo do Tour Londrina. Esta análise serve para compreender modelos existentes, não para copiar regras, textos, identidade ou implementação.

## Tour Londrina

Fonte oficial: [tourlondrina.com.br](https://tourlondrina.com.br/)

Características observadas:

- foco gastronômico em Londrina;
- pagamento único, sem mensalidade recorrente;
- edição atual anunciada com 170 vouchers;
- mecânica principal “pede um prato e ganha outro igual”;
- cada voucher vale uma visita;
- benefícios armazenados no aplicativo;
- validação presencial por QR Code;
- validade anunciada até junho de 2027;
- estabelecimento parceiro é responsável pelo produto ou serviço, enquanto a plataforma intermedeia o benefício.

### O que aproveitar como referência

- proposta comercial compreensível em poucos segundos;
- benefício com valor percebido concreto;
- validação presencial simples;
- catálogo visual de parceiros;
- edição com validade clara;
- comunicação orientada a experimentar lugares novos.

### O que não assumir no Experimente+

- limitar o produto a restaurantes;
- exigir pagamento para acessar descoberta;
- adotar dois por um como única modalidade;
- tratar voucher como principal unidade de domínio;
- limitar operação a uma cidade;
- copiar preço, validade ou regras comerciais.

### Aplicativo Android — inspeção direta

**Data:** 4 de setembro de 2026.
**Artefato:** `br.com.tourlondrina`, versão 1.1.11 (`versionCode` 23), `targetSdk` 36, observado em aparelho próprio com Android 16.
**Método:** leitura estática do pacote instalado e navegação assistida por ADB. Não houve descompilação de código nem extração de assets proprietários. O objetivo foi entender arquitetura de navegação, sistema visual e modelo de filtro — não identidade, texto ou implementação.

#### Stack técnica observada

| Camada          | Escolha                                                          |
| --------------- | ---------------------------------------------------------------- |
| Framework       | React Native bare (CLI), sem Expo                                |
| Arquitetura     | New Architecture (Fabric/TurboModules), engine Hermes            |
| Navegação       | React Navigation — bottom tabs, stack e drawer                   |
| Estilo          | styled-components                                                |
| Listas          | `@shopify/flash-list`; gráficos com `@shopify/react-native-skia` |
| Armazenamento   | MMKV via Nitro Modules                                           |
| Câmera e QR     | `react-native-vision-camera` com ML Kit barcode scanning         |
| Mapas           | `react-native-maps` sobre Play Services                          |
| Observabilidade | Firebase Analytics, Crashlytics e Cloud Messaging                |
| Pagamento       | Pagar.me                                                         |
| Tipografia      | Montserrat e Outfit, oito pesos cada, mais Ionicons              |

A activity de entrada é `com.tourwhitelabel.MainActivity`: o produto é distribuído como **white-label**, com a operação de Londrina como uma instância. O banner da home exibiu em produção a frase `NOS MELHORES ESTABELECIMENTOS DA E ECONOMIZA`, com a variável de cidade não preenchida — evidência do template compartilhado.

O aplicativo declara App Links verificados (`autoVerify`) em `tourlondrina.com.br/app`, sem esquema proprietário, e bloqueia tráfego em texto claro.

#### Arquitetura de navegação

Cinco abas fixas, com as telas de detalhe dentro da stack de cada aba — a barra inferior permanece visível em toda a jornada:

```text
Home        conteúdo editorial: hero, destaques em carrossel, categorias
Compre!     argumento de venda: o que é, números, chamada de compra
Vouchers    lista do catálogo com busca, filtros e cards
Mapa        mesmo acervo em mapa escuro, pins coloridos por categoria
Meu Tour    conta e acompanhamento da economia acumulada
```

A observação relevante é que **a descoberta está distribuída em três abas** — editorial, lista e mapa — enquanto o planejamento móvel do Experimente+ trata `Explorar` como uma área única (`17-aplicativo-movel-consumer-first.md`).

| Tour Londrina         | Equivalente no Experimente+                          |
| --------------------- | ---------------------------------------------------- |
| Home, Vouchers e Mapa | `Explorar`, como três facetas do mesmo acervo        |
| Meu Tour              | `Carteira` e `Conta`                                 |
| Compre!               | sem equivalente; checkout está fora de escopo        |
| —                     | `Validar` e `Histórico`, condicionais por capability |

#### Sistema visual

A linguagem é **flat**: sem gradiente, sem sombra pesada, sem desfoque. O raio é total em praticamente todo elemento — campos, chips, botões, banners e caixas de aviso.

| Papel         | Valor observado      | Uso                                       |
| ------------- | -------------------- | ----------------------------------------- |
| Azul primário | `#385da3`            | cabeçalho, marca, links, chips ativos     |
| Azul escuro   | `#1f4977`, `#285ea7` | subcabeçalho da ficha, painel de card     |
| Azul claro    | `#5499c1`            | painéis secundários e banners             |
| Verde         | `~#2f592f`           | confirmação: cadastrar, aplicar filtros   |
| Vinho         | `~#ab5b6a`           | compra: adquirir edição, iniciar registro |
| Creme         | `#fffde6`, `#fffee8` | painéis de destaque e fundo de paywall    |
| Superfície    | `#f2f2f2`, `#f5f5f5` | fundo geral                               |
| Texto         | `#0b0b0c`, `#303030` | títulos e corpo                           |

A regra de cor é consistente e vale como referência: **azul é cromo, verde é confirmação e vinho é transação**. A ação de conversão nunca reutiliza a cor da marca.

Padrões de composição recorrentes:

- cabeçalho azul fixo com logotipo circular à esquerda, chamada em pill ao centro e ajuda à direita;
- subcabeçalho escuro com o nome da entidade na tela de detalhe;
- título de seção formado por pill sólida da marca seguida do rótulo em caixa alta;
- card de estabelecimento com barra de título, favorito, foto à esquerda, benefício à direita e marca circular sobre a emenda;
- entalhe serrilhado de ticket separando painéis do card de endereço, retomando a metáfora do voucher;
- chips de filtro em faixa rolável horizontal acima da lista, com `FILTRAR` fixo na primeira posição.

#### Modelo de filtro

O modal de filtro organiza a busca em três abas — `Geral`, `Culinária` e `Região` — e concentra na primeira:

- dia da semana, como sete alternadores circulares;
- faixa de horário, como slider de 0:00 a 24:00;
- aceitação em feriados e datas comemorativas;
- atributos da unidade: espaço kids, pet friendly, consumo no local, opções vegetarianas, veganas e sem glúten, estacionamento gratuito e conveniado;
- favoritos do usuário;
- exibição de vouchers já utilizados.

Esse recorte é praticamente o contrato de disponibilidade e atributos já aceito em [ADR-0013](../architecture/decisions/0013-disponibilidade-categorias-e-atributos-de-unidade.md), o que sugere que o modelo de dados do Experimente+ já suporta uma experiência de filtro equivalente.

#### O que aproveitar como referência

- a disciplina de cor por função, separando marca, confirmação e transação;
- a linguagem flat, que converge com a direção de redesenho já registrada para o produto;
- a anatomia do card de estabelecimento, legível em lista densa;
- o filtro por dia, horário e atributos, coerente com a taxonomia existente;
- a persistência da barra de navegação durante toda a jornada;
- o uso de App Links verificados, sem esquema proprietário.

#### O que não assumir no Experimente+

- a aba dedicada a compra, com checkout e assinatura anual — o `ADR-0022` mantém cobrança fora de escopo;
- o voucher como unidade central de navegação e de domínio;
- a proteção contra captura de tela: a apresentação temporária assinada do [ADR-0021](../architecture/decisions/0021-resgate-transacional-com-apresentacao-temporaria.md) é revalidada no servidor e não depende de sigilo da imagem;
- o acesso ao catálogo condicionado à aquisição de uma edição;
- identidade visual, ilustrações, fotografia e textos, que permanecem de terceiros.

## Duo Gourmet

Fonte oficial: [duogourmet.com.br](https://www.duogourmet.com.br/)

Características observadas:

- assinatura orientada a benefícios gastronômicos;
- mecânica central de dois pratos pelo preço de um;
- presença em múltiplas cidades;
- descoberta por cidade, cozinha, dia, horário e modalidade;
- uso pelo aplicativo e apresentação de código de assinante;
- proposta de recuperar o valor da assinatura nas primeiras utilizações;
- frentes para parceiros, empresas e família.

### Aprendizado

Uma assinatura pode criar recorrência e operar em várias cidades, mas o produto permanece fortemente dependente da economia imediata. Para o Experimente+, essa lógica faz mais sentido como camada futura do que como porta de entrada.

## Prime Gourmet

Fonte oficial: [primegourmetclub.com.br](https://primegourmetclub.com.br/)

Características observadas:

- clube de benefícios por região;
- assinatura anual por região;
- vouchers dois por um;
- restaurantes, hotéis, ingressos e experiências;
- validação por QR Code;
- regras de dia e horário definidas por oferta;
- presença anunciada em mais de 44 regiões;
- região “Maringá, Londrina & Região” listada entre as operações.

### Aprendizado

O modelo demonstra que benefícios podem ultrapassar restaurantes e ser organizados regionalmente. Também evidencia o risco de a experiência ficar fragmentada por edição ou região paga.

## Espaço estratégico do Experimente+

As referências existentes concentram sua proposta em **economia por benefício**. O Experimente+ deve ocupar primeiro o espaço de **decisão e descoberta confiável**, adicionando monetização sem bloquear o catálogo.

```text
Referências de clube
Descoberta → assinatura → voucher → validação

Experimente+
Descoberta gratuita → ação qualificada → ferramentas B2B → campanhas → benefícios opcionais
```

## Diferenciação recomendada

| Dimensão           | Clubes de benefício                     | Experimente+                                                 |
| ------------------ | --------------------------------------- | ------------------------------------------------------------ |
| Entrada do usuário | pagamento/assinatura                    | catálogo público gratuito                                    |
| Escopo             | principalmente gastronomia e benefícios | gastronomia, lazer e serviços locais                         |
| Geografia          | cidade ou edição/região comercial       | descoberta contínua entre cidades próximas                   |
| Valor principal    | economia                                | decisão confiável e descoberta                               |
| Receita inicial    | consumidor paga                         | presença gratuita e monetização B2B posterior                |
| Benefício          | produto central                         | camada opcional futura                                       |
| Parceiro           | oferece voucher e recebe tráfego        | administra presença, conteúdo, equipe, analytics e campanhas |
| Dados              | regras de voucher                       | catálogo estruturado, atualização e sinais de intenção       |

## Hipóteses derivadas da comparação

- uma proposta gratuita reduz barreira para formar audiência;
- gastronomia é uma boa vertical inicial para densidade e comunicação;
- a modalidade de benefício precisa variar por categoria;
- região deve apoiar descoberta, não apenas cobrança;
- analytics de ações pode ser mais sustentável para B2B do que exposição genérica;
- um Pass só deve ser vendido quando o conjunto de benefícios sustentar valor percebido.

Essas hipóteses precisam ser validadas com entrevistas e pilotos locais.
