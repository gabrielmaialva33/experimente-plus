# Fundação clara e tokens canônicos do catálogo

Fonte executável: [`inertia/css/app.css`](../../inertia/css/app.css); exposição em [`tailwind.config.css`](../../inertia/css/tailwind.config.css). Revisão de 08/09/2026: opção B — Neutro frio aprovada, com escuro funcional e seleção pelo dispositivo preservada. O app deriva os valores desta tabela; não há autorização para redesenhar navegação, copy ou contratos.

## Princípios de construção

- **P1 — escala perceptual:** valores completos `oklch(L C h)`, L em 0–1, C absoluto, h em graus. Permite variar claridade separadamente do croma; não confundir L com luminância WCAG. Todos os valores foram contidos em sRGB, sem depender de gamut mapping do dispositivo.
- **P2 — área e hierarquia:** canvas claro de baixo croma, conteúdo branco, sobreposição delimitada por borda e contato de 2 px. E0/E1/E2 são papéis, não uma regra de que todo overlay claro deva ser mais branco que branco. A composição usa grandes áreas discretas e pequenos acentos, sem impor uma quota 60–30–10 a cada tela.
- **P3 — identidade contextual:** azul institucional original `#13467c` preservado. Papel `#f3f5f7` em toda a página e texto de baixo croma equilibram a marca fria. Neutro frio `#e8ecf1` fica no estado neutro, não em faixas editoriais. A associação com hospitalidade/gastronomia é uma hipótese de direção visual, não uma lei psicológica.
- **P4 — saliência da conversão:** CTA claro escolhido `#e2661a` tem L≈0,652931 e C≈0,173621, com texto escuro para manter contraste. Laranja sólido fica em controles e sinais de benefício; não ocupa painéis inteiros. `cta-hover` é preenchimento, `cta-accent` é texto: não intercambiar.
- **P5 — semântica estável:** success verde, warning âmbar, info ciano, destructive vermelho e muted neutro. Estados nunca viram decoração e mantêm texto/ícone. Mapeamento operacional e precedência abaixo são preservados.
- **P6 — contraste por par:** texto normal ≥4,5:1; limites essenciais e foco ≥3:1. `border` é separador decorativo; `input` identifica controles. Texto auxiliar mantém cor opaca. Os cálculos seguem WCAG 2.2; APCA não substitui esse critério.
- **P7 — flat 2.0:** raios 4/8/12, cards sem sombra, sobreposição com contato duro de 2 px. Sem gradiente, halo, vidro, blur ou sombra difusa. Preservar AppBrand, Instrument Sans, skip link, foco e reduced motion.
- **P8 — continuidade escura:** cores anteriores do escuro convertidas para OKLCH, preservando o resultado sRGB arredondado. Papéis de estado e hover têm equivalente escuro; o alias contextual passa a ser E0 em ambos os temas. Não forçar claro nem remover `.dark`; refino estético completo do escuro permanece pendente.

Fundamentação: [CSS Color 4 / OKLab e OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab), [composição e contexto de cor — NN/g](https://www.nngroup.com/articles/color-enhance-design/), [contraste WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Os números escolhidos são decisões de projeto sob esses princípios, não valores prescritos pelas fontes.

## Escala de elevação e aplicação

| Nível                         | Token / alias                                | Onde aplicar                                                             | Princípio |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ | --------- |
| E0 — papel contínuo           | `--surface-base` / `--background`            | Página inteira, header, hero, todas as faixas, footer e barra fixa móvel | P2, P12   |
| E1 — conteúdo delimitado      | `--surface-raised` / `--card`                | Cards de conteúdo, ficha, edição/benefício, campos informativos          | P2        |
| E2 — sobreposição transitória | `--surface-overlay` / `--popover`            | Menu, popover, dialog/sheet e select aberto; nunca faixa da página       | P2, P7    |
| Contexto — alias legado       | `--surface-context` / `--context-foreground` | Resolve para background/foreground; não cria outro papel                 | P12       |

Claro: E0 `oklch(0.969195527 0.003425761 247.858256445)` / `#f3f5f7`; E1 branco puro; E2 branco puro, separado por borda e contato duro de 2 px. E2 não precisa superar a claridade do branco: sua relação de elevação vem de sobreposição transitória e contorno. Escuro conserva E0/E1/E2 crescentes e passa a usar E0 também no chrome fixo. Fotos reais conservam suas cores originais.

Raios web: `--radius: 0.75rem`; `rounded-sm/md/lg` = 4/8/12 px; `xl` é alias de 12 px, não um quarto degrau. No app: 4/8/12 unidades lógicas. `rounded-full` somente para círculos/pílulas. `--elevation-raised: none`; `--elevation-overlay: 0 2px 0 var(--border)`. App pode representar o contato com borda inferior de 2 unidades, sem elevação nativa difusa. Scrim modal: `--scrim` a 60%, sem blur; o plano inferior fica inerte. Foco: `--ring`, anel de 2 px; preservar o afastamento de 2 px onde já aplicado.

## Papel único, opção B — Neutro frio (08/09/2026)

**P12 — um papel, sem alternância editorial:** a opção escolhida pelo dono fixa background `#f3f5f7`, card `#ffffff`, primary `#13467c`, cta `#e2661a` e estado neutro `#e8ecf1`. A causa corrigida é a alternância de faixas, não apenas o tom do bege. Header, hero, categorias, “Como funciona”, rodapé, título do catálogo e chrome da carteira ficam sobre E0. Nenhuma faixa editorial tem exceção de fundo. `surface-context` é mantido só como alias compatível de background, sem consumidor editorial.

Cards brancos são unidades delimitadas por borda e espaçamento dentro desse papel: resumo do hero, cards de cidade/estabelecimento, seções da ficha e edição/benefício da carteira. Uma tag HTML `section` que contém a ficha, horários ou contato é um card de conteúdo, não uma faixa de fundo. Não transformar todo agrupamento em card. Na carteira, edição e benefício ficam em branco; hierarquia vem de título, espaçamento e borda, sem aninhamento bege.

Neutro frio de estado fica em `status-neutral`/`muted` (fechamento/histórico, benefício indisponível). `temporal-emphasis` é estado temporal localizado, com “Hoje” e faixa lateral; não serve como hero. Ausência usa cinza frio `content-absent`, também no ícone de EmptyState. Textos auxiliares usam muted-foreground opaco, sem exigir fundo muted. Metadados, contagens, ícones genéricos, moldura de galeria, detalhes de apresentação e recibos usam branco/inherência; não bege decorativo.

Exceções funcionais, todas **dentro de componentes delimitados**: estados success/warning/info/destructive; escolha selecionada em azul; aviso de agendamento; recibo de sucesso; placeholder cinza; “Hoje”; estados neutros. E2 é exclusivamente transitório (menu/dialog/popover), branco no claro com borda e contato duro. Barras fixas de navegação usam E0, não E2. O QR mantém branco puro também no escuro para preservar sua leitura; não é fundo de seção nem um tema forçado.

**Derivação:** primários escolhidos convertidos sRGB → sRGB linear → OKLab → OKLCH (D65) em precisão de ponto flutuante, conferidos no gamut antes de arredondar para nove casas. Não houve clipping. primary-soft/hover/ring/choice-border conservam a família do azul convertido; primary-accent e accent são aliases. CTA-soft/accent/hover usam a família do novo laranja com L/C próprios para contraste. Texto, auxiliar, border e input reduzem croma para manter os suportes na família fria; secondary passa a card. A tabela completa abaixo é o contrato de valores, incluindo aliases resolvidos para o app.

**Distinção mensurada — opção B:** ausência `oklch(0.875 0.006 255)`, estado fixado pelo dono e hoje `oklch(0.988 0.004 255)` ocupam neutros frios de baixo croma. Distâncias ΔEOK claras, ausência/estado, ausência/hoje e estado/hoje: **0.066507**, **0.113018**, **0.046695**. No escuro: **0.046120**, **0.140289**, **0.108200**. O piso >0,04 permanece proteção de regressão, não norma WCAG. A separação agora usa sobretudo L, sem recriar família bege.

Os preenchimentos de estado e hoje têm contraste baixo contra o papel (1.086:1, 1.056:1), portanto não se afirma que o preenchimento sozinho basta. Ausência tem identificador tracejado, hoje tem faixa lateral de 4 px e texto “Hoje”, estado tem rótulo operacional em badge. Bordas de ausência e hoje superam 3:1 contra o papel. São sinais flat, sem padrão decorativo de fundo nem sombra. No escuro, o antigo amarelo de hoje passa a neutro frio; demais valores de estado e marca são preservados.

Regressão de composição: `inertia/tests/components/public/public_experience.test.tsx` renderiza Home e shells reais, exige papel nos bands/header/footer/nav e mantém cards brancos delimitados. `design_tokens.test.ts` fixa os cinco HEX, gamut, aliases, contraste e distâncias. No escuro, composição de papel único funciona sem forçar claro; o refino estético dos valores escuros permanece pendente de avaliação do dono.

## Valores completos para web e app

Cada célula traz **CSS OKLCH exato / HEX sRGB de 8 bits**. O app deve usar o HEX correspondente ao tema se sua camada não aceitar OKLCH. A cor já está no gamut sRGB; não aumentar saturação ou recalcular harmonias no cliente. Web: `var(--token)` diretamente, nunca `hsl(var(--token))` ou `oklch(var(--token))`, pois o valor já é uma cor completa. Aliases `background/card/popover` apontam para E0/E1/E2. Os princípios da última coluna justificam o papel; no escuro soma-se P8. `scrim` é herdado da base.

| Token CSS                        | Claro — OKLCH / HEX                                        | Escuro — OKLCH / HEX                           | Princípios                            |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| `--surface-base`                 | `oklch(0.969195527 0.003425761 247.858256445)` / `#f3f5f7` | `oklch(0.190579 0.018873 275.681)` / `#11131c` | P2, P3                                |
| `--surface-raised`               | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.254256 0.036457 274.849)` / `#1d2134` | P2, P3                                |
| `--surface-overlay`              | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.311724 0.056823 274.068)` / `#282e4d` | P2, P3                                |
| `--surface-context`              | `oklch(0.969195527 0.003425761 247.858256445)` / `#f3f5f7` | `oklch(0.190579 0.018873 275.681)` / `#11131c` | P2, P3                                |
| `--context-foreground`           | `oklch(0.25 0.012 255)` / `#1e2227`                        | `oklch(0.972339 0.004673 84.5636)` / `#f7f6f2` | P3, P6                                |
| `--background`                   | `oklch(0.969195527 0.003425761 247.858256445)` / `#f3f5f7` | `oklch(0.190579 0.018873 275.681)` / `#11131c` | P2, P3                                |
| `--foreground`                   | `oklch(0.25 0.012 255)` / `#1e2227`                        | `oklch(0.972339 0.004673 84.5636)` / `#f7f6f2` | P3, P6                                |
| `--card`                         | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.254256 0.036457 274.849)` / `#1d2134` | P2, P3                                |
| `--card-foreground`              | `oklch(0.25 0.012 255)` / `#1e2227`                        | `oklch(0.972339 0.004673 84.5636)` / `#f7f6f2` | P3, P6                                |
| `--popover`                      | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.311724 0.056823 274.068)` / `#282e4d` | P2, P3                                |
| `--popover-foreground`           | `oklch(0.25 0.012 255)` / `#1e2227`                        | `oklch(0.972339 0.004673 84.5636)` / `#f7f6f2` | P3, P6                                |
| `--primary`                      | `oklch(0.391842381 0.105523416 253.364477316)` / `#13467c` | `oklch(0.743392 0.110862 251.054)` / `#75b0f0` | P3, P6                                |
| `--primary-hover`                | `oklch(0.34 0.092 253.364477316)` / `#0d3866`              | `oklch(0.81028 0.080506 250.516)` / `#9ac5f4`  | P3, P6                                |
| `--primary-foreground`           | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.191511 0.034882 274.072)` / `#0f1324` | P3, P6                                |
| `--primary-soft`                 | `oklch(0.958 0.019 253.364477316)` / `#e9f2fe`             | `oklch(0.331538 0.04734 250.976)` / `#23374d`  | P3, P6                                |
| `--primary-accent`               | `oklch(0.391842381 0.105523416 253.364477316)` / `#13467c` | `oklch(0.825784 0.081948 250.514)` / `#9ecafa` | P3, P6                                |
| `--secondary`                    | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.254256 0.036457 274.849)` / `#1d2134` | P2, P3                                |
| `--secondary-foreground`         | `oklch(0.25 0.012 255)` / `#1e2227`                        | `oklch(0.972339 0.004673 84.5636)` / `#f7f6f2` | P3, P6                                |
| `--muted`                        | `oklch(0.941476798 0.007996977 253.85459596)` / `#e8ecf1`  | `oklch(0.254256 0.036457 274.849)` / `#1d2134` | P2, P3                                |
| `--muted-foreground`             | `oklch(0.46 0.015 255)` / `#535961`                        | `oklch(0.828324 0.024104 84.5932)` / `#cec6b6` | P3, P6                                |
| `--accent`                       | `oklch(0.958 0.019 253.364477316)` / `#e9f2fe`             | `oklch(0.331538 0.04734 250.976)` / `#23374d`  | P3, P6                                |
| `--accent-foreground`            | `oklch(0.391842381 0.105523416 253.364477316)` / `#13467c` | `oklch(0.825784 0.081948 250.514)` / `#9ecafa` | P3, P6                                |
| `--cta`                          | `oklch(0.652931129 0.173621111 46.045497295)` / `#e2661a`  | `oklch(0.747823 0.15366 48.8186)` / `#f98c4d`  | P4, P6                                |
| `--cta-hover`                    | `oklch(0.7 0.155 46.045497295)` / `#eb7b42`                | `oklch(0.836053 0.093504 58.4456)` / `#f8bb8c` | P4, P6                                |
| `--cta-foreground`               | `oklch(0.22 0.028 46.045497295)` / `#26160f`               | `oklch(0.221969 0.038615 49.8432)` / `#29150a` | P4, P6                                |
| `--cta-soft`                     | `oklch(0.95 0.025 46.045497295)` / `#feeae1`               | `oklch(0.331312 0.049114 53.907)` / `#492f1d`  | P4, P6                                |
| `--cta-accent`                   | `oklch(0.45 0.105 46.045497295)` / `#833f1b`               | `oklch(0.836053 0.093504 58.4456)` / `#f8bb8c` | P4, P6                                |
| `--destructive`                  | `oklch(0.51 0.18 28)` / `#b72822`                          | `oklch(0.690037 0.157955 22.0757)` / `#ed6e6e` | P5, P6                                |
| `--destructive-hover`            | `oklch(0.45 0.16 28)` / `#9b1f1b`                          | `oklch(0.759377 0.1158 20.1165)` / `#f29292`   | P5, P6                                |
| `--destructive-foreground`       | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.200316 0.034587 20.5948)` / `#240f0f` | P5, P6                                |
| `--destructive-soft`             | `oklch(0.96 0.018 28)` / `#feeeeb`                         | `oklch(0.315933 0.059434 20.9791)` / `#4c2424` | P5, P6                                |
| `--destructive-accent`           | `oklch(0.44 0.15 28)` / `#94221d`                          | `oklch(0.812146 0.095733 19.3507)` / `#f9a9a9` | P5, P6                                |
| `--border`                       | `oklch(0.84 0.008 255)` / `#c7cbd0`                        | `oklch(0.410811 0.063788 274.616)` / `#40486d` | P2, P3                                |
| `--input`                        | `oklch(0.57 0.012 255)` / `#73787f`                        | `oklch(0.681873 0.045602 276.24)` / `#9197b6`  | P6                                    |
| `--ring`                         | `oklch(0.45 0.12 253.364477316)` / `#1a5695`               | `oklch(0.743392 0.110862 251.054)` / `#75b0f0` | P6                                    |
| `--scrim`                        | `oklch(0.133386 0.015892 273.521)` / `#06070e`             | `oklch(0.133386 0.015892 273.521)` / `#06070e` | P7                                    |
| `--success`                      | `oklch(0.49 0.115 155)` / `#117342`                        | `oklch(0.784753 0.160935 154.357)` / `#51d689` | P5, P6                                |
| `--success-foreground`           | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.190579 0.018873 275.681)` / `#11131c` | P5, P6                                |
| `--success-soft`                 | `oklch(0.956 0.027 155)` / `#e3f6e9`                       | `oklch(0.350415 0.048455 157.136)` / `#244230` | P5, P6                                |
| `--success-accent`               | `oklch(0.43 0.1 155)` / `#0e5f36`                          | `oklch(0.871761 0.101829 157.856)` / `#9aeabb` | P5, P6                                |
| `--warning`                      | `oklch(0.79 0.14 80)` / `#e9af41`                          | `oklch(0.823357 0.138274 78.2444)` / `#f6b951` | P5, P6                                |
| `--warning-foreground`           | `oklch(0.29 0.05 65)` / `#3c260e`                          | `oklch(0.265459 0.05917 57.8617)` / `#3a1d03`  | P5, P6                                |
| `--warning-soft`                 | `oklch(0.96 0.035 85)` / `#fdf1d8`                         | `oklch(0.347772 0.040173 80.4926)` / `#453821` | P5, P6                                |
| `--warning-accent`               | `oklch(0.43 0.075 65)` / `#6c461f`                         | `oklch(0.894623 0.092856 84.1027)` / `#f9d894` | P5, P6                                |
| `--info`                         | `oklch(0.48 0.085 230)` / `#1b6684`                        | `oklch(0.802723 0.106996 224.388)` / `#69cdf2` | P5, P6                                |
| `--info-foreground`              | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.190579 0.018873 275.681)` / `#11131c` | P5, P6                                |
| `--info-soft`                    | `oklch(0.957 0.022 230)` / `#e3f4fd`                       | `oklch(0.338604 0.038788 223.55)` / `#203c46`  | P5, P6                                |
| `--info-accent`                  | `oklch(0.43 0.075 230)` / `#185771`                        | `oklch(0.871998 0.070834 222.52)` / `#a1e0f7`  | P5, P6                                |
| `--chart-1`                      | `oklch(0.482999 0.136144 253.911)` / `#195fa9`             | `oklch(0.679133 0.140663 251.962)` / `#519cec` | P8; cores existentes preservadas      |
| `--chart-2`                      | `oklch(0.643847 0.197989 40.1886)` / `#eb550a`             | `oklch(0.725074 0.169254 47.5318)` / `#f97f39` | P8; cores existentes preservadas      |
| `--chart-3`                      | `oklch(0.600557 0.115234 230.003)` / `#148cb8`             | `oklch(0.75134 0.129544 227.307)` / `#3abeee`  | P8; cores existentes preservadas      |
| `--chart-4`                      | `oklch(0.603664 0.11314 164.187)` / `#2c966f`              | `oklch(0.755915 0.142212 164.125)` / `#3ecc98` | P8; cores existentes preservadas      |
| `--chart-5`                      | `oklch(0.542357 0.187441 298.325)` / `#804dcb`             | `oklch(0.65502 0.168272 300.277)` / `#a274e7`  | P8; cores existentes preservadas      |
| `--content-absent`               | `oklch(0.875 0.006 255)` / `#d3d6da`                       | `oklch(0.22 0.006 255)` / `#191b1d`            | P9–P11                                |
| `--content-absent-foreground`    | `oklch(0.43 0.02 255)` / `#49515b`                         | `oklch(0.83 0.015 255)` / `#c1c8d1`            | P9–P11                                |
| `--content-absent-border`        | `oklch(0.55 0.02 255)` / `#6a727d`                         | `oklch(0.46 0.018 255)` / `#515962`            | P9–P11                                |
| `--temporal-emphasis`            | `oklch(0.988 0.004 255)` / `#f9fbfe`                       | `oklch(0.36 0.015 255)` / `#383e45`            | P9–P11                                |
| `--temporal-emphasis-foreground` | `oklch(0.34 0.015 255)` / `#333840`                        | `oklch(0.9 0.015 255)` / `#d8dfe8`             | P9–P11                                |
| `--temporal-emphasis-border`     | `oklch(0.55 0.025 255)` / `#687380`                        | `oklch(0.7 0.025 255)` / `#94a0ae`             | P9–P11                                |
| `--choice-border`                | `oklch(0.6 0.045 253.364477316)` / `#6e829b`               | `oklch(0.7 0.045 253.59)` / `#8ba1ba`          | P9–P11                                |
| `--status-neutral`               | `oklch(0.941476798 0.007996977 253.85459596)` / `#e8ecf1`  | `oklch(0.254256 0.036457 274.849)` / `#1d2134` | Alias de `--muted`; P9–P11            |
| `--status-neutral-foreground`    | `oklch(0.46 0.015 255)` / `#535961`                        | `oklch(0.828324 0.024104 84.5932)` / `#cec6b6` | Alias de `--muted-foreground`; P9–P11 |
| `--status-neutral-border`        | `oklch(0.84 0.008 255)` / `#c7cbd0`                        | `oklch(0.410811 0.063788 274.616)` / `#40486d` | Alias de `--border`; P9–P11           |
| `--choice-background`            | `oklch(1 0 0)` / `#ffffff`                                 | `oklch(0.254256 0.036457 274.849)` / `#1d2134` | Alias de `--card`; P9–P11             |
| `--choice-foreground`            | `oklch(0.25 0.012 255)` / `#1e2227`                        | `oklch(0.972339 0.004673 84.5636)` / `#f7f6f2` | Alias de `--foreground`; P9–P11       |
| `--choice-selected`              | `oklch(0.958 0.019 253.364477316)` / `#e9f2fe`             | `oklch(0.331538 0.04734 250.976)` / `#23374d`  | Alias de `--primary-soft`; P9–P11     |
| `--choice-selected-foreground`   | `oklch(0.391842381 0.105523416 253.364477316)` / `#13467c` | `oklch(0.825784 0.081948 250.514)` / `#9ecafa` | Alias de `--primary-accent`; P9–P11   |
| `--choice-selected-border`       | `oklch(0.391842381 0.105523416 253.364477316)` / `#13467c` | `oklch(0.743392 0.110862 251.054)` / `#75b0f0` | Alias de `--primary`; P9–P11          |
| `--action-secondary`             | `oklch(0.969195527 0.003425761 247.858256445)` / `#f3f5f7` | `oklch(0.190579 0.018873 275.681)` / `#11131c` | Alias de `--background`; P9–P11       |
| `--action-secondary-foreground`  | `oklch(0.25 0.012 255)` / `#1e2227`                        | `oklch(0.972339 0.004673 84.5636)` / `#f7f6f2` | Alias de `--foreground`; P9–P11       |
| `--action-secondary-border`      | `oklch(0.57 0.012 255)` / `#73787f`                        | `oklch(0.681873 0.045602 276.24)` / `#9197b6`  | Alias de `--input`; P9–P11            |

## Contrastes calculados

Conversão OKLCH → OKLab → sRGB linear (D65); luminância `Y = 0.2126 R + 0.7152 G + 0.0722 B`; razão `(Ymax + 0.05)/(Ymin + 0.05)`. Sem arredondar os canais antes do cálculo. [WCAG 2.2, 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) e [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Não é uma certificação global de acessibilidade: são os pares especificados e testados.

| Texto / superfície                             |   Claro |  Escuro |
| ---------------------------------------------- | ------: | ------: |
| `foreground` / `background`                    | 14.63:1 | 17.05:1 |
| `foreground` / `card`                          | 15.99:1 | 14.65:1 |
| `foreground` / `popover`                       | 15.99:1 | 12.18:1 |
| `muted-foreground` / `background`              |  6.51:1 | 10.88:1 |
| `muted-foreground` / `card`                    |  7.12:1 |  9.35:1 |
| `muted-foreground` / `popover`                 |  7.12:1 |  7.77:1 |
| `primary` / `background`                       |  8.75:1 |  8.15:1 |
| `primary` / `card`                             |  9.57:1 |  7.00:1 |
| `primary` / `popover`                          |  9.57:1 |  5.82:1 |
| `primary-accent` / `background`                |  8.75:1 | 10.84:1 |
| `primary-accent` / `card`                      |  9.57:1 |  9.32:1 |
| `primary-accent` / `popover`                   |  9.57:1 |  7.75:1 |
| `cta-accent` / `background`                    |  7.10:1 | 10.94:1 |
| `cta-accent` / `card`                          |  7.76:1 |  9.40:1 |
| `cta-accent` / `popover`                       |  7.76:1 |  7.81:1 |
| `success-accent` / `background`                |  7.06:1 | 13.03:1 |
| `success-accent` / `card`                      |  7.72:1 | 11.20:1 |
| `success-accent` / `popover`                   |  7.72:1 |  9.31:1 |
| `warning-accent` / `background`                |  7.56:1 | 13.43:1 |
| `warning-accent` / `card`                      |  8.26:1 | 11.54:1 |
| `warning-accent` / `popover`                   |  8.26:1 |  9.60:1 |
| `info-accent` / `background`                   |  7.28:1 | 12.77:1 |
| `info-accent` / `card`                         |  7.96:1 | 10.98:1 |
| `info-accent` / `popover`                      |  7.96:1 |  9.13:1 |
| `destructive-accent` / `background`            |  7.67:1 |  9.91:1 |
| `destructive-accent` / `card`                  |  8.38:1 |  8.52:1 |
| `destructive-accent` / `popover`               |  8.38:1 |  7.08:1 |
| `primary-foreground` / `primary`               |  9.57:1 |  8.15:1 |
| `primary-accent` / `primary-soft`              |  8.48:1 |  7.11:1 |
| `cta-foreground` / `cta`                       |  5.10:1 |  7.37:1 |
| `cta-accent` / `cta-soft`                      |  6.67:1 |  7.30:1 |
| `success-foreground` / `success`               |  5.92:1 | 10.00:1 |
| `success-accent` / `success-soft`              |  6.86:1 |  7.78:1 |
| `warning-foreground` / `warning`               |  7.27:1 |  8.84:1 |
| `warning-accent` / `warning-soft`              |  7.35:1 |  8.32:1 |
| `info-foreground` / `info`                     |  6.40:1 | 10.25:1 |
| `info-accent` / `info-soft`                    |  7.05:1 |  8.08:1 |
| `destructive-foreground` / `destructive`       |  6.30:1 |  6.12:1 |
| `destructive-accent` / `destructive-soft`      |  7.42:1 |  7.09:1 |
| `primary-foreground` / `primary-hover`         | 11.80:1 | 10.29:1 |
| `cta-foreground` / `cta-hover`                 |  6.17:1 | 10.28:1 |
| `destructive-foreground` / `destructive-hover` |  8.08:1 |  8.07:1 |
| `secondary-foreground` / `secondary`           | 15.99:1 | 14.65:1 |
| `muted-foreground` / `muted`                   |  6.00:1 |  9.35:1 |
| `accent-foreground` / `accent`                 |  8.48:1 |  7.11:1 |
| `context-foreground` / `surface-context`       | 14.63:1 | 17.05:1 |
| `foreground` / `surface-context`               | 14.63:1 | 17.05:1 |
| `muted-foreground` / `surface-context`         |  6.51:1 | 10.88:1 |

Controles e foco (≥3:1):

| Par                         |  Claro | Escuro |
| --------------------------- | -----: | -----: |
| `input` / `background`      | 4.08:1 | 6.42:1 |
| `input` / `card`            | 4.46:1 | 5.52:1 |
| `input` / `popover`         | 4.46:1 | 4.59:1 |
| `input` / `surface-context` | 4.08:1 | 6.42:1 |
| `ring` / `background`       | 6.84:1 | 8.15:1 |
| `ring` / `card`             | 7.47:1 | 7.00:1 |
| `ring` / `popover`          | 7.47:1 | 5.82:1 |
| `ring` / `surface-context`  | 6.84:1 | 8.15:1 |

As regressões em `inertia/tests/css/design_tokens.test.ts` verificam também texto comum/auxiliar em superfícies suaves, gamut sRGB, identidade da marca, documentação dos HEX e manutenção escura. Use `*-foreground` sobre o preenchimento sólido correspondente, `*-accent` sobre `*-soft` ou superfícies neutras. `cta` luminoso não é token de texto sobre branco. `cta-accent` não é o novo fundo de hover: seu texto escuro não teria contraste suficiente. Gráficos preservam as cores anteriores e não definem pares de texto.

## Papéis semânticos e gramática de seleção — revisão 3

**P9 — uma função por papel:** ausência de conteúdo, situação operacional e orientação temporal não compartilham mais o mesmo neutro. A separação não depende só de cor: ausência mantém a composição de placeholder com contorno tracejado; funcionamento tem rótulo textual; hoje tem faixa lateral de 4 px e texto “Hoje”. **P10 — seleção consistente:** escolher uma opção sempre produz preenchimento suave azul + contorno azul de 2 px + marca ✓ + peso forte, sem sublinhado ativo. **P11 — forma distingue intenção:** filtros são pílulas persistentes; contatos são comandos retangulares. [WCAG, uso de cor](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) exige um sinal além de cor; esses detalhes também reduzem ambiguidade para quem enxerga todas as cores.

| Papel                      | Fundo                                  | Texto/ícone                                          | Borda                                    | Forma / sinal adicional                                                                           |
| -------------------------- | -------------------------------------- | ---------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Ausência de imagem         | `--content-absent`                     | `--content-absent-foreground`                        | `--content-absent-border`                | Área de placeholder; contorno tracejado no identificador. Cinza frio de baixo croma; não é estado |
| Ênfase temporal / hoje     | `--temporal-emphasis`                  | `--temporal-emphasis-foreground`                     | `--temporal-emphasis-border`             | Linha fria clara com faixa lateral de 4 px e “Hoje”; não é seleção nem disponibilidade            |
| Estado neutro              | `--status-neutral` → `--muted`         | `--status-neutral-foreground` → `--muted-foreground` | `--status-neutral-border` → `--border`   | Badge com “Fechado agora”, “Consulte o atendimento” ou histórico. Sem cor de erro                 |
| Escolha inativa            | `--choice-background`                  | `--choice-foreground`                                | `--choice-border`                        | Sem ✓ visível; espaço do marcador reservado                                                       |
| Escolha selecionada        | `--choice-selected` → `--primary-soft` | `--choice-selected-foreground` → `--primary-accent`  | `--choice-selected-border` → `--primary` | Preenchimento + contorno 2 px + ✓ + peso forte; sem sublinhado                                    |
| Ação secundária de contato | `--action-secondary`                   | `--action-secondary-foreground`                      | `--action-secondary-border`              | Retângulo de raio 8, altura 48, ícone da ação; sem ✓ e sem estado persistente                     |

**Não foi necessário colorir artificialmente o estado neutro:** a associação com `muted` permanece; o dono fixou o novo valor claro em `#e8ecf1`. `status-neutral` é um alias semântico para impedir que novos consumidores o tratem como ausência ou destaque temporal. `muted-foreground` ainda pode aparecer em texto de apoio; o fundo `muted` fica reservado ao estado nestas superfícies; não o usar nos dois papéis separados acima. Success/warning/info/destructive mantêm seus significados, e a tabela de precedência abaixo não muda.

### Um idioma, variantes somente de composição

- **Abas e controles segmentados de escolha única:** mesma aparência selecionada. Segmentos usam grupo compacto; abas podem usar grupo com linha de base contínua. Essa linha é sempre `choice-border`, da família azul, inclusive sob os itens inativos. O item ativo nunca ganha um sublinhado exclusivo. Na web, `TabsList` default/button/line conservam API e organização, mas `TabsTrigger` usa a mesma `choice-control`.
- **Navegação de contexto da cidade:** usa a mesma gramática visual, mas conserva links e `aria-current="location"`. Não transformar links de navegação em tabs falsos. Lista/mapa, quando o app controla painéis locais, mantém semântica de tab/radio; não existe mapa público novo nesta entrega web.
- **Chip de filtro interativo:** pílula (raio total), altura/alvo mínimo 44, mesma seleção azul + ✓. A web usa `FilterChip` com checkbox nativo; não impor exclusividade a filtros combináveis. Chip desmarcado fica sem ✓ e sem preenchimento selecionado. No formulário, marcação reflete o filtro editado; resultados só mudam ao enviar “Buscar”.
- **Resumo de filtro aplicado:** `AppliedFilterChip`, pílula de altura mínima 28, sempre selecionada e sem ação. Não simular botão. Todos os filtros efetivamente aplicados usam a mesma aparência, não somente categoria.
- **Contato secundário:** `Button variant="contact"`, altura 48 na ficha, raio 8. Hover usa accent/accent-foreground; não há checked/pressed persistente. A cor do texto não é o diferenciador primário. CTA de conversão continua separado.
- **Seleção não é foco:** anel de foco `ring`, 2 px e afastamento 2 px. Marca de seleção permanece quando o foco muda. Reduced motion continua global.

O destaque “Hoje” usa o fuso publicado da cidade, após hidratação, atualiza a cada minuto e ao retomar visibilidade. Fuso ausente/inválido suprime o destaque. Não recalcula `is_open_now`, não substitui exceções de funcionamento e não modifica validade/elegibilidade. Um dia marcado “Hoje” pode mostrar “Fechado”.

### Contrastes dos papéis novos (WCAG 2.2)

| Par texto / fundo                                    |   Claro |  Escuro |
| ---------------------------------------------------- | ------: | ------: |
| `content-absent-foreground` / `content-absent`       |  5.55:1 | 10.26:1 |
| `temporal-emphasis-foreground` / `temporal-emphasis` | 11.35:1 |  8.06:1 |
| `status-neutral-foreground` / `status-neutral`       |  6.00:1 |  9.35:1 |
| `choice-foreground` / `choice-background`            | 15.99:1 | 14.65:1 |
| `choice-selected-foreground` / `choice-selected`     |  8.48:1 |  7.11:1 |
| `action-secondary-foreground` / `action-secondary`   | 14.63:1 | 17.05:1 |

Contornos interativos e faixa temporal (≥3:1):

| Par                                              |  Claro | Escuro |
| ------------------------------------------------ | -----: | -----: |
| `choice-border` / `choice-background`            | 3.94:1 | 5.96:1 |
| `choice-border` / `choice-selected`              | 3.49:1 | 4.55:1 |
| `choice-selected-border` / `choice-selected`     | 8.48:1 | 5.34:1 |
| `action-secondary-border` / `action-secondary`   | 4.08:1 | 6.42:1 |
| `temporal-emphasis-border` / `temporal-emphasis` | 4.68:1 | 4.07:1 |

Os testes medem também distância OKLab entre ausência, estado neutro e ênfase temporal, além dos contrastes e dos marcadores. O piso ΔEOK >0,04 é um critério de regressão desta paleta, não um limiar WCAG nem garantia universal de percepção.

## Área medida — opção B

Capturas de componentes reais com fixtures, Chromium, largura 1440 px, viewport de 1000 px e captura de página inteira. Contagem de todos os pixels PNG com Pillow, sem estimar pela área dos elementos DOM. A amostra não contém fotos reais; ausência é placeholder. Distribuição varia com conteúdo, viewport e fotografias. Não é uma meta percentual universal.

| Tela / página inteira |  Pixels |   Papel | Cards brancos |  Azul¹ | Conversão¹ | Ausência |   Hoje | Estado neutro | Outros² |
| --------------------- | ------: | ------: | ------------: | -----: | ---------: | -------: | -----: | ------------: | ------: |
| home                  | 3061440 | 80.759% |       14.546% | 0.325% |     0.545% |   0.000% | 0.000% |        0.000% |  3.825% |
| cities                | 1440000 | 77.317% |       18.821% | 0.842% |     0.000% |   0.001% | 0.000% |        0.000% |  3.020% |
| listing               | 2229120 | 70.685% |       15.582% | 0.628% |     0.214% |  10.281% | 0.000% |        0.081% |  2.531% |
| detail                | 2577600 | 54.426% |       27.901% | 0.607% |     0.582% |  12.460% | 1.307% |        0.000% |  2.715% |
| wallet                | 1440000 | 53.499% |       42.820% | 0.416% |     1.047% |   0.001% | 0.000% |        0.000% |  2.217% |

¹ Grupo de cores canônicas de primary/seleção/contornos ou cta, mais pixels de mistura de antialias identificados por matiz/croma. Neutros frios não entram como azul só por terem h próximo: para misturas azuis, h=245–265° e C>0,02; misturas laranja h=30–65° e C>0,03. Preenchimentos suaves canônicos entram por RGB exato mesmo com croma menor. ² Texto, bordas, outros estados e cores não classificadas. Classes exclusivas; somam 100% antes de arredondar. Branco inclui eventuais textos brancos: contar cor não identifica sozinho a função DOM.

No primeiro viewport, o azul ocupa de 0,416% a 0,901% nesta amostra; na página inteira de 0,325% a 0,842%. A medição de estilos efetivos confirmou o mesmo papel nos headers, rodapés e faixas de todas as cinco telas em ambos os temas. Cards claros medidos são #ffffff. Portanto a marca continua em área pequena, sem fundo azul de seção. Evidências e contagens absolutas estão no relatório codex-paleta-b.md e no artefato /tmp/experimente-neutral/areas.json; a regra permanente está no código e nos testes, não depende da existência desses arquivos temporários.

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

| Papel visual             | Tokens canônicos                                                                                                            | Aplicação web                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Conversão principal      | `--cta`, `--cta-foreground`; hover `--cta-hover`                                                                            | `Button variant="cta"`                                     |
| Conversões secundárias   | `--action-secondary`, `--action-secondary-foreground`, `--action-secondary-border`; hover `--accent`, `--accent-foreground` | `Button variant="contact"`                                 |
| Instagram e compartilhar | `--foreground`; hover `--accent`, `--accent-foreground`                                                                     | `Button variant="ghost"`                                   |
| Marca e navegação        | `--primary`, `--primary-foreground`, `--primary-soft`, `--primary-accent`                                                   | Cabeçalhos, links e navegação; não estado de funcionamento |
| Foco                     | `--ring`, `--background`                                                                                                    | Anel e afastamento do foco nos controles                   |

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
