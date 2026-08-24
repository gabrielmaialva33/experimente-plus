# ADR-0013 — Disponibilidade, categorias e atributos efetivos da unidade

- **Status:** aceito
- **Data:** 23 de agosto de 2026
- **Marco:** EP-03 — Unidades, endereço, horários e atributos

## Contexto

O Experimente+ atende categorias muito diferentes. Um restaurante normalmente possui horários semanais; um estúdio pode trabalhar por agendamento; alguns serviços podem operar continuamente. Ao mesmo tempo, a taxonomia permite atributos definidos na categoria e herdados por descendentes.

Sem contratos centrais, cada formulário poderia interpretar horários, categorias e atributos de maneira diferente, produzindo fichas incompletas ou filtros públicos inconsistentes.

## Decisão

### Tipos de disponibilidade

Cada revisão declara um único `availability_type`:

```text
regular_hours
appointment_only
always_open
```

#### `regular_hours`

- exige ao menos um intervalo semanal;
- aceita múltiplos intervalos no mesmo dia;
- intervalos do mesmo dia não podem se sobrepor;
- abertura e fechamento não podem ser iguais;
- intervalo que cruza meia-noite é marcado explicitamente;
- dias sem registros são tratados como fechados.

#### `appointment_only`

- não exige horário semanal;
- exige ao menos um canal público adequado para agendamento;
- intervalos semanais, quando informados, são rejeitados para evitar semântica ambígua.

#### `always_open`

- não usa intervalos semanais;
- somente é permitido quando a categoria primária ativa possui `allows_always_open`;
- a policy de produto poderá restringir categorias adicionais sem alterar o schema.

### Exceções de agenda

Exceções pertencem à revisão e podem representar:

```text
closed
special_hours
```

- `closed` informa um período fechado e não possui horário;
- `special_hours` possui horário válido e pode cruzar meia-noite;
- início não pode ser posterior ao fim;
- conflitos e sobreposições são rejeitados no service;
- motivo é texto opcional e público apenas quando a projeção decidir expô-lo.

Essa escolha mantém o snapshot completo da disponibilidade dentro da revisão aprovada. Alterações emergenciais depois da publicação poderão receber uma camada operacional adicional em marco posterior, sem reescrever o histórico editorial.

### Categorias da revisão

Uma revisão pode possuir várias categorias ativas, mas:

- precisa de exatamente uma categoria primária para ficar estruturalmente completa;
- todas devem pertencer ao mesmo tenant;
- categorias inativas não podem ser adicionadas;
- duplicidades são proibidas;
- a categoria primária orienta requisitos, completude e apresentação principal;
- categorias secundárias ampliam descoberta e filtros, sem substituir os requisitos primários.

### Resolvedor de atributos efetivos

A aplicação terá um único `EffectiveCategoryAttributesService`.

Para cada categoria selecionada:

1. carrega a categoria e seu ancestral direto;
2. inclui definições ativas do ancestral somente quando `applies_to_descendants = true`;
3. inclui definições ativas da própria categoria;
4. uma definição direta sobrescreve a herdada quando utiliza a mesma `key`;
5. atributos efetivos da categoria primária têm precedência sobre chaves duplicadas vindas de categorias secundárias;
6. colisões incompatíveis de `data_type` são rejeitadas em vez de convertidas silenciosamente.

Somente atributos ativos entram no resolvedor. Opções inativas não são aceitas em novos valores.

### Persistência tipada

`establishment_attribute_values` mantém um valor por revisão e definição, com snapshot de `data_type`:

- `text`, `long_text` e `url` usam `text_value`;
- `boolean` usa `boolean_value`;
- `integer` usa `integer_value`;
- `decimal` usa `decimal_value`;
- `single_select` e `multi_select` usam opções em tabela associativa.

Constraints garantem que apenas a coluna compatível seja preenchida. O service garante:

- tipo igual ao da definição vigente;
- opção pertencente à definição;
- uma opção para `single_select`;
- uma ou mais opções para `multi_select` quando o valor existir;
- cardinalidade, limites e regras declaradas em `validation_rules`;
- remoção do registro quando o usuário limpa um campo opcional.

### Completude

O cálculo é centralizado e versionado (`rules_version = 1`). Ele retorna seções, score e blockers estáveis por código.

Para o EP-03, a completude estrutural cobre:

- organização e estados válidos;
- identidade pública;
- cidade e endereço;
- contato acionável;
- disponibilidade;
- categoria primária e categorias adicionais;
- atributos obrigatórios efetivos da categoria primária.

Mídia pertence ao EP-04. Enquanto não existir, o relatório pode indicar blockers de mídia de forma transparente, sem declarar a ficha pronta para submissão.

Controllers e frontend não reimplementam regras de completude, herança ou horário. Todos consomem os services de domínio.

## Integridade e isolamento

- horários, exceções, categorias e valores carregam `tenant_id`;
- todas as relações usam FKs compostas com revisão, categoria, definição e opção;
- exatamente uma categoria primária é protegida por índice parcial durante a edição; a obrigatoriedade é validada no gate;
- sobreposição de horários é validada dentro de transaction com a revisão bloqueada;
- revisão terminal não aceita alterações relacionadas;
- valores privados da taxonomia não entram em futuras projeções públicas quando `is_public = false`.

## Consequências

### Positivas

- diferentes modelos de operação cabem no mesmo domínio;
- regras não ficam duplicadas em formulários;
- herança de atributos passa a ter semântica determinística;
- filtros e completude usam o mesmo conjunto efetivo;
- valores inválidos são bloqueados na aplicação e, quando possível, no banco.

### Custos

- atualização de categorias pode invalidar valores previamente informados na revisão editável;
- o resolvedor precisa detectar colisões de chave;
- horários requerem validação transacional além das constraints;
- evolução das regras de completude exige versionamento explícito.

## Cenários obrigatórios de teste

- impedir horário com abertura igual ao fechamento;
- impedir sobreposição no mesmo dia;
- aceitar intervalo explicitamente atravessando meia-noite;
- impedir horários em `appointment_only` e `always_open`;
- impedir `always_open` quando a categoria primária não permite;
- exigir uma única categoria primária;
- impedir categoria, definição ou opção de outro tenant;
- herdar somente atributo com `applies_to_descendants`;
- sobrescrever atributo herdado pela chave na categoria filha;
- impedir opção pertencente a outra definição;
- validar `single_select` e `multi_select` separadamente;
- apontar atributos obrigatórios ausentes no relatório de completude.

## Relações

- detalha ADR-0005 — completude, submissão e publicação;
- depende de ADR-0009 — modelo físico de taxonomia;
- complementa ADR-0012 — estabelecimentos estáveis e revisões públicas.
