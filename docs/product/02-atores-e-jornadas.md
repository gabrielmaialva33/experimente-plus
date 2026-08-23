# 02 — Atores e jornadas

## Base da especificação

A especificação inicial identifica cinco perfis:

- Explorador;
- Parceiro;
- Administrador;
- Moderador;
- Concierge IA.

O planejamento adiciona **Visitante** como estado não autenticado da experiência pública. Ele não substitui o Explorador; representa apenas alguém que ainda não criou conta.

## Visitante

### Objetivo

Descobrir opções locais sem enfrentar uma barreira de cadastro.

### Pode no MVP

- selecionar cidade;
- navegar por categorias e coleções;
- pesquisar estabelecimentos;
- aplicar filtros públicos;
- consultar ficha, endereço, horário e contatos;
- abrir rota, WhatsApp, telefone, site e redes sociais;
- compartilhar um link.

### Precisa criar conta para

- favoritar;
- criar listas ou roteiros pessoais;
- seguir parceiros;
- avaliar;
- denunciar com acompanhamento;
- personalizar recomendações;
- sincronizar dados entre dispositivos.

## Explorador

### Objetivo

Descobrir, organizar e compartilhar experiências locais de maneira personalizada.

### Capacidades da especificação

- criar conta e editar perfil;
- favoritar locais;
- avaliar;
- compartilhar experiências;
- denunciar;
- criar roteiros;
- salvar fotos;
- seguir parceiros;
- receber recomendações da IA;
- escolher interesses;
- recuperar senha;
- usar a conta em vários dispositivos;
- excluir a própria conta.

### Restrições da especificação

- não cria parceiros;
- não altera dados públicos oficiais de estabelecimento;
- não altera avaliações de outros usuários;
- não pratica spam;
- não publica conteúdo ofensivo;
- não cria contas falsas ou bots;
- não manipula localização;
- não burla benefícios;
- não reutiliza e-mail ou login social já cadastrado;
- não cria conta sem aceitar os termos.

A exigência de visita para avaliar ainda está aberta na especificação e não deve ser implementada até existir uma regra verificável.

### Jornada prioritária

```text
Acessa a plataforma
        ↓
Seleciona cidade ou permite localização
        ↓
Escolhe intenção, categoria ou pesquisa
        ↓
Compara resultados
        ↓
Abre a ficha de uma unidade
        ↓
Executa ação externa ou salva
        ↓
Retorna e recebe descoberta mais relevante
```

### Jornada autenticada posterior ao MVP

```text
Cria conta
        ↓
Escolhe interesses
        ↓
Favorita unidades e segue parceiros
        ↓
Organiza lista ou roteiro
        ↓
Registra visita ou avaliação
        ↓
Recebe recomendações personalizadas
```

## Parceiro

### Definição proposta

Parceiro é o usuário que administra uma **organização** e uma ou mais **unidades públicas**. A role global, sozinha, nunca concede acesso a todas as organizações: a autorização também exige membership e escopo da entidade.

### Capacidades da especificação

- criar experiências;
- alterar horário;
- adicionar fotos;
- responder avaliações;
- incluir item a ser vendido;
- criar eventos.

### Restrições da especificação

- não apaga avaliações;
- não altera nota;
- não publica conteúdo ofensivo;
- edita apenas o próprio parceiro/estabelecimento;
- não aprova eventos.

### Requisitos iniciais de cadastro presentes na especificação

- CNPJ válido;
- CEP válido;
- telefone válido;
- e-mail válido;
- categoria definida;
- horário de funcionamento;
- pelo menos uma foto.

Esses requisitos serão aplicados ao fluxo de publicação. Durante o planejamento do schema, ainda deve ser validado se haverá exceções legais para profissionais ou atividades que operem como pessoa física.

### Jornada de aquisição e publicação

```text
Cria conta ou entra
        ↓
Cria ou reivindica organização
        ↓
Informa dados legais e contatos
        ↓
Cria uma unidade
        ↓
Adiciona cidade, endereço e categorias
        ↓
Configura horários, atributos e mídia
        ↓
Submete para análise
        ↓
Recebe aprovação ou pendências
        ↓
Unidade é publicada
```

### Jornada de operação

```text
Atualiza dados
        ↓
Publica novidades permitidas
        ↓
Acompanha ações qualificadas
        ↓
Responde avaliações
        ↓
Participa de campanhas opcionais
```

## Moderador

### Objetivo

Proteger qualidade, segurança e confiança do catálogo sem receber acesso administrativo irrestrito.

### Capacidades propostas

- analisar organização e unidade pendente;
- aprovar, rejeitar ou solicitar correção;
- analisar denúncias;
- ocultar conteúdo em violação;
- revisar mídia e avaliações;
- registrar motivo e evidência da decisão;
- encaminhar casos graves ao Administrador.

### Não deve poder por padrão

- administrar roles e permissões globais;
- excluir contas de Administrador;
- alterar configurações de segurança;
- assumir uma organização;
- modificar nota ou autoria de avaliação;
- remover trilha de auditoria.

### Jornada

```text
Abre fila priorizada
        ↓
Consulta dados e histórico
        ↓
Valida requisitos
        ↓
Aprova, rejeita ou solicita correção
        ↓
Registra motivo
        ↓
Sistema audita e notifica o responsável
```

## Administrador

### Objetivo

Operar a plataforma e controlar estruturas globais.

### Capacidades propostas

- administrar usuários e acessos;
- cadastrar e manter cidades e regiões;
- administrar taxonomia e atributos;
- revisar qualquer organização ou unidade;
- suspender e reativar conteúdo;
- administrar campanhas institucionais;
- consultar auditoria e indicadores;
- definir políticas e limites globais.

A especificação atribui ao Administrador a exclusão de parceiro e a aprovação de evento. A política de exclusão física ainda precisa ser compatibilizada com auditoria, retenção e obrigações legais.

## Concierge IA

### Definição proposta

O Concierge IA é um ator de sistema, não uma conta humana comum. Suas consultas e ações devem ser identificadas na auditoria.

### Capacidades da especificação

- sugerir lugares;
- criar roteiros;
- explicar destinos.

### Restrições da especificação

- não inventa estabelecimentos;
- não inventa horários;
- não inventa eventos.

### Arquitetura de interação futura

```text
Usuário descreve intenção
        ↓
Concierge transforma intenção em consulta
        ↓
Ferramentas internas consultam catálogo publicado
        ↓
Resposta usa somente entidades e fatos retornados
        ↓
Fontes internas e entidades usadas ficam registradas
```

Quando um dado não estiver disponível, a resposta deve declarar a ausência, não preencher a lacuna.

## Matriz inicial de responsabilidade

| Ação                            | Visitante | Explorador | Parceiro próprio | Moderador | Administrador |
| ------------------------------- | --------: | ---------: | ---------------: | --------: | ------------: |
| Consultar catálogo publicado    |       sim |        sim |              sim |       sim |           sim |
| Favoritar e criar listas        |       não |        sim |              sim |       sim |           sim |
| Criar organização/unidade       |       não |        não |              sim |       não |           sim |
| Editar unidade                  |       não |        não |              sim |       não |           sim |
| Submeter para publicação        |       não |        não |              sim |       não |           sim |
| Aprovar publicação              |       não |        não |              não |       sim |           sim |
| Responder avaliação             |       não |        não |              sim |       não |           sim |
| Alterar nota de avaliação       |       não |        não |              não |       não |           não |
| Administrar cidades e taxonomia |       não |        não |              não |       não |           sim |
| Suspender conteúdo              |       não |        não |              não |       sim |           sim |
| Administrar roles globais       |       não |        não |              não |       não |           sim |

A matriz é conceitual. Permissions específicas serão definidas junto do primeiro domínio implementado.
