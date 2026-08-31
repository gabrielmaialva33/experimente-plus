# ADR 0020 — Acesso à edição e carteira derivada

**Status:** aceito  
**Data:** 27 de agosto de 2026  
**Marco:** EP-10 — Experimente+ Pass

## Contexto

O EP-09 introduziu edições comerciais e ofertas vinculadas a estabelecimentos publicados. Ainda era necessário representar quem possui o direito de utilizar uma edição e como esse direito aparece ao consumidor.

Criar um registro para cada combinação entre consumidor e oferta multiplicaria dados sem acrescentar uma verdade de negócio. Uma edição com 170 ofertas e mil compradores produziria 170 mil linhas antes de qualquer utilização.

Pagamento ainda não faz parte da primeira entrega. Mesmo assim, a operação precisa conceder acessos manualmente, testar cortesias e apresentar uma carteira real antes de escolher checkout e adquirente.

## Decisão

### Acesso é o direito persistente

`BenefitAccess` representa o direito de um usuário da operação utilizar uma edição.

Cada acesso pertence a:

- uma operação (`tenant`);
- uma edição;
- um usuário com membership na mesma operação.

Estados de uma linha:

```text
active → revoked
```

Uma nova concessão após revogação cria outra linha. O histórico anterior permanece imutável e uma restrição única parcial garante no máximo um acesso ativo para `tenant + edition + user`.

Fontes aceitas:

```text
manual
courtesy
payment
promo_code
migration
```

`payment` exige uma referência externa. A combinação `tenant + source + external_reference` é única quando a referência existe, impedindo que o mesmo evento externo seja processado duas vezes.

O acesso registra quem concedeu, quando concedeu, observações internas e, quando aplicável, quem revogou, quando revogou e o motivo.

### Regras de concessão

- somente administrador da operação concede ou revoga;
- a edição precisa estar publicada ou pausada e ainda não pode ter expirado;
- edição em rascunho ou arquivada não recebe acessos;
- o titular precisa pertencer ao mesmo tenant;
- a relação entre usuário e tenant também é protegida por chave estrangeira composta para `user_tenants`;
- concessão repetida enquanto existe acesso ativo é recusada;
- revogação preserva a linha e permite uma nova concessão futura.

### A carteira é uma projeção

A carteira é calculada em tempo de leitura:

```text
acesso ativo
  + edição publicada ou pausada
  + ofertas da edição
  + estado e janela temporal da oferta
  = benefícios apresentados ao consumidor
```

O benefício mostrado na interface não possui tabela própria. Sua chave deriva de `access_id + offer_id`.

Estados derivados:

```text
upcoming
available
outside_schedule
paused
expired
revoked
redeemed
```

`redeemed` é acrescentado pelo domínio de resgate quando o limite de utilizações da oferta é alcançado.

### Visibilidade e autorização

- o consumidor só lê acessos vinculados ao próprio `user_id`;
- a carteira exige autenticação e tenant resolvido por membership;
- a leitura da própria carteira não depende de permissão administrativa;
- a administração usa o recurso RBAC `benefit_accesses`;
- e-mail, observações e origem da concessão aparecem somente no backoffice;
- carteira e APIs privadas usam `noindex, nofollow` e `Cache-Control: private, no-store`.

## Consequências

### Positivas

- o piloto comercial funciona antes do checkout;
- o volume cresce por comprador, não por comprador multiplicado por ofertas;
- benefícios refletem automaticamente pausas, validade e mudanças autorizadas;
- concessões, revogações e reprocessamentos externos permanecem auditáveis;
- pagamento pode conceder o mesmo agregado sem alterar a carteira.

### Custos

- a carteira exige uma projeção com edição, oferta e estabelecimento;
- o histórico mantém múltiplas linhas quando o acesso é revogado e concedido novamente;
- concessões manuais ainda dependem do backoffice.

## Cenários obrigatórios de teste

- somente administrador concede e revoga;
- usuário fora do tenant é recusado;
- edição indisponível ou expirada é recusada;
- apenas um acesso ativo por usuário e edição;
- referência externa de pagamento não pode ser repetida;
- revogação preserva histórico e permite uma nova linha ativa;
- carteira mostra somente acessos do usuário autenticado;
- carteira deriva corretamente os estados temporais;
- páginas administrativas e consumidoras respeitam cache privado e noindex.
