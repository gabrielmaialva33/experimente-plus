# Revisão da SOBRAL SPEC

**Fonte:** `SOBRAL.pdf`, recebido em 24 de agosto de 2026  
**Status:** insumo de produto reconciliado  
**Objetivo:** preservar a intenção do solicitante sem transformar um rascunho informal em contrato técnico contraditório.

## Leitura geral

A SOBRAL SPEC funciona bem como inventário inicial de ideias. Ela identifica atores, permissões, restrições, avaliações, mídia, IA, segurança e alguns casos extremos. O documento, porém, mistura no mesmo nível:

- requisitos do MVP;
- funcionalidades futuras;
- controles de segurança;
- regras ainda não decididas;
- exemplos de interface;
- respostas improvisadas para casos extremos;
- conceitos diferentes, como usuário, organização, parceiro e estabelecimento.

Por isso, a fonte será tratada como requisito de negócio rastreável, não como schema, matriz de autorização ou ordem de implementação.

## Tradução canônica dos atores

| Termo da fonte | Representação canônica no Experimente+                   | Observação                                                  |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| Explorador     | usuário regular, visitante autenticado quando necessário | não é tenant nem organização                                |
| Parceiro       | membership ativa em uma organização                      | nunca será uma role global com acesso a todos os parceiros  |
| Administrador  | role global administrativa                               | ações críticas continuam protegidas por policies de domínio |
| Moderador      | role global de moderação                                 | não recebe poderes administrativos irrestritos              |
| Concierge IA   | serviço interno baseado em dados publicados              | não é pessoa, membership ou role humana                     |

## Requisitos aceitos e já refletidos na arquitetura

### Cadastro e identidade

- e-mail não pode ser reutilizado por duas contas;
- CNPJ pertence à organização e deve ser normalizado, validado e único no escopo correto;
- organização e estabelecimento não são a mesma entidade;
- cadastro social pode ser acrescentado sem substituir a identidade interna da conta;
- criação de conteúdo por parceiro depende de membership na organização correspondente.

CPF não será exigido de todo Explorador apenas porque aparece no rascunho. A coleta de CPF precisa de finalidade legal, política de privacidade e decisão de produto específica. O layout de patrocinadores também não pertence ao cadastro da conta.

### Unidade pronta para submissão

A intenção da fonte é preservada por dois agregados:

- organização: CNPJ, e-mail e telefone administrativos;
- revisão da unidade: CEP, endereço, contato público, categoria, horário e mídia.

O gate de submissão exige:

- operação ativa;
- organização elegível e ativa;
- responsável autorizado;
- cidade e categoria ativas;
- identidade pública válida;
- endereço e localização coerentes;
- canal público de contato;
- disponibilidade válida;
- atributos obrigatórios;
- pelo menos uma imagem elegível e uma capa;
- ausência de mídia em quarentena.

### Mídia

A primeira vertical aceita JPEG, PNG e WebP. HEIC/HEIF permanece rejeitado até existir pipeline confiável de conversão, remoção ou preservação de metadados e entrega pública compatível.

As restrições de conteúdo ofensivo, violência, pornografia, marca d'água e texto promocional são políticas de moderação. Elas não serão simuladas como validação automática infalível no upload.

### Desativação e histórico

Uma organização ou unidade suspensa deixa de participar da descoberta pública. Dados históricos e referências internas permanecem preservados. Arquivamento é preferido a exclusão destrutiva.

Essa regra atende à intenção de retirar conteúdo da busca e do mapa sem destruir auditoria, histórico, atribuição ou relações de usuários.

### Concierge IA

O princípio aceito é de grounding obrigatório:

- não inventar estabelecimento;
- não inventar horário;
- não inventar evento;
- distinguir informação publicada de inferência;
- responder com indisponibilidade quando não houver fonte confiável.

A implementação do Concierge pertence a um marco posterior e dependerá do catálogo publicado e de contratos de retrieval próprios.

## Requisitos aceitos, mas fora do EP-05

### Exploração e relacionamento

- favoritos;
- seguir parceiros;
- roteiros;
- compartilhamento de experiências;
- interesses e recomendações;
- denúncias;
- uso em múltiplos dispositivos.

Esses itens pertencem aos domínios de identidade, descoberta, social graph, roteiros e personalização.

### Avaliações

A fonte propõe nota de uma a cinco estrelas, texto, foto e vídeo, além de limites contra spam e propaganda. O domínio de avaliações precisará decidir antes da implementação:

- comprovação de visita;
- uma ou várias avaliações por usuário e unidade;
- edição e janela temporal;
- moderação de texto e mídia;
- resposta oficial do parceiro;
- impacto de banimento;
- agregação de nota;
- direito de recurso;
- retenção e anonimização após exclusão de conta.

### Experiências, eventos e comércio

- criar experiências;
- criar e aprovar eventos;
- vender itens;
- responder avaliações;
- reservas.

São domínios posteriores e não devem ser incorporados ao workflow de publicação da unidade.

### Segurança adicional

- 2FA;
- biometria;
- login social;
- políticas avançadas de sessão;
- cache offline e comportamento sem GPS.

A base atual já deve impedir SQL injection, XSS por saída não confiável, credenciais expostas e senhas fracas, mas essas expressões são requisitos não funcionais, não histórias de domínio isoladas.

## Decisões da fonte que não serão aplicadas literalmente

### Parceiro como role global

Rejeitado. Parceiro é uma relação entre usuário e organização. Uma role global permitiria acesso indevido a organizações alheias.

### Excluir parceiro e remover todas as avaliações

Rejeitado como comportamento padrão. A unidade será arquivada ou suspensa. Avaliações pertencem aos autores e ao histórico da plataforma; eventual ocultação dependerá de policy, moderação ou obrigação legal.

### Banir usuário e apagar automaticamente todas as avaliações

Rejeitado como regra universal. Banimento bloqueia novas ações e pode ocultar conteúdo abusivo, mas conteúdo legítimo deve permanecer auditável. Cada avaliação precisará de estado próprio de moderação.

### Administrador alterar nota ou produzir avaliação privilegiada

Não será permitido como poder administrativo. Administradores podem moderar, corrigir fraude e auditar; não manipulam a reputação pública.

### Restaurante duplicado como simples unicidade de nome

Rejeitado. Nome comercial pode se repetir. A prevenção de duplicidade usará sinais como organização, endereço, coordenadas, telefone e claim, com revisão humana para casos ambíguos.

### Avaliar apenas após visita sem prova definida

Adiado. A intenção antifraude é válida, mas precisa de evidência verificável. GPS isolado não é suficiente e pode gerar exclusão ou manipulação.

## Impacto imediato no EP-05

A SOBRAL SPEC reforça os seguintes requisitos do próximo marco:

1. parceiro autorizado envia uma revisão completa para análise;
2. conteúdo em análise fica congelado;
3. moderador acessa fila tenant-safe;
4. moderador aprova, rejeita ou solicita correção com motivo;
5. solicitação de correção informa campos acionáveis;
6. ressubmissão preserva o histórico da decisão anterior;
7. aprovação executa o gate de publicação e troca o ponteiro publicado atomicamente;
8. suspensão remove a unidade da descoberta sem apagar histórico;
9. nenhuma mídia pendente ou em quarentena vaza para a projeção pública;
10. toda transição gera evento imutável e auditoria.

## Mapeamento de marcos

| Tema da SOBRAL SPEC                                              | Marco principal                       |
| ---------------------------------------------------------------- | ------------------------------------- |
| cadastro, login e recuperação                                    | fundação e evolução de identidade     |
| CNPJ e parceiro                                                  | EP-02                                 |
| endereço, categoria e horário                                    | EP-03                                 |
| fotos e moderação de mídia                                       | EP-04                                 |
| submissão, correção, aprovação, rejeição, publicação e suspensão | EP-05                                 |
| busca, mapa e ficha pública                                      | EP-06                                 |
| analytics de descoberta e ações externas                         | EP-07                                 |
| portal do parceiro, backoffice e feedback do piloto              | EP-08                                 |
| favoritos, follows, avaliações e denúncias                       | marcos posteriores                    |
| experiências, eventos e comércio                                 | marcos posteriores                    |
| Concierge IA                                                     | após catálogo e telemetria confiáveis |

## Pendências de produto preservadas

- finalidade e base legal para CPF de Explorador;
- provedores de login social;
- prova de visita;
- política de reviews de usuários banidos;
- política de conteúdo e recurso;
- HEIC/HEIF;
- experiências, eventos e itens à venda;
- reservas;
- 2FA e biometria;
- cache offline;
- comportamento sem GPS;
- contrato de grounding e observabilidade do Concierge IA.
