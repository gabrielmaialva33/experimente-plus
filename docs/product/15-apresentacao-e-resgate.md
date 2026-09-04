# 15 — Apresentação e resgate

**Estado:** implementado em 31 de agosto de 2026 e validado para o piloto em 4 de setembro de 2026.

## Objetivo

Fechar o caminho demonstrável do Experimente+:

```text
Edição publicada
  → oferta ativa
    → acesso do consumidor
      → carteira
        → apresentação por QR
          → validação do parceiro
            → comprovante
```

## Experiência do consumidor

Na carteira, um benefício disponível possui a ação **Usar benefício**. A tela de apresentação:

- identifica edição, cidade, parceiro e oferta;
- mostra regras antes do uso;
- gera QR Code com link assinado;
- exibe contagem regressiva de cinco minutos;
- informa os usos restantes;
- permite renovar um código expirado;
- oferece cópia do link como fallback.

Depois da confirmação, o consumidor encontra o registro em **Benefícios utilizados** e pode abrir o comprovante.

## Experiência do parceiro

O parceiro pode abrir **Validar benefício** no Portal. O fluxo principal é ler o QR com a câmera nativa do celular, que abre a página já preenchida. Como fallback, a página aceita colar o link ou token.

Antes da confirmação são apresentados:

- nome e e-mail do titular;
- estabelecimento e edição;
- descrição e termos;
- usos realizados e restantes;
- exigência de reserva, consumo local e quantidade mínima de pessoas.

A confirmação cria o resgate em uma única transação. O parceiro recebe o mesmo código de comprovante do consumidor e pode consultar o histórico da unidade.

## Regras essenciais

- QR não é autorização permanente;
- apresentação expira em cinco minutos;
- token é assinado e não pode ser alterado;
- somente membro autorizado da organização valida;
- acesso, oferta, edição, unidade, horário e limite são reavaliados no servidor;
- token utilizado não pode ser reapresentado;
- cada uso recebe sequência e comprovante únicos;
- resgate é imutável neste primeiro corte;
- benefício esgotado permanece no histórico, não como botão utilizável.

## Definition of Done

- migration única de `benefit_redemptions`;
- apresentação assinada sem tabela de QR;
- ação de uso na carteira;
- confirmação autenticada no Portal;
- proteção contra adulteração, expiração, replay e IDOR;
- limite por acesso/oferta;
- comprovante para os dois lados;
- histórico do consumidor e da unidade;
- carteira atualizada após resgate;
- testes funcionais do caminho completo;
- lint, typecheck, testes, migrations e build verdes em Node 24.

## Próximos cortes possíveis

O fluxo já pode ser validado com acessos manuais e cortesias. Checkout, assinatura ou código promocional poderão criar o mesmo `BenefitAccess`, sem modificar a carteira ou o resgate.

Antes de ampliar o produto, a prioridade passa a ser:

```text
QA visual em dispositivos reais
→ seed regional de demonstração
→ roteiro de entrega ao cliente
→ integração de pagamento escolhida
```
