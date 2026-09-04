# 13 — Benefícios controlados

**Estado:** implementado e validado em 31 de agosto de 2026; permissões e experiência revisitadas em 4 de setembro de 2026.

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

## Fora do EP-09A

Entregues posteriormente pelos cortes EP-10 e EP-11:

- concessão de acesso;
- carteira do consumidor;
- benefício calculado na carteira;
- apresentação por QR Code;
- resgate transacional com proteções mínimas contra replay e uso acima do limite.

Permanecem fora do escopo atual:

- pedido e pagamento;
- antifraude genérico;
- reembolso;
- exposição pública de benefícios.

Essa evolução preserva a fundação de edição e oferta, sem duplicar regras em páginas ou integrações.

## Definition of Done

- migrations com integridade cross-tenant;
- models, repositories, services, validators e controllers modulares;
- RBAC e policy de organização aplicados;
- API administrativa de edições;
- API do parceiro para ofertas;
- telas responsivas de operação inicial;
- regressões funcionais para autorização, estados e regras comerciais;
- lint, typecheck, testes e build verdes em Node 24.
