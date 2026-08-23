# ADR-0002 — Organização e unidade são agregados distintos

- **Status:** Aceito
- **Data:** 2026-08-22
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** D-007; EP-02, EP-03

## Contexto

A plataforma precisa representar desde um café independente até uma rede com várias unidades em cidades diferentes. O cadastro do parceiro exige dados legais como CNPJ, enquanto a descoberta pública precisa de endereço, horário, categorias, mídia e contatos de cada local.

Usar uma única entidade “parceiro” ou “estabelecimento” para tudo misturaria:

- identidade legal;
- equipe e propriedade;
- conteúdo público;
- localização;
- horários;
- estados de moderação;
- múltiplas unidades;
- métricas por local.

Também faria uma rede repetir CNPJ, membros e configurações a cada cidade.

## Decisão

A plataforma terá dois agregados distintos:

### Organização

Representa o responsável legal ou comercial.

Responsabilidades:

- nome legal e nome comercial;
- documento e dados de contato administrativo;
- estado de aprovação da relação com a plataforma;
- membros e papéis internos;
- propriedade das unidades;
- claim, transferência e convites futuros;
- configurações e billing futuros.

Dados legais e operacionais privados não fazem parte do catálogo público.

### Unidade (`establishment`)

Representa o local ou operação pública descoberta pelo usuário.

Responsabilidades:

- vínculo com uma organização;
- cidade e endereço;
- nome público, descrição e contatos;
- categorias e atributos;
- horários e disponibilidade;
- mídia;
- publicação, suspensão e histórico;
- ações e métricas por local.

Uma organização pode possuir zero ou várias unidades. Cada unidade pertence a exatamente uma organização e a exatamente uma cidade na primeira versão.

```text
Organization 1 ── N Establishment
Organization N ── N User (organization_members)
City 1 ── N Establishment
```

## Membership da organização

A autorização interna será representada por `organization_members` com papel explícito:

```text
owner
admin
editor
analyst
```

### `owner`

- controle total da organização;
- gerencia membros;
- transfere propriedade quando o fluxo existir;
- cria, edita, submete e arquiva unidades;
- acessa analytics.

### `admin`

- atualiza organização;
- gerencia membros sem transferir ou remover o último owner;
- cria, edita, submete e arquiva unidades;
- acessa analytics.

### `editor`

- lê organização;
- cria e edita unidades;
- administra horários, categorias, atributos e mídia;
- submete alterações;
- não gerencia dados legais sensíveis ou membros.

### `analyst`

- leitura das unidades;
- acesso a métricas permitidas;
- sem permissão de alteração.

Membership deve possuir estado ativo. Convites pendentes não concedem acesso.

## Ownership derivado

Uma unidade não terá `owner_id` apontando diretamente para um usuário como fonte primária de autorização.

O acesso é derivado por:

```text
usuário
  → membership ativa na organização
  → papel interno suficiente
  → organização é dona da unidade
  → todos os registros pertencem ao tenant ativo
```

Policies de domínio devem implementar esse caminho. O `OwnershipService` genérico da fundação não será usado para inferir ownership de organização ou unidade por uma coluna simples.

## Identidade pública e legal

- `organizations` pode conter razão social, CNPJ normalizado e contatos administrativos.
- `establishments` e suas revisões contêm nome e conteúdo público.
- o nome público de uma unidade pode diferir do nome legal da organização;
- uma organização pode operar marcas diferentes;
- CNPJ não será exposto por padrão no catálogo;
- alterar a identidade legal não deve ser tratado como edição comum de conteúdo público.

## Claim e duplicidade

O primeiro schema deve permitir acrescentar um fluxo de claim sem reestruturar o ownership.

A criação de organização e unidade não deve ignorar possíveis duplicidades. Antes de persistir ou submeter, o sistema poderá comparar:

- CNPJ normalizado;
- telefone;
- domínio/site;
- nome normalizado;
- endereço e coordenadas;
- identificadores externos futuros.

Detecção não implica merge automático. Casos ambíguos devem gerar revisão administrativa.

## Pessoa física e operações sem CNPJ

A especificação exige CNPJ válido para parceiro. O schema inicial não deve inventar suporte a pessoa física sem decisão de produto.

O agregado poderá ser estendido futuramente com `legal_entity_type`, mas a primeira implementação seguirá o requisito de CNPJ. Exceções exigirão novo registro em `docs/product/05-decisoes-e-pendencias.md` e revisão desta decisão, se necessário.

## Alternativas consideradas

### Uma tabela única para parceiro e unidade

Rejeitada. Mistura privacidade, ownership, localização e publicação, além de não atender redes adequadamente.

### Uma organização por unidade

Rejeitada. Duplica dados e torna equipes e redes difíceis de administrar.

### Usuário como dono direto da unidade

Rejeitada. Troca de equipe, transferência e administração por múltiplas pessoas ficariam frágeis.

### Parceiro como role global suficiente

Rejeitada. Uma role global não identifica qual organização o usuário pode administrar.

## Consequências

### Positivas

- redes e múltiplas cidades são naturais;
- dados legais ficam isolados do conteúdo público;
- memberships permitem equipe e transferência;
- analytics e campanhas podem operar por unidade ou organização;
- autorização fica explícita e testável.

### Custos

- mais tabelas e joins;
- policies de domínio obrigatórias;
- onboarding precisa separar organização e unidade;
- claim e duplicidade exigem fluxo operacional.

## Invariantes de teste

- uma unidade não existe sem organização e cidade do mesmo tenant;
- membro de uma organização não lê ou altera dados privados de outra;
- papel `analyst` não modifica conteúdo;
- `editor` não gerencia membros ou identidade legal;
- nenhum membro remove o último `owner`;
- dados legais não aparecem em DTOs públicos;
- uma organização pode ter unidades em cidades diferentes sem duplicação;
- remover membership revoga acesso imediatamente.

## Impacto nas próximas migrations

EP-02 criará `organizations` e `organization_members`. EP-03 criará `establishments` e dados públicos relacionados. As FKs devem carregar ou validar o mesmo `tenant_id`, e os índices devem apoiar consultas por organização, cidade e estado.
