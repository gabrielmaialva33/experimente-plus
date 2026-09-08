# Recriação da homologação — baseline de 08/09/2026

A [proposta ADR-0025](../architecture/decisions/0025-voucher-avulso-e-baseline-de-homologacao.md) registra a autorização expressa do dono para consolidar migrations já aplicadas em homologação. Exceção restrita a esta entrega: **o banco do piloto terá de ser recriado do zero pelo dono**. Este procedimento não foi executado na VPS. Não usar o deploy automático comum para aplicar este histórico sobre o schema anterior; não basta apagar linhas de `adonis_schema`.

## Histórico executável: 59 → 51

| Migration retirada                                           | Destino canônico / tratamento                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `1788814801000_protect_purchase_terms_and_reconciliation.ts` | `1788814800000_create_purchase_financial_ledger.ts`: settlements, imutabilidade do ledger e proteção dos termos                   |
| `1788814802000_reconcile_purchased_terms_trigger.ts`         | Mesmo ledger, função corrigida com ramificação por tabela; não mantém a versão inválida anterior                                  |
| `1788814803000_add_payment_inbox_reconciliation_cursor.ts`   | Mesmo ledger, checked_at/attempts/issue na criação de purchase_webhooks                                                           |
| `1788556800000_reconcile_catalog_attribute_slugs.ts`         | `1782133990000_create_catalog_projection.ts` já contém coluna, GIN e função canônicos; reparo arquivado como fixture              |
| `1788556800100_reconcile_benefit_receipt_codes.ts`           | `1782134030200_create_benefit_redemptions_table.ts` já cria varchar(20) e check canônico; reparo arquivado                        |
| `1788556800200_reconcile_user_identity_checks.ts`            | `1752422127116_create_users_table.ts` já contém checks de identidade; reparo arquivado                                            |
| `1788556800300_remove_unused_global_editor_role.ts`          | `1752435537745_create_default_roles.ts` já cria apenas os papéis globais vigentes; reparo arquivado                               |
| `1788556800400_add_credential_version_to_users.ts`           | `1752422127116_create_users_table.ts` passa a criar credential_version int4 NOT NULL DEFAULT 1 e check positivo; reparo arquivado |

As cinco fixtures ficam em `tests/fixtures/legacy_migrations/`, importadas explicitamente pelos testes históricos. Não estão no caminho do migrator. Nenhum timestamp dos 51 arquivos restantes foi renumerado.

O domínio novo também entra nas criações originais: `1782134020100_create_benefit_offers_table.ts` (preço avulso e chave composta de escopo), `1782134030000_create_benefit_accesses_table.ts` (offer_id, FK composta, unicidade por escopo e trigger imutável), `1782134030200_create_benefit_redemptions_table.ts` (validação do escopo em insert/update), e ledger EP-14 (offer_id, FK, unicidade e conferência do acesso vinculado).

Não restam migrations autônomas de add/alter/reconcile. O `alterTable` interno em `1782133960100_create_establishment_revisions_table.ts` é uma exceção técnica necessária: instala a FK circular do ponteiro publicado depois que a tabela de revisões existe. As colunas já estão nas criações; fundir os dois agregados ou remover a FK pioraria a legibilidade/integridade. O segundo alter desse arquivo está no down e apenas retira essa mesma FK.

## Procedimento do dono — fora desta tarefa

1. Planejar indisponibilidade e impedir push/deploy automático durante a troca. Registrar SHA anterior e SHA da baseline revisada; validar CI do novo SHA antes da janela. Parar HTTP, worker `purchases:process` e scheduler e controlar entregas do PSP. Não apenas trocar imagem enquanto o banco antigo continua conectado.
2. Tirar backup consistente, cifrado e com acesso restrito do banco antigo, configuração e chaves necessárias para recuperar dados cifrados; conferir restauração em ambiente isolado. Preservar objetos R2 e chaves de mídia. Manter backup e versão anterior como conjunto de recuperação, sem expor dados privados no relatório operacional.
3. Resolver pagamentos/estornos pendentes no sandbox e registrar conciliação final. Arquivar ledger, resgates e referências PSP anteriores: recriar banco não cancela pagamento externo nem preserva automaticamente idempotência com o provedor. Eventos antigos não devem conceder acessos novos. Preservar também evidências de direitos e usos anteriores para qualquer decisão de reemissão; nunca converter o reset técnico em devolução silenciosa de cotas.
4. Provisionar um **novo banco vazio** no ambiente de homologação, distinto do antigo arquivado. Configurar conexão apenas no release preparado e nos processos novos, mantendo `DEPLOYMENT_ENV=homologation` e `NODE_ENV=production`. A partir da raiz do artefato preparado, executar `node ace.js migration:run --force` uma única vez, somente depois de conferir que a conexão aponta para o novo banco vazio. No checkout TypeScript, o equivalente é `pnpm ace migration:run --force`; o artefato compilado usa `node ace.js`, sem depender do loader de desenvolvimento. Não rodar `migration:fresh`, rollback, seeder de desenvolvimento ou atualização manual de `adonis_schema` sobre o banco antigo. Não restaurar schema nem histórico de migrations do dump antigo no novo.
5. Conferir 51 registros em `adonis_schema`; colunas `purchases.offer_id`, `benefit_accesses.offer_id`, `benefit_offers.standalone_price_cents`, `users.credential_version` e cursor do inbox; FKs compostas, índices de escopo e triggers presentes/validados. O teste `tests/functional/database/canonical_baseline.spec.ts` é a referência da inspeção, mas **não executar Japa contra homologação**: seu bootstrap semeia e limpa Redis.
6. Executar **`homologation:provision`** no release novo, com `DEPLOYMENT_ENV=homologation`, contas fornecidas em arquivo privado e sandbox de pagamentos configurado, seguindo o procedimento abaixo. O comando cria administrador de negócio (`admin`, não `root`), parceiro e consumidor, memberships e conteúdo demonstrativo completo. Não importar usuários `.local`, seed de desenvolvimento, nem dumps financeiros parciais. Não mudar homologação para development. Guardar o recibo de IDs emitido pelo comando; nenhuma senha é impressa.
7. Com configuração nova consistente em HTTP/worker, validar readiness, descoberta anônima, vitrine dos dois produtos, login/membership e compra sandbox → confirmação autenticada → carteira restrita → apresentação → resgate → replay. Validar reembolso e efeitos financeiros sem apagar comprovantes. Reativar webhooks/scheduler de forma controlada e acompanhar eventos órfãos do histórico antigo.
8. Se houver falha antes da reabertura, retornar **código, banco e configuração anteriores juntos**. Após atividade no banco novo, rollback demanda reconciliar pagamentos/usos desse intervalo; não descartar o ledger novo. O rollback automático que só restaura imagem/código é insuficiente para esta ruptura.

## Desenvolvimento e prova de instalação limpa

Usar PostgreSQL e Redis exclusivos de teste, conferir host/porta/database antes de iniciar. Criar banco de teste novo a partir de template0, confirmar zero tabelas públicas e apontar `ENV_PATH` para cópia privada de `.env.test` com esse destino. `pnpm test:e2e` executa bootstrap (51 migrations e seeders permitidos), Japa unit/functional/browser e testes do schema. `pnpm test:ui`, `node --test tests/deploy/*.test.mjs`, `pnpm typecheck`, `pnpm lint` e `pnpm build` completam a validação. Não reutilizar dados antigos para comprovar a baseline.

O desenvolvimento com seed usa `NODE_ENV=development`, `DEPLOYMENT_ENV=development`, Drive configurado e, para simulação sem rede de pagamentos, `PAYMENT_PROVIDER=fake`. Isso é diferente de habilitar seed na homologação pública. Uma reexecução preserva termos comerciais, preço e janelas; nova campanha após expiração deve ter nova identidade. O gerador original e as imagens/URLs são testados sem usar o bucket real.


## Provisionamento próprio de homologação

O comando é opt-in, não faz parte das migrations, de `db:seed`, do startup ou do deploy automático. A política exige exatamente `DEPLOYMENT_ENV=homologation` e `PAYMENT_ENVIRONMENT=test`; produção, desenvolvimento, valor ausente ou inválido são recusados. Manter `NODE_ENV=production` na imagem compilada.

### Configuração privada e execução

1. Escolher três e-mails individuais controlados pelo operador e diferentes entre si. Não usar `.local` nem importar as identidades do seed. Gerar três senhas independentes no gerenciador de senhas (recomendado: pelo menos 32 bytes aleatórios antes da codificação). O comando aceita senhas fornecidas de 20–128 caracteres, com minúscula, maiúscula e dígito; essa validação não mede entropia. Não passar senhas em argumentos, shell history ou variáveis impressas. O comando **não gera nem imprime senhas**: o cofre é o canal de entrega e recuperação.
2. Criar um JSON temporário fora do checkout/artefato, por editor seguro ou exportação controlada do cofre. Arquivo regular, sem symlink/hardlink, tamanho máximo 16 KiB, modo `0600`, pertencente ao UID que executará o comando. Diretório privado recomendado `0700`. Não usar `tee`, `cat`, shell com tracing ou logs de CI para seu conteúdo. Estrutura obrigatória, com os campos vazios abaixo preenchidos **somente no arquivo privado**, nunca no repositório:

   ```json
   {
     "tenantSlug": "experimente-plus",
     "tenantName": "Experimente+ (homologação)",
     "accounts": {
       "administrator": { "fullName": "", "email": "", "password": "" },
       "partner": { "fullName": "", "email": "", "password": "" },
       "customer": { "fullName": "", "email": "", "password": "" }
     }
   }
   ```

3. Conferir hostname: `experimente-plus.mahina.fun` resolve o tenant `experimente-plus`. O primeiro rótulo prevalece sobre `PUBLIC_TENANT_SLUG`; manter também o fallback alinhado quando utilizado. Configurar Drive `r2` com sua base pública válida. O comando grava ilustrações originais no disco configurado e não migra/apaga objetos antigos. Para `fs`, o storage precisa ser gravável e compartilhado com o processo HTTP.
4. Configurar `PAYMENT_PROVIDER=stripe`, `STRIPE_ENVIRONMENT=test`, `PAYMENT_ENVIRONMENT=test` e apenas os `PAYMENT_METHODS` efetivamente habilitados na conta, além dos segredos exigidos pelo runbook de compras. O comando valida a disponibilidade declarada antes de criar a base; não ativa meios de pagamento nem faz cobrança. Para simulação inteiramente local, `PAYMENT_PROVIDER=fake` e `PAYMENT_METHODS=pix,card` são aceitos em homologação. Nunca há fallback automático de Stripe para fake.
5. Na raiz do **artefato compilado**, com o ambiente apontando para o novo banco, executar:

   ```sh
   node ace.js homologation:provision --config=/run/private/provision.json
   ```

   No checkout TypeScript: `pnpm ace homologation:provision --config=/run/private/provision.json`. No container preparado, o JSON deve estar disponível por montagem privada somente leitura. Com o Compose do release revisado, conferir previamente que a imagem aprovada já existe no daemon (se faltar, interromper e preparar a imagem pela esteira). Executar sem `--build`, sem subir o HTTP e sem buscar outra imagem:

   ```sh
   docker compose -f docker-compose.vps.yml run --rm --no-deps --pull never \
     --user "$(id -u):$(id -g)" \
     --volume /run/private/provision.json:/run/private/provision.json:ro \
     app node ace.js homologation:provision --config=/run/private/provision.json
   ```

   Os caminhos de montagem resolvem no **host do daemon Docker**. O UID escolhido deve possuir o arquivo `0600`; com R2, não precisa gravar no volume de storage. Se usar fs, ajustar previamente a permissão do volume para esse UID. Conferir a imagem/release e o banco conforme passos 1–5 da recriação; o comando não seleciona nem recria banco. Esta instrução não autoriza executar o procedimento sobre a base antiga.
6. Conferir exit 0 e o recibo `created: true`, IDs de tenant, três contas, dois estabelecimentos, duas edições, quatro ofertas e um acesso de cortesia. Verificar login das três contas, descoberta anônima, imagens e vitrine. Apagar a cópia temporária do JSON após armazenar as credenciais no cofre. Não enviar sua saída sensível a terceiros; o comando emite apenas recibo sem e-mails/senhas.

### Conteúdo, idempotência e recuperação

- Um tenant nomeado pelo operador; Norte do Paraná, Londrina, família Comer & Beber e categoria demonstrativa.
- Uma organização fictícia e duas fichas publicadas: Casa de Petiscos e Ateliê do Café, explicitamente identificadas como demonstração. Contatos públicos são fictícios, não credenciais. Duas ilustrações originais PNG 1200×800; sem fotografias ou direitos de terceiros.
- Um administrador global `admin` com membership owner do tenant/organização; parceiro global `user` com membership admin da organização; consumidor global `user`, membro do tenant. Não cria root e não marca e-mail como verificado sem verificação.
- Cortesia gratuita com duas ofertas e um acesso do consumidor. Pacote Londrina de 4990 centavos BRL com duas ofertas, cada uma comprável avulsa por 1490 centavos. Venda começa um dia antes do provisionamento e termina três meses depois; uso começa um dia antes e termina oito meses depois. São janelas independentes, fixadas na criação; a reexecução não prorroga campanha.
- Não cria compras pagas nem acesso provisório. Comprar pacote/avulso pela API; com fake, `node ace.js purchases:simulate <id-da-compra>` confirma e reconcilia a simulação. Com Stripe, usar o sandbox e `node ace.js purchases:process`/webhook conforme runbook de compras. Pagamento confirmado concede acesso pelo domínio existente.
- Valida completude real das fichas e registra revisão, composição, moderação explícita do material conhecido, eventos e ponteiro publicado na mesma transação que as identidades/benefícios. O trigger existente constrói a projeção pública. Objetos do Drive são enviados antes da transação; falha pode deixar somente objetos demonstrativos sem referência, em chave com SHA-256 reutilizável.
- Lock advisory transacional por slug serializa inicializações concorrentes. `audit_logs`, ação `homologation.provision.v1`, guarda o recibo sem credenciais na mesma transação. Reexecutar com as mesmas identidades retorna `created: false` e o recibo original; não troca senha, publica novamente, concede nova cortesia, restaura cota, reativa conta ou altera termos pagos. Mudanças de identidade e tenant preexistente sem recibo são recusados; nunca adota/promove uma conta já existente.
- Se falhar antes do commit, corrigir a configuração/infraestrutura e repetir com o mesmo JSON. Se o terminal cair após o commit, a reexecução reconhece o recibo. Perda da senha é resolvida pelo cofre/recuperação normal de conta, não reexecutando provisionamento. Não apagar o recibo para tentar forçar execução. Novas campanhas e alterações posteriores seguem a administração normal; o comando não é sincronizador nem ferramenta de restauração.

Esse procedimento não modifica a restrição do `development_seeder`. A exceção de recriação da baseline não autoriza levar suas contas determinísticas à internet.
