# ADR-0003 — Catálogo público sem membership

- **Status:** Aceito
- **Data:** 2026-08-22
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** D-003, ADR-0001; EP-06

## Contexto

A proposta principal do Experimente+ é descoberta gratuita. Exigir conta ou membership de tenant para listar cidades, pesquisar categorias ou abrir uma ficha reduziria aquisição, prejudicaria SEO e confundiria operação com geografia.

A fundação atual possui `tenant_middleware`, que pressupõe usuário autenticado e valida membership. Esse middleware é correto para áreas privadas, mas não para catálogo público.

O catálogo também precisa garantir que nenhuma alteração não aprovada, dado legal ou conteúdo suspenso seja exposto por engano.

## Decisão

O catálogo será uma superfície pública, somente leitura, sem autenticação e sem membership.

### Separação de rotas

Rotas públicas ficarão sob módulos e grupos explicitamente públicos, por exemplo:

```text
GET /api/v1/catalog/cities
GET /api/v1/catalog/cities/:citySlug/categories
GET /api/v1/catalog/cities/:citySlug/establishments
GET /api/v1/catalog/cities/:citySlug/establishments/:establishmentSlug
```

As URLs web canônicas serão definidas na implementação do catálogo, mas devem conter slugs humanos de cidade e unidade. IDs de tenant não fazem parte da URL pública.

Essas rotas:

- não usam `auth`;
- não usam `tenant_middleware`;
- usam `PublicOperationResolver` do ADR-0001;
- recebem throttle público;
- retornam apenas DTOs allowlisted.

### Predicate de visibilidade

Uma unidade só pode aparecer em listagem pública quando todas as condições forem verdadeiras:

```text
operação ativa
AND cidade ativa
AND organização ativa
AND unidade ativa
AND revisão publicada existente
AND ao menos uma categoria pública ativa
```

A mídia retornada deve estar aprovada. Conteúdo legal, administrativo, rascunhos, motivos internos e dados de membership nunca integram o DTO público.

### Disponibilidade operacional

`business_status` não se confunde com publicação:

- `open` — aparece normalmente;
- `temporarily_closed` — pode permanecer na ficha e resultados, claramente sinalizado, e nunca conta como “aberto agora”;
- `permanently_closed` — sai da descoberta normal; uma URL histórica pode retornar uma página mínima de encerramento, sem chamadas de conversão;
- unidade suspensa ou arquivada — não possui página pública acessível por conteúdo completo.

Essa distinção preserva histórico sem apresentar um negócio encerrado como opção ativa.

### Fonte dos dados públicos

O catálogo lê uma **projeção aprovada**. Alterações em rascunho não podem modificar a resposta pública antes de nova publicação.

O contrato mínimo da projeção inclui:

- IDs internos necessários ao servidor;
- slugs públicos;
- nome e descrição aprovados;
- cidade, endereço público e coordenadas;
- categorias e atributos públicos;
- horários aprovados;
- contatos públicos;
- mídia aprovada;
- estado operacional;
- timestamps de publicação e atualização pública;
- marcação explícita de patrocínio quando aplicável.

A forma física da projeção é decidida no ADR-0004: uma revisão aprovada é a fonte canônica, podendo gerar uma projeção/cache para consulta.

### DTOs allowlisted

DTO público é definido campo a campo. Não será usado `model.toJSON()` diretamente para entidades de organização, moderação ou unidade.

Campos proibidos incluem, entre outros:

- CNPJ e documentos;
- e-mail administrativo;
- IDs de membros;
- observações internas;
- motivos de rejeição não destinados ao parceiro;
- histórico de moderação;
- métricas privadas;
- arquivos não aprovados;
- IP, user agent ou dados de analytics.

### Cache

Respostas públicas podem ser cacheadas por:

```text
tenant público
cidade
categoria
filtros
página
idioma
versão da projeção
```

Publicação, suspensão, alteração de cidade/categoria e nova revisão aprovada invalidam as chaves relacionadas. O cache nunca torna um item suspenso permanentemente visível; a invalidação faz parte da mesma operação de mudança de estado ou de um evento confiável com retry.

A API JSON allowlisted e não personalizada pode manter cache público, variando por `Host` e pelas
dimensões de representação adicionadas pela pilha HTTP, como `Accept-Encoding`.

Nas páginas Inertia, somente o documento HTML inicial, anônimo e com status `200`, pode manter
`Cache-Control: public`. O mesmo HTML passa a ser `private, no-store` quando a renderização
compartilha usuário, e-mail, tenants ou permissões. Toda requisição com `X-Inertia` termina como
`private, no-store`, inclusive visitas completas, recargas parciais, incompatibilidade de versão
(`409`), redirects e erros. Respostas não `200` das rotas web cacheáveis também são `private,
no-store`.

O HTML cacheável varia por `Host`, `X-Inertia` e `Accept-Encoding`, com composição aditiva de
`Vary`. `Cookie` e `Authorization` não entram em `Vary`: respostas personalizadas não são
armazenáveis, em vez de multiplicarem chaves de cache por credencial.

Os cookies técnicos de sessão e CSRF criados automaticamente durante um GET são removidos somente
das respostas anônimas allowlisted que permanecerem públicas; o HTML do catálogo nesse conjunto não
contém formulário mutável. Qualquer outro `Set-Cookie` torna a resposta `private, no-store`; a
próxima resposta não cacheável emite um novo par de sessão e CSRF.

### Preview privado

Parceiros, Moderadores e Administradores poderão visualizar rascunhos por uma rota privada de preview. Preview:

- exige autenticação;
- exige tenant ativo;
- exige policy de domínio;
- usa `Cache-Control: no-store`;
- não é indexável;
- não compartilha URL com a ficha pública.

## Ranking e patrocinado

Resultados patrocinados devem ser identificados. A API deve expor `is_sponsored` ou metadado equivalente, e a UI deve apresentar o rótulo.

Patrocínio não altera:

- nota;
- selo de verificação;
- estado de publicação;
- elegibilidade;
- posição orgânica sem identificação.

O ranking orgânico e a estratégia de busca estão no ADR-0006.

## Alternativas consideradas

### Exigir login para todo catálogo

Rejeitada por aquisição, SEO e valor público.

### Reutilizar `tenant_middleware` sem usuário

Rejeitada. O middleware possui responsabilidade de membership; torná-lo ambíguo enfraqueceria segurança privada.

### Aceitar `x-tenant-id` em rotas públicas

Rejeitada. Permite enumeração e seleção arbitrária de operação por identificador interno.

### Serializar models completos e remover campos depois

Rejeitada. É mais seguro construir DTOs públicos allowlisted do que depender de exclusões crescentes.

## Consequências

### Positivas

- descoberta imediata e indexável;
- separação clara entre público e backoffice;
- menor risco de vazamento de dados privados;
- cache independente da autenticação;
- expansão para múltiplas operações por hostname.

### Custos

- resolvedor público próprio;
- DTOs e repositories específicos de catálogo;
- invalidação de cache ligada à publicação;
- testes de visibilidade para todas as combinações de estado.

## Invariantes de teste

- catálogo funciona sem cookie e sem bearer token;
- `x-tenant-id` é ignorado ou rejeitado em público;
- unidade pendente, rejeitada, suspensa ou sem revisão publicada não aparece;
- organização ou cidade inativa remove a unidade;
- mídia pendente/rejeitada não aparece;
- editar rascunho não altera ficha publicada;
- DTO público não contém CNPJ, memberships ou moderação;
- `temporarily_closed` aparece sinalizado e não passa em “aberto agora”;
- `permanently_closed` não aparece em busca normal;
- preview exige autorização e não usa cache público;
- somente HTML anônimo `200` mantém cache público nas páginas;
- HTML autenticado e toda resposta a `X-Inertia` usam `private, no-store`;
- recarga parcial, incompatibilidade de versão, redirect, `404` e demais erros de página não usam
  cache público;
- API pública não personalizada mantém cache público e mescla `Vary: Host, Accept-Encoding`.
