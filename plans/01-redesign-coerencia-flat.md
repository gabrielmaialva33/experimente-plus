# Plano 01 — Redesign coerente e flat do Experimente+

## Objetivo

Reconstruir a fundação visual e a arquitetura de navegação do Experimente+ para formar um produto
coerente entre descoberta pública, consumidor, Portal e Backoffice. A primeira entrega deve ser
mobile-first, flat 2.0, acessível e honesta, sem alterar contratos de domínio já aceitos.

O plano executa o handoff de `DESIGN-IS-2026-09-02/04-handoff-prompt.md` e preserva todas as
alterações de backend já existentes no worktree.

## Phase 0 — documentação descoberta e APIs permitidas

### Contratos de produto permitidos

- Tenant representa uma operação isolada, nunca cidade ou organização:
  `docs/architecture/decisions/0001-tenant-representa-operacao.md:8-79`.
- Cidade e categoria são dimensões públicas; o catálogo começa em `/cidades`:
  `app/modules/catalog/routes.ts:7-35`.
- Organização é a entidade privada; estabelecimento/unidade é o lugar público:
  `docs/architecture/decisions/0002-organizacao-e-unidade-sao-agregados-distintos.md:8-66`.
- Público, Portal e Backoffice possuem semântica e navegação distintas:
  `docs/architecture/decisions/0018-portais-operacionais-e-feedback-piloto.md:17-82`.
- Partner deriva de membership de organização, não de papel global:
  `docs/architecture/decisions/0007-rbac-global-com-policies-de-dominio.md:78-143`.
- Conteúdo pago deve ser rotulado “Patrocinado”:
  `docs/architecture/decisions/0003-catalogo-publico-sem-membership.md:87-132`.
- Vocabulário de benefícios: edição, oferta, acesso, benefício derivado, apresentação, utilização e
  comprovante; “resgate” pode permanecer no domínio interno:
  `docs/architecture/decisions/0019-edicoes-e-ofertas-de-beneficio.md:31-77`,
  `0020-acesso-a-edicao-e-carteira-derivada.md:7-94`,
  `0021-resgate-transacional-com-apresentacao-temporaria.md:30-100`.

### APIs frontend permitidas

- React 19 + Inertia 3 com `hydrateRoot`; manter o mesmo tree de providers no cliente e SSR:
  `inertia/app/app.tsx:21-43`, `inertia/app/ssr.tsx:33-47`.
- Inertia: `<Link>`, `usePage`, `useForm`, `router.visit/get/post/put/patch/delete`,
  `preserveScroll` e `preserveState` conforme usos atuais.
- Alias local: `~/`; não usar `@/` do EduGuard (`vite.config.ts:25-28`).
- Tailwind 4 configurado por CSS e tokens HSL semânticos:
  `inertia/css/tailwind.config.css:1-36`, `inertia/css/app.css:13-119`.
- Composição de classes por `cn(...inputs)` em `inertia/lib/utils.ts:1-9`.
- Primitivos canônicos em `inertia/components/ui/*`, especialmente:
  `button.tsx:370-422`, `input.tsx:119-171`, `card.tsx:24-194`,
  `badge.tsx:199-210`, `alert.tsx:197-225`.
- Formulário acessível por `inertia/components/forms/field.tsx:32-95` e
  `portal/establishment_editor/editor_field.tsx:21-72`.
- Toda shell mantém `SkipLink` primeiro e `main#conteudo-principal[tabIndex=-1]`:
  `inertia/components/skip_link.tsx:1-16`.
- Manter reduced motion de `inertia/css/app.css:173-192`.

### Padrões do EduGuard permitidos para adaptação

- Uma fonte central de navegação com rota, título, descrição, superfície, capability e breadcrumb:
  `/home/gabrielmaia/Projects/eduguard/eduguard/inertia/config/menu.config.tsx:34-370`.
- Matching da rota mais específica primeiro:
  `.../inertia/components/layouts/app-layout/sidebar-menu.tsx:24-122`.
- Cabeçalho compacto título/descrição/ações:
  `.../inertia/components/shared/page-header.tsx:12-27`.
- Empty state plano:
  `.../inertia/components/shared/empty-state.tsx:4-22`.
- Helper browser de atraso determinístico de requests:
  `.../tests/browser/helpers.ts:60-79`.

### Anti-pattern guards globais

- Não copiar tenant escolar, rotas, roles, tokens OKLCH, aliases ou layout completo do EduGuard.
- Não usar `createRoot`, `Helmet`, `@/`, `tw-animate-css` ou `role="content"`.
- Não introduzir novas bibliotecas de UI, animação ou design system.
- Não criar outro conjunto paralelo em `ui/core`; usar os primitives canônicos.
- Não portar a estrutura antiga apenas com novas cores.
- Flat não remove sinais de clique, foco, seleção, loading ou erro.
- Capability na navegação nunca substitui autorização server-side.

## Phase 1 — verdade de navegação e linguagem

### O que implementar

1. Criar uma configuração central, específica do Experimente+, para metadados de navegação das
   superfícies `public`, `consumer`, `portal` e `backoffice`. Copiar apenas o princípio do tree do
   EduGuard e o matching mais específico; manter tipos e rotas locais.
2. Fazer sidebar, header contextual e shell do consumidor consumirem essa fonte única quando
   aplicável.
3. Corrigir `Explorar` para `/cidades`; impedir que a navegação do consumidor caia em `/dashboard`
   ou apresente configurações operacionais como “Perfil”.
4. Centralizar rótulos user-facing que hoje variam por tela. Usar “operação” apenas em contexto
   administrativo, “estabelecimento” no público e “unidade” quando a relação com organização
   precisar ser explicitada.
5. Tornar publicidade explícita como “Patrocinado”.
6. Unificar linguagem do fluxo em “edição”, “benefício”, “acesso”, “apresentação”, “utilização” e
   “comprovante”; remover “campanha” quando o objeto for edição.
7. Remover copy desatualizada sobre checkout e fases futuras; neutralizar o feedback inicial sem
   nota pré-selecionada.

### Referências para copiar

- Rotas canônicas: `app/modules/catalog/routes.ts:7-35`, `portal/routes.ts:14-137`,
  `benefits/routes.ts:105-195,229-259`.
- Labels atuais: `inertia/lib/labels.ts:10-111`.
- Padrão `aria-current`: `inertia/layouts/main/components/sidebar.tsx:117-123,167-200`.
- Metadados/matching de referência no EduGuard citados na Phase 0.

### Verificação

- Testes de unidade para matching exato, rota filha mais específica e filtragem por superfície.
- Testes de componentes para consumer shell, sponsorship e nota inicial de feedback.
- `rg` não encontra link interno para `href="/estabelecimentos"`, “Destaque” condicionado a
  `isSponsored`, nem default de avaliação igual a 5.
- Rotas e autorização backend permanecem inalteradas.

### Guards

- Não inventar rota de perfil do consumidor; omitir o item até existir uma superfície coerente.
- Não copiar a densidade ou permission model do menu EduGuard.
- Não renomear classes/modelos/migrations de domínio nesta fase.

## Phase 2 — fundação visual flat 2.0

### O que implementar

1. Consolidar tokens em escalas curtas e explícitas: fonte, spacing, radius, border e elevação
   funcional. Ligar `--radius` aos namespaces do Tailwind 4 com o padrão do EduGuard, adaptado ao
   formato HSL local.
2. Usar de fato a fonte já carregada ou remover a carga externa incoerente; manter uma única família
   sans. Alinhar `theme-color` à marca.
3. Normalizar Button, Input, Card, Badge, PageHeader e EmptyState para a linguagem flat: borda nítida,
   contraste AA, raios contidos e sombra apenas quando indicar camada/interação.
4. Remover utilitários sem uso de gradiente/halo/grid/floating card e a animação idle `animate-ping`.
5. Definir um único contrato de container responsivo e aplicar primeiro às shells compartilhadas.
6. Preservar focus-visible, dark mode, disabled, invalid e reduced motion.

### Referências para copiar

- Tokens locais: `inertia/css/app.css:7-119`, `tailwind.config.css:1-36`.
- Radius Tailwind v4: EduGuard `inertia/css/app.css:97-104`.
- Primitives e PageHeader locais citados na Phase 0.
- EmptyState de referência: EduGuard `inertia/components/shared/empty-state.tsx:4-22`.

### Verificação

- Testes dos primitives mantêm accessible name, disabled, invalid e asChild.
- Contraste de CTA e texto primário alcança WCAG AA.
- `rg` confirma remoção de `animate-ping`, `bg-grid-pattern`, `tech-gradient`, `floating-card` e
  `backdrop-blur-2xl` das superfícies de produto.
- Screenshot manual em 390×844, 768×1024 e 1440×900 confirma ausência de overflow.

### Guards

- Não misturar OKLCH e HSL.
- Não testar somente classes Tailwind; validar comportamento e computed style.
- Não eliminar borders/rings que comunicam interatividade.

## Phase 3 — descoberta pública

### O que implementar

1. Reescrever home como uma jornada curta: proposta literal, seleção/entrada para cidades, categorias
   representativas sem duplicação e um CTA secundário honesto para cadastro.
2. Simplificar PublicHeader, PublicFooter e navegação móvel, preservando convenções e acesso sem
   login.
3. Simplificar CatalogShell, busca/filtros, cards e empty states. Todo card deve possuir um destino
   coerente sem três affordances concorrentes.
4. Preservar cidade → categoria/busca → ficha → ação externa e dados moderados.
5. Garantir que “Patrocinado” seja saliente sem sugerir qualidade orgânica.

### Referências para copiar

- Shell acessível: `inertia/components/public/public_shell.tsx:26-46`.
- Fluxo atual: `inertia/pages/catalog/cities.tsx:15-83`,
  `catalog/establishment_actions.tsx:67-160`.
- Search form test: `inertia/tests/components/catalog/catalog_search_form.test.tsx:1-93`.

### Verificação

- Vitest cobre home/header/search/card/empty state e acessibilidade de filtros.
- Browser cobre skip link, teclado, navegação pública e viewports 390/768/1440.
- Sem login, `/cidades` e catálogo permanecem acessíveis.
- O card inteiro tem um destino previsível e nenhum falso alvo.

### Guards

- Não transformar a home em campanha publicitária ou dashboard.
- Não duplicar categorias ou CTA de cadastro em três regiões.
- Não usar superlativos como “melhor” ou “exclusivo” sem dado.

## Phase 4 — autenticação e consumidor

### O que implementar

1. Simplificar AuthSplitLayout e páginas de login/cadastro, removendo painel decorativo dominante e
   mantendo contexto útil em layout responsivo.
2. Tornar consumidor uma superfície própria: Explorar, Carteira e Conta apenas se houver destino
   realmente consumidor. Não usar dashboard genérico como início.
3. Corrigir copy da carteira: acesso não implica compra; histórico usa “Utilizações”.
4. Implementar aceitação obrigatória de Termos de Uso e Política de Privacidade apenas com páginas e
   rotas reais; validar no backend sem persistir afirmação falsa.
5. Preservar loading, erro, disabled, foco e anúncios ARIA; adicionar `aria-busy` onde necessário.

### Referências para copiar

- Field acessível: `inertia/components/forms/field.tsx:32-95`.
- Estados do login: `inertia/components/auth/login_form.tsx:29-75`.
- Tests de estado: `pilot_feedback_form.test.tsx:79-120`, `confirm_dialog.test.tsx:44-73`.

### Verificação

- Functional test exige aceite de termos no cadastro.
- Component/browser tests cobrem skip link, loading determinístico, erro e fluxo mobile.
- Consumer shell não referencia `/dashboard`, `/settings` nem rota inexistente.

### Guards

- Não criar seleção fixa “sou Partner”; Partner deriva de organização.
- Não adicionar checkbox com links inexistentes.
- Não usar autofocus para impedir acesso inicial ao skip link.

## Phase 5 — Portal e Backoffice coerentes

### O que implementar

1. Separar navegação e contexto visual de Portal e Backoffice usando a configuração central da
   Phase 1 e capabilities atuais.
2. Substituir títulos inferidos por prefixos amplos por metadata da rota mais específica.
3. Aplicar PageHeader, EmptyState, Card e forms normalizados às páginas representativas de Portal,
   moderação e benefícios sem reescrever regras de negócio.
4. Remover jargão exposto: slug → endereço da página; tenant → operação quando necessário;
   PublicationGate/gates → pendências para publicação; IDs → seletores/rótulos humanos.
5. Traduzir Settings e Files para pt-BR e posicioná-los somente na superfície apropriada.

### Referências para copiar

- PageHeader local: `inertia/components/page_header.tsx:21-54`.
- Explicação organização/unidade: `portal/organizations/new.tsx:64-70`.
- Capability filtering atual: `main/components/sidebar.tsx:125-145`.
- Cabeçalho compacto EduGuard citado na Phase 0.

### Verificação

- Testes por capability confirmam visibilidade de menu sem substituir testes de autorização.
- Títulos de receipt, benefits e editor vêm da rota específica.
- `rg` não encontra termos banidos em strings user-facing nem páginas integralmente em inglês.
- Testes funcionais existentes de Portal/Backoffice permanecem verdes.

### Guards

- Não mover autorização para React.
- Não alterar contratos de controllers/services/repositories.
- Não criar uma sidebar única com todos os domínios.

## Phase 6 — verificação final e corte

### Checklist técnico

- `mise exec node@24 -- pnpm typecheck`
- `mise exec node@24 -- pnpm lint`
- `mise exec node@24 -- pnpm test:e2e`
- `mise exec node@24 -- pnpm test:ui`
- `mise exec node@24 -- pnpm build`
- `git diff --check`
- Greps dos anti-patterns de todas as fases.

### Checklist de produto

- Descoberta pública completa sem login em mobile e desktop.
- Público, consumidor, Portal e Backoffice têm navegação, título e linguagem próprios.
- Nenhuma rota morta ou salto não explicado para dashboard/settings.
- Toda publicidade diz “Patrocinado”.
- Todo conceito relevante usa o mesmo nome entre superfícies.
- Empty, loading, error, success, focus e disabled estão cobertos nos padrões interativos.
- Sem overflow horizontal em 390, 768 e 1440 px.
- Reduced motion e dark mode continuam funcionais.

### Critério de corte

O sistema anterior só é considerado substituído quando os testes, a inspeção visual e os greps de
anti-patterns passarem. Não manter dois sistemas visuais ou duas configurações de navegação em
paralelo além da fase necessária para migração.
