# Tokens de funcionamento e ações do catálogo

A fonte dos valores é [`inertia/css/app.css`](../../inertia/css/app.css), em `:root` e `.dark`.
[`tailwind.config.css`](../../inertia/css/tailwind.config.css) expõe os mesmos papéis para a web.
O cliente móvel deve derivar as cores desses valores HSL, sem criar uma paleta própria.
Os tokens existentes são suficientes: nenhum token ou valor de cor novo foi necessário.

## Estado de funcionamento

Use o estado enviado pelo servidor. `business_status` é a situação operacional persistida;
`is_open_now` é calculado pelo PostgreSQL com timezone, horários e exceções da revisão publicada.
`business_status = open` não significa, sozinho, que a unidade esteja aberta neste instante.

Aplique esta ordem de apresentação, comum à grade e à ficha:

| Condição                                                                                       | Texto                     | Fundo            | Texto/ícone          | Borda             |
| ---------------------------------------------------------------------------------------------- | ------------------------- | ---------------- | -------------------- | ----------------- |
| `business_status = permanently_closed`                                                         | Encerrado permanentemente | `--muted`        | `--muted-foreground` | `--border`        |
| `business_status = temporarily_closed`                                                         | Fechado temporariamente   | `--warning-soft` | `--warning-accent`   | `--warning` a 30% |
| `business_status = open`, `availability_type = appointment_only`                               | Somente com agendamento   | `--info-soft`    | `--info-accent`      | `--info` a 25%    |
| `business_status = open`, `is_open_now = true`                                                 | Aberto agora              | `--success-soft` | `--success-accent`   | `--success` a 25% |
| `business_status = open`, `is_open_now = false`, disponibilidade regular ou contínua conhecida | Fechado agora             | `--muted`        | `--muted-foreground` | `--border`        |
| `business_status = open`, `is_open_now = false`, sem `availability_type`                       | Consulte o atendimento    | `--muted`        | `--muted-foreground` | `--border`        |

**Limite do contrato atual:** resultados da busca não incluem `availability_type`; a ficha inclui.
O cálculo retorna `false` para atendimento por agendamento, portanto a grade não pode distinguir
esse caso de fechamento pelo horário. Não invente essa informação, não derive horários no dispositivo
e não acrescente campo à API para aplicar esta apresentação. Na ficha, mostre agendamento explicitamente.

Fechamento permanente deixa de participar da descoberta e possui ficha histórica sem contatos.
O par neutro acima é a referência semântica para histórico, não autorização para recolocar essas unidades
na grade. Fechado não é erro de sistema: não use `--destructive` para fechamento regular ou histórico.
Cor complementa o texto; nunca deve ser a única indicação do estado.

Na web, [`EstablishmentStatus`](../../inertia/components/catalog/establishment_status.tsx) centraliza os
estilos e [`businessStatusLabel`](../../inertia/lib/catalog.ts) os rótulos. A grade preserva o estado
na descrição acessível do link. A ficha histórica conserva sua mensagem explícita de encerramento.

O valor é uma projeção, não telemetria ao vivo: a busca usa cache de até 60 segundos e a ficha de até
300 segundos no serviço de catálogo. A interface não recalcula a validade usando o relógio local.

## Hierarquia de ação

Na ficha web, destaque uma única ação disponível, nesta ordem de preferência:
WhatsApp → rota → telefone → site → agendamento externo. É uma regra de apresentação da web,
não uma regra de elegibilidade nem alteração do contrato de eventos.

| Papel visual             | Tokens canônicos                                                                   | Aplicação web                                              |
| ------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Conversão principal      | `--cta`, `--cta-foreground`; hover `--cta-accent`                                  | `Button variant="cta"`                                     |
| Conversões secundárias   | `--background`, `--foreground`, `--input`; hover `--accent`, `--accent-foreground` | `Button variant="outline"`                                 |
| Instagram e compartilhar | `--foreground`; hover `--accent`, `--accent-foreground`                            | `Button variant="ghost"`                                   |
| Marca e navegação        | `--primary`, `--primary-foreground`, `--primary-soft`, `--primary-accent`          | Cabeçalhos, links e navegação; não estado de funcionamento |
| Foco                     | `--ring`, `--background`                                                           | Anel e afastamento do foco nos controles                   |

`primary` mantém marca/navegação; `cta` mantém conversão. Não pinte todas as alternativas com o fundo
de CTA, nem use CTA para comunicar aberto/fechado. Preserve o tamanho de toque das secundárias.
As variantes já são definidas em [`button.tsx`](../../inertia/components/ui/button.tsx).

Rota, WhatsApp, telefone e site conservam seus links `/go/:city/:establishment/:action`, com
`route_click`, `whatsapp_click`, `phone_click` e `website_click` registrados no redirecionamento.
Compartilhamento conserva `share_click` após sucesso. Instagram e agendamento externo continuam links
diretos: esta mudança não acrescenta eventos nem os atribui artificialmente a outro canal.

## Referências de domínio

- [ADR-0013: disponibilidade](../architecture/decisions/0013-disponibilidade-categorias-e-atributos-de-unidade.md).
- [ADR-0016: projeção pública](../architecture/decisions/0016-catalogo-publico-projecao-e-resolucao-de-operacao.md).
- [ADR-0023: tokens herdados pelo cliente móvel](../architecture/decisions/0023-stack-e-navegacao-do-cliente-movel.md).
