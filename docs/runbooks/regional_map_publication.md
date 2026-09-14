# Publicação do mapa regional — Protomaps / R2

O [ADR-0026](../architecture/decisions/0026-mapa-regional-protomaps-r2-ou-google.md) foi aceito pelo dono: opção A, Protomaps regional em R2 com MapLibre. Este procedimento prepara uma publicação reproduzível; não é uma rota da API nem uma etapa automática do deploy. Extrato, upload e CORS pertencem ao operador; configuração e validação nativa pertencem ao agente do app. Nesta entrega foram executadas somente preparação pública, geração e validação estática. **Nenhum upload nem credencial foi utilizado.**

## Artefatos, estilo e decisão de hospedagem

- Fonte versionada: [`resources/maps/norte-parana/build_style.mjs`](../../resources/maps/norte-parana/build_style.mjs).
- Artefato consumível: [`resources/maps/norte-parana/style.json`](../../resources/maps/norte-parana/style.json), Style Specification v8, 71 camadas, português com fallback de nomes do gerador oficial.
- Gerador oficial fixado: `@protomaps/basemaps@5.7.2`, commit `3ea8293a28131c3dc63f1bb20827bdb8a76df06f`. Não é dependência instalada na aplicação ou no app; é baixado em diretório temporário somente para gerar JSON.
- Tiles: basemap **4.15.2**, build `20260911`, PMTiles v3/MVT/gzip. Nesta entrega, leitura Range do header e metadados reconfirmou a versão e as nove source-layers: `boundaries`, `buildings`, `earth`, `landcover`, `landuse`, `places`, `pois`, `roads`, `water`. Todas as source-layers do estilo pertencem a esse conjunto. A versão 5 do pacote de estilos não significa schema v5 dos tiles.

**Escolha de entrega:** hospedar estilo e assets no mesmo R2 do extrato, em prefixo próprio de mapas. O JSON versionado fica junto dos objetos imutáveis; um segundo objeto `maps/norte-parana/style.json` é o endereço estável do app, promovido por último. Seu conteúdo aponta exclusivamente para objetos de uma release imutável. Assim, depois da configuração inicial, atualizar o mapa não depende de release do app nem de disponibilidade da API. O app deverá usar `EXPO_PUBLIC_MAP_STYLE_URL=https://midia-experimente.mahina.fun/maps/norte-parana/style.json` após publicação e testes. **Esses caminhos são os destinos preparados, não uma alegação de objetos já publicados.** Se o operador escolher outro prefixo, regenerar o estilo com ele antes de publicar.

| Alternativa para o estilo                                            | Benefício                                                           | Custo/limitação                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2, alias estável + releases imutáveis — escolhido para esta entrega | Atualização e rollback independentes de release; sem API no caminho | GET do JSON antecede descoberta dos tiles/glyphs/sprites; cache curto do alias pode atrasar atualização. Cache frio ainda depende de rede.              |
| JSON embutido no app                                                 | Elimina esse GET inicial; bootstrap local                           | Estilo e URLs vinculados ao release/OTA do app. Não implementado; eventual fallback local precisa de política de atualização. Não garante mapa offline. |
| Servido pela API                                                     | Permite seleção dinâmica central                                    | Acrescenta disponibilidade e latência do backend sem necessidade de domínio. Nenhuma rota criada.                                                       |

O R2 já é dependência dos tiles; auto-hospedar glyphs e sprites elimina o host público de terceiros **do runtime**, não a origem upstream do processo de atualização. A [documentação oficial de assets](https://docs.protomaps.com/basemaps/maplibre) fornece as famílias e os formatos necessários. URLs de atribuição são links de crédito, não downloads de assets.

### Fundação visual aplicada

A referência continua sendo [`catalog_tokens.md`](../design/catalog_tokens.md). O mapa é contexto geográfico, não uma nova paleta de componentes. Nenhum token canônico foi alterado.

| Papel cartográfico                        | Valor                 | Princípio aplicado                                                                                   |
| ----------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| Papel / terra / áreas urbanas             | `#f3f5f7`             | Mesmo papel neutro frio da aplicação; sem faixas ou fundos de marca.                                 |
| Vias / pontes / gelo                      | `#ffffff`             | Geometria de circulação separada do papel; hierarquia por espessura e zoom, sem laranja de rodovias. |
| Contornos de vias                         | `#c7cbd0`             | Token border; contorno sólido funcional, sem sombra.                                                 |
| Edificações                               | `#dce1e7`             | Massa construída ligeiramente mais escura; não é card, estado ou seleção.                            |
| Hospital, escola, pista aeroportuária     | `#e8edf2`             | Superfície funcional neutra; sem sinalizar ações/alertas do produto.                                 |
| Túneis                                    | `#e8ecf1`             | Via recessiva em relação ao branco da via ao nível do solo; não substitui o chip de funcionamento.   |
| Água                                      | `#dceaf0`             | Matiz azul dessaturada identifica hidrografia, sem preencher a terra de azul institucional.          |
| Parques / vegetação baixa                 | `#e5eee7`             | Verde de baixo croma comunica cobertura vegetal.                                                     |
| Bosques / floresta                        | `#e2ebe5`             | Mesmo significado, maior massa visual para vegetação densa.                                          |
| Área agrícola                             | `#eef2ef`             | Transição rural suave, sem inventar um segundo papel de UI.                                          |
| Labels principais                         | `#1e2227`             | Foreground canônico; cidades e eixos principais.                                                     |
| Labels auxiliares / POIs OSM              | `#535961`             | Muted-foreground canônico; contexto subordinado aos pins públicos do app.                            |
| Limites e ferrovia                        | `#73787f`             | Traços finos identificáveis; diferenciação por geometria/tracejado.                                  |
| Marca e conversão, na sobreposição do app | `#13467c` / `#e2661a` | Preservados para marca/navegação e conversão; **nenhum dos dois preenche o mapa-base**.              |

O gerador remove todas as propriedades de halo/blur. Não há gradiente, raster decorativo, extrusão, relevo sombreado ou vidro. Opacidades que o upstream interpola por zoom são transições cartográficas, não gradientes espaciais. Sprites grayscale v4 são usados para localidades, escudos e setas; a camada de POIs mantém texto, mas remove ícones coloridos. Nomes OSM são referência cartográfica, não estabelecimentos aprovados nem indicação de benefício. Noto Sans é usada porque os glyphs oficiais já estão compilados; não altera a tipografia dos componentes da aplicação. Tema escuro cartográfico não foi produzido nesta tarefa de tema claro; não forçar o tema do dispositivo.

Contrastes calculados pela luminância sRGB relativa/WCAG 2.x, entre os dois textos e cada preenchimento sólido, estão registrados abaixo. Não são uma alegação de legibilidade de todas as posições: cruzamento de geometrias, densidade e labels sem halo exigem inspeção em aparelho. Os pequenos símbolos raster também não são avaliados por essa tabela.

| Superfície | Texto principal `#1e2227` | Auxiliar `#535961` |
| ---------- | ------------------------: | -----------------: |
| `#f3f5f7`  |                   14.63:1 |             6.47:1 |
| `#ffffff`  |                   15.99:1 |             7.07:1 |
| `#c7cbd0`  |                    9.81:1 |             4.34:1 |
| `#dce1e7`  |                   12.16:1 |             5.38:1 |
| `#e8edf2`  |                   13.57:1 |             6.00:1 |
| `#e8ecf1`  |                   13.48:1 |             5.96:1 |
| `#dceaf0`  |                   13.00:1 |             5.75:1 |
| `#e5eee7`  |                   13.49:1 |             5.97:1 |
| `#e2ebe5`  |                   13.13:1 |             5.81:1 |
| `#eef2ef`  |                   14.15:1 |             6.26:1 |
| `#dddddd`  |                   11.77:1 |             5.21:1 |

`#dddddd` é o preenchimento predominante medido no atlas grayscale; `#c7cbd0` é contorno, incluído por poder cruzar labels. Cores de borda não são fundos de seção.

### Assets medidos: bytes publicados, não tamanho do link no Git

Fonte: [basemaps-assets no commit 028c18f](https://github.com/protomaps/basemaps-assets/tree/028c18f713baecad011301ff7a69acc39bcc2ae7). Foi baixado o tar público de **6.379.327 bytes**, não um planeta. Medição local por `stat` após resolução dos symlinks:

| Asset                                             |       Objetos | Bytes efetivos |
| ------------------------------------------------- | ------------: | -------------: |
| Noto Sans Regular                                 |       256 PBF |      6.240.473 |
| Noto Sans Medium                                  |       256 PBF |      3.613.867 |
| Noto Sans Italic                                  |       256 PBF |      1.224.916 |
| Noto Sans Devanagari Regular v1                   |       256 PBF |      6.632.342 |
| **Glyphs completos selecionados**                 | **1.024 PBF** | **17.711.598** |
| grayscale.json / grayscale.png                    |             2 |  1.267 / 5.560 |
| grayscale@2x.json / grayscale@2x.png              |             2 |  1.276 / 6.187 |
| **Sprites grayscale v4**                          |         **4** |     **14.290** |
| **Glyphs + sprites, sem licenças/estilo/extrato** |     **1.028** | **17.725.888** |

O conjunto Devanagari é referenciado pelo fallback de escrita no código upstream [`language.ts`](https://github.com/protomaps/basemaps/blob/3ea8293a28131c3dc63f1bb20827bdb8a76df06f/styles/src/language.ts). A maioria dos arquivos aponta para Noto Sans Regular por symlink. A soma ingênua dos blobs desse diretório no Git é **400.969 bytes**, mas publicar todos os objetos materializados exige **6.632.342 bytes**. O comando abaixo usa `cp -RL`; não enviar o texto de um symlink como PBF. As quatro famílias cobrem os 256 intervalos BMP de 256 pontos cada, não todo Unicode nem toda escrita mundial. Não foi adotado recorte arbitrário apenas de caracteres latinos.

Por comparação medida, os quatro sprites `light` somam **52.154 bytes**. Escolher grayscale poupa 37.864 bytes, mas a razão principal é semântica visual. A publicação de 1.028 assets é trabalho real de operação; scripts evitam cópia manual. Esse volume é armazenamento total do bundle, **não download inicial de cada aparelho**: glyph ranges são requisitados conforme os labels. Bytes/sessão e custo real continuam sem medição. A recomendação de auto-hospedagem se apoia em independência e volume delimitado, não em afirmar menor preço. As tarifas e a ausência de comparação de custo real permanecem no ADR.

Preservar SIL OFL dos glyphs, MIT/Mapzen dos sprites e [`UPSTREAM-LICENSE.md`](../../resources/maps/norte-parana/UPSTREAM-LICENSE.md) do estilo derivado. O [README upstream](https://github.com/protomaps/basemaps-assets/blob/028c18f713baecad011301ff7a69acc39bcc2ae7/README.md) identifica as licenças. Exibir no cliente atribuição Protomaps e OpenStreetMap, já definida na source; verificar que o app não a oculta.

## 1. Preparação pública, sem credencial

Pré-requisitos: Bash, curl, tar, sha256sum, Python 3, Node 24 e o pnpm do checkout. Publicação posterior requer AWS CLI configurado pelo operador para o R2, fora de logs/CI com tracing. Não instalar pacote de sistema como efeito deste procedimento. Os blocos abaixo são executados na **mesma sessão Bash**, na raiz do checkout. Todos os temporários ficam em diretório criado exclusivamente para esta operação.

```bash
set -euo pipefail
set +x
MAP_REPO="$PWD"
MAP_WORK="$(mktemp -d /tmp/experimente-map-publish.XXXXXX)"
trap 'rm -rf -- "$MAP_WORK"' EXIT
MAP_BUILD=20260911
MAP_RELEASE=20260911-v1
MAP_PREFIX="maps/norte-parana/$MAP_RELEASE"
MAP_PUBLIC_BASE=https://midia-experimente.mahina.fun
MAP_RELEASE_URL="$MAP_PUBLIC_BASE/$MAP_PREFIX/"
MAP_SOURCE="https://build.protomaps.com/$MAP_BUILD.pmtiles"
MAP_BOUNDS=-51.40,-23.55,-50.25,-22.95
MAP_ASSETS_COMMIT=028c18f713baecad011301ff7a69acc39bcc2ae7
mkdir -p "$MAP_WORK/tool" "$MAP_WORK/style-package" "$MAP_WORK/bundle/assets/fonts" \
  "$MAP_WORK/bundle/assets/sprites/v4" "$MAP_WORK/bundle/licenses"

# Binário Linux x86_64 fixado; outra arquitetura exige selecionar e verificar
# o artefato correspondente da mesma release, não executar este binário.
test "$(uname -sm)" = 'Linux x86_64'
curl -fL --retry 2 https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz \
  -o "$MAP_WORK/pmtiles.tar.gz"
printf '%s  %s\n' 3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f \
  "$MAP_WORK/pmtiles.tar.gz" | sha256sum -c -
tar -xzf "$MAP_WORK/pmtiles.tar.gz" -C "$MAP_WORK/tool" pmtiles
MAP_CLI="$MAP_WORK/tool/pmtiles"
"$MAP_CLI" show "$MAP_SOURCE"
"$MAP_CLI" show "$MAP_SOURCE" --metadata > "$MAP_WORK/source-metadata.json"
python - "$MAP_WORK/source-metadata.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
assert m['version'] == '4.15.2', m['version']
assert {v['id'] for v in m['vector_layers']} == {
    'boundaries', 'buildings', 'earth', 'landcover', 'landuse',
    'places', 'pois', 'roads', 'water'
}
print('Schema basemap 4.15.2 confirmado')
PY
```

A identificação do build e os metadados devem acompanhar o recibo. Se `20260911` expirar, interromper: selecionar um build explícito em [builds.json](https://build-metadata.protomaps.dev/builds.json), atualizar versão/build no gerador e neste registro, validar compatibilidade e medir novamente. **Não trocar silenciosamente por latest nem baixar o planeta.**

## 2. Extrato limitado, verificado antes do upload

```bash
"$MAP_CLI" extract "$MAP_SOURCE" "$MAP_WORK/bundle/norte-parana.pmtiles" \
  --bbox="$MAP_BOUNDS" --maxzoom=15 --download-threads=2 --dry-run
"$MAP_CLI" extract "$MAP_SOURCE" "$MAP_WORK/bundle/norte-parana.pmtiles" \
  --bbox="$MAP_BOUNDS" --maxzoom=15 --download-threads=2
"$MAP_CLI" verify "$MAP_WORK/bundle/norte-parana.pmtiles"
"$MAP_CLI" show "$MAP_WORK/bundle/norte-parana.pmtiles"
stat -c '%s bytes' "$MAP_WORK/bundle/norte-parana.pmtiles"
printf '%s  %s\n' 51d27203a9016ae3e52ae4f2b1b81f69d1d8a5adf11c31fcb9b6b89f2e165404 \
  "$MAP_WORK/bundle/norte-parana.pmtiles" | sha256sum -c -
test "$(stat -c '%s' "$MAP_WORK/bundle/norte-parana.pmtiles")" = 12823275
```

Esperado para a reprodução exata do ADR: **12.823.275 bytes**, z0–15, clustered e `verify` exit 0. Divergência não deve ser escondida: interromper publicação, conferir fonte, ferramenta e flags, registrar a nova medição se deliberadamente mudar algo. Bounds são oeste/sul/leste/norte; cobrem centros urbanos e corredor, não todos os limites municipais. Conferir área de atendimento e restringir navegação no app; source bounds não substitui limite de câmera.

## 3. Gerar estilo e materializar assets

```bash
curl -fL --retry 2 https://registry.npmjs.org/@protomaps/basemaps/-/basemaps-5.7.2.tgz \
  -o "$MAP_WORK/basemaps.tgz"
printf '%s  %s\n' 2d5d41b29cdd2364f7092ad439bd9d170b4f38cbec8858cefbe84d0f98125ce6 \
  "$MAP_WORK/basemaps.tgz" | sha256sum -c -
tar -xzf "$MAP_WORK/basemaps.tgz" -C "$MAP_WORK/style-package"
node resources/maps/norte-parana/build_style.mjs \
  "$MAP_WORK/style-package/package" "$MAP_RELEASE_URL" "$MAP_WORK/bundle/style.json"
pnpm exec prettier --ignore-path /dev/null \
  --config "$MAP_REPO/node_modules/@adonisjs/prettier-config/index.cjs" --write "$MAP_WORK/bundle/style.json"

curl -fL --retry 2 --max-filesize 35000000 \
  "https://codeload.github.com/protomaps/basemaps-assets/tar.gz/$MAP_ASSETS_COMMIT" \
  -o "$MAP_WORK/assets.tar.gz"
printf '%s  %s\n' 57e40e8c512bd8042d0a3a251f19d0d1c8523ad963c666c3c6643bada4dc92d0 \
  "$MAP_WORK/assets.tar.gz" | sha256sum -c -
tar -xzf "$MAP_WORK/assets.tar.gz" -C "$MAP_WORK"
MAP_ASSETS="$MAP_WORK/basemaps-assets-$MAP_ASSETS_COMMIT"
for font in 'Noto Sans Regular' 'Noto Sans Medium' 'Noto Sans Italic' 'Noto Sans Devanagari Regular v1'; do
  cp -RL "$MAP_ASSETS/fonts/$font" "$MAP_WORK/bundle/assets/fonts/"
done
for file in grayscale.json grayscale.png grayscale@2x.json grayscale@2x.png; do
  cp "$MAP_ASSETS/sprites/v4/$file" "$MAP_WORK/bundle/assets/sprites/v4/"
done
cp "$MAP_ASSETS/fonts/OFL.txt" "$MAP_WORK/bundle/licenses/FONTS-OFL.txt"
cp resources/maps/norte-parana/UPSTREAM-LICENSE.md "$MAP_WORK/bundle/licenses/STYLE-LICENSE.md"
curl -fL --retry 2 \
  https://raw.githubusercontent.com/tangrams/icons/92510779634f4a006c61ea70e50cb8c52c765a81/LICENSE.md \
  -o "$MAP_WORK/bundle/licenses/SPRITES-LICENSE.txt"
printf '%s  %s\n' 46d0ca73c10d7366ef7bf3932d8508267096393ccc9ef3a41d1b1d1fe37023f1 \
  "$MAP_WORK/bundle/licenses/SPRITES-LICENSE.txt" | sha256sum -c -

python - "$MAP_WORK/bundle" <<'PY'
from pathlib import Path
import hashlib, json, sys
p = Path(sys.argv[1])
assert not any(f.is_symlink() for f in p.rglob('*'))
glyphs = list((p / 'assets/fonts').rglob('*.pbf'))
assert len(glyphs) == 1024
assert sum(f.stat().st_size for f in glyphs) == 17711598
sprites = list((p / 'assets/sprites/v4').iterdir())
assert len(sprites) == 4 and sum(f.stat().st_size for f in sprites) == 14290
manifest = [dict(path=str(f.relative_to(p)), bytes=f.stat().st_size,
                 sha256=hashlib.sha256(f.read_bytes()).hexdigest())
            for f in sorted(p.rglob('*')) if f.is_file()]
(p / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Assets: 1024 glyphs + 4 sprites; 17725888 bytes; sem symlinks')
PY
node --test tests/maps/regional_style.test.mjs
```

Os testes do checkout protegem o artefato canônico. Para alteração de prefixo/release, conferir também o JSON de saída e suas URLs; não inferir que testar o arquivo versionado valida um arquivo diferente. O manifesto registra todos os bytes do bundle antes de adicionar o próprio manifesto. Guardá-lo, com metadados da fonte e SHA do checkout, no recibo da publicação; não incluir variáveis privadas.

Validar também o JSON que será publicado com o validador oficial, instalado **somente no diretório temporário**, sem scripts de instalação nem dependência nova no checkout. O teste verifica sintaxe/tipos da Style Specification; não substitui o teste no runtime nativo.

```bash
touch "$MAP_WORK/npm-user" "$MAP_WORK/npm-global"
npm install --prefix "$MAP_WORK/validator" --ignore-scripts --no-audit --no-fund \
  --userconfig="$MAP_WORK/npm-user" --globalconfig="$MAP_WORK/npm-global" \
  --registry=https://registry.npmjs.org @maplibre/maplibre-gl-style-spec@26.4.2
node --input-type=module - "$MAP_WORK" <<'JS'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const work = process.argv[2]
const { validateStyleMin } = await import(pathToFileURL(
  `${work}/validator/node_modules/@maplibre/maplibre-gl-style-spec/dist/index.mjs`
).href)
const style = JSON.parse(await readFile(`${work}/bundle/style.json`, 'utf8'))
const errors = validateStyleMin(style)
console.log(JSON.stringify({ layers: style.layers.length, errors }))
process.exitCode = errors.length ? 1 : 0
JS
```

## 4. Publicação — somente pelo operador com credencial

**Este bloco não foi executado nesta entrega.** Pré-configurar AWS CLI via cofre/perfil privado com acesso restrito ao bucket. Exportar apenas no processo do operador `R2_BUCKET`, `R2_ENDPOINT` e as credenciais reconhecidas pelo AWS CLI (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, ou perfil privado). Não usar `cat .env`, tracing, `--debug` nem interpolar segredos em argumentos. `R2_KEY`/`R2_SECRET` do Drive não são nomes automaticamente reconhecidos pelo AWS CLI.

Confirmar que `MAP_PREFIX` é uma release **nova**: objetos versionados nunca são sobrescritos, inclusive em reexecução; se já foram publicados, comparar o manifesto e seguir a validação ou escolher nova release. Publicar antes os assets e os tiles. O PMTiles deve manter bytes e offsets: **não configurar Content-Encoding gzip no objeto**, mesmo que cada tile tenha compressão interna gzip; não habilitar transformação na CDN.

```bash
: "${R2_BUCKET:?Configurar bucket no processo privado do operador}"
: "${R2_ENDPOINT:?Configurar endpoint no processo privado do operador}"
aws --endpoint-url "$R2_ENDPOINT" --region auto s3 cp \
  "$MAP_WORK/bundle/assets/fonts/" "s3://$R2_BUCKET/$MAP_PREFIX/assets/fonts/" \
  --recursive --content-type application/x-protobuf \
  --cache-control 'public,max-age=31536000,immutable' --only-show-errors
aws --endpoint-url "$R2_ENDPOINT" --region auto s3 cp \
  "$MAP_WORK/bundle/assets/sprites/" "s3://$R2_BUCKET/$MAP_PREFIX/assets/sprites/" \
  --recursive --cache-control 'public,max-age=31536000,immutable' --only-show-errors
aws --endpoint-url "$R2_ENDPOINT" --region auto s3 cp \
  "$MAP_WORK/bundle/licenses/" "s3://$R2_BUCKET/$MAP_PREFIX/licenses/" \
  --recursive --cache-control 'public,max-age=31536000,immutable' --only-show-errors
aws --endpoint-url "$R2_ENDPOINT" --region auto s3 cp \
  "$MAP_WORK/bundle/norte-parana.pmtiles" "s3://$R2_BUCKET/$MAP_PREFIX/norte-parana.pmtiles" \
  --content-type application/octet-stream --cache-control 'public,max-age=31536000,immutable' --only-show-errors
for file in manifest.json style.json; do
  aws --endpoint-url "$R2_ENDPOINT" --region auto s3 cp \
    "$MAP_WORK/bundle/$file" "s3://$R2_BUCKET/$MAP_PREFIX/$file" \
    --content-type application/json --cache-control 'public,max-age=31536000,immutable' --only-show-errors
done
```

## 5. Validar entrega pública antes de promover o alias

Configurar CORS é responsabilidade do operador e continua pendente até uma prova no objeto real. Para os clientes web autorizados: permitir GET/HEAD, headers Range/If-Match; expor ETag e Content-Range (úteis também Accept-Ranges/Content-Length). Não exigir autenticação. [Referência Protomaps](https://docs.protomaps.com/pmtiles/cloud-storage). Conferir regras de CDN/cache após mudança de CORS; o PNG ensaiado no ADR retornou 206 **sem** os headers de CORS.

O teste abaixo faz apenas GET público, compara duas fatias com o arquivo local, verifica 206/Content-Range e ausência de compressão HTTP. Também valida bytes de **todos** os assets do manifesto, incluindo o estilo. Requer CORS para a origem web de homologação; não substituir por sucesso no curl sem Origin. Limita a transferência de cada resposta, evitando baixar acidentalmente o objeto inteiro se Range for ignorado.

```bash
python - "$MAP_WORK/bundle" "$MAP_RELEASE_URL" <<'PY'
import hashlib, json, sys, urllib.request
from pathlib import Path
from urllib.parse import quote
p, base = Path(sys.argv[1]), sys.argv[2]
origin = 'https://experimente-plus.mahina.fun'
def get(path, maximum, byte_range=None):
    headers = {'Origin': origin, 'Accept-Encoding': 'identity', 'User-Agent': 'Experimente-Map-Check/1'}
    if byte_range: headers['Range'] = byte_range
    req = urllib.request.Request(base + quote(path, safe='/'), headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read(maximum + 1)
        assert len(body) <= maximum, (path, 'resposta maior que o esperado')
        assert r.headers.get('Access-Control-Allow-Origin') in ('*', origin), (path, 'CORS')
        assert r.headers.get('Content-Encoding', 'identity') == 'identity', path
        return r.status, r.headers, body
file = p / 'norte-parana.pmtiles'
size = file.stat().st_size
for start, end in [(0, 126), (16384, 16511)]:
    status, headers, body = get(file.name, end-start+1, f'bytes={start}-{end}')
    assert status == 206
    assert headers.get('Content-Range') == f'bytes {start}-{end}/{size}'
    exposed = {h.strip().lower() for h in headers.get('Access-Control-Expose-Headers', '').split(',')}
    assert {'etag', 'content-range'} <= exposed or '*' in exposed
    assert headers.get('ETag')
    with file.open('rb') as f:
        f.seek(start)
        assert body == f.read(end-start+1)
    print(f'Range {start}-{end}: 206, bytes iguais, ETag/CORS presentes')
entries = json.loads((p / 'manifest.json').read_text())
for entry in entries:
    if entry['path'] == 'norte-parana.pmtiles': continue
    status, headers, body = get(entry['path'], entry['bytes'])
    assert status == 200 and len(body) == entry['bytes'], entry['path']
    assert hashlib.sha256(body).hexdigest() == entry['sha256'], entry['path']
print('Estilo, glyphs, sprites e licenças: GET 200, checksum e CORS conferidos')
PY
```

Se o cliente Python receber 403, registrar o resultado e investigar regras de borda; não descartar como ruído. A divergência Python/curl anterior permanece documentada. Para uma inspeção pontual reproduzível com curl:

```bash
curl -fSs --range 0-126 --max-filesize 127 \
  -H 'Accept-Encoding: identity' -H 'Origin: https://experimente-plus.mahina.fun' \
  -D "$MAP_WORK/range.headers" -o "$MAP_WORK/range.bin" \
  "${MAP_RELEASE_URL}norte-parana.pmtiles"
cat "$MAP_WORK/range.headers"
wc -c "$MAP_WORK/range.bin"
```

Completar em Android e iOS reais: MapLibre RN 11.3.8, fonte `pmtiles://https://...`, labels/acentos nas três cidades, zoom 11–15 e overzoom, interações/pins/filtros, atribuição, bordas do recorte, rede fria/quente e indisponibilidade. Não adicionar `pmtiles` JS ao RN: os runtimes nativos do ADR suportam o protocolo. No eventual renderer web, registrar o protocolo JS antes de carregar o estilo; **não há implementação de mapa web nesta entrega**. Validar CORS no navegador de verdade, inclusive preflight de If-Match se emitido. Sucesso dos GETs acima não mede renderização, requisições/sessão ou custo.

## 6. Promover, atualizar e reverter

Somente após validações, promover o JSON, nunca renomear/copiar o PMTiles para uma chave mutável:

```bash
aws --endpoint-url "$R2_ENDPOINT" --region auto s3 cp \
  "$MAP_WORK/bundle/style.json" "s3://$R2_BUCKET/maps/norte-parana/style.json" \
  --content-type application/json --cache-control 'public,max-age=300,must-revalidate' --only-show-errors
curl -fSs "$MAP_PUBLIC_BASE/maps/norte-parana/style.json" -o "$MAP_WORK/alias.json"
cmp "$MAP_WORK/alias.json" "$MAP_WORK/bundle/style.json"
```

Um cache ainda válido pode servir a versão anterior por até 300 segundos: purgar somente o alias se a troca precisar ser imediata, ou conferir depois do TTL; não usar espera para mascarar objeto incorreto. Atualizações usam novo `MAP_RELEASE` e URLs imutáveis. Para rollback, o operador baixa o `style.json` da release anterior, confere seu manifesto e republica seus bytes **no alias**, com o mesmo cache curto. Manter os objetos anteriores enquanto houver clientes/estilos em uso; periodicidade de atualização, retenção e responsável operacional ainda devem ser definidos pelo dono. Offline, fallback embarcado e mapa escuro refinado são trabalhos separados.

Guardar recibo sem segredo (SHA, build, bounds, zoom, manifestos, saída verify, GETs e testes em dispositivo). Ao sair da sessão, o trap remove apenas o diretório temporário criado. Nunca remover objetos antigos com `sync --delete`. CORS, validação visual e custo real **continuam pendentes nesta entrega**, mesmo com estilo estático válido.

## Validação executada nesta entrega

Executado em 11/09/2026 BRT / 12/09/2026 UTC, neste checkout, sem aplicação HTTP, banco ou provedor autenticado:

| Comando / ensaio executado                                                                          | Saída real / resultado                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `mise exec node@24.13.0 -- pnpm typecheck`                                                          | `$ tsc --noEmit && tsc --noEmit -p inertia/tsconfig.json`; exit **0**, sem diagnósticos.                                |
| `mise exec node@24.13.0 -- pnpm lint`                                                               | `$ eslint .`; exit **0**, sem erros ou avisos.                                                                          |
| `mise exec node@24.13.0 -- node --test tests/maps/regional_style.test.mjs`                          | `tests 4`, `pass 4`, `fail 0`; exit **0**. Schema/fonte, URLs públicas, flat/cores e contraste das superfícies sólidas. |
| Geração + assets: bloco 3 deste runbook, executado em diretório temporário                          | `Assets: 1024 glyphs + 4 sprites; 17725888 bytes; sem symlinks`; SHA-256 dos três downloads conferidos, todos `OK`.     |
| Validador `@maplibre/maplibre-gl-style-spec@26.4.2`, comando Node do bloco 3                        | `{"layers":71,"errors":[]}`; exit **0**.                                                                                |
| `cmp resources/maps/norte-parana/style.json /tmp/experimente-map-style/rehearsal/bundle/style.json` | exit **0**; regeneração com o prefixo padrão reproduziu exatamente o JSON versionado após formatação.                   |
| `pmtiles show https://build.protomaps.com/20260911.pmtiles --metadata`, binário temporário 1.31.2   | Metadados obtidos; `version: 4.15.2`, nove source-layers confirmadas. Não foi feita nova extração.                      |
| `bash -n` de cada bloco Bash e conferência de links relativos novos                                 | Sem erros. Os blocos de upload e validação remota tiveram somente sintaxe conferida, **não foram executados**.          |

O estilo formatado mede **122.497 bytes**, SHA-256 `49fbacc67ff011fd5aa73815f09aac5fcfd2dc1bfd03a42fee1b7fab07b0a82b`. Glyphs, sprites, três licenças e estilo somam **17.857.122 bytes**, sem o manifesto e sem o PMTiles. Somando o extrato z15 anteriormente medido, a composição resulta em **30.680.397 bytes**, antes do manifesto: é soma de arquivos, não medição de tráfego ou custo. Não foi baixado o planeta, repetido o extrato do operador, criado pacote de sistema ou alterada dependência do projeto.

O ensaio descobriu que a regra `tmp/` de `.prettierignore` pulava o JSON temporário. O comando reproduzível inclui `--ignore-path /dev/null`; depois disso, `cmp` confirmou igualdade byte a byte. A primeira contagem pelos blobs do Git também foi substituída pela medição materializada dos glyphs (symlinks), descrita acima. Temporários desta entrega foram removidos depois de registrar as medições. Não há prova nesta etapa de publicação, CORS resolvido, renderização em aparelho, desempenho ou custo real.

## Publicação, promoção e validação executadas — 14/09/2026

Executado na estação do operador. A credencial R2 do backend foi lida do `.env` para o ambiente do
processo `aws` e mapeada para `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`; não foi impressa, não foi
persistida em perfil e não foi repassada a outro agente. O bloco 4 (upload da release) **não** foi
reexecutado: os objetos de `20260911-v1` já existiam de entrega anterior. Foram executados o bloco 5
(validação pública) e o bloco 6 (promoção do alias), que até então tinham apenas sintaxe conferida.

| Ensaio executado                                                            | Saída real / resultado                                                                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verificação completa do manifesto: GET de **todos** os 1.033 objetos        | bytes e SHA-256 idênticos ao manifesto em **todos**; nenhuma resposta trouxe `Content-Encoding`; **30.680.397 bytes**; 24,8 s com 16 conexões.        |
| Range no PMTiles real, com `Origin` da web de homologação                   | `206`; `content-range: bytes 0-15/12823275`; `accept-ranges: bytes`; `etag`; `cache-control: public,max-age=31536000,immutable`; sem transformação. |
| Preflight `OPTIONS` no PMTiles, com `Access-Control-Request-Headers: range` | `204`; `access-control-allow-methods: GET, HEAD`; `access-control-allow-headers: range`; `access-control-max-age: 86400`.                            |
| `access-control-expose-headers` nas respostas GET                          | `etag,content-range,accept-ranges,content-length` — os quatro exigidos pelo bloco 5.                                                                |
| Promoção do alias, bloco 6                                                 | `style.json` da release copiado para `maps/norte-parana/style.json`, `content-type: application/json`, `cache-control: public,max-age=300,must-revalidate`. |
| `cmp` alias × release, e alias × artefato versionado do repositório         | exit **0** nos dois. SHA-256 `49fbacc67ff011fd5aa73815f09aac5fcfd2dc1bfd03a42fee1b7fab07b0a82b`, **122.497 bytes**.                                 |
| Referências internas do alias                                              | glyphs, sprite e source apontam exclusivamente para `20260911-v1`; nenhuma chave mutável referenciada.                                               |

A cadeia de proveniência fica fechada e verificável: `resources/maps/norte-parana/style.json` no
repositório, o objeto da release imutável e o objeto servido pelo alias público são **o mesmo byte a
byte**. O alias passou de `404` para `200` nesta entrega.

### Diferença 403/206 entre clientes — causa identificada

O ADR-0026 registrou como pendência investigar essa diferença **se reaparecer**. Reapareceu: a
primeira verificação do manifesto recebeu `403` em **todos** os 1.033 objetos usando Python `urllib`,
enquanto `curl` obtinha `200`/`206` nos mesmos objetos no mesmo momento. A causa é uma regra de borda
por **User-Agent**, não Range, CORS, credencial, cache ou limite de taxa. Mesma URL, variando apenas o UA:

| User-Agent enviado                        | Resposta |
| ----------------------------------------- | -------- |
| `Python-urllib/3.13`                      | **403**  |
| `Python-urllib/3.11`                      | **403**  |
| `Python-urllib/3.13 extra` (com sufixo)   | **403**  |
| `extra Python-urllib/3.13` (com prefixo)  | `200`    |
| `python-requests/2.32`, `Python/3.13`, `urllib/3.13` | `200` |
| `okhttp/4.12.0` (transporte Android)      | `200`    |
| `CFNetwork/1568 Darwin/24.0.0` (iOS)      | `200`    |
| `MapLibreNative/11.3.8 Android`           | `200`    |
| Chrome, `curl`, `Go-http-client`, `undici`, UA vazio | `200` |

A regra casa o UA **ancorado no início** da string, é independente da versão do Python e o `403` é
reprodutível (3/3). **Consequência operacional delimitada:** nenhum transporte real de cliente é
afetado — Android, iOS, navegador e a própria CLI passam. O risco é de **ferramentaria**: qualquer
script de verificação ou job de CI que use `urllib` com o UA padrão recebe `403` e pode ser lido como
falha de publicação. Definir `User-Agent` explícito nesses scripts. Isto não foi medido como regra de
bot do provedor nem foi alterada nenhuma configuração de borda para chegar a esta conclusão.

### Alcance da regra de CORS

O cabeçalho `access-control-allow-origin` é devolvido **apenas** para
`https://experimente-plus.mahina.fun`. Origens de terceiros, a própria origem de mídia e
`http://localhost:8081` recebem resposta **sem** cabeçalho CORS:

| `Origin` enviado                      | `access-control-allow-origin` |
| ------------------------------------- | ----------------------------- |
| `https://experimente-plus.mahina.fun` | ecoa a origem                 |
| `https://exemplo-terceiro.invalid`    | ausente                       |
| `http://localhost:8081`               | ausente                       |
| `https://midia-experimente.mahina.fun` | ausente                       |

Isso é suficiente para o cliente móvel nativo, que não passa por CORS. Duas consequências reais:
`expo start --web` na porta padrão **não** carregará o mapa, e um eventual renderer web em outra
origem exigirá incluir essa origem na regra antes de funcionar. Nenhuma alteração de configuração do
bucket foi feita nesta entrega.

### O que continua pendente

Validação visual em Android e iOS reais (zoom 11–15 nas três cidades, acentos nos rótulos, ruas,
pins, atribuição Protomaps/OpenStreetMap, bordas do recorte); medição de carregamento frio/quente,
bytes e requisições por sessão e comportamento com rede ruim; consumo e custo reais no R2; e
definição de periodicidade de atualização, retenção e responsável operacional. Publicação verificada
e alias promovido **não** são prova de renderização, desempenho ou custo.
