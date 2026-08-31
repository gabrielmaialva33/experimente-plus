# ADR 0019 — Edições e ofertas de benefício

**Status:** aceito  
**Data:** 26 de agosto de 2026  
**Marco:** EP-09 — Benefícios controlados

## Contexto

O catálogo, o portal do parceiro, a moderação e a descoberta pública já formam uma base operacional. A direção comercial da entrega passou a exigir uma camada semelhante à experiência de clubes regionais: uma edição com validade clara e ofertas vinculadas aos estabelecimentos participantes.

Essa evolução não substitui o catálogo gratuito nem reduz o Experimente+ a restaurantes ou a um clube de vouchers. A plataforma continua multicidade e multicategoria; benefícios são uma camada comercial opcional sobre estabelecimentos publicados.

Construir pagamento, carteira e QR Code antes de existir uma representação canônica de edição e oferta criaria acoplamento prematuro. O primeiro corte precisa registrar as regras comerciais e o vínculo com a unidade de forma segura, deixando acesso, apresentação e resgate para marcos subsequentes.

## Decisão

### Edição de benefício

Uma edição pertence a uma operação (`tenant`) e a uma cidade, mas cidade continua sendo dimensão de descoberta, não fronteira de autorização.

A edição registra:

- nome, slug e descrição;
- cidade atendida;
- preço de referência em centavos e moeda;
- janela opcional de venda;
- janela obrigatória de utilização;
- estado operacional;
- autoria e datas de publicação ou arquivamento.

Estados aceitos:

```text
draft → published → paused → published
  └────────────────────────────→ archived
```

Somente administradores da operação podem criar, editar, publicar, pausar ou arquivar uma edição. Uma edição só pode ser publicada quando possuir pelo menos uma oferta ativa.

### Oferta de benefício

Uma oferta pertence simultaneamente a:

- uma edição;
- um estabelecimento estável e publicado;
- uma operação.

Na primeira versão existe no máximo uma oferta por estabelecimento em cada edição. Essa restrição representa a unidade comercial apresentada ao consumidor sem materializar antecipadamente cada benefício disponível.

Tipos iniciais:

```text
buy_one_get_one
percentage
fixed_amount
complimentary_item
custom
```

A oferta registra título, descrição, termos, valor tipado quando aplicável, dias e horário de uso, janela opcional dentro da edição, necessidade de reserva, consumo presencial, tamanho mínimo do grupo e limite futuro de resgates por acesso.

Estados aceitos:

```text
draft → active → paused → active
  └──────────────────────→ archived
```

Uma oferta ativa pode existir enquanto a edição ainda está em rascunho, mas só poderá ser exposta ao consumidor quando a edição estiver publicada e dentro da janela de utilização.

### Autorização

- administração de edições usa RBAC da operação e exige administrador global;
- administração de ofertas combina permissão global com membership da organização dona do estabelecimento;
- owners, admins e editors da organização podem administrar ofertas da própria unidade;
- leitura e mutação de outra organização devem responder como recurso inexistente para evitar IDOR;
- nenhuma decisão de acesso é delegada ao React.

### Integridade

- chaves estrangeiras compostas preservam o mesmo `tenant_id` entre edição, cidade, oferta e estabelecimento;
- somente estabelecimento com revisão publicada pode receber oferta;
- a cidade da revisão publicada deve ser a mesma cidade da edição;
- percentuais e valores monetários são mutuamente exclusivos e validados pelo tipo;
- horários, datas e estados possuem checks no banco e validação no domínio;
- alteração de cidade da edição é bloqueada após existir qualquer oferta.

### Próximos agregados

Os próximos marcos poderão introduzir:

```text
Access / Pass
  + Offer ativa
  + ausência de Redemption
  = benefício disponível para apresentação
```

O benefício mostrado na interface será derivado desse estado. Não serão criados milhares de registros por consumidor no momento da compra. O registro transacional permanente será o resgate, protegido por unicidade e idempotência.

Pagamento, concessão de acesso, carteira, QR Code, antifraude e resgate não fazem parte deste ADR.

## Consequências

### Positivas

- cria o núcleo comercial sem comprometer o catálogo gratuito;
- mantém cidade separada de tenant;
- reutiliza organizações, estabelecimentos publicados e policies existentes;
- permite testar benefícios manualmente antes de pagamento e QR;
- prepara uma evolução segura para acesso, benefício calculado e resgate.

### Custos

- a oferta ativa ainda não representa direito de uso sem o futuro agregado de acesso;
- publicação da edição exige coordenação com parceiros;
- mudanças em uma oferta ativa exigem pausa para evitar alteração silenciosa de termos.

## Cenários obrigatórios de teste

- isolamento completo entre operações;
- apenas administrador cria ou publica edição;
- parceiro administra somente oferta de estabelecimento autorizado;
- estabelecimento não publicado é recusado;
- cidade da oferta precisa coincidir com a edição;
- edição sem oferta ativa não publica;
- tipo e valor do benefício permanecem coerentes;
- duplicidade de estabelecimento na mesma edição é recusada;
- estados inválidos e edição arquivada bloqueiam mutações.
