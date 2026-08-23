# ADR-0001 — Tenant representa uma operação isolada

- **Status:** Aceito
- **Data:** 2026-08-22
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** D-005, D-006; EP-00

## Contexto

A fundação herdada possui `tenants`, `user_tenants`, tenant ativo no JWT e um middleware que resolve o tenant somente após autenticação e sempre verifica membership.

O Experimente+ precisa atender várias cidades e permitir que uma organização possua unidades em cidades diferentes. Também precisa oferecer catálogo público sem login. Tratar cidade ou estabelecimento como tenant causaria:

- fragmentação artificial de redes;
- membership obrigatório para navegação pública;
- duplicação de organização e usuários entre cidades;
- roteiros e descoberta regional mais difíceis;
- uso incorreto do tenant como categoria geográfica.

Ao mesmo tempo, manter tenant como conceito de infraestrutura é útil para uma futura operação white-label, franquia independente, ambiente institucional ou implantação isolada.

## Decisão

`tenant` representa uma **operação isolada da plataforma**.

No lançamento inicial haverá uma única operação Experimente+. Dentro dela existirão regiões, cidades, organizações, unidades, categorias e conteúdo.

```text
Tenant / operação
├── regiões
├── cidades
├── organizações
├── unidades
├── taxonomia
└── catálogo
```

### Regras de scoping

1. Toda entidade de produto que pertença a uma operação deve ter `tenant_id NOT NULL`.
2. Identidade, roles, permissions e trilhas globais da fundação continuam globais quando isso estiver explicitamente documentado.
3. FKs compostas ou validações equivalentes devem impedir relações entre registros de tenants diferentes.
4. Repositories privados recebem o `tenantId` explicitamente e aplicam o escopo em toda leitura e escrita.
5. IDs enviados pelo cliente nunca substituem o tenant resolvido pelo servidor.
6. Cidade não concede acesso e não participa da autorização.
7. Organização adiciona uma segunda camada de autorização por membership, sem substituir o tenant.

### Resolução em áreas privadas

Áreas privadas continuam usando o middleware existente:

```text
x-tenant-id válido e acessível
        ↓
tenantId do JWT
        ↓
primeiro tenant ativo do usuário
```

O middleware verifica membership e atividade. Operações privadas que dependem de operação devem usar `tenant({ required: true })`.

### Resolução no catálogo público

O catálogo público não usa o middleware de tenant autenticado.

Será criado um `PublicOperationResolver` com esta ordem:

1. hostname ou domínio mapeado para uma operação;
2. slug configurado em `PUBLIC_TENANT_SLUG` para a implantação de operação única;
3. falha explícita de configuração — nunca escolher silenciosamente “o primeiro tenant”.

O visitante não pode selecionar tenant por `x-tenant-id`, query string ou ID numérico. Cidade e categoria são filtros dentro da operação já resolvida.

### Linguagem do produto

- Banco e infraestrutura podem continuar usando `tenant`.
- Interfaces para usuários devem preferir **operação** quando o conceito precisar aparecer.
- O seletor genérico de workspace do template não deve ser exposto ao público como seletor de cidade.

## Alternativas consideradas

### Um tenant por cidade

Rejeitada. Redes seriam duplicadas, usuários precisariam participar de várias cidades e o catálogo regional ficaria fragmentado.

### Um tenant por organização ou estabelecimento

Rejeitada. Visitantes teriam de atravessar tenants para comparar opções e a plataforma perderia sua visão regional.

### Remover multi-tenancy

Rejeitada. A fundação já suporta isolamento e o conceito é útil para futuras operações independentes.

### Usar sempre o primeiro tenant ativo

Rejeitada. Em uma implantação com mais de uma operação, isso pode servir conteúdo do cliente errado e cria risco de vazamento.

## Consequências

### Positivas

- várias cidades coexistem na mesma operação;
- redes mantêm uma organização única;
- catálogo público funciona sem membership;
- expansão white-label permanece possível;
- autorização privada continua aproveitando a fundação existente.

### Custos

- será necessário um resolvedor público separado;
- todas as migrations de produto exigirão `tenant_id` e constraints de escopo;
- testes precisarão cobrir acesso cruzado entre operações;
- a UI de workspaces da fundação precisará ser adaptada ou escondida conforme o perfil.

## Invariantes de teste

- entidade de um tenant não referencia cidade, categoria, organização ou unidade de outro tenant;
- usuário sem membership não acessa endpoints privados da operação;
- visitante consulta conteúdo público sem autenticação;
- header `x-tenant-id` não altera a operação de uma rota pública;
- hostname desconhecido ou slug público ausente falha sem fallback ambíguo;
- desativar uma operação remove todo seu conteúdo do catálogo público.

## Impacto nas próximas migrations

EP-01 e os domínios posteriores devem usar `tenant_id` desde suas migrations `create_*`. A configuração e o resolver público serão implementados antes da primeira rota pública do catálogo.
