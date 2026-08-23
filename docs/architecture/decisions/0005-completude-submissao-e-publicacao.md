# ADR-0005 — Completude, submissão e publicação possuem gates explícitos

- **Status:** Aceito
- **Data:** 2026-08-22
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** ADR-0002, ADR-0004; EP-03, EP-04, EP-05

## Contexto

A especificação exige, no cadastro de parceiro, CNPJ, CEP, telefone, e-mail, categoria, horário e pelo menos uma foto. O produto também precisa funcionar para categorias diferentes, como restaurantes, cinemas e estúdios de tatuagem, cujas formas de atendimento não são idênticas.

Uma validação binária espalhada em controllers produziria inconsistência entre:

- checklist do parceiro;
- submissão;
- moderação;
- publicação;
- catálogo;
- testes.

Submeter para análise e publicar também são momentos diferentes. Uma foto pode estar enviada, mas ainda não aprovada; coordenadas podem ser geradas durante a moderação; uma categoria pode ser desativada entre a submissão e a aprovação.

## Decisão

A plataforma terá um serviço de domínio de **completude e elegibilidade** com dois gates distintos:

```text
SubmissionGate
PublicationGate
```

Os dois retornam resultado estruturado, nunca apenas `true/false`.

## Contrato do resultado

```text
eligible: boolean
score: 0..100
blocking_issues[]
warnings[]
checked_at
rules_version
```

Cada issue possui:

- código estável;
- domínio/campo afetado;
- mensagem traduzível;
- severidade;
- ação sugerida;
- metadados seguros quando necessários.

Exemplos:

```text
organization_not_active
city_inactive
address_missing
coordinates_missing
primary_category_missing
category_inactive
availability_missing
contact_channel_missing
cover_image_missing
media_not_approved
required_attribute_missing
unauthorized_submitter
```

Controllers e UI consomem esses códigos. Não devem duplicar as regras.

## Gate de submissão

Uma revisão pode ir de `draft` ou `changes_requested` para `pending_review` quando:

### Operação e autorização

- tenant está ativo;
- organização e unidade pertencem ao tenant ativo;
- usuário possui membership ativa;
- papel interno é `owner`, `admin` ou `editor`;
- unidade não está suspensa ou arquivada.

### Organização

- organização está `active`;
- CNPJ normalizado e validado existe;
- e-mail administrativo válido existe;
- telefone administrativo válido existe;
- dados obrigatórios da organização estão completos.

### Identidade pública

- nome público válido;
- descrição curta dentro dos limites definidos;
- slug candidato válido e disponível no escopo `(tenant, city)`;
- cidade ativa selecionada.

### Endereço e localização

Para unidade física:

- CEP válido;
- logradouro;
- número ou marcador explícito de “sem número”;
- bairro;
- cidade/UF coerentes com a entidade `city`;
- coordenadas podem estar pendentes de geocoding, gerando warning ou pendência operacional conforme o fluxo.

Negócios sem endereço físico, itinerantes ou de atendimento em domicílio permanecem fora da primeira vertical até regra específica ser aprovada.

### Categorias e atributos

- ao menos uma categoria ativa;
- exatamente uma categoria primária;
- todas as categorias pertencem ao mesmo tenant;
- atributos obrigatórios da categoria primária estão preenchidos;
- valores respeitam tipo, opções e cardinalidade.

### Disponibilidade

A unidade informa uma forma de disponibilidade:

```text
regular_hours
appointment_only
always_open
```

- `regular_hours` exige ao menos um intervalo semanal válido;
- intervalos do mesmo dia não podem se sobrepor;
- horário de abertura deve ser diferente do fechamento;
- funcionamento atravessando meia-noite é representado explicitamente pelo modelo, não por horário inválido;
- `appointment_only` exige canal de contato apto a agendamento externo;
- `always_open` é permitido apenas para categorias/policies que o aceitem.

Isso preserva o requisito de horário/funcionamento sem forçar um estúdio por agendamento a inventar uma grade.

### Contatos públicos

Ao menos um canal de ação público válido:

- telefone;
- WhatsApp;
- site;
- URL externa adequada à categoria.

E-mail público não é obrigatório quando o contato administrativo da organização não deve ser exposto.

### Mídia

- ao menos uma imagem vinculada à revisão;
- exatamente uma imagem candidata a capa;
- arquivo pertence ao mesmo tenant e foi enviado por ator autorizado;
- formato e tamanho são aceitos;
- mídia pode estar `pending` no momento da submissão.

## Gate de publicação

A aprovação reexecuta todas as regras do gate de submissão e acrescenta condições que só podem ser garantidas na análise.

### Estado

- organização continua `active`;
- cidade e categorias continuam ativas;
- unidade continua `active`;
- revisão está `pending_review`;
- não existe outra revisão publicada/aberta em conflito;
- reviewer possui permission válida.

### Localização

- latitude e longitude válidas existem para unidade física;
- coordenadas pertencem à área esperada ou foram confirmadas manualmente;
- endereço público foi revisado quanto a consistência.

### Mídia

- ao menos uma imagem está `approved`;
- exatamente uma capa aprovada;
- nenhuma mídia `quarantined` integra a revisão;
- mídia rejeitada é removida da composição pública ou bloqueia conforme a decisão do Moderador.

### Conteúdo

- não contém conteúdo proibido;
- campos obrigatórios por categoria foram validados;
- links e contatos são sintaticamente e operacionalmente aceitáveis;
- duplicidade foi revisada ou descartada;
- revisão não foi alterada após a análise começar.

### Publicação transacional

O `PublishEstablishmentRevisionService` deve, na mesma transaction:

1. adquirir locks da organização, unidade e revisão;
2. executar `PublicationGate` novamente;
3. marcar a revisão como `approved`;
4. trocar `published_revision_id`;
5. registrar ação de moderação e auditoria;
6. atualizar/inutilizar projeções e cache;
7. persistir outbox/evento de publicação quando adotado.

Se qualquer etapa falhar, a publicação inteira faz rollback.

## Score de completude

O score ajuda orientação e ordenação de tarefas, mas não substitui blockers.

Exemplo de pesos iniciais, a serem calibrados:

| Grupo                  | Peso |
| ---------------------- | ---: |
| organização elegível   |   15 |
| identidade pública     |   15 |
| endereço e localização |   20 |
| categoria e atributos  |   15 |
| disponibilidade        |   15 |
| contatos               |   10 |
| mídia                  |   10 |

Uma unidade com score alto ainda não é elegível se houver issue bloqueante.

O `rules_version` deve ser armazenado na submissão/moderação para explicar mudanças futuras na política.

## Warnings versus blockers

### Blocker

Impede submissão ou publicação:

- organização inativa;
- cidade inativa;
- sem categoria;
- endereço obrigatório ausente;
- sem disponibilidade;
- sem mídia;
- contato inválido;
- atributo obrigatório ausente;
- usuário sem autorização.

### Warning

Permite prosseguir, mas orienta qualidade:

- descrição curta demais, dentro do mínimo legal;
- poucas imagens;
- ausência de atributos opcionais;
- coordenadas automáticas com baixa confiança antes da publicação;
- contato secundário ausente;
- horário sem exceções de feriado cadastradas.

## Revalidação contínua

Publicação não torna a unidade permanentemente elegível.

Mudanças em dependências podem afetar visibilidade:

- desativar cidade;
- suspender organização;
- desativar categoria primária;
- remover imagem aprovada;
- marcar unidade como permanentemente fechada.

Essas ações devem atualizar o read model público imediatamente e criar pendência operacional quando cabível.

## Alternativas consideradas

### Validação apenas no formulário

Rejeitada. APIs, imports e mudanças administrativas poderiam ignorar a regra.

### Um campo booleano `is_complete`

Rejeitada. Não explica pendências, fica obsoleto e não diferencia submissão de publicação.

### Publicar usando a validação feita horas antes

Rejeitada. Cidade, categoria, mídia ou organização podem ter mudado desde a submissão.

### Exigir horário semanal de toda categoria

Rejeitada. Não representa adequadamente negócios por agendamento e outras modalidades.

## Consequências

### Positivas

- uma única fonte de verdade para checklist e backend;
- feedback estruturado ao parceiro;
- regras testáveis e versionadas;
- publicação resistente a race conditions;
- suporte multicategoria sem campos artificiais.

### Custos

- serviço de regras mais elaborado;
- necessidade de catálogo de issues e tradução;
- dependências precisam disparar revalidação/invalidação;
- score e regras exigem governança.

## Invariantes de teste

- controller não consegue submeter sem passar pelo gate;
- score 100 com blocker não aprova;
- `appointment_only` funciona sem intervalos semanais, mas exige contato;
- `regular_hours` rejeita intervalos sobrepostos;
- categoria desativada entre submissão e análise bloqueia publicação;
- mídia pendente permite submissão, mas não publicação;
- publicação sem coordenadas válidas falha para unidade física;
- usuário de outra organização não consulta nem aciona o gate privado;
- falha após mudança de status faz rollback integral;
- códigos de pendência são estáveis e não expõem dados internos.
