# 16 — Piloto operacional

## Objetivo

Validar o ciclo ativo do Experimente+ com dados fictícios, três perfis separados e observação direta da experiência antes de ampliar monetização ou escopo.

O piloto deve responder:

- o consumidor entende a carteira e as regras antes de apresentar o benefício;
- o parceiro consegue conferir titular, unidade e oferta antes da confirmação;
- os dois lados recebem o mesmo comprovante permanente;
- a operação enxerga edições, ofertas e acessos sem depender de consultas técnicas;
- as fricções observadas geram backlog priorizado por evidência.

## Ambiente reproduzível

Em desenvolvimento, `pnpm ace db:seed` cria dados inteiramente fictícios:

- uma operação regional;
- catálogo em Londrina, Cornélio Procópio e Bandeirantes;
- estabelecimentos publicados em três categorias;
- edições e ofertas ativas em Londrina e Cornélio Procópio;
- perfis distintos de administrador, parceiro e consumidor;
- dois acessos ativos na carteira do consumidor.

As credenciais locais estão documentadas no `README.md` e podem ser substituídas pelas variáveis `DEV_ADMIN_*`, `DEV_PARTNER_*` e `DEV_CUSTOMER_*`.

## Roteiro assistido

### Consumidor

1. Entrar com o perfil de consumidor.
2. Abrir **Minha carteira**.
3. Conferir as duas cidades, estabelecimentos, regras e usos restantes.
4. Abrir **Usar benefício** e confirmar QR, validade de cinco minutos e cópia do link.
5. Apresentar o link ao parceiro.

### Parceiro

1. Entrar com o perfil de parceiro em outro dispositivo ou sessão.
2. Abrir o link apresentado pelo consumidor.
3. Conferir titular, estabelecimento, edição, regras e uso restante.
4. Confirmar a utilização.
5. Registrar o código do comprovante e encontrá-lo no histórico do Portal.

### Consumidor após confirmação

1. Abrir **Benefícios utilizados**.
2. Encontrar o mesmo código emitido ao parceiro.
3. Abrir o comprovante e conferir as regras preservadas no momento da utilização.
4. Voltar à carteira e confirmar que a oferta esgotada não possui nova ação de uso.

### Operação

1. Entrar com o perfil administrativo.
2. Abrir **Edições e benefícios**.
3. Conferir as duas edições publicadas, suas ofertas ativas e acessos ativos.
4. Abrir a gestão de acessos de cada edição.

## Smoke local de 31 de agosto de 2026

O roteiro foi percorrido em Chromium contra PostgreSQL e Redis locais após uma instalação limpa do schema.

Resultados observados:

- catálogo regional: 3 estabelecimentos publicados;
- carteira: 2 edições, 2 ofertas disponíveis e 2 acessos;
- apresentação: QR gerado, validade inicial de `4:59` e cópia do link confirmada;
- parceiro: titular e regras conferidos antes da confirmação;
- comprovante: mesmo código visível no Portal e no histórico do consumidor;
- termos: preservados e exibidos no comprovante;
- backoffice: 2 edições publicadas, cada uma com 1 oferta e 1 acesso ativo.

Durante o smoke, o backoffice revelou uma projeção ausente de acessos que causava erro 500. A projeção foi corrigida e recebeu regressão funcional e de navegador.

## Evidência automatizada

- `tests/browser/benefits/redemption_flow.spec.ts` cobre consumidor → parceiro → consumidor;
- `tests/browser/benefits/admin_overview.spec.ts` cobre a projeção administrativa;
- `tests/functional/benefits/api_contract.spec.ts` cobre o contrato HTTP e os limites de organização;
- `tests/functional/benefits/redemptions.spec.ts` cobre expiração, replay, concorrência, privacidade e snapshots.

## Backlog orientado por evidência

### P1 — antes do piloto em dispositivo real

- eliminar os avisos de hidratação dos IDs internos do Radix no layout autenticado;
- validar leitura do QR pela câmera nativa em Android e iOS;
- validar carteira, Portal e comprovantes nas larguras móveis alvo;
- confirmar linguagem e tempo de decisão com pelo menos um consumidor e um parceiro.

### P2 — depois das primeiras sessões assistidas

- priorizar ajustes de texto, navegação e regras conforme dúvidas recorrentes;
- decidir se o parceiro precisa filtrar histórico por unidade e período;
- decidir se a operação precisa exportar acessos e resgates;
- só então avaliar checkout, assinatura ou códigos promocionais.

## Critério de avanço

O próximo corte comercial só deve ser iniciado quando:

- nenhuma falha P0/P1 bloquear a jornada;
- consumidor e parceiro concluírem o fluxo sem intervenção técnica;
- regras e comprovante forem compreendidos pelos dois perfis;
- o backlog estiver ordenado por frequência e impacto observados.
