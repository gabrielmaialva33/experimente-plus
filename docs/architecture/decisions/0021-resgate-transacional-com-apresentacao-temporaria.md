# ADR 0021 — Resgate transacional com apresentação temporária

**Status:** aceito  
**Data:** 28 de agosto de 2026  
**Marco:** EP-11 — Apresentação e resgate

## Contexto

O EP-10 introduziu acesso persistente à edição e carteira derivada. Um benefício disponível ainda precisava atravessar o último trecho operacional: ser apresentado pelo consumidor, conferido pelo estabelecimento e convertido em um registro permanente sem permitir reutilização indevida.

Materializar benefícios derivados, QR Codes ou sessões em tabelas permanentes aumentaria o volume e criaria entidades sem valor histórico. O fato comercial relevante é o resgate concluído. A apresentação existe apenas por poucos minutos para transportar uma intenção assinada entre dois dispositivos.

## Decisão

### Um único agregado permanente

O EP-11 adiciona somente `benefit_redemptions` como registro permanente. Cada resgate preserva:

- operação;
- acesso, edição, oferta e estabelecimento;
- consumidor e usuário que validou;
- número sequencial do uso dentro do acesso/oferta;
- hash do token apresentado;
- código de comprovante;
- título, tipo e termos da oferta no momento do uso;
- data e hora do resgate.

Não existe tabela para cada benefício da carteira e não existe tabela de QR Code.

### Apresentação temporária

O consumidor solicita uma apresentação para uma oferta disponível. O servidor emite um token HMAC com validade de cinco minutos contendo somente:

```text
versão
tenant_id
access_id
offer_id
user_id
nonce
issued_at
expires_at
```

O QR Code contém um link para a tela autenticada de validação do parceiro. A assinatura impede alteração do conteúdo; a expiração limita o tempo de exposição; o hash único persistido no resgate impede replay.

O token não autoriza o benefício sozinho. Ele apenas identifica uma apresentação que ainda deve ser confirmada por um usuário autorizado da organização proprietária do estabelecimento.

### Validação no servidor

Antes de apresentar, visualizar ou concluir um resgate, o servidor verifica novamente:

- tenant do token e da requisição;
- titular do acesso;
- acesso ativo;
- edição publicada e dentro da validade;
- oferta ativa e vinculada à mesma edição;
- unidade ativa, publicada e não encerrada permanentemente;
- dia da semana e horário local da cidade;
- janela opcional da oferta;
- membership e capacidade do parceiro;
- limite de resgates por acesso e oferta;
- uso anterior do mesmo token.

A confirmação bloqueia o acesso e a oferta durante a transação, calcula o próximo número de uso e cria o resgate. Constraints únicas protegem token, comprovante e sequência mesmo diante de requisições concorrentes.

### Histórico e comprovante

Consumidor e parceiro recebem projeções do mesmo registro. O consumidor acessa seu histórico privado; o parceiro acessa apenas resgates de unidades pertencentes à sua organização.

Os termos essenciais são copiados para o resgate para que alterações futuras da oferta não modifiquem o comprovante emitido.

## Consequências

### Positivas

- fecha o fluxo comercial sem criar entidades artificiais;
- QR Code curto e descartável;
- replay bloqueado por assinatura, expiração, lock e unicidade;
- limites maiores que um uso continuam suportados;
- comprovante consistente para consumidor e parceiro;
- checkout permanece desacoplado.

### Custos

- o parceiro precisa estar autenticado ao confirmar;
- o token não possui código humano curto, pois isso exigiria armazenamento temporário adicional;
- a câmera nativa abre o link do QR; o fallback web aceita colar o link ou token;
- cancelamento/estorno de resgate exige decisão futura e não é permitido neste corte.

## Fora de escopo

- pagamento e reembolso;
- transferência de acesso;
- dispositivos confiáveis;
- geolocalização obrigatória;
- motor genérico de antifraude;
- resgate offline;
- cancelamento ou edição de resgate;
- tabela permanente de QR Codes ou benefícios derivados.

## Cenários obrigatórios

- token adulterado ou expirado é recusado;
- parceiro de outra organização não visualiza o consumidor nem o benefício;
- replay não cria segundo resgate;
- duas confirmações concorrentes não ultrapassam o limite;
- horário, status e limite são reavaliados no momento da confirmação;
- consumidor acessa somente seus comprovantes;
- parceiro acessa somente histórico das próprias unidades;
- carteira deixa de apresentar benefício esgotado;
- migration sobe e reverte em banco limpo.
