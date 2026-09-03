# Handoff para planejamento

```text
/make-plan Redesign Experimente+ — fundação visual, descoberta pública, navegação do consumidor e coerência com Portal/Backoffice. Current design failed audit at 10/30 with critical gaps in principles #2 useful, #3 aesthetic, #4 understandable, #5 unobtrusive, #6 honest, #8 thorough and #10 as little design as possible.

Primary user: pessoa da região procurando onde comer, beber ou viver uma experiência local.
Primary task: escolher cidade ou categoria, comparar opções e abrir uma ficha útil de estabelecimento com o mínimo de esforço.
Constraints: AdonisJS 7, React 19, Inertia e a base CSS/Tailwind existente; mobile-first; WCAG AA; linguagem pt-BR; visual flat 2.0; preservar contratos de domínio e funcionalidades EP-01 a EP-11; cidade não é tenant e organização pode possuir unidades em várias cidades.

Verdict paragraph (quoted from 03-verdict.md):
> REDESIGN: o Experimente+ possui contratos de domínio e partes acessíveis que merecem ser preservados, mas obteve 10/30 e falha em compreensão, honestidade, contenção visual e continuidade das jornadas; trocar apenas cores e sombras conservaria os problemas estruturais.

Why redesign and not refine: o total está abaixo de 20 e os princípios estruturais de utilidade, compreensão e honestidade ficaram em 1/3; uma troca cosmética preservaria rotas, linguagem e jornadas incoerentes.

Preserve from current design:
- Sequência pública cidade → categoria/busca → ficha → ação externa (`inertia/pages/catalog/cities.tsx:15-83`; `inertia/components/catalog/establishment_actions.tsx:67-160`).
- Tokens semânticos azul/laranja e `AppBrand` (`inertia/css/app.css:4-63`; `inertia/components/app_brand.tsx`).
- Skip link, foco visível, reduced motion e estados já implementados no login (`inertia/components/skip_link.tsx:1-15`; `inertia/css/app.css:173-192`; `inertia/components/auth/login_form.tsx:29-75`).
- Separação conceitual de organização e unidade no Portal (`inertia/pages/portal/organizations/new.tsx:64-70`).

Discard:
- Hero e autenticação baseados em gradientes, grid, halos, glassmorphism, sombras grandes e conteúdo duplicado. Evidence: `inertia/pages/home.tsx:67-75,112-190,227-265`; `inertia/layouts/auth/auth_split_layout.tsx:96-151`. Caused failure on principles #3, #5 and #10.
- Shell do consumidor que mistura carteira, dashboard operacional, rota pública inexistente e configurações sistêmicas. Evidence: `inertia/components/consumer/consumer_shell.tsx:11-100`; `app/modules/catalog/routes.ts:25-35`; `app/modules/web/routes.ts:57-78`. Caused failure on principles #2, #4 and #10.
- Vocabulário distribuído e contraditório de operação/workspace/tenant e utilização/resgate/validação. Evidence: `inertia/layouts/main/components/header.tsx:82-139`; `inertia/pages/wallet/index.tsx:97-127`; `inertia/pages/portal/redemptions/index.tsx:24-43`. Caused failure on principles #4 and #7.

Top 3–5 moves from the audit (verbatim):
1. Princípios #2 e #4 — Utilidade e compreensão: reconstruir a arquitetura de navegação por usuário e tarefa, corrigindo a rota inexistente, separando consumidor de operação e adotando um vocabulário único para operação, organização, estabelecimento, edição e utilização. Evidência: `01-evidence.md#2-utilidade` e `01-evidence.md#4-compreensão`.
2. Princípio #10 — Menos, porém melhor: remover CTAs, categorias e destinos duplicados; cada tela terá uma ação primária, uma sequência clara e chrome proporcional à tarefa. Evidência: `01-evidence.md#10-menos-porém-melhor`.
3. Princípios #3 e #5 — Estética e discrição: substituir a coleção de gradientes, halos, blurs, sombras e raios por uma fundação flat 2.0 com escalas curtas e profundidade somente como sinal de interação ou hierarquia. Evidência: `01-evidence.md#3-estética` e `01-evidence.md#5-discrição`.
4. Princípio #6 — Honestidade: renomear publicidade como “Patrocinado”, remover superlativos não sustentados, neutralizar a nota inicial do feedback e alinhar toda copy ao estado real do produto. Evidência: `01-evidence.md#6-honestidade`.
5. Princípios #8 e #9 — Detalhe e atenção: fechar estados, foco e contratos de acessibilidade, validar termos no cadastro e reduzir o JavaScript inicial da descoberta antes do piloto. Evidência: `01-evidence.md#8-cuidado-com-detalhes` e `01-evidence.md#9-peso-e-atenção`.

Redesign principles in priority order:
1. Principle #2 — Useful: a descoberta é direta e cada perfil permanece em uma navegação própria, sem rotas mortas nem saltos de contexto.
2. Principle #4 — Understandable: um conceito usa um único nome, controles seguem convenções web e a ação primária é reconhecível sem ajuda.
3. Principle #6 — Honest: anúncios, limitações, disponibilidade e estado do produto são descritos literalmente, sem superlativos ou defaults enviesados.
4. Principle #10 — As little design as possible: cada elemento justifica sua presença pela tarefa; decoração nunca repete ou compete com conteúdo.
5. Principle #8 — Thorough: empty, loading, error, success, focus e disabled são especificados para cada padrão interativo.

Deliverables for the plan:
- Nova arquitetura de informação, não derivada dos shells atuais.
- Fluxo primário mobile-first em baixa fidelidade, comparado lado a lado ao atual.
- Sistema de tokens curto: tipografia, spacing, raios, cor, borda e elevação funcional.
- Matriz única de componentes e padrões para público, consumidor, Portal e Backoffice.
- Glossário user-facing com fonte única no código e migração da copy existente.
- Checklist de estados empty, loading, error, success, focus e disabled.
- Plano de correção das rotas e transição para usuários das superfícies atuais.
- Critérios mensuráveis de corte: tarefa pública, navegação por perfil, WCAG AA, budget de JS e testes de regressão visual/funcional.

Anti-patterns to guard against:
- Portar a estrutura antiga sob novas cores.
- Transformar flat em ausência de sinais de clique.
- Criar cards para todo agrupamento ou usar sombras como decoração.
- Manter os dois sistemas visuais indefinidamente.
- Seguir tendência estética sem vínculo com tarefa, conteúdo ou evidência.
- Tratar a lista Preserve como opcional.
```
