# Dependências nativas e build da imagem

O runtime implantado usa PostgreSQL (`DB_CONNECTION=postgres`). A conexão SQLite
em `config/database.ts` continua disponível com a instalação de desenvolvimento;
ela não é uma alternativa suportada para o schema PostgreSQL do produto.

## Fronteira de instalação

- `better-sqlite3`, Tailwind e seu plugin Vite são dependências de desenvolvimento.
  O builder instala desenvolvimento para compilar; a imagem final recebe somente
  a árvore de `pnpm install --prod --frozen-lockfile`.
- `.pnpmfile.cjs` remove **somente** o peer opcional `better-sqlite3` de Knex.
  Sem isso, o peer resolvido no lockfile promove o driver de desenvolvimento para
  a árvore transitiva de produção. Não remover o hook ao atualizar o lockfile.
  O driver explícito na raiz continua disponível para ferramentas locais.
- Argon2 permanece em produção: é o hasher configurado para autenticação.
  O provider `@adonisjs/vite` também permanece: integra manifests/assets e Edge.
  Sua árvore upstream ainda inclui Vite/Rolldown/Lightning CSS; o assembler
  transitivo de Adonis inclui ast-grep. Não amputar esses grafos apenas porque
  contêm binários: revalidar os consumidores e a inicialização antes de podar.
- O estágio final não herda Python, Make ou G++. Compiladores ficam no estágio
  `toolchain`, usado pelas duas instalações.

## Custo e limites

As instalações dependem apenas de manifests, lockfile e hook. Mudanças de fonte
não invalidam a camada de dependências de produção. O cache BuildKit do store
pnpm tem compartilhamento bloqueado durante a instalação.

`npm_config_nodedir=/usr/local` usa os headers da própria imagem Node, cuja
presença é verificada. `npm_config_jobs=2`, `MAKEFLAGS=-j2` e
`--child-concurrency=1` limitam jobs nativos e scripts de instalação.
`NODE_OPTIONS=--max-old-space-size=2048` limita o heap V8 do build, **não** a memória
total do container ou de processos nativos. Esses ajustes não limitam todos os
estágios concorrentes de BuildKit.

O deploy mantém seu prazo interno de 600 segundos para build e seu rollback.
Não há limite de RAM/CPU de build declarado no Compose versionado. Caso telemetria
do host mostre pressão residual, avaliar um builder dedicado com paralelismo
máximo reduzido e orçamento de memória medido, preservando recursos dos outros
serviços. Não deduzir OOM apenas de um timeout ou de uma linha de node-gyp.

## Verificação antes de publicar

Com Node 24.13.0 e pnpm 11.22.0, na raiz:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
node --test tests/deploy/*.test.mjs
pnpm test:ui
docker build --progress=plain --target production -t experimente-native-verification .
```

Executar também `pnpm test:e2e` exclusivamente com PostgreSQL e Redis de teste
isolados: o bootstrap aplica migrations, seed e limpa Redis. Não usar o ambiente
do piloto para essa validação.

`tests/deploy/native_dependencies.test.mjs` percorre o grafo transitivo do lock,
valida a separação das camadas e exercita a conexão SQLite local em memória.
Complementar com um container da imagem final, sem bind mount de `node_modules`,
usando somente banco/Redis descartáveis. Verificar health, catálogo público,
HTML/assets compilados, login Argon2 e carteira autenticada. Registrar somente
status e asserções; não imprimir senha, hash, cookie ou token. Inicializar com
`node bin/server.js`, sem migration no comando de startup.

## Referências

- [Lucid: instalação e escolha do driver](https://lucid.adonisjs.com/docs/installation).
- [pnpm: hook readPackage](https://pnpm.io/pnpmfile).
- [node-gyp: nodedir e jobs](https://github.com/nodejs/node-gyp).
- [Docker: organização das camadas e cache mounts](https://docs.docker.com/build/cache/optimize/).
- [BuildKit: configuração de paralelismo](https://docs.docker.com/build/buildkit/configure/).
