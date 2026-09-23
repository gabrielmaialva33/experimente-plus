# 18 — Rastreabilidade do contrato (Anexo I)

O documento 09 relaciona o `SOBRAL.pdf` ao planejamento. Este relaciona o **Anexo I do contrato** ao código, e a diferença importa: pela cláusula 1.3, a especificação inicial é contexto e não amplia o escopo, e em caso de divergência **prevalecem o contrato e o Anexo I**. É contra este anexo que o contratante testa na homologação da cláusula 4.1 e aponta defeitos na 4.2.

Auditoria feita em **23/09/2026**, confrontando cada item do anexo com o código dos dois repositórios. A situação é a medida naquela data, não a intenção.

| Situação          | Significado                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **Entregue**      | implementado e coberto por teste                                                           |
| **Parcial**       | implementado, com a lacuna nomeada ao lado                                                 |
| **Falta**         | não existe no código                                                                       |
| **Contratante**   | depende de definição, conta ou material do contratante (item 15, cláusulas 2.4, 6.3 e 6.5) |
| **Não conferido** | não verificado nesta auditoria; não afirmar em nenhum sentido                              |

## 1. Perfis e controle de acesso

| Item                                           | Situação | Onde / observação                                        |
| ---------------------------------------------- | -------- | -------------------------------------------------------- |
| Explorador, Parceiro, Administrador, Moderador | Entregue | papéis globais e policies de domínio (ADR-0007)          |
| Concierge IA como módulo, não usuário          | Entregue | ADR-0029; sem caminho de escrita                         |
| Permissões por perfil                          | Entregue | middleware de permissão e regressões de IDOR por domínio |

## 2. Cadastro, autenticação e conta

| Item                                                                         | Situação        | Onde / observação                                                                                       |
| ---------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| Cadastro e login por e-mail                                                  | Entregue        | `auth`                                                                                                  |
| Login social Google e Apple                                                  | **Contratante** | o anexo condiciona às "contas fornecidas pelo CONTRATANTE"; nenhuma conta foi fornecida e não há código |
| CPF quando exigido                                                           | Entregue        | validado na compra, única regra que o exige hoje                                                        |
| Parceiro com CNPJ válido                                                     | Entregue        | `cnpj_service`                                                                                          |
| Unicidade de e-mail                                                          | Entregue        | vínculo social depende do login social                                                                  |
| Recuperação de senha, edição de perfil, aceite dos Termos, exclusão da conta | Entregue        | exclusão grava lápide e apaga a camada pessoal (ADR-0030)                                               |
| Tokens e múltiplos dispositivos                                              | Entregue        | JWT com refresh opaco rotativo                                                                          |

## 3. Cadastro e dados de parceiros

| Item                                                                     | Situação | Onde / observação                                                                                                                                           |
| ------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CNPJ, CEP, categoria e imagem para ativação                              | Entregue | a projeção só torna descobrível com categoria ativa e exatamente uma capa aprovada                                                                          |
| Telefone e e-mail obrigatórios na ativação                               | Parcial  | a completude exige ao menos um canal de contato, não telefone e e-mail ambos; exigir os dois pode travar parceiros já publicados e é decisão do contratante |
| Cadastro e edição respeitando permissões                                 | Entregue | revisões e moderação (ADR-0012, ADR-0015)                                                                                                                   |
| Parceiro altera horários, fotos, responde avaliações, gerencia conteúdos | Entregue | ADR-0027, ADR-0028                                                                                                                                          |
| Parceiro desativado sai de busca e mapa, preservando histórico           | Entregue | definição única em `catalog_discoverability`                                                                                                                |

## 4. Descoberta, catálogo, busca e mapa

| Item                                     | Situação | Onde / observação                                         |
| ---------------------------------------- | -------- | --------------------------------------------------------- |
| Estabelecimentos ativos, busca e filtros | Entregue | projeção reconstruível (ADR-0016)                         |
| Mapa                                     | Entregue | Protomaps em R2 (ADR-0026); provedor definitivo é item 15 |
| Informações públicas do parceiro         | Entregue |                                                           |

## 5. Assinatura anual, pagamentos e elegibilidade

| Item                                      | Situação        | Onde / observação                                                                                                                                                            |
| ----------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fluxo de contratação da assinatura anual  | Parcial         | implementado como compra de edição anual com vigência (ADR-0024); **confirmar com o contratante que é o mesmo conceito**                                                     |
| Integração com gateway                    | **Contratante** | adaptadores existem; provedor e parâmetros são item 15; homologação usa pagamento simulado. A cláusula 2.2 não condiciona a entrega à disponibilidade do serviço de terceiro |
| Estado da assinatura restringe benefícios | Entregue        | acesso e carteira (ADR-0021, ADR-0022)                                                                                                                                       |

## 6. Vouchers e benefícios

| Item                                       | Situação | Onde / observação                                                    |
| ------------------------------------------ | -------- | -------------------------------------------------------------------- |
| Cadastro administrativo                    | Entregue | `backoffice/benefits`                                                |
| Exibição aos elegíveis, regras de validade | Entregue | ADR-0019 a ADR-0022                                                  |
| Uso, validação e histórico                 | Entregue | resgate transacional; repetir o token devolve o comprovante original |
| Impedir reutilização indevida              | Entregue | regressões de concorrência                                           |

## 7. Experiências, eventos e ofertas dos parceiros

| Item                                            | Situação | Onde / observação                                                                                                                                                                              |
| ----------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parceiro cria e edita experiências e eventos    | Entregue | ADR-0028                                                                                                                                                                                       |
| Publicação de evento com aprovação configurável | Entregue | política por tenant                                                                                                                                                                            |
| Administrador aprova, desativa e exclui         | Entregue | aprovar, recusar e arquivar; excluir é arquivamento (ADR-0028 §4)                                                                                                                              |
| Administrador **edita**                         | Entregue | correção pelo moderador conta como aprovada e não muda a data de publicação; histórico append-only de todo ato, protegido contra alteração por gatilho (ADR-0028, implementação de 23/09/2026) |
| Item de vitrine sem checkout                    | Entregue | regressão garante que nenhuma rota de compra o aceita                                                                                                                                          |

## 8. Avaliações, mídia e respostas

| Item                                      | Situação    | Onde / observação                                                                                                                                                                                                                        |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nota de 1 a 5 e texto                     | Entregue    | ADR-0027                                                                                                                                                                                                                                 |
| **Fotos** na avaliação                    | Entregue    | JPEG, PNG e WebP pelo pipeline do ADR-0014, limite lido da política; metadados removidos por lista de permissão antes de armazenar — GPS, EXIF, XMP, C2PA e dados anexados após o fim do arquivo (ADR-0027, implementação de 23/09/2026) |
| Vídeos                                    | Contratante | proposto como corte próprio, padrão zero (ADR-0027)                                                                                                                                                                                      |
| Parceiro responde sem alterar a nota      | Entregue    |                                                                                                                                                                                                                                          |
| JPG, PNG e WEBP                           | Entregue    | HEIC não suportado (ADR-0014); o anexo o condiciona a "quando suportados pela infraestrutura"                                                                                                                                            |
| Limites configuráveis                     | Entregue    | `review_policies`; tela de gestão falta (item 12)                                                                                                                                                                                        |
| Denúncia e moderação                      | Entregue    | fila única, tela no backoffice                                                                                                                                                                                                           |
| Usuário banido tem avaliações ocultadas   | Entregue    | por operação, oculta na leitura e na média, reversível, com histórico (ADR-0027 §6)                                                                                                                                                      |
| Parceiro excluído retira material público | Entregue    | listagem e leitura por id de avaliações conferem se o estabelecimento ainda é descobrível; nada é reescrito, e tudo volta se ele voltar                                                                                                  |

## 9. Moderação e conteúdo proibido

| Item                                         | Situação | Onde / observação                                                                                                                                                                            |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fluxo de denúncia e recursos administrativos | Entregue | avaliação, resposta, estabelecimento, experiência, evento e item de vitrine, numa fila só; ocultar conteúdo do parceiro é arquivá-lo (ADR-0028 §4)                                           |
| Ocultar ou remover conteúdo proibido         | Entregue | avaliação e resposta por denúncia; conteúdo do parceiro por arquivamento                                                                                                                     |
| Parceiro não apaga avaliação nem altera nota | Entregue |                                                                                                                                                                                              |
| **Moderação automática razoável**            | Entregue | detectores determinísticos de contato, dados de pagamento, links e termos bloqueados; cada ocorrência abre denúncia na fila única e nada é apagado; modo por regra e por operação (ADR-0031) |

## 10. Recursos do Explorador

| Item                           | Situação | Onde / observação                                                                                                                                                                                                                   |
| ------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Favoritar estabelecimentos     | Entregue | ADR-0030                                                                                                                                                                                                                            |
| Favoritar **conteúdos**        | Entregue | experiências e eventos; item de vitrine fica de fora por decisão, porque favoritar produto com preço seria o primeiro passo do checkout que o §16 exclui — pendente de confirmação do contratante (ADR-0030, revisão de 23/09/2026) |
| Seguir parceiros               | Entregue | segue o estabelecimento (ADR-0030)                                                                                                                                                                                                  |
| Compartilhar                   | Entregue | estabelecimento e experiência pela folha do sistema; experiência sem página própria compartilha o endereço público do estabelecimento com o título dela                                                                             |
| Interesses para personalização | Parcial  | registrados; não alteram ordenação — ranking cria proeminência e está pendente do contratante (ADR-0030)                                                                                                                            |
| Criar e salvar roteiros        | Entregue | privados do autor                                                                                                                                                                                                                   |
| Histórico de utilizações       | Entregue | carteira                                                                                                                                                                                                                            |
| Denunciar                      | Entregue | mesma ressalva do item 9                                                                                                                                                                                                            |

## 11. Concierge IA

| Item                                                    | Situação    | Onde / observação                                                                                                                                                                                  |
| ------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sugerir lugares cadastrados                             | Entregue    | ADR-0029                                                                                                                                                                                           |
| Considerar interesses do Explorador, "quando aplicável" | Entregue    | rota autenticada própria; interesses escolhem quais lugares entram no contexto quando não cabem todos, não são enviados ao provedor e não mudam a ordem da busca (ADR-0029, revisão de 23/09/2026) |
| Sugestões de roteiro, explicar opções                   | Entregue    | respostas citam itens do catálogo                                                                                                                                                                  |
| Reduzir invenção                                        | Entregue    | validação determinística contra o catálogo                                                                                                                                                         |
| Não realizar reservas nem compras                       | Entregue    | módulo sem escrita                                                                                                                                                                                 |
| Provedor, modelo e limites                              | Contratante | item 15                                                                                                                                                                                            |

## 12. Painel administrativo web

| Item                                                    | Situação | Onde / observação                                                                                                                                  |
| ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestão de Exploradores e contas                         | Entregue | `users`                                                                                                                                            |
| Gestão de parceiros, dados públicos, status e conteúdos | Entregue | moderação de revisões e de conteúdo                                                                                                                |
| Gestão de **categorias**                                | Entregue | telas de famílias e categorias, regiões e cidades no backoffice, sobre os mesmos serviços da API                                                   |
| Gestão de vouchers, benefícios, experiências e eventos  | Entregue |                                                                                                                                                    |
| Gestão das **regras de avaliação** e moderação          | Entregue | uma tela para a política de avaliação e as regras de moderação automática, com os valores marcados como provisórios até a definição do contratante |
| Denúncias e conteúdos sujeitos a moderação              | Entregue | `backoffice/reports`                                                                                                                               |
| Informações do catálogo e do Concierge                  | Parcial  | catálogo por tela; parâmetros do Concierge por variável de ambiente                                                                                |

## 13. Segurança

| Item                         | Situação               | Onde / observação                                                                   |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| Política mínima de senha     | Entregue               | mínimo de oito caracteres                                                           |
| Injeção e XSS                | Entregue por convenção | validação VineJS, consultas parametrizadas, escape do React; sem auditoria dedicada |
| Segredos fora do repositório | Entregue               | `.env` fora do Git; allowlist no deploy                                             |
| Biometria e 2FA              | fora, salvo definição  | o anexo condiciona a definição expressa                                             |

## 14. Casos e regras expressamente definidos

| Item                                         | Situação | Onde / observação             |
| -------------------------------------------- | -------- | ----------------------------- |
| Sem módulo de reservas                       | Entregue |                               |
| Parceiro desativado fora de busca e mapa     | Entregue |                               |
| Avaliações de usuário banido fora do público | Entregue | mesma implementação do item 8 |
| Exclusão de parceiro retira material público | Entregue | mesma implementação do item 8 |

Eram o maior risco no aceite, por serem regras que o próprio anexo chama de "expressamente definidas". O banimento foi entregue em 23/09/2026; resta conferir se as avaliações vinculadas saem com a exclusão do parceiro.

## 15. Itens que dependem de definição

Todos **pendentes do contratante** em 23/09/2026: comprovação de visita, limites de caracteres, fotos e vídeos por avaliação, limite diário e intervalo de edição, prazo de edição, gateway de pagamento, provedor de mapas, provedor e limites de IA, e comportamento em falha de GPS. O sistema opera com valores provisórios em política por tenant, nunca em constante.

## 17. Submissão às lojas e implantação

| Item                                | Situação    | Onde / observação                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Submissão à Google Play e App Store | Contratante | `eas.json` e configuração de build prontos, sem credenciais, com trava que impede build de produção apontando para a homologação; faltam as contas, a confirmação do identificador `br.com.experimentemais` e ícones de marca (os atuais são do template, §16) — ver `docs/store-submission.md` no app |
| Implantação inicial                 | Parcial     | homologação no ar; produção depende de infraestrutura do contratante (cláusula 2.3)                                                                                                                                                                                                                    |

## Ordem de construção

Em 23/09/2026 todas as lacunas que dependiam só dos contratados foram construídas. O que resta depende do contratante:

- **Assinatura do contrato** e as definições do item 15 — gateway, mapas, provedor e limites de IA, parâmetros de avaliação e comportamento em falha de GPS.
- **Login social** Google e Apple, condicionado às contas dele (item 2).
- **Contas de desenvolvedor**, identificador de distribuição, ícones e textos das lojas (item 17).
- **Confirmações:** que "assinatura anual" é a compra de edição anual implementada (item 5); se a ativação deve exigir telefone **e** e-mail (item 3); se interesses devem alterar a ordem da descoberta (item 10); se item de vitrine pode ser favoritado (item 10); se banimento deve também impedir a escrita (ADR-0027).
- **Vídeos** em avaliações, propostos como corte próprio (item 8).
