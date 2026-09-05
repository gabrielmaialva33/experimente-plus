# Reconciliação do schema do catálogo

## Motivo

O commit `15bf8a9` adicionou `attribute_slugs` à migration
`1782133990000_create_catalog_projection.ts` depois que ela já havia sido aplicada no piloto.
O deploy de `d71f93c` passou na home, mas o catálogo dependia de uma coluna e de uma versão da função
de refresh ausentes no banco implantado. Reexecutar `migration:run` não reaplica arquivos registrados.

A correção durável é `1788556800000_reconcile_catalog_attribute_slugs.ts`. A migration original
permanece intacta; alterações posteriores de objetos implantados também precisam de novas migrations.

O drift adicional de recibos, identidades e papel global, junto da proteção dos arquivos
operacionais no contexto Docker, está no [runbook dos contratos persistidos](persistent_schema_reconciliation.md).
As exclusões de credenciais e logs precisam estar presentes antes do próximo build.

## Comportamento da migration

- Executa na transação do Lucid e recusa execução sem transação. Esperas por locks têm limite de 5s;
  cada statement tem limite de 60s, dimensionado para o piloto.
- Antes de tocar a projeção, toma `SHARE ROW EXCLUSIVE` (SRX) em `catalog_tenant_versions` e,
  antes do `ALTER`, exige explicitamente `ACCESS EXCLUSIVE` em `catalog_establishments` com
  `NOWAIT`. Não há uma ordem universal nos triggers: refresh elegível incrementa a versão antes
  do catálogo, mas `catalog_delete_establishment` faz o delete antes de incrementar a versão.
  O SRX espera os writers de versões existentes e bloqueia novos; leitores dessa tabela continuam
  permitidos. Se a projeção já estiver ocupada, inclusive por writer na ordem inversa, `NOWAIT`
  aborta imediatamente a transação e libera os locks, sem esperar nesse ciclo de deadlock.
  O lock exclusivo, quando adquirido, também bloqueia leituras do catálogo.
- Adiciona `attribute_slugs text[]` somente quando ausente, inicialmente permitindo nulos para
  acomodar linhas existentes.
- Sob o mesmo lock, exige uma coluna comum de tipo `text[]` sem typmod. Uma coluna homônima
  `varchar[]`, limitada, de domínio ou gerada aborta antes de alterar função, índices ou projeções;
  não há conversão automática ou truncamento de slugs.
- Instala uma cópia fixa e integral de `catalog_refresh_establishment(integer, integer)` da baseline
  `d71f93c`. Não carrega código de aplicação nem SQL de arquivos de migrations que possam mudar.
- Reprocessa as fontes publicadas de todos os tenants, inclusive unidades ausentes da projeção, e
  quaisquer unidades ainda projetadas. O refresh respeita elegibilidade, remove conteúdo que deixou
  de ser público e incrementa a versão do catálogo para invalidar caches.
- Antes do rebuild reconcilia o índice GIN, para um índice divergente não impedir as escritas.
  Verifica tabela/coluna, método, opclass, collation, ausência de predicado/expressão e estados
  `indisvalid`, `indisready` e `indislive` em `pg_index`, junto da definição decompilada. Um índice
  homônimo divergente é removido e recriado na transação; um índice correto preserva seu OID.
  Não usa `CASCADE`: colisão com outro tipo de objeto ou dependências impedem o reparo integralmente.
- Só depois do rebuild aplica `NOT NULL` e remove qualquer default.
- Preserva os dados de origem e os campos de patrocínio das projeções existentes. Pode ser aplicada
  após o hotfix ou em instalação limpa. Repetir o reparo mantém o conteúdo lógico, mas incrementa
  versões e timestamps da projeção.

O `down` mantém o reparo aditivo: a coluna, o índice e a função podem ser anteriores a esta migration
por instalação limpa ou hotfix. Removê-los quebraria a baseline atual e o rollback de código.
O reset completo de um banco descartável continua removendo esses objetos no `down` da migration
original.

## Preparação e janela

Coordenar a janela antes de executar migrations ou testes com banco. O bootstrap Japa migra e popula
o banco até em `pnpm test`; não é uma validação sem DB. A revisão de código e os seguintes checks
estáticos podem ocorrer antes da janela, usando Node 24:

```bash
pnpm typecheck
pnpm lint
bash -n deploy.sh scripts/smoke_catalog.sh
node --test tests/deploy/catalog_migration_snapshot.test.mjs tests/deploy/docker_context_contract.test.mjs tests/deploy/deploy_revision_contract.test.mjs
```

Esses testes estáticos incluem a comparação byte a byte da função nas migrations create e repair,
com SHA256 fixado na baseline `d71f93c`, a ordem de locks com timeouts anteriores ao primeiro acesso
ao catálogo, a proteção do contexto Docker e o SHA transmitido pela CI. Não importam migrations
nem inicializam o Adonis. Quando testes dinâmicos sem banco estiverem autorizados, a suíte completa
`node --test tests/deploy/*.test.mjs` também exercita o fluxo de deploy com Git, Docker e HTTP
simulados em diretório temporário. Esses cenários cobrem falhas de materialização por
`git read-tree`, `git update-ref` e `rsync`, build, migration, subida, readiness, smoke e persistência
do estado, rollback malsucedido, `HEAD` já em NEW,
bootstrap explícito, concorrência no `flock`, encerramento do processo, arquivos não rastreados
inclusive ignorados, contexto extraído do commit, corrida entre SHA aprovado e avanço de master,
comandos SSH malformados, downgrade concorrente, mudança tardia de `.env` e contratos diferentes
de smoke entre NEW e LKG.
Há também regressões em repositórios Git temporários reais para paths reservados, `refs/replace`,
flags do index, sparse checkout e modos dos arquivos críticos. A regressão de `refs/replace` cria
um objeto commit sintético apenas no clone temporário, via `commit-tree`, sem mover branches ou
alterar a origem; também funciona com checkout raso da CI. Não executam fetch de rede, Docker ou banco. Os cenários simulados cobrem
alterações tardias de Compose, recuperação do serviço com checkout alterado, configuração Git de
transporte executável, `core.worktree` externo e sinais imediatamente depois de publicar a LKG.

Depois do `git archive` e das restaurações críticas, o verifier integral compara o snapshot inteiro
com `git ls-tree -r -t -z` do SHA aprovado. Ele exige o mesmo conjunto NUL-safe de paths e diretórios,
os mesmos modos de blobs (`100644`/`100755`) e os mesmos hashes de conteúdo sem filtros; symlinks
`120000` precisam manter o alvo byte a byte, inclusive newline final. Gitlinks, tipos desconhecidos,
FIFO, diretórios extras, arquivos extras e entradas ausentes abortam o deploy sem imprimir paths ou
conteúdo. A extração normaliza arquivos para o modo Git e diretórios para `0755`, independentemente
do `umask`; a enumeração `find` é materializada antes do loop e qualquer erro também é fatal.

Antes do primeiro Git, o entrypoint injeta `core.fsmonitor=false` e `core.hooksPath=/dev/null` por
configuração de processo. Assim hooks de referência e fsmonitor não executam durante `ls-files`,
`write-tree`, `hash-object`, `read-tree` ou `update-ref`. O preflight rejeita qualquer
`filter.*.clean`, `filter.*.smudge` ou `filter.*.process` configurado, tratando retorno sem matches
como estado limpo e erro de leitura como fail-closed; essa rejeição ocorre antes de cada verificação
rastreada e materialização relevante. As regressões em
`tests/deploy/git_integrity.test.mjs` cobrem hooks, fsmonitor, `refs/replace`, checkout raso,
atributos `export-ignore`/`export-subst` em `.gitattributes`, `info/attributes` e
`core.attributesFile`, além de modos, filtros de snapshot, origem divergente, `uploadpack`,
`sshCommand`, `alternateRefsCommand`, reescrita `insteadOf` e protocolos inseguros. Configurações
globais e de sistema são desativadas; a origem local deve ser exatamente o repositório HTTPS
aprovado. O fetch de rede acontece em um repositório bare temporário criado pelo entrypoint e o
checkout operacional importa dele somente pelo protocolo `file`, com allowlist de protocolo.

Na janela, validar primeiro em banco descartável, com dados representativos. A suíte
`tests/functional/database/catalog_attribute_reconciliation.spec.ts` prepara estes cenários dentro
de transações revertidas ao final:

1. Schema antigo com coluna/índice ausentes e função desatualizada; conferir backfill entre tenants,
   recuperação de projeção ausente e funcionamento dos triggers após a atualização.
2. Schema de instalação limpa/hotfix; aplicar novamente, conferir conteúdo, preservação da origem e
   do patrocínio e retenção do reparo no `down`.
3. Reparo parcial com nulos, default temporário e índice ausente; verificar convergência ao contrato.
4. Índice homônimo de outra coluna, de outro método, parcial, inválido ou sem prontidão para escrita;
   verificar substituição por GIN íntegro, com novo OID. Uma restrição de unicidade indevida no índice
   também deve ser removida antes de reconstruir uma projeção ausente. A simulação dos flags inválidos altera
   `pg_index` somente na transação de teste e requer superuser no PostgreSQL descartável da suíte,
   como na CI. A migration de produção apenas consulta esses flags e usa DDL para reparar o índice.
5. Coluna homônima `varchar[]` ou `varchar(120)[]`; recusar o tipo divergente e preservar a coluna,
   os dados, a função e o índice preexistentes.

Antes do rollout persistente, validar um backup restaurável e confirmar a revisão da imagem e as
migrations pendentes. O script quiesce explicitamente o serviço Compose da única réplica, usando
o snapshot GOOD e o projeto fixo `experimente-plus`, antes de executar uma única migration one-shot
destacada e subir NEW. O container recebe o nome `experimente-plus-migration-<sha>` e labels de papel
e revisão; o script valida também ID, imagem, política sem restart, projeto e serviço antes de esperar
pelo ID concreto por até 600s. Depois da espera, em sucesso, falha ou timeout, o cleanup remove os
containers de migration do namespace e repete a enumeração para comprovar que nenhum restou. Sem
essa comprovação, não sobe NEW nem inicia a subida de GOOD no rollback. O CMD permanente inicia
somente o servidor HTTP; `restart: unless-stopped` não repete migrations. Essa quiescência do serviço
não encerra writers externos ao serviço; o operador deve eliminá-los antes de executar a migration
na janela autorizada. A migration adquire primeiro SRX em `catalog_tenant_versions`, depois
`ACCESS EXCLUSIVE NOWAIT` em `catalog_establishments` antes do `ALTER`, mantendo ambos durante
o rebuild. Prever a pausa de writers e leituras do catálogo. Se `NOWAIT` recusar o lock, abortar
o rollout e restabelecer quiescência antes de tentar novamente, sem retry automático sob carga.
Espera do primeiro lock acima de 5s ou statement acima de 60s também aborta integralmente o reparo
e libera seus locks. A sequência e o fail-fast estão cobertos por contrato estático; o teste
concorrente com banco permanece para a janela coordenada. Os conflitos desses modos estão no
[manual de locks do PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES).

No primeiro rollout desta alteração, instalar uma cópia revisada de `deploy.sh` fora da working tree,
por exemplo em `/usr/local/libexec/experimente-plus-deploy`, com proprietário root e sem escrita
pelo usuário de deploy. Atualizar o `command="/usr/local/libexec/experimente-plus-deploy"` da chave
em `authorized_keys`, mantendo suas restrições existentes. Essa instalação e a atualização da chave
pertencem à janela; não foram executadas neste lote. Não deixar o forced command apontando para o
arquivo que o próprio rollback pode substituir por uma versão antiga. O entrypoint deve ser
atualizado separadamente quando seu contrato mudar; ele não instala automaticamente código recebido.
Para a release que adiciona o fence de rotação bootstrap, seguir o
[procedimento atômico de atualização do entrypoint](persistent_schema_reconciliation.md#atualização-obrigatória-do-entrypoint-externo)
depois da promoção a LKG e antes de habilitar a rotação.

## Deploy e recuperação

O script atualizado adquire um `flock` não bloqueante antes de fetch e materialização. O lock fica em
`<git-common-dir>/experimente-plus-deploy/deploy.lock`, sobrevive à troca da revisão e permanece adquirido
até terminar a validação ou o rollback. Uma segunda execução concorrente termina com código `75`.

A CI faz checkout e envia o mesmo `github.sha` aprovado, como `deploy <sha>` por SSH. O entrypoint
lê `SSH_ORIGINAL_COMMAND` como texto e exige exatamente esse formato: 40 caracteres hexadecimais
minúsculos, sem argumentos adicionais, espaços extras ou comandos de shell. Não usa `eval` nem
`bash -c`. Para execução manual, exige o SHA como único argumento. Faz fetch pelo SHA; no canal SSH
forçado, também busca `refs/heads/master` para uma ref isolada e aceita NEW somente se o SHA pertencer
ao histórico dessa `master` remota. Confirma o commit exato no bare e novamente em
`FETCH_HEAD^{commit}` após a importação local. Um avanço concorrente posterior da `master` não altera
a revisão implantada. Depois de carregar a LKG, exige que ela seja ancestral de NEW, impedindo uma
execução antiga da CI de rebaixar a produção.
A variável SSH deve ser preservada pelo forced command, sem wrapper
que descarte ou execute seu conteúdo. O [manual do OpenSSH](https://man.openbsd.org/sshd.8#command)
documenta esse canal do comando original.

O preflight usa `git ls-files --others -z` sem `--exclude-standard`, incluindo arquivos ignorados,
antes do fetch, imediatamente antes de materializar NEW e novamente depois do `rsync`. Só aceita `.env`, `.env.local`, `.env.*.local`,
e arquivos sob `node_modules/`, `build/`, `dist/`, `coverage/`, `tmp/`, `storage/uploads/` e
`storage/seed-media/`. Cada exceção depende de exclusão explícita no `.dockerignore` do commit;
um override `Dockerfile.dockerignore` também precisa cumprir esse contrato. Reinclusões são
recusadas. Qualquer outro arquivo, inclusive migration stale ou `database/schema.ts` gerado,
interrompe o deploy. Não usar `git clean`; revisar e preservar os arquivos fora desse fluxo.
O [manual do Git](https://git-scm.com/docs/git-ls-files) documenta a listagem sem ativar ignores.

Antes de qualquer comando Git, o entrypoint força `GIT_NO_REPLACE_OBJECTS=1` e recusa outros
controles `GIT_*` herdados sem imprimir nomes ou valores. A raiz física, `.git` e common dir devem
ser exatamente o checkout operacional regular; depois disso `GIT_DIR` e `GIT_WORK_TREE` ficam
fixados, de modo que `core.worktree` tardio não redirecione a materialização. `git ls-tree` verifica que NEW e GOOD
não rastreiam os paths operacionais reservados nem arquivos que substituam seus diretórios.
O preflight rastreado não usa `git diff`: compara a árvore produzida pelo index com a árvore de
`HEAD`, enumera os blobs de `HEAD` de forma NUL-safe e compara manualmente tipo, modo e conteúdo da
working tree. Arquivos regulares são calculados com `git hash-object --no-filters`, e symlinks têm o
alvo comparado por hash. Também recusa sparse checkout e flags especiais do index, incluindo
`skip-worktree`, `assume-unchanged` e fsmonitor-valid. Falha de enumeração interrompe o fluxo; esses
erros não imprimem paths nem conteúdo local. Esse gate roda antes de fetch, imediatamente antes de
materializar NEW, depois da cópia e antes de reconciliar GOOD.

O build usa `git archive` do SHA verificado extraído em `<state>/run.*/source`, com permissões
restritas. Todas as operações Compose de NEW (build, config, imagem, subida e inspeção) usam esse
snapshot. GOOD tem snapshot próprio em `good-source`, preparado antes da materialização, para inspeção e
recuperação. Antes do fetch, `.env` deve ser um arquivo regular e é copiado de forma estável para o
diretório privado da execução; a mesma cópia `0600` é instalada nos snapshots NEW e GOOD. Cada
chamada recebe `--project-directory` apontando para seu snapshot, resolvendo interpolação e
`env_file` sem reler o arquivo operacional. O build recebe override de contexto para o snapshot,
cujo `.dockerignore` exclui `.env`. Assim, alterações tardias de Compose ou ambiente não entram no
release nem quebram o rollback. O uso de `--project-directory` segue o
[contrato do Compose](https://docs.docker.com/reference/cli/docker/compose/).

Compose, `.dockerignore` e o smoke extraído do Git precisam ser blobs regulares `100644`/`100755`;
symlinks, gitlinks, diretórios e entradas ausentes são recusados antes da leitura ou execução.
Os arquivos críticos são copiados dos blobs verificados, sem substituição por atributos de archive.
O mesmo vale para `Dockerfile.dockerignore` quando existe; ambos os ignores exigem também
`**/.env.*.local`. O smoke compatível do bootstrap passa pela mesma checagem Git; a cópia persistida
da LKG precisa ser arquivo regular sem symlink e manter seu SHA256 validado. Não se arquiva a árvore
operacional. A materialização não usa checkout nem qualquer forma de `git reset`: depois dos gates,
`git read-tree` sem `--reset`/`-u` atualiza somente o index e `git update-ref` avança `HEAD` exigindo o
valor anterior esperado. Só então `rsync --archive --checksum --delete --delete-delay --delay-updates`
copia o snapshot já verificado para a working tree, preservando os paths operacionais excluídos.
Essa separação impede que filtros clean/smudge injetados na janela de materialização executem; o
pós-preflight ainda recusa a configuração tardia. Em seguida o script confere `HEAD` e repete os
preflights. Os diretórios temporários criados pelo próprio deploy são removidos ao sair.

`/usr/bin/rsync`, `/usr/bin/sync` e `/usr/bin/jq` são pré-requisitos verificados antes de fetch ou
snapshots. Os dois primeiros materializam as releases e sincronizam o estado durável; o terceiro
valida o modelo Compose efetivo. O build aceita somente o contexto absoluto do snapshot,
`Dockerfile` raiz e target `production`; qualquer opção adicional, inclusive `additional_contexts`
ou outro Dockerfile com ignore prioritário, aborta antes da materialização. A ausência de qualquer
pré-requisito também aborta a preparação.

O arquivo `last-known-good` nesse mesmo diretório contém três linhas: revisão completa, ID da imagem
Docker e SHA256 do smoke validado. O script fica em `smokes/<sha256>.sh`, e sua integridade é conferida
antes de qualquer materialização. O registro só é substituído atomicamente depois de conferir a imagem do container, readiness e
catálogo. A gravação e a atribuição da flag de sucesso formam uma seção crítica curta que ignora
HUP/INT/TERM; as traps são restauradas logo depois. EXIT continua ativo para recuperar falhas de
gravação. A revisão recebe uma ref `refs/deploy/verified/<sha>` e a imagem recebe a tag
`experimente-plus:deploy-good-<sha>` antes de avançar o registro. Preservar esses artefatos ao fazer
limpeza de Git/Docker, incluindo os smokes preservados. Registro inválido, smoke ausente/alterado ou
imagem ausente interrompe a preparação, sem materializar a release. Registros antigos de duas linhas não são
completados usando o smoke de NEW: exigem reconciliação coordenada do contrato e nova validação.

No primeiro uso, identificar explicitamente a revisão da imagem atualmente servida; o `HEAD`
pode ter sido deixado em uma revisão malsucedida pelo script antigo. O bootstrap com `d71f93c`
pressupõe explicitamente o hotfix de catálogo já aplicado no banco e o smoke completo verde.
O SHA sozinho não comprova que o schema foi reparado; sem essas duas condições, essa revisão
não deve ser registrada como last-known-good. Na janela, se essa ainda for a versão servida
com hotfix e smoke validados, definir os SHAs completos do deploy aprovado e de um contrato de smoke
compatível revisado. Como `d71f93c` não tem esse script, o bootstrap exige explicitamente a revisão
do contrato compatível; sem ela falha antes de materializar a release. Substituir os marcadores antes da execução:

```bash
APPROVED_REVISION='SHA_COMPLETO_APROVADO_NA_CI'
COMPATIBLE_SMOKE_REVISION='SHA_COMPLETO_DO_CONTRATO_COMPATIVEL_REVISADO'
DEPLOY_INITIAL_GOOD_REVISION=d71f93c5db45705698d9be7e0515052624bc8be4 \
DEPLOY_INITIAL_GOOD_SMOKE_REVISION="$COMPATIBLE_SMOKE_REVISION" \
  /usr/local/libexec/experimente-plus-deploy "$APPROVED_REVISION"
```

Esse comando primeiro valida e registra a versão em execução, depois continua o deploy, incluindo
migrations pendentes pela operação one-shot após a quiescência. Não é um comando apenas de preparação. Nas execuções
seguintes, o estado persistido prevalece sobre as variáveis iniciais e sobre o `HEAD` atual.
Quando a revisão boa já contém seu próprio smoke, a variável de compatibilidade pode ser omitida.

O trap é instalado antes da materialização. Falhas de materialização, build, migration, `compose up`, readiness, smoke ou gravação
do novo estado acionam recuperação. Primeiro ela retagueia a imagem retida
para o nome usado pelo snapshot Compose GOOD e sobe com `--no-build --pull never`; portanto não depende de rede
ou de outro build para recuperar a imagem. Executa uma cópia do smoke armazenado e verificado da
LKG, nunca o contrato de NEW por padrão. Esse snapshot permanece disponível mesmo se a revisão
antiga não possuir o script e mesmo que NEW passe a exigir endpoints novos.
Só depois de restaurar e validar o serviço tenta reconciliar o checkout com GOOD. Repete os gates
de untracked e tracked antes dessa materialização. Se houver alteração tardia ou enumeração impossível,
preserva o estado local e a LKG, informa que o serviço foi restaurado mas o checkout não foi
reconciliado e termina com código `2`. A recuperação do serviço independe dessa materialização.

Readiness e smoke também precisam passar depois do rollback, verificando o ID da imagem restaurada.
Saída `0` significa deploy validado, `1` significa falha de preparação ou deploy revertido com
validação, e `2` significa recuperação incompleta (serviço não validado ou checkout não reconciliado)
e exige intervenção. O registro da
versão boa anterior permanece intacto em toda falha. HUP/INT/TERM acionam esse fluxo; SIGKILL ou
queda do host não permitem trap, mas o registro persistido mantém o fallback para a próxima execução.

O build tem limite de 10 minutos; a espera no container de migration destacado tem 600s e a subida
tem 120s; stop tem 60s; config/ps têm 30s; chamadas diretas ao Docker têm 30s. Readiness aceita de
1 a 120s por versão (`DEPLOY_READY_TIMEOUT_SECONDS`). O job da CI tem limite de 75 minutos e o passo
SSH de 70 minutos.
O teste de orçamento soma conservadoramente o primeiro bootstrap, uma falha tardia e o rollback
completo e exige pelo menos 10 minutos de margem no passo e 5 minutos entre passo e job. SSH usa
keepalive a cada 30s, com três respostas ausentes
antes de encerrar a conexão; o trap remoto continua responsável pelo rollback mesmo quando a sessão
SSH cai. Rollback restaura código/imagem e nunca reverte migrations aplicadas.

## Verificação após rollout

O smoke deve usar o hostname confiável cadastrado na operação e o slug de uma cidade existente.
Por padrão usa o loopback da VPS, `experimente-plus.mahina.fun` e `londrina`:

```bash
bash scripts/smoke_catalog.sh
```

As variáveis `CATALOG_SMOKE_BASE_URL`, `CATALOG_SMOKE_HOST` e `CATALOG_SMOKE_CITY_SLUG` permitem
apontar o mesmo script para o ambiente ou cidade em validação. São variáveis do processo que executa
o script, não apenas do `.env` do container.

Home, lista de cidades, cidade em HTML e Inertia, establishments e filters devem responder `200`
com `Content-Type` correto. Redirects, `404`, `429`, `500`, falha de conexão ou timeout reprovam o
smoke; nenhuma resposta é impressa. No deploy, a execução externa do script tem limite de 45s.
Tanto o `curl` de readiness quanto os `curl` do smoke usam `--disable --noproxy '*'`, ignorando
arquivos de configuração e proxies herdados. Falha provoca rollback de código, mantendo o schema.
As APIs só são consultadas uma vez por execução, após readiness, para respeitar o rate limit.

Na mesma janela, conferir também o registro da nova migration, coluna `text[] NOT NULL` sem default,
índice GIN válido, função instalada e coerência de `attribute_slugs` com as fontes públicas. A suíte
PostgreSQL cobre essas garantias; o smoke HTTP sozinho verifica disponibilidade e tipo de conteúdo.

O health de conexões do PostgreSQL compartilhado e a sanitização de erros JSON são correções
separadas; este smoke não depende de `/api/v1/health`.
