# Escopo da auditoria de design

## Produto auditado

Experimente+, no repositório `/home/gabrielmaia/Projects/personal/experimente-plus`.

A auditoria cobre o sistema visual compartilhado e três superfícies representativas:

- descoberta pública: início, cidades, catálogo e detalhe de estabelecimento;
- portal de organizações e estabelecimentos;
- backoffice operacional.

## Usuário e tarefa primários

O usuário primário é uma pessoa da região procurando onde comer, beber ou viver uma experiência
local. A tarefa primária é escolher uma cidade ou categoria, comparar opções e abrir uma ficha útil
de estabelecimento com o mínimo de esforço.

Portal e backoffice são superfícies secundárias no escopo. Elas serão avaliadas para verificar se o
mesmo vocabulário visual, os mesmos componentes e as mesmas regras de interação formam um produto
coeso, sem confundir cidade, organização, operação e estabelecimento.

## Restrições

- Stack existente: AdonisJS 7, React 19, Inertia e Tailwind/CSS do projeto.
- Direção desejada: flat, simples, contemporânea e profissional.
- Mobile-first e acessível, com foco em uso rápido no celular.
- Preservar os contratos de domínio e as funcionalidades EP-01 a EP-11.
- Não copiar a implementação do Tour Londrina nem reduzir o produto a restaurantes ou vouchers.
- Coerência: a mesma intenção deve usar o mesmo padrão visual e verbal em todas as superfícies.
- Coesão: cada tela e componente deve conter apenas elementos que contribuam para sua tarefa.

## Referências de avaliação

- Os dez princípios de bom design de Dieter Rams.
- Heurística de consistência e padrões de Jakob Nielsen.
- Design systems como linguagem compartilhada de componentes, padrões, conteúdo e estados.
- Pesquisa Exa registrada nas evidências da auditoria.

## Fora do escopo desta auditoria

- Criar funcionalidades de negócio novas.
- Alterar regras de tenant, organização, cidade, categoria ou publicação.
- Produzir identidade ilustrativa ou campanha de marketing antes de estabilizar a fundação visual.
