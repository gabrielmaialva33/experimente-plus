# Prazo de moderação de denúncias

Toda denúncia recebe `due_at` pelo prazo da política da operação (ADR-0027). A fila do backoffice mostra quantas estão vencidas na operação e marca cada caso vencido. Este runbook trata do **aviso**: a mensagem que diz à equipe que um caso passou do prazo.

É observabilidade, não escalonamento. A moderação humana contínua depois da entrega está fora do contrato (Anexo I, item 9). O comando não reatribui casos, não insiste e não age sobre o conteúdo. Cada denúncia vencida é citada **uma única vez**.

## O comando

```sh
node ace.js reports:notify-overdue
```

No checkout TypeScript: `pnpm ace reports:notify-overdue`.

Para cada operação com denúncias abertas (`pending` ou `under_review`) vencidas e ainda não avisadas, o comando:

1. procura quem pode agir naquela fila — equipe de plataforma (root, admin, moderator) com membership na operação, conta ativa e sem banimento ali;
2. reivindica as denúncias numa transação curta, marcando `sla_notified_at`;
3. envia **uma** mensagem para a operação, com os destinatários em cópia oculta, citando protocolo, tipo, motivo, vencimento e atraso — nunca a identidade de quem denunciou nem o texto denunciado;
4. se o envio falhar, devolve a reivindicação, e a próxima execução tenta de novo.

Operação sem ninguém que possa agir não tem nada marcado: a marca significa "uma pessoa foi avisada", e fica em aberto até haver alguém. A saída do comando traz só contagens. Aviso não enviado termina com código 1, para o agendador perceber.

Duas execuções simultâneas não citam o mesmo caso duas vezes. A reivindicação é um único `UPDATE … WHERE sla_notified_at IS NULL`, e a segunda execução, ao esperar o lock da linha, encontra a marca já posta.

## Agendamento — o que o operador precisa acrescentar

O repositório não agenda comandos. `purchases:process` e `analytics:prune` seguem a mesma regra: rodam por um agendador do ambiente, que não é instalado automaticamente no piloto.

Na VPS de homologação, a partir do diretório do deploy (`/opt/experimente-plus`), uma entrada de cron do host que rode o comando **de hora em hora** atende o propósito. O prazo é contado em dias, então um intervalo menor não muda nada para quem lê o aviso:

```cron
17 * * * * cd /opt/experimente-plus && docker compose -f docker-compose.vps.yml exec -T app node ace.js reports:notify-overdue >> /var/log/experimente-plus/reports-overdue.log 2>&1
```

Antes de ativar, conferir:

- **SMTP configurado** no `.env` do container (`MAIL_MAILER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_ADDRESS`). Sem isso, cada execução falha no envio, devolve a reivindicação e termina com código 1. Nada se perde, mas ninguém é avisado.
- **`APP_URL`** apontando para o endereço público do backoffice, porque a mensagem leva o link da fila.
- **A equipe tem membership na operação.** Moderador global sem membership não recebe o aviso daquela operação, pela mesma razão que não abre a fila dela.

Rodar uma vez manualmente e conferir a saída antes de agendar:

```sh
cd /opt/experimente-plus && docker compose -f docker-compose.vps.yml exec -T app node ace.js reports:notify-overdue
```

Em produção vale o mesmo, com o agendador que a infraestrutura do contratante usar (cláusula 2.3).
