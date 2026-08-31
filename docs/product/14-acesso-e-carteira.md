# 14 — Acesso à edição e carteira do consumidor

**Estado:** implementado e validado em 27 de agosto de 2026

## Objetivo

Transformar uma edição publicada em uma experiência entregável a um consumidor real, mesmo antes do checkout.

O EP-10 entrega:

```text
Administrador seleciona uma edição disponível
        ↓
Concede acesso a um usuário da operação
        ↓
Usuário abre a carteira
        ↓
Sistema deriva os benefícios das ofertas
        ↓
Validade, pausas e horários aparecem sem materializar benefícios por consumidor
```

## Escopo funcional

### Backoffice

- listar acessos de todas as edições;
- localizar o titular pelo e-mail;
- conceder acesso manual, cortesia, pagamento, código promocional ou migração;
- exigir referência externa para pagamento;
- registrar observação interna;
- visualizar histórico ativo e revogado;
- revogar com motivo;
- conceder novamente sem apagar a linha anterior.

### Consumidor

- acessar `/wallet` autenticado;
- visualizar edições recebidas;
- compreender se cada benefício está futuro, disponível, fora do horário, pausado, expirado ou utilizado;
- consultar estabelecimento, modalidade, dias, horário e termos;
- usar a experiência adequadamente em celular, tablet e desktop.

## Regras centrais

- acesso não é pagamento;
- existe no máximo um acesso ativo por edição e usuário;
- somente membros da operação recebem acesso;
- edição em rascunho, arquivada ou expirada não recebe concessões;
- evento externo repetido não cria outro acesso;
- acesso revogado deixa de aparecer na carteira;
- nova concessão preserva o histórico revogado;
- oferta não gera um novo registro por comprador;
- o benefício visual é derivado de acesso mais oferta;
- a carteira nunca expõe observações internas ou dados de outros usuários;
- o catálogo gratuito continua independente da carteira.

## Fora deste corte

- checkout;
- pedido e cobrança;
- estorno financeiro;
- conciliação do provedor de pagamento.

Apresentação presencial, QR Code e resgate são tratados pelo EP-11 sobre esta fundação.

## Definition of Done

- migration com integridade para tenant, edição, usuário e membership;
- apenas um acesso ativo por usuário e edição;
- idempotência por referência externa;
- model, repository, service, validators e controllers modulares;
- permissões administrativas incrementais;
- gestão responsiva de acessos no backoffice;
- carteira responsiva e privada para o consumidor;
- benefícios derivados sem tabela física por consumidor;
- regressões de autorização, isolamento, estados, revogação e nova concessão;
- migrations, lint, typecheck, testes e build verdes em Node 24.
