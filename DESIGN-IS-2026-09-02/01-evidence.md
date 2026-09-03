# Evidências da auditoria

## Referências externas pesquisadas com Exa

- A heurística de consistência de Nielsen define que o usuário não deve precisar descobrir se
  palavras, situações ou ações diferentes significam a mesma coisa. Consistência interna permite
  transferir aprendizado entre partes do produto: [NN/G — Consistency and Standards](https://www.nngroup.com/articles/consistency-and-standards/).
- Um design system é uma linguagem compartilhada de padrões, componentes e estilos, não somente
  uma coleção visual: [NN/G — Design Systems 101](https://www.nngroup.com/articles/design-systems-101/).
- Flat sem indicadores de ação aumenta a incerteza. A recomendação aplicável é preservar contraste,
  padrões conhecidos, feedback e profundidade apenas quando ela explica relações:
  [NN/G — Flat Design Best Practices](https://www.nngroup.com/articles/flat-design-best-practices/).
- Componentes e padrões devem registrar como foram validados, permitindo adaptação responsável ao
  serviço: [GOV.UK Design System — Get started](https://design-system.service.gov.uk/get-started/).

## 1. Inovação

- A descoberta pública usa o fluxo convencional cidade → categoria/busca → ficha → ação externa
  (`inertia/pages/catalog/cities.tsx:15-83`,
  `inertia/components/catalog/establishment_actions.tsx:67-160`).
- A home usa hero em duas colunas, cards de categoria, três passos e CTA final
  (`inertia/pages/home.tsx:67-266`).
- O diferencial comprovável está no recorte regional e na publicação moderada, não em uma interação
  inédita (`docs/product/01-visao-e-negocio.md:5-20`).

## 2. Utilidade

- A exploração pública funciona sem login, e “Explorar cidades” leva diretamente a `/cidades`
  (`inertia/pages/home.tsx:89-97`).
- No shell do consumidor, “Explorar” leva a `/estabelecimentos`, rota que não existe; as rotas
  públicas partem de `/cidades` (`inertia/components/consumer/consumer_shell.tsx:11-15`,
  `app/modules/catalog/routes.ts:25-35`).
- “Início” leva a `/`, mas o usuário autenticado é redirecionado ao dashboard operacional. “Perfil”
  leva a configurações de workspaces em inglês (`inertia/components/consumer/consumer_shell.tsx:11-15`,
  `app/modules/web/routes.ts:57-64`, `inertia/pages/settings/index.tsx:312-342`).
- A busca pública oferece cinco controles e apresentou corretamente um resultado publicado
  (`inertia/components/catalog/catalog_search_form.tsx:57-132`).

## 3. Estética

- A home renderizada apresentou 12 tamanhos tipográficos, 16 medidas de espaçamento, sete famílias
  de raio, quatro variações de sombra e 24 valores de cor computados.
- A home combina gradientes, grid decorativo, cinco halos/blurs, backdrop blur e sombras
  (`inertia/pages/home.tsx:67-75,112-114,179,210,227-265`).
- O login repete gradiente, halos, grid, backdrop blur e três cards translúcidos
  (`inertia/layouts/auth/auth_split_layout.tsx:100-142`).
- Os tokens azul/laranja e os componentes compartilhados fornecem uma base comum
  (`inertia/css/app.css:4-63`, `inertia/components/ui/button.tsx:7-68`).
- O menor contraste medido entre texto acionável foi 4,56:1: branco sobre o CTA laranja.

## 4. Compreensão

- Cidade e categoria seguem uma hierarquia coerente na descoberta; organização e unidade também
  são explicadas como conceitos distintos no Portal (`docs/product/02-atores-e-jornadas.md:78-94`,
  `inertia/pages/portal/organizations/new.tsx:64-70`).
- O conceito de operação aparece como “operação”, “espaço”, “espaço de trabalho”, “workspace” e
  “tenant” (`inertia/layouts/main/components/header.tsx:82-139`,
  `inertia/pages/settings/index.tsx:237-342`,
  `inertia/pages/portal/establishments/new.tsx:98-105`).
- A jornada de benefício alterna “edição”, “campanha”, “benefício”, “oferta”, “acesso”, “validação”,
  “utilização” e “resgate” entre superfícies
  (`inertia/pages/wallet/index.tsx:97-127`,
  `inertia/pages/portal/redemptions/index.tsx:24-43`,
  `inertia/pages/portal/redemptions/receipt.tsx:42-68`).
- Termos internos aparecem para o usuário: “Onboarding”, “Slug público”, “backend”, “tenant”,
  “PublicationGate”, IDs de organização/cidade e “Validador #...”
  (`inertia/pages/portal/organizations/new.tsx:64-66,122-137,220-225`,
  `inertia/pages/backoffice/moderation/show.tsx:83-86,147-177`,
  `inertia/pages/portal/redemptions/receipt.tsx:61-68`).

## 5. Discrição

- Na listagem pública medida, 11 de 22 elementos interativos pertencem ao chrome, fora do conteúdo
  principal.
- O hero contém grid, halos, badge, painel flutuante, sombra ampla e backdrop blur
  (`inertia/pages/home.tsx:67-75,112-150`).
- O login reserva aproximadamente metade da largura desktop a um painel institucional decorado
  (`inertia/layouts/auth/auth_split_layout.tsx:96-151`).
- Não há modal, notificação ou animação ociosa na carga inicial da listagem pública.

## 6. Honestidade

- Itens com `isSponsored` são apresentados como “Destaque”, embora a documentação determine
  identificação explícita de conteúdo pago (`inertia/components/catalog/establishment_grid.tsx:98-104`,
  `docs/product/01-visao-e-negocio.md:160-172`).
- “Descubra o melhor”, “Mais interessante do que você esperava” e “Benefício exclusivo” não possuem
  dado ou regra que sustente “melhor” ou “exclusivo” (`inertia/pages/home.tsx:63-81`,
  `inertia/pages/wallet/index.tsx:75-90`).
- O feedback obrigatório começa pré-selecionado em 5/5
  (`inertia/components/portal/pilot_feedback_form.tsx:61-67,153-175`).
- A carteira vazia fala em compra, embora checkout/pagamento ainda não exista
  (`inertia/pages/wallet/index.tsx:130-139`, `docs/product/14-acesso-e-carteira.md:44-65`).
- O backoffice descreve acesso e apresentação como futuros, embora já estejam implementados
  (`inertia/pages/backoffice/benefits/index.tsx:270-337`,
  `inertia/pages/backoffice/benefits/accesses.tsx:173-313`).

## 7. Longevidade

- A base semântica azul/laranja e o componente de marca são reutilizados.
- Gradientes, halos, glassmorphism, pills, sombras grandes e utilitários “Metronic” convivem no
  vocabulário atual (`inertia/css/app.css:195-372`).
- Rótulos de domínio são duplicados em mapas locais; `inertia/lib/labels.ts:10-111` centraliza apenas
  parte deles.

## 8. Cuidado com detalhes

- Login possui vazio inicial, loading, erro, foco e disabled; o erro usa `role=alert`
  (`inertia/components/auth/login_form.tsx:29-75`).
- O botão em loading não informa `aria-busy`.
- Catálogo possui vazio, filtros ativos, limpar filtros e foco; loading, erro e sucesso não aparecem
  na superfície consultada (`inertia/components/catalog/catalog_search_form.tsx:135-165`,
  `inertia/components/catalog/establishment_grid.tsx:35-46`).
- Skip link e redução de movimento existem. Na tela de login, `autoFocus` pula o skip link como
  primeira parada efetiva (`inertia/components/skip_link.tsx:1-15`,
  `inertia/components/auth/login_form.tsx:47`, `inertia/css/app.css:173-192`).
- O requisito de aceitar termos no cadastro está documentado, mas ausente no formulário e validador
  (`docs/product/02-atores-e-jornadas.md:63-74`,
  `inertia/components/auth/register_form.tsx:15-106`,
  `app/modules/users/validators/users_validator.ts:3-25`).

## 9. Peso e atenção

- A listagem pública de produção carregou 548.695 bytes de JavaScript decodificado em 23 arquivos e
  realizou 29 requests, com cache desativado em localhost.
- O TTI operacional medido foi 85,2 ms, sem throttling e sem long tasks; esse número não representa
  um aparelho móvel em rede real.
- Não havia animação ociosa. `prefers-reduced-motion` é respeitado globalmente
  (`inertia/css/app.css:173-192`).
- Uma imagem seed retornou `ENOENT` no build de produção, deixando um recurso visual ausente na
  amostra medida.

## 10. Menos, porém melhor

- As quatro categorias são apresentadas duas vezes na home
  (`inertia/pages/home.tsx:20-41,127-143,175-190`).
- O cadastro aparece no cabeçalho, hero e CTA final
  (`inertia/components/public/public_header.tsx:85-93`,
  `inertia/pages/home.tsx:94-98,250-254`).
- O card de estabelecimento oferece imagem, título e CTA separados para o mesmo destino
  (`inertia/components/catalog/establishment_grid.tsx:67-70,117-123,139-144`).
- No shell do consumidor, somente “Carteira” permanece dentro da mesma tarefa; os outros três
  destinos atravessam para superfícies distintas ou quebradas
  (`inertia/components/consumer/consumer_shell.tsx:11-100`).

## Lacunas conhecidas

- Portal e backoffice autenticados não foram medidos no navegador por falta de uma sessão válida.
- Mobile e dark mode não receberam a mesma medição visual do desktop.
- Não houve teste com usuários, leitor de tela ou throttling de rede/CPU.
- As métricas de bundle representam uma rota e uma execução local.
