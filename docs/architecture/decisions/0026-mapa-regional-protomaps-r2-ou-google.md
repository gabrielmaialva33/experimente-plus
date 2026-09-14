# ADR 0026 — Mapa regional: Protomaps em R2 ou SDK de mapas da plataforma

**Status:** aceito

**Data:** 11 de setembro de 2026

**Marco:** EP-13 — mapa de descoberta do cliente móvel; correção do mapa-base, sem expansão de navegação ou domínio

**Relacionados:** [ADR-0003](0003-catalogo-publico-sem-membership.md), [ADR-0016](0016-catalogo-publico-projecao-e-resolucao-de-operacao.md) e [ADR-0023](0023-stack-e-navegacao-do-cliente-movel.md)

**Dono da decisão:** dono do produto. Em 11/09/2026 (Brasília), escolheu expressamente a **opção A: Protomaps regional em R2 com MapLibre**. A recomendação e as medições da investigação original são preservadas abaixo como histórico; o registro de aceitação e a execução autorizada estão ao final.

## Contexto e fontes locais

O mapa precisa oferecer contexto de ruas em Londrina, Cornélio Procópio e Bandeirantes. O ADR-0023, seção 4, mantém mapa e lista como modos de Explorar, compartilhando os filtros. O mapa-base não substitui os estabelecimentos publicados pela API e não condiciona descoberta a login ou compra.

O operador informou que as duas variáveis públicas de mapa estão vazias. Não foram lidos arquivos de ambiente para verificar esse relato. O comportamento do código foi verificado:

| Evidência                                                                 | Comportamento existente                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `../experimente-plus-app/src/maps/config.ts:12` e `:14`                   | A presença de `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` seleciona o renderer denominado Google.                                |
| `../experimente-plus-app/src/maps/config.ts:21`                           | Sem `EXPO_PUBLIC_MAP_STYLE_URL`, usa `https://demotiles.maplibre.org/style.json`.                                      |
| `../experimente-plus-app/src/maps/maplibre-map.tsx:20` e `:21`            | Passa essa URL a `mapStyle`, com câmera inicial em zoom 11.                                                            |
| `../experimente-plus-app/src/maps/google-map.tsx:22` e `:34`              | O renderer usa **Apple Maps no iOS** e **Google Maps no Android**. Não passa `mapId`.                                  |
| `../experimente-plus-app/src/components/establishment-map.tsx:27` e `:45` | Os pins vêm dos resultados do catálogo; a seleção de renderer ocorre nesse componente.                                 |
| `../experimente-plus-app/package.json:8` e `:21`                          | Declara MapLibre RN `^11.3.8` e `expo-maps ~57.0.2`, já presentes.                                                     |
| `../experimente-plus-app/app.json:14`                                     | A configuração Android inspecionada não contém `android.config.googleMaps.apiKey`.                                     |
| `config/drive.ts:28` e `:37`                                              | R2 já é disco configurável e usa `R2_PUBLIC_BASE_URL` como `cdnUrl`. Nenhuma credencial foi utilizada na investigação. |

Na web, `inertia/pages/catalog/establishments.tsx:68` apresenta uma grade, e `inertia/components/catalog/establishment_actions.tsx:103` oferece um link de rota. Essas superfícies não constituem um renderer cartográfico integrado. Adicionar um mapa web não é uma consequência automática desta proposta.

## Proveniência das medições

As medições ocorreram em 11/09/2026 à noite, horário de Brasília, correspondendo a 12/09/2026 UTC. A investigação foi interrompida antes da redação; os binários, extratos, respostas e logs em `/tmp/experimente-map-investigation` foram perdidos. Os números abaixo foram preservados no contexto da execução, inclusive tamanhos exatos e resultado dos comandos.

**Na retomada não houve nova medição HTTP nem nova extração.** Foram reconferidos estado do Git, numeração e costuras locais. Não se apresenta o diretório perdido como evidência disponível, nem o checksum como substituto de um arquivo retido. Os comandos abaixo documentam como reproduzir a medição; URLs de builds podem expirar. Não houve upload, uso de credenciais, acesso ao banco, instalação de pacote de sistema ou alteração de aplicação.

## Medições realizadas

### 1. Causa do mapa sem detalhe

O GET de [style.json do fallback](https://demotiles.maplibre.org/style.json) identificou a fonte vetorial `maplibre`, cujo TileJSON é [tiles/tiles.json](https://demotiles.maplibre.org/tiles/tiles.json). Esse segundo GET retornou **`minzoom: 0` e `maxzoom: 6`**.

Portanto, a falta de detalhe em escala de cidade tem uma causa medida: a câmera inicial do app está em zoom 11, mas o conjunto de tiles do fallback termina em zoom 6. Ampliar esses tiles não cria os dados de ruas e edificações de níveis superiores. Não é uma hipótese sobre falta de chave do próprio MapLibre: falta um mapa-base apropriado.

### 2. HTTP Range no domínio público de mídia

Foram consultados, sem sessão e apenas com GET:

- `https://experimente-plus.mahina.fun/api/v1/catalog/cities`
- `https://experimente-plus.mahina.fun/api/v1/catalog/cities/londrina/establishments`

A resposta da vitrine de estabelecimentos expôs a seguinte URL de mídia real, utilizada no ensaio:

```text
https://midia-experimente.mahina.fun/homologation/media/v1/r2/experimente-plus/atelier-do-cafe-demo/e65a0fc04bc9da21e2cef5b72f75390f3396392998fde5b65b46adc55cc5e0ca.png
```

| GET                                                                   | Resultado medido                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Range: bytes=0-15`, `Accept-Encoding: identity`                      | HTTP/2 **206**, corpo de **16 bytes**, `Content-Range: bytes 0-15/16426`, `Content-Type: image/png`.              |
| `Range: bytes=100-131`, `Origin: https://experimente-plus.mahina.fun` | HTTP/2 **206**, corpo de **32 bytes**, `Content-Range: bytes 100-131/16426`.                                      |
| Objeto completo, sem Range                                            | **16.426 bytes**. Os dois corpos parciais foram comparados às fatias correspondentes do objeto: **ambos iguais**. |

As respostas parciais registraram `CF-Cache-Status: MISS`. O primeiro GET parcial levou 0,526271 s; uma amostra isolada não é um benchmark de latência do mapa.

**Pendência real de CORS:** o GET com `Origin` não trouxe `Access-Control-Allow-Origin` nem `Access-Control-Expose-Headers`. O êxito de Range não valida acesso por JavaScript de outra origem. Antes de usar esse domínio em um mapa web, configurar e testar CORS para estilo, PMTiles, glyphs e sprites, incluindo leitura de ETag e cabeçalhos necessários ao cliente. Não foi enviado OPTIONS nem alterada a configuração do bucket. A [documentação de armazenamento PMTiles](https://docs.protomaps.com/pmtiles/cloud-storage) distingue explicitamente Range de CORS.

Uma tentativa inicial com Python `urllib` recebeu 403; os GETs posteriores com curl produziram os resultados acima. A causa dessa diferença não foi investigada. Ainda é necessário validar o cliente nativo real e eventuais regras de borda; não se conclui que todo cliente recebe 206.

**Conclusão delimitada:** o domínio público atual atende Range corretamente para o objeto PNG ensaiado. Isso sustenta a hipótese de infraestrutura para PMTiles, mas não prova que um PMTiles já esteja publicado nem que sua configuração de entrega esteja pronta.

### 3. Tamanho do extrato regional

Foi obtido o binário oficial **go-pmtiles v1.31.2**, arquivo `go-pmtiles_1.31.2_Linux_x86_64.tar.gz`, da [release oficial](https://github.com/protomaps/go-pmtiles/releases/tag/v1.31.2), extraído somente em `/tmp`. Não foi instalado pacote de sistema.

A lista pública de [builds](https://maps.protomaps.com/builds), alimentada por [builds.json](https://build-metadata.protomaps.dev/builds.json), identificou:

- Fonte: `https://build.protomaps.com/20260911.pmtiles`.
- Tamanho planetário anunciado: **137.928.448.540 bytes**; esse arquivo inteiro **não foi baixado**.
- Basemap **4.15.2**, PMTiles **spec v3**, tiles **MVT**, compressão interna e dos tiles **gzip**, organização `clustered: true`, zooms 0–15.
- Timestamp de replicação OSM nos metadados: **2026-09-11T04:00:00Z**.

O recorte foi um retângulo **`[-51.40, -23.55, -50.25, -22.95]`**, na ordem oeste, sul, leste, norte. Contém os três centros de referência de `database/support/development_catalog.ts:62`: Londrina `(-51.1696, -23.3045)`, Cornélio Procópio `(-50.6463, -23.1813)` e Bandeirantes `(-50.3671, -23.1078)`, além do corredor entre eles.

**Escopo geográfico:** recorte para os centros urbanos e entorno, não união das divisas municipais oficiais. Não se afirma cobertura integral dos territórios rurais, especialmente de Londrina. O dono precisa aprovar a área de atendimento. A extração seleciona tiles que intersectam o recorte; em zooms baixos, eles podem conter áreas externas ao retângulo.

| Extrato                                | Tamanho exato por `stat` | MiB, dividido por 1.048.576 | Verificação              |
| -------------------------------------- | -----------------------: | --------------------------: | ------------------------ |
| `norte-parana-z14.pmtiles`, zooms 0–14 |      **6.003.162 bytes** |              **5,7251 MiB** | `pmtiles verify`: exit 0 |
| `norte-parana-z15.pmtiles`, zooms 0–15 |     **12.823.275 bytes** |             **12,2292 MiB** | `pmtiles verify`: exit 0 |

O extrato z15 contém **8.640 tiles endereçados, 8.400 entradas e 7.966 conteúdos distintos**. Seu SHA-256 registrado foi `51d27203a9016ae3e52ae4f2b1b81f69d1d8a5adf11c31fcb9b6b89f2e165404`.

A extração remota efetiva levou **20,994631116 s**, com **2 threads e 63 requisições**. O CLI informou transferência de **13 MB**, valor arredondado pelo programa, não uma contagem exata dos bytes na rede. O z14 foi derivado localmente do z15. Os tamanhos de arquivo são medições exatas, sem margem de erro estimada; variam se mudarem build, bounds, zoom ou ferramenta. Não incluem estilo, fontes/glyphs e sprites.

Comandos utilizados, conforme a [documentação do CLI](https://docs.protomaps.com/pmtiles/cli):

```sh
/tmp/experimente-map-investigation/pmtiles show https://build.protomaps.com/20260911.pmtiles

/tmp/experimente-map-investigation/pmtiles extract \
  https://build.protomaps.com/20260911.pmtiles \
  /tmp/experimente-map-investigation/norte-parana-z15.pmtiles \
  --bbox=-51.40,-23.55,-50.25,-22.95 --maxzoom=15 --download-threads=2 --dry-run

/tmp/experimente-map-investigation/pmtiles extract \
  https://build.protomaps.com/20260911.pmtiles \
  /tmp/experimente-map-investigation/norte-parana-z15.pmtiles \
  --bbox=-51.40,-23.55,-50.25,-22.95 --maxzoom=15 --download-threads=2

/tmp/experimente-map-investigation/pmtiles extract \
  /tmp/experimente-map-investigation/norte-parana-z15.pmtiles \
  /tmp/experimente-map-investigation/norte-parana-z14.pmtiles --maxzoom=14 --quiet

/tmp/experimente-map-investigation/pmtiles verify /tmp/experimente-map-investigation/norte-parana-z15.pmtiles
/tmp/experimente-map-investigation/pmtiles verify /tmp/experimente-map-investigation/norte-parana-z14.pmtiles
stat -c '%s bytes' /tmp/experimente-map-investigation/norte-parana-z15.pmtiles
sha256sum /tmp/experimente-map-investigation/norte-parana-z15.pmtiles
```

### 4. Amostra de conteúdo, sem alegar validação visual

O comando `pmtiles tile` leu um tile z15 por centro, do extrato local. Um leitor mínimo do formato protobuf contou features por camada após descompressão gzip; não interpretou geometria nem renderizou o mapa.

| Centro            | Tile z/x/y       | Bytes retornados comprimidos | Features `roads` | Features `buildings` | Features `pois` |
| ----------------- | ---------------- | ---------------------------: | ---------------: | -------------------: | --------------: |
| Londrina          | `15/11726/18566` |                       57.700 |               89 |                2.418 |             183 |
| Cornélio Procópio | `15/11774/18554` |                        7.992 |               87 |                   69 |              22 |
| Bandeirantes      | `15/11799/18546` |                        7.242 |               62 |                   82 |              64 |

Há dados de detalhe nos três pontos amostrados. As contagens não representam o total da cidade, a completude do OSM, qualidade de rótulos ou equivalência ao Google. Não houve comparação visual em aparelho.

## Alternativas e trabalho necessário

### A. Protomaps regional em R2, usando MapLibre

**Compatibilidade apurada:** o pacote instalado era MapLibre React Native **11.3.8**. Seus defaults nativos são Android **13.2.0** e iOS **6.26.0**, conferidos também no código da tag: [gradle.properties](https://github.com/maplibre/maplibre-react-native/blob/v11.3.8/package/android/gradle.properties#L8) e [podspec](https://github.com/maplibre/maplibre-react-native/blob/v11.3.8/package/MapLibreReactNative.podspec#L7).

MapLibre Native suporta fontes `pmtiles://https://...` remotamente e `pmtiles://file://...` em arquivo local. O suporte é documentado desde [Android 11.7.0](https://maplibre.org/maplibre-native/android/examples/data/PMTiles/) e [iOS 6.10.0](https://maplibre.org/maplibre-native/ios/latest/documentation/maplibre-native-for-ios/pmtiles/), anteriores aos defaults inspecionados. O caminho proposto usa o arquivo **PMTiles v3/MVT/gzip** medido. Não requer adicionar o pacote JavaScript `pmtiles` ao app nativo. A compatibilidade foi verificada em código/documentação, não exercitada em um build do aparelho.

`EXPO_PUBLIC_MAP_STYLE_URL` deve apontar para um **style JSON**, não diretamente para o arquivo PMTiles. Dentro do estilo, a fonte vetorial usa uma URL absoluta como `pmtiles://https://DOMINIO/maps/VERSAO/norte-parana.pmtiles`; a notação é ilustrativa, não um endpoint publicado. O estilo precisa de layers compatíveis com o schema do basemap, glyphs e sprites. Pode ser gerado e versionado como JSON estático, sem dependência runtime nova; `@protomaps/basemaps` é uma opção de geração, não requisito do protocolo. Ver [assets e estilos Protomaps](https://docs.protomaps.com/basemaps/maplibre).

| Repositório/superfície                               | Trabalho posterior à aceitação                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experimente-plus`                                   | Documentar e automatizar recorte reproduzível, versão, checksums, atualização e rollback. Publicar PMTiles, estilo e assets em prefixo cartográfico próprio, separado das mídias editoriais. Configurar entrega binária sem transformação de bytes, Range e CORS. Manter versões antigas até os clientes migrarem. Não criar migration, rota de compra ou mudança de OpenAPI para servir o mapa-base. |
| `experimente-plus-app`                               | Configurar URL do estilo e manter a chave Google ausente para selecionar MapLibre no mecanismo atual. Validar os binários nativos efetivos, labels em português, atribuição, limites de área/zoom, pins e falhas de rede. Se ambos os envs estiverem preenchidos, o código atual dá prioridade ao renderer Google. Preservar filtros compartilhados e dados públicos da API.                          |
| Web Inertia, apenas se mapa integrado for autorizado | Implementar renderer e instalar/configurar MapLibre GL JS com o protocolo JavaScript `pmtiles`, conforme [integração oficial](https://docs.protomaps.com/pmtiles/maplibre). CORS é bloqueador pendente; a validação do PNG por curl não o resolve. Não confundir essa integração adicional com a configuração móvel.                                                                                  |

A atribuição a OpenStreetMap é necessária; o [basemap é distribuído como Produced Work sob ODbL](https://docs.protomaps.com/basemaps/downloads). Preservar também licenças dos assets selecionados. Não usar o build público planetário como origem permanente dos aparelhos: a documentação desencoraja hotlinking e as URLs têm retenção limitada.

Atualizar por novo caminho versionado e promover o estilo somente após os objetos existirem evita misturar diretórios/tiles de duas versões durante leituras Range. Ainda será preciso definir periodicidade e responsável operacional. O suporte a arquivo local não equivale a offline pronto: as documentações nativas registram que essas fontes não suportam os offline packs/cache do SDK; baixar e gerenciar um extrato local seria trabalho separado.

### B. Caminho já existente de SDK da plataforma: Google Android / Apple iOS

Este é o nome preciso da alternativa que o app implementa hoje. Usar Google também no iOS exigiria outra integração; não se obtém isso apenas preenchendo a variável existente.

| Repositório/superfície                               | Trabalho posterior à aceitação                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experimente-plus`                                   | Registrar ambiente, operação, métricas e manutenção da alternativa escolhida. Nenhuma mudança necessária no contrato público ou no armazenamento para o mapa nativo. As coordenadas e pins continuam vindo da API.                                                                                                                                                                                                                           |
| `experimente-plus-app`                               | Habilitar Maps SDK for Android em projeto Google com billing, configurar restrições de aplicação/API, pacote e certificados de assinatura. Alimentar `android.config.googleMaps.apiKey` via configuração de build, sem fixar a chave no repositório, e alinhar o seletor `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Recompilar o binário e validar Google Android/Apple iOS. `expo-maps` já existe, portanto esse caminho não exige nova biblioteca. |
| Web Inertia, apenas se mapa integrado for autorizado | Escolher e integrar produto web separadamente. A gratuidade do SDK móvel não cobre automaticamente Maps JavaScript API. O link atual de rota permanece independente da escolha do renderer.                                                                                                                                                                                                                                                  |

A [documentação Expo Maps](https://docs.expo.dev/versions/latest/sdk/maps/) exige configuração nativa da chave e novo development build; ela também informa Google apenas no Android, Apple no iOS e estágio alpha. A presença da variável lida em `src/maps/config.ts` somente troca o componente: não foi encontrada ligação dessa variável à configuração nativa inspecionada. Chaves de SDK distribuídas no cliente precisam de restrições; não devem ser confundidas com credenciais privilegiadas de servidor.

## Tarifas publicadas — custo real NÃO medido

**Esta seção é consulta de tabela, não comparação de custos observados do projeto.** Não foram acessados billing, consumo da conta R2, franquias remanescentes, número de sessões ou cache hit rate. Não há base para concluir qual opção é mais barata. Valores em USD, consultados na investigação de 11/09/2026 BRT / 12/09/2026 UTC; impostos, câmbio e trabalho humano não foram quantificados.

| Produto/condição                                         | Tarifa publicada                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| R2 Standard: armazenamento                               | US$ 0,015/GB-mês; franquia de 10 GB-mês/mês.                                                                                                    |
| R2 Standard: operações A                                 | US$ 4,50/milhão; franquia de 1 milhão/mês.                                                                                                      |
| R2 Standard: operações B, incluindo GET                  | US$ 0,36/milhão; franquia de 10 milhões/mês.                                                                                                    |
| R2: egress                                               | Sem cobrança de egress.                                                                                                                         |
| Google Maps SDK móvel **sem `mapId`**                    | SKU Maps SDK listado com franquia **Unlimited**, sem tarifa de carga nesse SKU. Billing e chave continuam necessários para configuração Google. |
| Google Dynamic Maps: web JS ou SDK móvel **com `mapId`** | 10.000 cargas gratuitas/mês; US$ 7/1.000 na primeira faixa paga até 100.000 eventos. Outras faixas constam da tabela.                           |

Fontes: [preços R2](https://developers.cloudflare.com/r2/pricing/), [preços Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing) e [gatilhos dos SKUs Maps SDK/Dynamic Maps](https://developers.google.com/maps/billing-and-pricing/sku-details). A Cloudflare arredonda uso faturável por unidade; suas franquias Standard são compartilhadas com o restante do uso da conta. Um GET Range conta como leitura quando alcança o armazenamento; não assumir uma requisição por abertura de mapa.

O arquivo z15 mede **0,012823275 GB decimais**. Isso é dimensão medida de armazenamento, não fatura. Não inclui glyphs, sprites, versões retidas ou mídias existentes. Seu eventual enquadramento na franquia não foi consultado. As **63 requisições** acima são da extração pela ferramenta, não de uma sessão do app e não de leituras faturadas no R2 do projeto.

O renderer atual não passa `mapId`, mas o SKU efetivamente gerado precisa ser confirmado após configurar e executar o binário. Não foram medidos custos de Google, Apple, R2 ou manutenção. Places, geocoding, rotas internas e Street View não fazem parte do ensaio nem estão incluídos na gratuidade citada.

## Recomendação original, consequências e decisão então pendente

**Recomendação técnica:** avaliar primeiro a publicação controlada do extrato z15 em R2 com MapLibre, após aceitação pelo dono. O tamanho medido é pequeno para esse recorte, Range funcionou e os runtimes já presentes suportam o protocolo. Esse caminho permite o mesmo mapa-base e estilo nos dois sistemas móveis, sem exigir uma troca de biblioteca nativa. A recomendação se apoia nessas propriedades, **não em alegação de menor custo**.

Google Android/Apple iOS continua alternativa válida se o dono preferir delegar a manutenção do mapa-base e aceitar diferenças entre plataformas. Não foi medido que sua cartografia seja melhor nas três cidades. Também não foi medido prazo de implantação de nenhuma das opções.

Cabe ao dono escolher A ou B, aprovar cobertura territorial e requisito de paridade iOS/Android. Se escolher A, definir atualização, retenção e responsável; se escolher B, confirmar se Apple no iOS atende ou se pretende Google nas duas plataformas. Nenhum desses pontos é decidido implicitamente por este ADR.

## Pendências registradas na investigação original

- Publicar e testar o **PMTiles real** no domínio escolhido; validar Range, ETag, tipos de conteúdo e ausência de transformação dos bytes. O ensaio atual foi sobre PNG.
- Corrigir/testar **CORS na web**, incluindo acesso aos headers pelo JavaScript e todos os assets. A ausência de headers no GET com Origin é um achado, não uma hipótese.
- Investigar a diferença 403/206 entre clientes se reaparecer; testar os transportes de Android e iOS.
- Validar visualmente zooms 11–15 e ampliação posterior nos três centros, nomes/acentos, ruas, pins, atribuição, tema e áreas próximas à borda do extrato. Não há prova de qualidade visual ou cobertura rural integral.
- Medir carregamento frio/quente, bytes/requisições por sessão, comportamento com rede ruim e tamanho dos assets adicionais. A extração de 21 segundos não mede tempo de abertura no celular.
- Se A: ensaiar atualização e rollback versionados, conferir bounds e selecionar glyphs/sprites/licenças. Se B: validar chave restrita, certificados dos builds, SKU real e comportamento no iOS.
- Medir consumo e custo real depois de um ensaio autorizado, separando armazenamento, operações, cache e manutenção. Não atribuir uso gratuito à conta sem conferir franquias.
- Preservar descoberta sem autenticação, o mesmo conjunto de filtros/pins entre lista e mapa e ações de contato existentes. Não adicionar Places ou regras de elegibilidade ao renderer.

## Validação da entrega documental original

Na retomada, os tamanhos z14/z15 e as demais medições necessárias estavam preservados; **nenhum dado precisou ser remedido**. O código local relevante foi reconferido somente em leitura. O ADR é a única alteração prevista; não há implementação, upload, migration, acesso autenticado ao piloto ou commit. Não foram recriados temporários. Os arquivos de medição originais permanecem indisponíveis; uma reprodução futura deverá usar os comandos e a identificação de build registrados, ou documentar a diferença caso o build tenha expirado.

## Registro de aceitação e primeira implementação — 11/09/2026, Brasília

O dono escolheu **A**, Protomaps regional em R2 com MapLibre. Isso resolve a escolha de provedor do mapa-base; não transforma os ensaios anteriores em validação de publicação, renderização ou custo. A alternativa B e todas as medições acima permanecem como fundamentação histórica, sem alegação de menor preço de A.

A execução foi dividida explicitamente: o operador/agente Claude gera o extrato, publica no R2 e configura CORS com sua credencial; esta entrega produz estilo e documentação sem upload ou uso de credencial; o agente do app liga o cliente depois de existir URL pública validada. Nenhuma mudança de API, geografia de domínio ou banco é necessária para servir o mapa-base.

O [runbook de publicação](../../runbooks/regional_map_publication.md) fixa ferramenta, build, bounds, zoom, checksums, geração do estilo, assets, Range, promoção e rollback. O [estilo claro](../../../resources/maps/norte-parana/style.json) deriva de `@protomaps/basemaps@5.7.2`, com source-layers reconferidas nos metadados **4.15.2**, paleta neutro frio e linguagem flat 2.0. O gerador usa rótulos em português, sprites grayscale e remove halo/blur; as cores de marca e conversão ficam reservadas à aplicação.

Para esta entrega, o estilo fica em R2: JSON imutável por release e alias estável promovido por último, sem endpoint da API nem dependência runtime nova no RN. Glyphs e sprites também ficam no R2. Foram medidos **17.711.598 bytes em 1.024 PBFs materializados**, mais **14.290 bytes em quatro sprites grayscale v4**; symlinks upstream precisam ser resolvidos antes do upload. Esse volume não é tráfego por sessão ou preço. O runbook registra fontes, licenças, hashes e alternativas de hospedagem, incluindo o GET inicial adicional em relação a um estilo embutido.

**Pendências preservadas:** publicar e validar Range no PMTiles real; configurar e testar CORS (o PNG medido não tinha headers); investigar 403 se reaparecer; validar Android/iOS, aparência, labels, atribuição e desempenho de rede; aprovar cobertura territorial final; definir atualização, retenção e responsável; medir consumo e custo real. O tamanho dos assets agora foi medido, mas nenhuma dessas outras pendências foi encerrada implicitamente. Os extratos não foram regenerados nesta etapa para não duplicar o trabalho do operador.

## Publicação validada e alias promovido — 14/09/2026, Brasília

O [runbook de publicação](../../runbooks/regional_map_publication.md) registra o recibo completo com
as saídas reais. Resumo do que esta data **encerra**, com medição:

- **Publicar e validar Range no PMTiles real:** encerrado. `206` no objeto real com
  `content-range: bytes 0-15/12823275`, `accept-ranges`, `etag` e sem `Content-Encoding`. Os 1.033
  objetos do manifesto foram baixados e conferidos por bytes e SHA-256, sem divergência.
- **Configurar e testar CORS:** encerrado para o alcance medido. Preflight `OPTIONS` responde `204`
  com `GET, HEAD` e `range`; os GETs expõem `etag,content-range,accept-ranges,content-length`. A
  regra atende **somente** `https://experimente-plus.mahina.fun`; `http://localhost:8081` e origens
  de terceiros não recebem cabeçalho CORS.
- **Investigar a diferença 403/206 se reaparecer:** encerrado. Reapareceu e a causa foi isolada: uma
  regra de borda por User-Agent ancorada em `Python-urllib/`, independente de versão e reprodutível.
  Os transportes reais — okhttp no Android, CFNetwork no iOS, MapLibre, navegador, `curl` — retornam
  `200`. É risco de ferramentaria, não de cliente.
- **Promoção do alias:** executada. `maps/norte-parana/style.json` passou de `404` a `200`, servindo
  bytes idênticos ao artefato versionado do repositório e à release imutável `20260911-v1`.

O cliente móvel foi configurado no mesmo dia: `EXPO_PUBLIC_MAP_STYLE_URL` passou a apontar para o
alias no `.env` local do app, corrigindo o fallback `demotiles.maplibre.org` cujo tileset termina no
zoom 6 enquanto a câmera abre no zoom 11 — a causa medida do mapa sem detalhe descrita neste ADR.

**Continuam pendentes, sem encerramento implícito:** validação visual em Android e iOS reais;
aparência, rótulos, acentos, atribuição e bordas do recorte; desempenho de rede frio/quente e bytes
por sessão; cobertura territorial final; periodicidade de atualização, retenção e responsável
operacional; e consumo e custo reais. Publicação verificada não é prova de renderização nem de custo.
