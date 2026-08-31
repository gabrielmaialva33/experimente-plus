# 13 — Benefícios controlados

## Objetivo

Adicionar a primeira camada comercial utilizável pelo cliente sem desmontar o catálogo gratuito nem antecipar pagamento e QR Code.

O corte EP-09A entrega:

```text
Administrador cria uma edição
        ↓
Define cidade, validade e preço de referência
        ↓
Parceiro vincula uma oferta a uma unidade publicada
        ↓
Oferta é validada e ativada
        ↓
Administrador publica a edição quando existe oferta ativa
```

## Escopo funcional

### Administração

- listar, criar e consultar edições;
- editar uma edição ainda controlável;
- publicar quando houver oferta ativa;
- pausar e retomar uma edição;
- arquivar sem apagar histórico;
- visualizar cidade, validade, preço e quantidade de ofertas.

### Parceiro

- listar ofertas de uma unidade própria;
- criar uma oferta para uma edição compatível;
- informar modalidade, descrição e termos;
- limitar dias, horário, período, reserva e consumo presencial;
- ativar, pausar e arquivar;
- não acessar unidades ou ofertas de outra organização.

## Regras centrais

- catálogo público continua útil sem compra;
- cidade não se torna tenant;
- uma edição pode abranger uma cidade por vez neste primeiro corte;
- uma organização pode participar de várias edições e cidades por meio de suas unidades;
- apenas unidade publicada participa;
- a unidade deve estar na cidade da edição;
- uma unidade possui no máximo uma oferta por edição;
- termos ativos não são editados silenciosamente: a oferta precisa ser pausada;
- preço da edição é referência comercial; checkout ainda não existe.

## Fora deste corte

- pedido e pagamento;
- concessão de acesso;
- carteira do consumidor;
- benefício calculado na carteira;
- QR Code;
- resgate e antifraude;
- reembolso;
- exposição pública de benefícios.

Esses itens serão implementados sobre a fundação de edição e oferta, em vez de duplicar regras em páginas ou integrações.

## Definition of Done

- migrations com integridade cross-tenant;
- models, repositories, services, validators e controllers modulares;
- RBAC e policy de organização aplicados;
- API administrativa de edições;
- API do parceiro para ofertas;
- telas responsivas de operação inicial;
- regressões funcionais para autorização, estados e regras comerciais;
- lint, typecheck, testes e build verdes em Node 24.
