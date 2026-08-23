# ADR-0004 — Publicação versionada e máquinas de estado

- **Status:** Aceito
- **Data:** 2026-08-22
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** D-009, D-012; ADR-0003; EP-03, EP-05

## Contexto

Parceiros precisam atualizar endereço, horários, categorias, contatos, atributos e mídia. Ao mesmo tempo, conteúdo público deve ser moderado e uma alteração ainda não aprovada não pode modificar imediatamente uma ficha publicada.

Um único campo `status` no estabelecimento também não consegue representar corretamente:

- workflow de revisão;
- suspensão administrativa;
- fechamento temporário;
- fechamento permanente;
- histórico de versões;
- edição de uma ficha ainda publicada.

A alternativa simples de retirar a unidade do ar sempre que o parceiro editar qualquer campo prejudicaria o negócio. Permitir edição direta da linha publicada quebraria a moderação.

## Decisão

A publicação de unidade será **versionada**. O estado administrativo da unidade, sua disponibilidade operacional e o workflow de conteúdo serão separados.

## Agregados e estados

### Organização

A organização possui um workflow próprio, porque sua elegibilidade bloqueia todas as unidades.

```text
draft
pending_review
changes_requested
active
rejected
suspended
archived
```

#### Transições

| De                  | Para                | Ator permitido             | Condição                  |
| ------------------- | ------------------- | -------------------------- | ------------------------- |
| `draft`             | `pending_review`    | owner/admin da organização | completude legal          |
| `pending_review`    | `active`            | Moderador/Admin            | análise aprovada          |
| `pending_review`    | `changes_requested` | Moderador/Admin            | correção possível         |
| `pending_review`    | `rejected`          | Moderador/Admin            | recusa fundamentada       |
| `changes_requested` | `pending_review`    | owner/admin                | correções concluídas      |
| `active`            | `suspended`         | Moderador/Admin            | motivo registrado         |
| `active`            | `archived`          | owner ou Admin             | encerramento confirmado   |
| `suspended`         | `active`            | Moderador/Admin            | motivo resolvido          |
| `suspended`         | `archived`          | Admin                      | encerramento/medida final |
| `rejected`          | `draft`             | Admin                      | reabertura excepcional    |
| `archived`          | `draft`             | Admin                      | restauração excepcional   |

CNPJ e identidade legal principal tornam-se imutáveis após ativação no fluxo normal. Correção excepcional exige ação administrativa auditada; troca de responsável legal pode demandar nova organização ou transferência formal.

### Unidade estável

A entidade `establishment` mantém identidade, organização proprietária e controles que não pertencem a uma revisão de conteúdo.

`lifecycle_status`:

```text
active
suspended
archived
```

Uma unidade pode estar `active` internamente sem aparecer em público, porque publicação também exige `published_revision_id`.

Transições:

| De          | Para        | Ator permitido                      |
| ----------- | ----------- | ----------------------------------- |
| `active`    | `suspended` | Moderador/Admin                     |
| `active`    | `archived`  | owner/admin da organização ou Admin |
| `suspended` | `active`    | Moderador/Admin                     |
| `suspended` | `archived`  | Admin                               |
| `archived`  | `active`    | Admin, após revalidação             |

### Disponibilidade da unidade

`business_status` descreve funcionamento, não moderação:

```text
open
temporarily_closed
permanently_closed
```

Transições:

| De                   | Para                 | Regra                               |
| -------------------- | -------------------- | ----------------------------------- |
| `open`               | `temporarily_closed` | parceiro autorizado ou Admin        |
| `temporarily_closed` | `open`               | parceiro autorizado ou Admin        |
| `open`               | `permanently_closed` | owner/admin da organização ou Admin |
| `temporarily_closed` | `permanently_closed` | owner/admin da organização ou Admin |
| `permanently_closed` | `open`               | Admin e nova revisão aprovada       |

`temporarily_closed` permanece visível com sinalização. `permanently_closed` sai da descoberta normal.

### Revisão pública da unidade

Conteúdo público fica em um agregado versionado `establishment_revision`.

```text
draft
pending_review
changes_requested
approved
rejected
```

Cada revisão possui número monotônico por unidade, autor, timestamps de submissão/revisão e decisão de moderação.

#### Transições

| De                  | Para                | Ator permitido     | Condição                  |
| ------------------- | ------------------- | ------------------ | ------------------------- |
| `draft`             | `pending_review`    | owner/admin/editor | requisitos de submissão   |
| `pending_review`    | `approved`          | Moderador/Admin    | requisitos de publicação  |
| `pending_review`    | `changes_requested` | Moderador/Admin    | motivo e campos pendentes |
| `pending_review`    | `rejected`          | Moderador/Admin    | motivo registrado         |
| `changes_requested` | `pending_review`    | owner/admin/editor | correções concluídas      |

`approved` e `rejected` são terminais e imutáveis. Uma nova tentativa após rejeição cria outra revisão, opcionalmente clonada da anterior.

## Regra de revisão ativa

Uma unidade pode ter no máximo uma revisão aberta, considerando:

```text
draft
pending_review
changes_requested
```

A constraint será implementada com índice único parcial ou mecanismo transacional equivalente no PostgreSQL.

Enquanto uma revisão está `pending_review`, o parceiro não edita seu conteúdo. O Moderador devolve como `changes_requested` antes de permitir alterações.

## Publicação

A unidade possui uma referência nullable para sua revisão publicada atual.

No primeiro publish:

1. lock da unidade e revisão;
2. revalidação dos gates do ADR-0005;
3. revisão muda para `approved`;
4. referência publicada aponta para a revisão;
5. projeção/cache público é atualizado ou invalidado;
6. ação de moderação e auditoria são registradas;
7. evento de domínio é emitido após commit.

Ao editar uma unidade já publicada:

1. o sistema clona a revisão publicada para uma nova `draft`;
2. o parceiro altera o novo rascunho;
3. a revisão anterior continua pública;
4. após aprovação, a referência publicada troca atomicamente;
5. a revisão anterior permanece histórica.

Nenhum campo de rascunho deve vazar pela projeção pública.

## Conteúdo ligado à revisão

Dados que afetam o que o visitante vê pertencem à revisão ou são versionados com ela:

- nome e descrições;
- endereço público e coordenadas;
- contatos públicos;
- categorias;
- atributos;
- horários e exceções;
- vínculos de mídia e imagem de capa;
- informações de acessibilidade;
- dados editoriais necessários ao catálogo.

Dados estáveis/administrativos permanecem na unidade:

- tenant;
- organização;
- ID;
- lifecycle status;
- business status;
- referência da revisão publicada;
- timestamps de criação e arquivamento.

A modelagem física poderá usar tabelas filhas com `revision_id`. JSON livre não substitui constraints de dados essenciais.

## Moderação

Toda decisão gera uma ação imutável contendo:

- ator;
- tipo de entidade;
- entidade e revisão;
- estado anterior e posterior;
- código de motivo;
- observação destinada ao parceiro quando aplicável;
- metadados internos separados;
- timestamp.

Solicitação de correção deve usar códigos de pendência estruturados, além de texto opcional.

## Mass assignment e concorrência

- status, IDs de revisão publicada, reviewer e timestamps administrativos nunca vêm de payload público;
- services de transição são a única forma de mudar estado;
- transições usam transaction e row lock;
- requests repetidos devem ser idempotentes quando possível;
- uma publicação concorrente não pode aprovar duas revisões abertas;
- optimistic version ou `updated_at` pode proteger edições concorrentes no rascunho.

## Alternativas consideradas

### Editar diretamente a linha publicada

Rejeitada. Permite vazamento de conteúdo sem moderação.

### Despublicar durante qualquer edição

Rejeitada. Uma correção pequena derrubaria uma ficha válida até nova análise.

### Manter tudo em uma linha com `pending_changes` JSON

Rejeitada como fonte principal. Dificulta constraints, diff, joins e evolução de categorias/horários.

### Usar somente histórico de auditoria

Rejeitada. Auditoria registra mudanças, mas não oferece snapshot aprovado para leitura pública.

## Consequências

### Positivas

- alterações seguras sem downtime da ficha;
- histórico e rollback explícitos;
- moderação consistente;
- read model público estável;
- estados deixam de misturar publicação e funcionamento.

### Custos

- mais tabelas e joins por revisão;
- clonar agregados requer service dedicado;
- publish é uma operação transacional complexa;
- telas precisam distinguir publicado, rascunho e pendências.

## Invariantes de teste

- rascunho nunca altera a ficha publicada;
- existe no máximo uma revisão aberta;
- partner não publica diretamente;
- revisão pendente não é editável;
- revisão aprovada/rejeitada é imutável;
- aprovação troca a revisão publicada atomicamente;
- suspensão da unidade ou organização remove a projeção pública, mesmo com revisão aprovada;
- `temporarily_closed` não despublica a ficha;
- transição inválida não altera nenhum estado;
- toda decisão de moderação possui registro auditável.
