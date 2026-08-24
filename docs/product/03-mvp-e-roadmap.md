# 03 — MVP e roadmap

## Objetivo do MVP

Provar que o Experimente+ consegue criar um catálogo regional confiável, publicar oferta local com controle de qualidade e gerar ações qualificadas de descoberta.

O MVP não precisa provar monetização completa. Ele precisa provar três premissas:

1. parceiros aceitam cadastrar e manter informações;
2. usuários encontram opções relevantes e executam ações;
3. a operação consegue moderar e manter qualidade sem esforço inviável.

## Escopo funcional do MVP

### Catálogo público

- acesso sem login;
- seleção persistente de cidade;
- listagem de cidades ativas;
- famílias, categorias e subcategorias;
- pesquisa por nome, termo e categoria;
- filtros iniciais por cidade, categoria, aberto agora e atributos essenciais;
- página pública da unidade;
- endereço, mapa e abertura de rota;
- horário semanal e exceções quando disponíveis;
- telefone, WhatsApp, site e redes sociais;
- fotos moderadas;
- compartilhamento por link;
- indicação clara de conteúdo patrocinado;
- páginas indexáveis e SSR.

### Conta do Explorador

A conta já existe na fundação. No MVP de catálogo, ela deve adicionar apenas:

- favoritos;
- cidade preferida;
- interesses básicos;
- sincronização entre dispositivos.

Avaliações, fotos de usuário, follows, roteiros e recomendações personalizadas entram em fases posteriores.

### Portal do parceiro

- criar ou reivindicar organização;
- cadastrar dados legais e contatos;
- convidar ou administrar membros básicos da equipe;
- criar e editar unidades próprias;
- escolher cidade e categorias;
- preencher endereço, horários e atributos;
- enviar fotos;
- visualizar pendências de completude;
- submeter unidade para análise;
- acompanhar aprovação, rejeição ou solicitação de correção;
- visualizar métricas básicas após publicação.

### Moderação e administração

- administrar regiões e cidades;
- administrar taxonomia e atributos;
- consultar fila de organizações e unidades;
- aprovar, rejeitar, solicitar correção, suspender e reativar;
- registrar motivo da decisão;
- manter trilha de auditoria;
- visualizar problemas de dados incompletos ou desatualizados;
- identificar conteúdo patrocinado.

### Analytics essenciais

Eventos mínimos:

- impressão em resultado;
- abertura de ficha;
- clique em rota;
- clique em WhatsApp;
- clique em telefone;
- clique em site;
- clique em rede social;
- favorito adicionado/removido;
- compartilhamento iniciado;
- pesquisa sem resultado.

Eventos não devem ser chamados de venda ou visita sem evidência.

## Fora do MVP

- reserva interna;
- agenda de serviços;
- checkout e pagamento;
- split financeiro;
- cashback;
- assinatura do consumidor;
- vouchers e QR Code;
- Experimente+ Pro pago;
- avaliações públicas completas;
- mídia enviada pelo Explorador;
- follow social;
- roteiros colaborativos;
- notificações avançadas;
- gamificação;
- aplicativo nativo;
- cache offline completo;
- busca geoespacial avançada;
- Concierge IA;
- recomendações por aprendizado de máquina.

Esses itens não estão descartados. Foram retirados para preservar foco e reduzir dependências antes de provar catálogo, aquisição e operação.

## Primeiro corte vertical

O primeiro marco de engenharia deve produzir uma unidade publicável do início ao fim:

### Pré-condições

- um Administrador existe;
- uma cidade ativa existe;
- ao menos uma categoria gastronômica existe;
- a fundação de autenticação, arquivos e auditoria está operacional.

### Fluxo

1. Administrador cria a cidade e a categoria.
2. Parceiro cria uma organização.
3. Parceiro cria uma unidade vinculada à organização.
4. Parceiro informa endereço, horário, categoria, contato e foto.
5. Sistema calcula completude.
6. Parceiro submete a unidade.
7. Moderador aprova.
8. Unidade aparece no catálogo público.
9. Visitante abre a ficha e clica em rota ou contato.
10. Parceiro visualiza a ação agregada.

### Testes obrigatórios

- isolamento entre organizações;
- parceiro não edita unidade alheia;
- unidade incompleta não é submetida;
- unidade pendente não aparece publicamente;
- unidade suspensa sai da busca e do mapa;
- cidade ou categoria inativa remove a unidade da descoberta;
- mídia não moderada não aparece;
- ação pública não vaza dados pessoais;
- decisão de moderação é auditada;
- consultas públicas não exigem tenant membership.

## Roadmap por fases

### Fase 0 — planejamento e fundação

Estado: concluída em 22 de agosto de 2026. Planejamento e ADRs técnicos do EP-00 estão aceitos; validação local continua em paralelo ao EP-01.

Entregas:

- visão de negócio;
- atores e jornadas;
- decisão sobre cidades, organizações e tenancy;
- mapa de domínios;
- MVP e métricas;
- lista de decisões abertas.

Saída: autorização para desenhar e implementar as migrations canônicas de Geografia e Taxonomia, respeitando os ADRs em `docs/architecture/decisions/`.

### Fase 1 — núcleo de oferta e publicação

Estado: concluído até o primeiro catálogo público. Geografia, Taxonomia, Organizações, memberships, Unidades revisionadas, Mídia, Submissão, moderação, publicação atômica e descoberta pública com busca PostgreSQL e SSR foram concluídos até 24 de agosto de 2026. Analytics de descoberta e métricas agregadas formam o próximo corte.

Domínios:

- geography;
- taxonomy;
- organizations;
- establishments;
- media;
- moderation.

Entregas:

- migrations canônicas;
- APIs e services;
- portal mínimo do parceiro;
- fila de moderação;
- catálogo público básico;
- primeira vertical testada.

### Fase 2 — descoberta pública

Entregas:

- home orientada a descoberta;
- páginas de cidade e categoria;
- pesquisa e filtros;
- aberto agora;
- mapa e ações externas;
- coleções editoriais;
- SEO técnico e dados estruturados;
- analytics de funil.

### Fase 3 — operação do parceiro

Entregas:

- claim de unidade;
- membros e múltiplas unidades;
- painel de completude e atualização;
- métricas por unidade;
- campanhas piloto gratuitas;
- alertas de dados desatualizados.

### Fase 4 — retenção do Explorador

Entregas:

- favoritos;
- interesses;
- listas pessoais;
- histórico controlado;
- follows;
- recomendações editoriais e regras simples;
- notificações essenciais.

### Fase 5 — reputação e comunidade

Entregas condicionadas às políticas abertas:

- avaliações de uma a cinco estrelas;
- texto e mídia moderados;
- respostas de parceiros;
- denúncias;
- revisões e edição com prazo;
- regra de visita verificada, se adotada;
- efeitos de banimento e remoção pública.

### Fase 6 — monetização B2B

Entregas:

- Experimente+ Pro;
- planos e entitlements;
- analytics avançado;
- campanhas patrocinadas identificadas;
- várias unidades e equipe avançada;
- faturamento e gestão de assinatura.

### Fase 7 — benefícios

Entregas somente após validação comercial:

- catálogo de benefícios;
- regras por categoria;
- elegibilidade;
- validação antifraude;
- eventual QR Code;
- passes sazonais ou regionais;
- Experimente+ Pass.

### Fase 8 — Concierge IA

Pré-condições:

- catálogo denso;
- horários confiáveis;
- taxonomia madura;
- eventos moderados;
- ferramentas internas de consulta;
- observabilidade e avaliação de respostas.

Entregas:

- sugestões baseadas no catálogo;
- montagem de roteiros;
- explicação de destinos;
- referências às entidades usadas;
- comportamento seguro quando não houver dado;
- tratamento de falha de GPS definido.

## Métrica principal

### North Star

> **Ações qualificadas de descoberta por mês.**

Uma ação qualificada representa intenção observável, por exemplo:

- abrir rota;
- chamar no WhatsApp;
- telefonar;
- visitar site;
- salvar;
- compartilhar;
- usar benefício quando existir.

A métrica deve ser segmentada por cidade, categoria, unidade e origem.

## Métricas de apoio

### Densidade e qualidade

- unidades publicadas por cidade/categoria;
- cobertura das categorias prioritárias;
- percentual de fichas completas;
- percentual com horário atualizado;
- idade mediana da última atualização;
- tempo médio de moderação;
- taxa de aprovação na primeira submissão.

### Descoberta

- pesquisas por visitante;
- pesquisa para abertura de ficha;
- ficha para ação qualificada;
- pesquisas sem resultado;
- uso de filtros;
- recorrência em 7 e 30 dias;
- distribuição de demanda entre cidades.

### Parceiro

- organizações criadas;
- unidades reivindicadas;
- tempo até primeira publicação;
- parceiros ativos no mês;
- taxa de atualização de dados;
- ações qualificadas por unidade;
- conversão para plano pago, quando existir.

### Operação

- backlog de moderação;
- tempo de resposta;
- denúncias por mil visualizações;
- reversões de moderação;
- dados marcados como incorretos;
- custo operacional por unidade publicada.

## Critérios sugeridos para lançamento público

Os números são metas de planejamento e devem ser ajustados ao agrupamento geográfico escolhido.

- 50 a 80 unidades verificadas no primeiro agrupamento;
- presença forte em ao menos quatro subcategorias gastronômicas;
- 80% ou mais das fichas com completude alta;
- 90% ou mais com horário informado;
- nenhuma unidade pendente ou suspensa vazando no catálogo;
- fila de moderação com prazo operacional definido;
- fluxo público responsivo e indexável;
- analytics de ações essenciais funcionando;
- processo de correção de dados disponível;
- parceiros piloto capazes de atualizar a própria ficha.

## Sequência imediata de engenharia

1. registrar as decisões de produto;
2. desenhar o modelo conceitual de geography, taxonomy, organizations e establishments;
3. definir estados e invariantes de publicação;
4. definir permissions do primeiro corte;
5. escrever migrations canônicas;
6. implementar services e testes da vertical;
7. criar telas mínimas de parceiro e moderação;
8. publicar o primeiro read model do catálogo;
9. instrumentar ações qualificadas;
10. validar com dados piloto.
