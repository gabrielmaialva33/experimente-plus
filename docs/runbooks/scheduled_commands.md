# Comandos agendados

Três comandos do backend precisam rodar periodicamente. O repositório não os agenda: cada ambiente instala o próprio agendador. Este runbook descreve o que está instalado na VPS de homologação e serve de modelo para produção, onde vale o agendador que a infraestrutura do contratante usar (cláusula 2.3).

| Comando                  | Frequência               | Para quê                                                                                         | Runbook                                           |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `purchases:process`      | a cada minuto            | reconcilia notificações do PSP e executa comandos de compra (confirmação, cancelamento, estorno) | [compras](purchases.md)                           |
| `reports:notify-overdue` | de hora em hora (`:17`)  | avisa a equipe, uma única vez, de denúncias que passaram do prazo                                | [prazo de denúncias](content_report_deadlines.md) |
| `analytics:prune`        | diário, 03:30 (Brasília) | apaga linhas de analytics com retenção vencida                                                   | —                                                 |

Sem o primeiro, um pedido cancelado ou pago continua "pendente" para sempre: o app diz que o estado "é atualizado em instantes", e isso só acontece com o agendador ativo.

## Homologação (instalado em 26/09/2026)

Timers do systemd no host, rodando o comando dentro do container `app` em execução. O systemd não inicia uma execução enquanto a anterior do mesmo comando não terminou, e a saída vai para o journald.

`/etc/systemd/system/experimente-plus-ace@.service`, um modelo cuja instância é o nome do comando:

```ini
[Unit]
Description=Experimente+ ace %I
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/experimente-plus
ExecStart=/usr/bin/docker compose -f docker-compose.vps.yml exec -T app node ace.js %I
TimeoutStartSec=10min
```

Um timer por comando, cada um apontando para a sua instância:

```ini
# /etc/systemd/system/experimente-plus-purchases.timer
[Timer]
OnCalendar=*-*-* *:*:00
AccuracySec=5s
Unit=experimente-plus-ace@purchases:process.service

# /etc/systemd/system/experimente-plus-reports-overdue.timer
[Timer]
OnCalendar=*-*-* *:17:00
Persistent=true
Unit=experimente-plus-ace@reports:notify-overdue.service

# /etc/systemd/system/experimente-plus-analytics-prune.timer
[Timer]
OnCalendar=*-*-* 03:30:00 America/Sao_Paulo
RandomizedDelaySec=10min
Persistent=true
Unit=experimente-plus-ace@analytics:prune.service
```

Cada timer tem também `[Unit] Description=…` e `[Install] WantedBy=timers.target`.

### Operação

```sh
systemctl list-timers 'experimente-plus-*'                              # próxima e última execução
journalctl -u 'experimente-plus-ace@purchases:process.service' -n 20    # saída (só contagens)
systemctl start 'experimente-plus-ace@purchases:process.service'        # rodar agora
```

Um código de saída diferente de zero aparece como `Result=exit-code` em `systemctl status`. `purchases:process` sai com 1 quando adia algum comando e `reports:notify-overdue` quando um aviso não foi enviado; a execução seguinte tenta de novo.

Durante um deploy o container é recriado, e a execução daquele minuto falha por não encontrá-lo. Não há perda: os comandos de compra são duráveis e a próxima execução os pega.

Para uma janela de manutenção, como a recriação da baseline, pare os timers antes de parar o HTTP e religue-os depois:

```sh
systemctl stop 'experimente-plus-*.timer'
systemctl start experimente-plus-purchases.timer experimente-plus-reports-overdue.timer experimente-plus-analytics-prune.timer
```

Para remover: `systemctl disable --now 'experimente-plus-*.timer'`, apagar os quatro arquivos acima e `systemctl daemon-reload`.

Antes de instalar em outro ambiente, rode cada comando uma vez à mão e confira a saída, e siga as pré-condições do [prazo de denúncias](content_report_deadlines.md) (SMTP, `APP_URL` e membership da equipe).
