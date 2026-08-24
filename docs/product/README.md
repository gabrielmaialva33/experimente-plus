# Planejamento de produto — Experimente+

Este diretório registra a visão de produto aceita antes da criação dos primeiros domínios de negócio.

A base de requisitos é a especificação `SOBRAL.pdf`, complementada pelas decisões tomadas para posicionar o Experimente+ como uma plataforma regional **multicidade** e **multicategoria**. Quando este planejamento propõe algo que não está na especificação, o texto identifica a decisão como hipótese ou recomendação.

## Resumo executivo

O Experimente+ será uma plataforma gratuita de descoberta regional para ajudar pessoas a decidir **onde comer, o que fazer e quais serviços locais conhecer**.

Restaurantes, bares, cafés, padarias e docerias formam a primeira vertical comercial, mas a arquitetura deve suportar cinemas, cultura, lazer, tatuagem, beleza, bem-estar e outras categorias sem transformar todo estabelecimento em um restaurante genérico.

A proposta de negócio é composta por quatro camadas evolutivas:

1. **Experimente+ público** — catálogo, busca, curadoria e descoberta gratuita.
2. **Experimente+ para parceiros** — gestão de presença, conteúdo, unidades e resultados.
3. **Experimente+ Pro** — assinatura B2B com analytics, equipe e campanhas.
4. **Experimente+ Pass** — benefícios opcionais para consumidores, somente após existir densidade de parceiros e uso recorrente.

O primeiro produto não terá reservas, pagamentos ou checkout interno. A conversão inicial será medida por ações como abrir rota, chamar no WhatsApp, telefonar, visitar o site, salvar e compartilhar.

## Decisões centrais

- A experiência pública deve funcionar sem login.
- Cidade é uma entidade de descoberta, não uma fronteira de autorização e não um tenant.
- Uma organização pode administrar várias unidades em uma ou mais cidades.
- O estabelecimento é a unidade pública descoberta pelo usuário.
- Categorias são hierárquicas e extensíveis.
- Dados públicos passam por publicação e moderação.
- Parceiros não compram nota, verificação ou posição orgânica.
- Benefícios, vouchers e assinatura não são pré-requisitos para o catálogo.
- O Concierge IA entra depois que o catálogo tiver dados estruturados e confiáveis.
- Remoção pública, retenção histórica e exclusão física são conceitos diferentes e serão tratados explicitamente.

## Primeiro marco funcional

A primeira vertical deve provar o ciclo completo:

```text
Admin configura cidade e categorias
        ↓
Parceiro cria ou reivindica sua organização
        ↓
Parceiro cadastra uma unidade
        ↓
Adiciona endereço, horários, categorias e fotos
        ↓
Submete para análise
        ↓
Moderador aprova ou rejeita
        ↓
Unidade publicada aparece no catálogo
        ↓
Ações de descoberta são registradas
```

## Documentos

- [`01-visao-e-negocio.md`](01-visao-e-negocio.md) — posicionamento, proposta de valor e modelo de receita.
- [`02-atores-e-jornadas.md`](02-atores-e-jornadas.md) — atores da especificação e jornadas prioritárias.
- [`03-mvp-e-roadmap.md`](03-mvp-e-roadmap.md) — escopo do MVP, fases, métricas e critérios de lançamento.
- [`04-mapa-de-dominios.md`](04-mapa-de-dominios.md) — limites conceituais dos domínios antes do schema.
- [`05-decisoes-e-pendencias.md`](05-decisoes-e-pendencias.md) — decisões aceitas, hipóteses e perguntas ainda abertas.
- [`06-referencias-de-mercado.md`](06-referencias-de-mercado.md) — leitura das referências de benefícios e descoberta local.
- [`07-validacao-de-negocio.md`](07-validacao-de-negocio.md) — entrevistas, experimentos e critérios de avanço.
- [`08-backlog-inicial.md`](08-backlog-inicial.md) — epics, dependências e Definition of Done da primeira vertical.
- [`09-rastreabilidade-da-especificacao.md`](09-rastreabilidade-da-especificacao.md) — relação entre cada requisito do documento inicial e o roadmap.
- [`10-revisao-da-sobral-spec.md`](10-revisao-da-sobral-spec.md) — reconciliação explícita do rascunho recebido com domínio, ADRs e marcos.
- [`../architecture/decisions/`](../architecture/decisions/README.md) — ADRs aceitos que transformam o planejamento em contratos técnicos.

## Estado arquitetural

Os marcos EP-00 a EP-05 foram concluídos. Tenant como operação, organização/unidade, publicação versionada, gates, autorização, mídia e o workflow auditável de revisão possuem ADRs aceitos e implementação canônica com regressões. A etapa atual de engenharia é EP-06 — Catálogo público e descoberta regional.

## Regra de mudança

Uma decisão deste diretório só deve virar migration, model, rota ou interface depois que:

1. estiver classificada como **aceita**;
2. possuir impacto e dono de domínio claros;
3. estiver incluída em um marco do roadmap;
4. tiver cenários de teste identificados.

Decisões aceitas que afetem schema também devem possuir ADR quando forem estruturais. A fundação pode avançar para o domínio correspondente somente depois desses dois registros estarem consistentes.
