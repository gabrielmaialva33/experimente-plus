# ADR 0023 — Stack e navegação do cliente móvel

**Status:** aceito
**Data:** 4 de setembro de 2026
**Marco:** EP-13 — Cliente móvel
**Relacionados:** ADR-0001, ADR-0003, ADR-0013, ADR-0016, ADR-0021 e ADR-0022

## Contexto

O [ADR-0022](0022-contrato-api-movel-consumer-first.md) fixou o contrato de API consumido pelo aplicativo, mas registrou como adiadas a escolha de stack e a arquitetura de navegação do cliente, também listadas em [`17-aplicativo-movel-consumer-first.md`](../../product/17-aplicativo-movel-consumer-first.md).

Duas evidências tornaram a decisão madura. A primeira é o próprio contrato: credenciais persistentes só podem residir no Keychain/Keystore, a leitura de QR precisa de câmera real em Android e iOS, e a estratégia de sessão de uma PWA permanece indefinida. A segunda é a inspeção da referência de experiência registrada em [`06-referencias-de-mercado.md`](../../product/06-referencias-de-mercado.md), que mostrou uma navegação por abas com descoberta distribuída em três destinos e cromo de filtro duplicado entre lista e mapa.

A decisão precisa anteceder o scaffold porque a regra de composição por capabilities determina a forma da árvore de navegação, e reconstruí-la depois é caro.

## Decisão

### 1. React Native com Expo e TypeScript

O aplicativo é um cliente React Native distribuído com Expo, em TypeScript. A superfície é pequena — descoberta, carteira, conta e validação condicional — e toda regra permanece no servidor.

Alternativas descartadas e o motivo:

- **PWA**: o ADR-0022 proíbe persistir o refresh token em armazenamento acessível a JavaScript e mantém a estratégia de sessão web indefinida. A opção fica bloqueada pelo próprio contrato.
- **Webview sobre a aplicação Inertia**: a sessão web é cookie sobre SSR, enquanto o contrato móvel é bearer com rotação. Adotá-la importaria o modelo de sessão errado.
- **Flutter**: segundo ecossistema e segunda linguagem para um cliente fino, sem ganho correspondente.
- **React Native sem Expo**: exigiria manter os projetos nativos à mão sem benefício, já que os módulos necessários possuem plugin de configuração.

### 2. A árvore de navegação é composta depois do contexto

A navegação é por abas, com as telas de detalhe dentro da stack de cada aba. O conjunto de abas deriva da sessão e das capabilities projetadas por `GET /api/v1/me/context`:

```text
sem sessão    Explorar · Entrar
consumidor    Explorar · Carteira · Conta
parceiro      Explorar · Carteira · Validar · Conta
```

`Histórico` é uma tela dentro de `Validar`, não uma aba. As áreas de parceiro são **montadas** apenas após o contexto resolver; a interface nunca renderiza uma área privilegiada para escondê-la em seguida. Enquanto o contexto carrega, o aplicativo exibe o conjunto de consumidor em estado de esqueleto.

`partner.redemptions.validate` governa a presença de `Validar` e `partner.redemptions.read` a de `Histórico`. `partner.enabled` não compõe navegação sozinho. Em todos os casos o endpoint repete a autorização de domínio, conforme ADR-0022.

### 3. Cidade é estado de descoberta local e não troca a operação

O seletor de cidade é um controle persistente da área `Explorar`, guardado no dispositivo e restaurado entre execuções. Trocar de cidade não emite requisição de tenant, não rotaciona credencial e não altera a operação ativa.

A operação continua resolvida pelo hostname da base URL configurada no build, conforme ADR-0003 e ADR-0016. O aplicativo nunca envia `tenant_id` em rota pública.

### 4. Mapa é um modo de visualização de Explorar

Cidade, categoria, busca textual, abertura e atributos formam **um único estado de filtro**, compartilhado por uma lista e por um mapa alternáveis. O mapa não é uma aba e não possui cromo de filtro próprio.

A decisão evita a duplicação observada na referência de mercado, onde lista e mapa mantêm controles e estados separados para a mesma pergunta.

### 5. Sessão em armazenamento seguro com rotação serializada

Access e refresh token residem apenas no Keychain/Keystore. O cliente serializa em uma única operação em voo todas as chamadas que consomem refresh — renovação, criação e troca de operação — conforme a primitiva transacional descrita no ADR-0022. Uma renovação que retorne `401` encerra a sessão local e devolve a pessoa ao conjunto de abas sem sessão.

Tokens não alcançam log, crash report, analytics, área de transferência ou notificação. A URL de validação e o QR são conteúdo privado e não são persistidos.

### 6. Os tokens visuais são herdados da aplicação web

O aplicativo não cria uma paleta própria. Reutiliza os tokens já definidos em `inertia/css/app.css`, preservando a separação de papéis existente:

| Papel     | Token                                               | Uso                                     |
| --------- | --------------------------------------------------- | --------------------------------------- |
| Cromo     | `--primary`                                         | cabeçalho, navegação, marca e links     |
| Conversão | `--cta`                                             | ação de conversão e apresentação de uso |
| Estados   | `--success`, `--warning`, `--destructive`, `--info` | retorno de operação                     |

A ação de conversão nunca reutiliza a cor da marca. A escala de raio é curta e possui duas posições: `--radius` para superfícies e raio total apenas para chips e controles de filtro.

### 7. Tipos derivados do OpenAPI, sem SDK gerado

Os tipos de request e response são derivados de `docs/openapi.yaml`, que já possui regressão de paridade com o router. O cliente HTTP é escrito à mão sobre esses tipos.

Gerar um SDK permanece fora de escopo enquanto o contrato não estabilizar no piloto, conforme ADR-0022.

### 8. Distribuição

Builds de Android são produzidos localmente. Builds de iOS e de distribuição usam serviço de build remoto, porque a estação de desenvolvimento não possui macOS. Identificadores de aplicação, assinatura, canais de distribuição e observabilidade móvel permanecem decisões operacionais fora deste ADR.

## Consequências

### Positivas

- uma única linguagem e um único ecossistema entre backend, web e aplicativo;
- a composição por capabilities fica explícita na árvore de navegação, sem vazamento visual de área privilegiada;
- filtro único entre lista e mapa reduz estado, código e superfície de inconsistência;
- a identidade visual permanece coerente entre web e aplicativo sem um segundo sistema de design;
- iOS deixa de depender de uma estação macOS.

### Custos

- o serviço de build remoto passa a ser dependência para publicar iOS;
- a serialização de rotação exige uma primitiva de concorrência no cliente e testes específicos;
- tipos derivados do OpenAPI exigem regenerar e revisar a cada mudança de contrato;
- o mapa dentro de Explorar acopla dois modos de visualização ao mesmo estado, que precisa permanecer simples.

## Fora de escopo

- favoritos, avaliações, push, compartilhamento social e operação offline;
- checkout, assinatura e qualquer cobrança no aplicativo;
- login social e biometria como mecanismo de autenticação do servidor;
- arquivos e certificados de Universal Links e App Links;
- estratégia de sessão para PWA;
- geração de SDK e paginação de históricos sem evidência de volume.

## Cenários obrigatórios

- exploração pública funciona sem sessão e sem operação escolhida pela pessoa;
- o conjunto de abas de consumidor não exibe área de parceiro em nenhum instante do carregamento;
- `partner.redemptions.validate` ausente não monta `Validar`, e `partner.redemptions.read` ausente não monta `Histórico`;
- moderador sem membership de organização não recebe navegação de parceiro;
- trocar de cidade não emite requisição de tenant nem altera a operação ativa;
- a seleção de cidade sobrevive ao reinício do aplicativo;
- lista e mapa refletem o mesmo estado de filtro sem controles duplicados;
- duas requisições concorrentes que consumam refresh produzem um sucesso e um `401`;
- credenciais sobrevivem ao reinício do aplicativo sem aparecer em log, analytics ou crash report;
- a apresentação exibe contagem regressiva derivada de `expires_at` e oferece geração de novo código, sem estender validade localmente;
- a confirmação repetida após resposta ambígua devolve o mesmo comprovante.
