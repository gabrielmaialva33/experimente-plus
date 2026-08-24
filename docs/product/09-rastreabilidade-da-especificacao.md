# 09 — Rastreabilidade da especificação inicial

Este documento relaciona os requisitos de `SOBRAL.pdf` ao planejamento. Ele não altera o conteúdo da especificação e não preenche silenciosamente as questões que o próprio documento deixa abertas.

## Perfis

| Requisito da especificação | Tratamento no planejamento                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| Explorador                 | ator autenticado de descoberta, retenção e conteúdo                         |
| Parceiro                   | usuário com membership em organização e acesso apenas às próprias unidades  |
| Administrador              | operação global, taxonomia, cidades, segurança e escalonamento              |
| Moderador                  | fila, denúncias e decisões sem acesso irrestrito                            |
| Concierge IA               | ator de sistema posterior, fundamentado em ferramentas internas             |
| cada perfil com permissões | matriz conceitual agora; permissions concretas por domínio na implementação |

O planejamento adiciona Visitante apenas para representar acesso público sem login.

## Cadastro e identidade

| Requisito                | Situação                                                                     |
| ------------------------ | ---------------------------------------------------------------------------- |
| CPF válido               | requisito futuro de perfil; modelo e necessidade ainda não definidos         |
| CNPJ válido              | requisito da organização no primeiro ciclo                                   |
| Google e Apple           | login social posterior; provedores e conta duplicada precisam de política    |
| Android                  | significado não está claro na especificação; permanece aberto                |
| e-mail                   | já suportado pela fundação                                                   |
| layout de patrocinadores | tratado como campanhas patrocinadas identificadas, não como ranking orgânico |
| e-mail duplicado         | já bloqueado pela fundação                                                   |
| CPF/CNPJ inválido        | validação obrigatória quando os campos forem implementados                   |
| restaurante duplicado    | generalizado para detecção de unidade duplicada, com regra ainda a definir   |

## Cadastro de parceiro

A especificação exige:

- CNPJ;
- CEP;
- telefone;
- e-mail;
- categoria;
- horário;
- ao menos uma foto.

Tratamento:

- dados legais ficam em organização;
- endereço, categoria, horário e foto pertencem à unidade;
- completude é calculada antes da submissão;
- publicação exige moderação;
- exceções para pessoa física ou atividade sem CNPJ permanecem abertas.

## Capacidades do parceiro

| Capacidade                     | Fase                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| alterar horário                | primeira vertical                                             |
| adicionar fotos                | primeira vertical                                             |
| criar experiências             | fase de experiências/eventos                                  |
| criar evento                   | fase de experiências/eventos                                  |
| responder avaliações           | fase de reputação                                             |
| incluir item a ser vendido     | domínio de offerings ainda não definido; não implica checkout |
| não apagar avaliações          | invariante da fase de reputação                               |
| não alterar nota               | invariante da fase de reputação                               |
| não publicar conteúdo ofensivo | moderação e políticas de conteúdo                             |

## Capacidades do Explorador

| Capacidade                                                  | Fase                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| criar conta, editar perfil, recuperar senha e excluir conta | fundação existente                                                  |
| login em vários dispositivos                                | fundação existente                                                  |
| favoritar                                                   | MVP/retensão inicial                                                |
| escolher interesses                                         | retenção                                                            |
| compartilhar                                                | catálogo público e retenção                                         |
| seguir parceiros                                            | retenção posterior                                                  |
| criar roteiros                                              | fase posterior                                                      |
| salvar fotos                                                | depende de definição: upload próprio, coleção ou mídia de avaliação |
| avaliar                                                     | fase de reputação                                                   |
| denunciar                                                   | fase de reputação/moderação                                         |
| receber recomendações da IA                                 | Concierge posterior                                                 |

Restrições como spam, bots, conta duplicada, conteúdo ofensivo, manipulação de localização e fraude de benefício serão tratadas por segurança, rate limit, moderação e regras dos domínios correspondentes.

## Permissões da especificação

| Ação                              | Regra mantida                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Explorador avalia parceiro        | permitido quando o módulo de avaliações existir                                          |
| Parceiro não avalia como parceiro | papel operacional não concede essa ação; uma conta pessoal poderá exigir regra separada  |
| Administrador avalia              | a especificação permite; impacto sobre confiança deve ser revisto antes da implementação |
| editar parceiro                   | somente responsável próprio e Administrador                                              |
| excluir parceiro                  | somente Administrador, sujeito à política de retenção                                    |
| criar evento                      | Parceiro próprio e Administrador                                                         |
| aprovar evento                    | Administrador; delegação futura ao Moderador exige decisão explícita                     |

## Avaliações

A especificação permite:

- uma a cinco estrelas;
- texto;
- foto;
- vídeo.

Ela proíbe:

- palavrões;
- spam;
- links;
- telefone;
- Pix;
- propaganda.

Ela deixa em aberto:

- mínimo e máximo de caracteres;
- quantidade de fotos e vídeos;
- avaliações por dia;
- intervalo entre edições;
- prazo para editar;
- necessidade de comprovar visita.

Tratamento: o domínio de reviews só entra depois que essas regras e o fluxo de moderação forem definidos.

## Fotos e mídia

A especificação aceita JPG, PNG, WEBP e HEIC e proíbe violência, pornografia, marcas d'água e texto promocional.

Tratamento:

- o ADR-0014 define asset estável e composição versionada por revisão;
- JPEG, PNG e WebP são validados por tamanho, assinatura, MIME type e dimensões;
- capa, ordem, texto alternativo, legenda e ownership possuem invariantes próprias;
- mídia usa `pending`, `approved`, `rejected` e `quarantined`, com eventos append-only;
- a submissão aceita mídia pendente ou aprovada, enquanto a projeção pública aceita somente aprovada;
- HEIC, vídeo, derivados, EXIF e análise automática permanecem fora da primeira vertical;
- conteúdo enviado por Explorador entra somente com reviews ou outro caso definido.

## Concierge IA

| Requisito                    | Tratamento                                                 |
| ---------------------------- | ---------------------------------------------------------- |
| sugerir lugares              | consulta catálogo publicado                                |
| criar roteiros               | usa entidades reais e regras de horário/localização        |
| explicar destinos            | usa dados editoriais e estruturados                        |
| não inventar estabelecimento | ferramenta interna obrigatória                             |
| não inventar horário         | resposta limitada ao dado consultado                       |
| não inventar evento          | evento precisa estar publicado e retornado pela ferramenta |

A reação a falha de GPS permanece aberta, exatamente como na especificação.

## Segurança

A especificação menciona 2FA, login social, token e biometria, e proíbe senha fraca, SQL Injection, XSS e credenciais expostas.

Tratamento:

- tokens, hashing, cookies, rate limit e segredos já possuem fundação;
- 2FA ainda não foi priorizado;
- biometria depende de cliente compatível;
- login social exige provedores e política de identidade;
- segurança continua sendo requisito transversal e testado.

## Regras gerais e casos extremos

### Parceiro desativado

Especificação:

- não aparece na busca;
- não aparece no mapa;
- permanece no histórico do usuário.

Planejamento:

- estado suspenso/inativo remove a unidade do read model público;
- referências históricas podem permanecer;
- nenhuma exclusão física automática decorre apenas da desativação.

### Reservas

Especificação: não haverá reservas no aplicativo; uso é presencial.

Planejamento: reservas, agenda, checkout e pagamento estão fora do MVP.

### Usuário banido

Especificação: avaliações do usuário banido não aparecem.

Planejamento: ocultação pública é requisito; efeito sobre nota agregada, auditoria e eventual recurso permanece aberto.

### Parceiro excluído

Especificação: fotos, avaliações e demais materiais são retirados do aplicativo.

Planejamento: remoção pública será garantida. Prazo, retenção interna, anonimização e exclusão física dependem de política legal e técnica.

### Usuário sem internet

Especificação: pergunta se haverá cache, sem resposta.

Planejamento: offline completo está fora do MVP e permanece decisão futura.

### GPS falhou

Especificação: pergunta como a IA reage, sem resposta.

Planejamento: fallback por cidade escolhida e comunicação de incerteza serão avaliados na fase do Concierge.

## Requisitos ainda sem destino definitivo

- cadastro de layout de patrocinadores;
- “Android” como modalidade de cadastro;
- item a ser vendido sem definição de catálogo ou transação;
- salvar fotos pelo Explorador;
- Administrador avaliando parceiro;
- exclusão física de todo material do parceiro;
- comprovação de visita;
- cache offline;
- reação exata do Concierge à falha de GPS.

Nenhum desses itens deve ser inventado durante a implementação. A decisão precisa ser registrada em `05-decisoes-e-pendencias.md` e, quando estrutural, em ADR.
