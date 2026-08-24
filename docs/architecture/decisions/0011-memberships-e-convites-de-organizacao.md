# ADR-0011 — Memberships e convites de organização

- Status: Aceito
- Data: 23 de agosto de 2026
- Marco: EP-02 — Organizações e memberships

## Contexto

Uma organização pode ser administrada por várias pessoas com responsabilidades diferentes. O tenant representa a operação da plataforma, enquanto a membership da organização define quais empresas e unidades cada usuário pode administrar.

Convites precisam funcionar para usuários existentes e futuros sem persistir tokens brutos. A aceitação deve garantir membership na operação e na organização de forma atômica.

## Decisão

## Memberships

A tabela `organization_members` terá:

```text
id
tenant_id
organization_id
user_id
role
status
invited_by
joined_at
suspended_at
removed_at
created_at
updated_at
```

Papéis:

```text
owner
admin
editor
analyst
```

Status:

```text
active
suspended
removed
```

### Capacidades por papel

| Capacidade                     | owner |                 admin |           editor | analyst |
| ------------------------------ | ----: | --------------------: | ---------------: | ------: |
| Ler organização e membros      |   sim |                   sim |              sim |     sim |
| Editar contato e nome fantasia |   sim |                   sim |              não |     não |
| Editar conteúdo de unidade     |   sim |                   sim |              sim |     não |
| Submeter organização/unidade   |   sim |                   sim | sim para unidade |     não |
| Convidar owner/admin           |   sim |                   não |              não |     não |
| Convidar editor/analyst        |   sim |                   sim |              não |     não |
| Alterar papel de owner/admin   |   sim |                   não |              não |     não |
| Remover membros                |   sim | apenas editor/analyst |              não |     não |
| Ver analytics                  |   sim |                   sim |              sim |     sim |

Policies de domínio, e não apenas permissions globais, aplicam essa matriz.

### Invariantes

- `(organization_id, user_id)` é único;
- membership carrega `tenant_id` e referencia organização do mesmo tenant;
- usuário pode participar de várias organizações;
- organização criada por usuário recebe um owner ativo;
- organização com owner não pode ficar sem owner ativo por remoção, suspensão ou rebaixamento;
- o último owner não pode sair;
- owner não pode ser removido por admin;
- membership removida pode ser reativada por novo convite ou claim aprovado;
- remoção e suspensão preservam histórico;
- membership não concede role global.

## Convites

A tabela `organization_invitations` terá:

```text
id
tenant_id
organization_id
email
role
token_hash
invited_by
expires_at
accepted_by
accepted_at
revoked_by
revoked_at
created_at
updated_at
```

### Segurança do token

- token bruto é aleatório e possui alta entropia;
- somente HMAC do token é persistido;
- o segredo usa `ORGANIZATION_INVITATION_SECRET`, com fallback para `APP_KEY` apenas em desenvolvimento;
- token possui validade configurável;
- aceitar, revogar ou reenviar torna o token anterior inutilizável;
- token não aparece na serialização, log ou resposta administrativa;
- o token bruto é enviado somente por e-mail.

### Criação e reenvio

- owner pode convidar qualquer papel;
- admin pode convidar `editor` e `analyst`;
- não é possível convidar membro ativo com o mesmo e-mail;
- um novo convite para o mesmo e-mail revoga ou substitui o convite pendente anterior;
- e-mail é normalizado para lowercase;
- convite é tenant-scoped e organization-scoped;
- envio de e-mail ocorre após persistência;
- falha de e-mail não desfaz o convite, mas é reportada para permitir reenvio.

### Aceitação

A rota de aceitação exige autenticação, mas não exige tenant ativo:

```text
auth
→ HMAC do token
→ convite pendente e não expirado
→ e-mail da conta igual ao e-mail convidado
→ transaction
```

Dentro da transaction:

1. o convite é bloqueado para atualização;
2. a validade é conferida novamente;
3. membership no tenant é criada se não existir;
4. membership na organização é criada ou reativada;
5. papel do convite é aplicado;
6. convite é marcado como aceito.

A resposta informa o `tenant_id` para que o cliente possa trocar o tenant ativo e obter novos tokens.

## Onboarding na operação

O modo de cadastro passa a aceitar:

```text
none
personal
operation
```

No Experimente+ local e em produção, `operation` será o padrão:

- a operação pública é resolvida por `PUBLIC_TENANT_SLUG`/hostname;
- o usuário é anexado ao tenant como `member` na mesma transaction de criação da conta;
- o token inicial carrega essa operação como tenant ativo;
- nenhuma conta pública cria tenant pessoal;
- `.env.test` pode manter `personal` para preservar testes genéricos do template, com regressão específica para `operation`.

## Rotas privadas

### Organizações do usuário

```text
GET    /api/v1/organizations
POST   /api/v1/organizations
GET    /api/v1/organizations/:id
PUT    /api/v1/organizations/:id
POST   /api/v1/organizations/:id/submit
```

### Membros e convites

```text
GET    /api/v1/organizations/:id/members
PATCH  /api/v1/organizations/:id/members/:memberId
DELETE /api/v1/organizations/:id/members/:memberId
GET    /api/v1/organizations/:id/invitations
POST   /api/v1/organizations/:id/invitations
POST   /api/v1/organizations/:id/invitations/:invitationId/resend
DELETE /api/v1/organizations/:id/invitations/:invitationId
POST   /api/v1/organization-invitations/accept
```

### Claims

```text
POST /api/v1/organizations/:id/claims
GET  /api/v1/admin/organization-claims
POST /api/v1/admin/organization-claims/:id/approve
POST /api/v1/admin/organization-claims/:id/reject
```

## Permissions globais

Novos resources:

```text
organizations
organization_members
organization_invitations
organization_claims
```

Permissions globais expressam capacidade geral; policy expressa escopo e papel interno.

O papel `user` recebe capacidades necessárias para criar e administrar apenas organizações onde possui membership. `moderator` recebe leitura, revisão, aprovação e rejeição. `admin` e `root` mantêm capacidades globais mais amplas.

## Auditoria

Devem ser registrados:

- criação e submissão de organização;
- aprovação, solicitação de correção, rejeição, suspensão e restauração;
- convite, reenvio, aceitação e revogação;
- alteração de papel;
- suspensão e remoção de membership;
- criação, aprovação e rejeição de claim.

Logs nunca incluem token bruto, hash do convite ou CNPJ completo em metadata desnecessária.

## Alternativas rejeitadas

### Papel de parceiro em `user_roles`

Rejeitada. Não identifica qual organização o usuário administra.

### Convite pendente como membership

Rejeitada. Mistura usuário ainda inexistente com acesso efetivo e dificulta expiração.

### Token bruto no banco

Rejeitada. Vazamento do banco permitiria aceitar convites.

### Aceitação sem autenticação

Rejeitada. O sistema precisa vincular uma conta verificada e impedir que outra pessoa reutilize o link.

### Excluir membership fisicamente

Rejeitada. Remoção precisa preservar histórico e auditoria.

## Consequências

- o acesso é granular por organização;
- convites funcionam sem role global de Parceiro;
- novos usuários entram corretamente na operação pública;
- last-owner e reativação são invariantes explícitas;
- tokens de convite são revogáveis e não recuperáveis pelo banco;
- o frontend pode diferenciar portal do parceiro pela existência de membership.

## Cenários obrigatórios de teste

- owner é criado atomicamente com organização;
- usuário sem membership não lê organização privada;
- admin interno não convida owner/admin;
- owner convida todos os papéis;
- convite de membro ativo é rejeitado;
- convite expirado, revogado ou já usado é rejeitado;
- conta com e-mail diferente não aceita convite;
- aceitação cria membership no tenant e na organização;
- replay do convite é rejeitado;
- último owner não pode ser removido, suspenso ou rebaixado;
- admin não remove owner;
- membership removida pode ser reativada;
- token/hash não aparecem em respostas;
- falha de SMTP mantém convite e permite reenvio;
- rotas e queries não vazam outra organização ou tenant.
