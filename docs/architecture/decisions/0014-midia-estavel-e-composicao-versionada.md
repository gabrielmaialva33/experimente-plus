# ADR 0014 — Mídia estável e composição versionada por revisão

**Status:** aceito  
**Data:** 24 de agosto de 2026  
**Marco:** EP-04 — Mídia e completude

## Contexto

O domínio `files` já armazena bytes e metadados físicos por operação. Ele não conhece, porém, a finalidade do arquivo, a unidade à qual pertence, a composição de uma ficha, a imagem de capa, a ordem da galeria nem o estado de moderação.

Mídia pública também participa do conteúdo versionado da unidade. Quando uma ficha publicada recebe uma nova revisão, a composição publicada anterior precisa permanecer íntegra até que a nova revisão seja aprovada. Duplicar os bytes a cada revisão desperdiçaria armazenamento e dificultaria a remoção segura; associar o arquivo diretamente ao estabelecimento faria uma edição alterar silenciosamente o conteúdo publicado.

O primeiro corte precisa ainda resolver duas garantias diferentes do ADR 0005:

- no gate de submissão, uma imagem válida pode estar `pending` ou `approved`;
- no gate de publicação, deve existir exatamente uma capa `approved` e nenhuma mídia `quarantined` na composição.

## Decisão

### Separação entre armazenamento e semântica

O domínio `files` continua responsável pelo objeto físico:

- chave no storage;
- nome original;
- tamanho;
- MIME type;
- proprietário técnico;
- operação (`tenant_id`).

O domínio `media` adiciona significado e integridade de negócio. Ele não substitui o `files` nem expõe upload genérico como mídia pública.

### Asset estável

`media_assets` representa um asset validado e estável sobre um único registro de `files`.

O asset contém, no mínimo:

- `tenant_id`;
- `file_id`;
- tipo de mídia;
- extensão e MIME type normalizados;
- largura e altura;
- hash SHA-256 do conteúdo;
- autoria e timestamps.

O mesmo asset pode compor mais de uma revisão da mesma unidade sem duplicar os bytes. Um asset não pode ser associado a outra operação nem a outra unidade.

### Composição por revisão

`establishment_revision_media` associa o asset a uma revisão e contém:

- `tenant_id`;
- `revision_id`;
- `media_asset_id`;
- finalidade da mídia;
- indicador de capa;
- ordem;
- texto alternativo;
- legenda;
- estado de moderação;
- decisão, autoria e timestamps da revisão de mídia.

A composição pertence à revisão, não ao estabelecimento estável. Assim:

- editar um draft não altera a galeria publicada;
- uma nova revisão pode reutilizar os mesmos assets;
- remover mídia de uma revisão não remove associações históricas;
- o objeto físico só pode ser excluído quando não existir nenhuma associação restante.

### Estados de moderação

Os estados aceitos são:

```text
pending
approved
rejected
quarantined
```

Regras:

- upload de parceiro começa em `pending`;
- `approved` exige texto alternativo, revisor e timestamp;
- `rejected` e `quarantined` exigem motivo, revisor e timestamp;
- mídia `rejected` ou `quarantined` não pode ser capa;
- alterar bytes cria um novo asset, nunca reescreve o asset existente;
- alterar texto alternativo ou legenda de mídia aprovada retorna a associação para `pending`;
- ordem e seleção de capa não alteram a aprovação do conteúdo, desde que a mídia continue elegível;
- somente equipe global de moderação pode aprovar, rejeitar ou colocar em quarentena;
- decisões são registradas em histórico imutável de eventos.

### Capa e ordenação

Cada revisão pode possuir no máximo uma capa. O banco protege essa cardinalidade com índice parcial único.

A ordem é um inteiro não negativo e único dentro da revisão. A aplicação substitui a ordem completa dentro de transação, usando uma etapa intermediária para não colidir com a restrição durante a reorganização.

O EP-04 inaugura `rules_version = 2` para o relatório de completude. Revisões criadas sob essa versão incorporam os dez pontos reservados para mídia; snapshots e futuras submissões preservam a versão usada no cálculo.

No gate de submissão:

- deve existir ao menos uma imagem `pending` ou `approved`;
- deve existir exatamente uma capa entre as imagens elegíveis;
- nenhuma associação `quarantined` pode integrar a revisão.

No gate de publicação:

- deve existir exatamente uma capa `approved`;
- somente associações `approved` entram na projeção pública;
- `pending`, `rejected` e `quarantined` nunca aparecem publicamente.

### Formatos da primeira vertical

O EP-04 aceita somente:

```text
JPEG
PNG
WebP
```

A extensão, o MIME type e a assinatura binária devem concordar. A API extrai dimensões diretamente do cabeçalho, calcula SHA-256 e rejeita arquivos inválidos, dimensões fora do limite e conteúdo que exceda o limite configurado.

HEIC/HEIF permanece fora deste corte. A especificação funcional o menciona, mas conversão, compatibilidade pública, remoção de EXIF e pipeline de derivados ainda são decisões abertas. O backend deve responder com erro explícito, em vez de armazenar um arquivo que não possa compor a experiência pública de forma consistente.

SVG, GIF, documentos, áudio e vídeo não são aceitos pelo endpoint de mídia de unidade, mesmo que o upload genérico de `files` suporte outros formatos.

### Storage, transações e compensação

Banco de dados e object storage não compartilham uma transação distribuída. Portanto:

#### Upload

1. validar assinatura, MIME, dimensões, tamanho e autorização;
2. gravar o objeto físico com chave opaca e tenant-safe;
3. persistir `files`, `media_assets` e associação da revisão na mesma transação de banco;
4. se a transação falhar, apagar o objeto físico como compensação;
5. se a compensação falhar, registrar erro estruturado com a chave do órfão.

#### Exclusão

1. remover a associação dentro de transação;
2. se não existirem outras referências, remover asset e registro `files` dentro da mesma transação;
3. somente após o commit apagar o objeto físico;
4. se o storage falhar, manter o banco consistente e registrar o objeto órfão para reconciliação.

O sistema nunca apaga primeiro o objeto físico enquanto o banco ainda o referencia.

### Ownership e autorização

- `owner`, `admin` e `editor` da organização podem gerenciar a composição de uma revisão editável;
- `analyst` possui somente leitura;
- permissões globais não substituem a policy de organização;
- moderadores e administradores globais usam capabilities específicas de `media`;
- todas as consultas administrativas são escopadas por `tenant_id` e por estabelecimento;
- IDs de arquivo, asset, revisão e estabelecimento não são aceitos sem validação conjunta de ownership;
- estabelecimento arquivado e revisão não editável rejeitam operações comuns de parceiro.

### Limites da entrega

O EP-04 entrega:

- upload de imagem para revisão editável;
- listagem administrativa;
- metadados, capa e ordenação;
- exclusão segura;
- fila e decisão de moderação da mídia;
- projeção pública estreita que retorna apenas mídia aprovada da revisão publicada;
- integração com o relatório de completude.

O EP-04 não publica a revisão do estabelecimento. A submissão, a moderação integral da ficha e a troca transacional do ponteiro publicado permanecem no EP-05. O catálogo público completo permanece no EP-06.

## Integridade e isolamento

O banco deve garantir:

- FKs compostas com `tenant_id` para arquivo, revisão e asset;
- asset e revisão pertencentes ao mesmo estabelecimento;
- arquivo usado por no máximo um asset;
- uma associação por asset em cada revisão;
- no máximo uma capa por revisão;
- ordem única e não negativa por revisão;
- estados de moderação válidos;
- coerência entre estado, revisor, timestamp e motivo;
- imutabilidade do histórico de moderação;
- impossibilidade de associação cross-tenant e cross-establishment.

A aplicação complementa as constraints com mensagens de domínio claras e bloqueios transacionais da revisão.

## Consequências

### Positivas

- o conteúdo publicado não muda durante a edição;
- bytes podem ser reutilizados por revisões sem cópia;
- moderação e visibilidade tornam-se explícitas;
- capa, ordenação e acessibilidade possuem contrato único;
- falhas entre banco e storage deixam estados reconciliáveis;
- IDOR e referências cruzadas são bloqueados também no banco;
- o EP-05 pode compor o `PublicationGate` sem refazer a modelagem.

### Custos

- upload e exclusão exigem compensação;
- a aplicação precisa distinguir asset físico de associação versionada;
- remoção definitiva depende de contagem de referências;
- reordenação exige transação e bloqueio da revisão;
- suporte futuro a HEIC, derivados e análise automática exigirá pipeline próprio.

## Cenários obrigatórios de teste

- aceitar JPEG, PNG e WebP válidos;
- rejeitar extensão, MIME e assinatura divergentes;
- rejeitar arquivo corrompido, dimensões inválidas e tamanho excedido;
- impedir upload para revisão congelada ou estabelecimento arquivado;
- impedir arquivo, asset, revisão ou estabelecimento de outro tenant;
- impedir associação do asset a outra unidade;
- compensar objeto físico quando a persistência falhar;
- manter o banco consistente quando a remoção física falhar;
- permitir no máximo uma capa e ordem única;
- reordenar atomicamente;
- alterar metadados aprovados e retornar para `pending`;
- exigir motivo em rejeição e quarentena;
- impedir parceiro de moderar;
- impedir analista de alterar composição;
- preservar mídia da revisão publicada ao editar nova revisão;
- devolver publicamente somente mídia `approved` da revisão publicada;
- permitir submissão com mídia `pending` e bloquear publicação sem capa `approved`;
- impedir exclusão física enquanto houver outra associação ao asset;
- preservar histórico de decisões.

## Relações

- concretiza ADR 0002: mídia pertence à unidade, não à organização abstrata;
- segue ADR 0003: projeção pública não depende de membership;
- detalha ADR 0004: mídia integra conteúdo versionado;
- detalha ADR 0005: gates diferentes para mídia pendente e aprovada;
- segue ADR 0007: RBAC global com policy de domínio;
- complementa ADR 0012: composição pertence à revisão estável;
- complementa ADR 0013: completude passa a incluir mídia.
