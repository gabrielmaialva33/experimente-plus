import type { LucideIcon } from 'lucide-react'
import {
  CircleHelp,
  Compass,
  QrCode,
  Rocket,
  ShieldCheck,
  Smartphone,
  Store,
  UsersRound,
  WalletCards,
} from 'lucide-react'

import { MANUAL_MEDIA_PATH } from '~/config/help'
import { MANUAL_MEDIA, type ManualMediaId } from '~/content/manual_media'

/**
 * The user manual at /manual, as data: the page, the PDF, the search and the
 * contextual help all read it. Every task was run in the site (or in the app) before
 * it was written; the pictures come from the demonstration data.
 *
 * Inline text accepts two marks: **bold** (what the screen shows, exactly) and
 * [label](/path or #anchor). The `app-*` section anchors are a contract with the mobile
 * app, which opens them from its "Ajuda" entries: never rename one. The chapter itself is
 * `app-celular`: `#app` is the page's root element, so a link to it would not scroll.
 */

export const MANUAL_UPDATED_AT = '2026-09-27'

export interface ManualImage {
  id: ManualMediaId
  src: string
  width: number
  height: number
  alt: string
  caption?: string
  /** A phone screenshot is shown narrow; a computer one takes the column. */
  frame: 'desktop' | 'phone'
}

export type ManualBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: readonly string[] }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'note'; tone: 'info' | 'tip' | 'warning'; title: string; text: string }
  | { kind: 'figures'; images: readonly ManualImage[] }
  | {
      kind: 'table'
      caption: string
      columns: readonly string[]
      rows: readonly (readonly string[])[]
    }

export interface ManualSection {
  id: string
  title: string
  /** One line: what the task is for. */
  intro: string
  /** "Você vai precisar de": the account, profile or data the task assumes. */
  needs?: readonly string[]
  blocks: readonly ManualBlock[]
  /** What the reader sees when the task worked ("Pronto: …"). */
  result?: string
  /** "Se algo der errado". */
  troubleshooting?: readonly string[]
  /** Extra words the search finds the section by. */
  keywords?: readonly string[]
}

export interface ManualChapter {
  id: string
  title: string
  /** Who the chapter is for, in a few words. */
  audience: string
  /** The profiles the chapter serves ("Para: …"). */
  profiles: string
  summary: string
  /** One line the whole chapter needs, shown under "Para: …". */
  note?: string
  icon: LucideIcon
  sections: readonly ManualSection[]
}

export interface ManualStartCard {
  title: string
  text: string
  href: string
  icon: LucideIcon
}

function image(id: ManualMediaId, alt: string, caption: string): ManualImage {
  // A screenshot missing from the map must not take the site down with it (every page
  // shares the server bundle); the content tests fail on it instead.
  const { width, height } = MANUAL_MEDIA[id] ?? { width: 0, height: 0 }
  return {
    id,
    src: `${MANUAL_MEDIA_PATH}/${id}.webp`,
    width,
    height,
    alt,
    caption,
    frame: id.endsWith('-celular') || id.startsWith('app-') ? 'phone' : 'desktop',
  }
}

const p = (text: string): ManualBlock => ({ kind: 'paragraph', text })
const steps = (...items: string[]): ManualBlock => ({ kind: 'steps', items })
const list = (...items: string[]): ManualBlock => ({ kind: 'list', items })
const figures = (...images: ManualImage[]): ManualBlock => ({ kind: 'figures', images })
const tip = (title: string, text: string): ManualBlock => ({
  kind: 'note',
  tone: 'tip',
  title,
  text,
})
const info = (title: string, text: string): ManualBlock => ({
  kind: 'note',
  tone: 'info',
  title,
  text,
})
const warning = (title: string, text: string): ManualBlock => ({
  kind: 'note',
  tone: 'warning',
  title,
  text,
})
const table = (
  caption: string,
  columns: readonly string[],
  ...rows: (readonly string[])[]
): ManualBlock => ({ kind: 'table', caption, columns, rows })

/** The cards on top of the page: one per profile, then the app and the questions. */
export const MANUAL_START_CARDS: readonly ManualStartCard[] = [
  {
    title: 'Visitante',
    text: 'Explorar cidades, lugares, agenda e o Concierge, sem conta.',
    href: '#perfil-visitante',
    icon: Compass,
  },
  {
    title: 'Explorador',
    text: 'Criar a conta, ver os benefícios da carteira e mostrar o QR no lugar.',
    href: '#perfil-explorador',
    icon: WalletCards,
  },
  {
    title: 'Parceiro',
    text: 'Cuidar do seu negócio no Portal: dados, conteúdo, avaliações e benefícios.',
    href: '#perfil-parceiro',
    icon: Store,
  },
  {
    title: 'Equipe do Experimente+',
    text: 'Moderar, decidir denúncias e cuidar das regras e dos benefícios.',
    href: '#perfil-equipe',
    icon: ShieldCheck,
  },
  {
    title: 'Resgate por QR code',
    text: 'Mostrar o QR da carteira e validar o benefício no balcão, do começo ao comprovante.',
    href: '#resgate',
    icon: QrCode,
  },
  {
    title: 'App no celular',
    text: 'Instalar o app Android e usar mapa, compra, carteira e Validar.',
    href: '#app-celular',
    icon: Smartphone,
  },
  {
    title: 'Dúvidas frequentes',
    text: 'E-mail que não chegou, QR expirado, pagamento, lugar que não aparece.',
    href: '#duvidas',
    icon: CircleHelp,
  },
]

export const MANUAL_CHAPTERS: readonly ManualChapter[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros passos',
    audience: 'Para todo mundo',
    profiles: 'todos os perfis',
    summary: 'O que é o Experimente+, onde usar, como instalar e onde pedir ajuda.',
    icon: Rocket,
    sections: [
      {
        id: 'primeiros-passos-o-que-e',
        title: 'O que é o Experimente+',
        intro:
          'Um guia de lugares e experiências das cidades do norte do Paraná, com benefícios para usar nos próprios lugares.',
        blocks: [
          p(
            'Restaurantes, bares, cafés, cultura, lazer, bem-estar e serviços locais ficam organizados por cidade e por categoria. Qualquer pessoa explora sem criar conta. Com uma conta, você guarda benefícios na carteira e os usa no lugar mostrando um QR. Os negócios cuidam dos próprios dados pelo **Portal do parceiro**, e a equipe do Experimente+ revisa tudo antes de publicar.'
          ),
          figures(
            image(
              'inicio-home',
              'Página inicial do Experimente+ com o título "Encontre lugares e serviços na sua cidade" e o botão laranja "Escolher uma cidade" destacado.',
              'A página inicial. O botão Escolher uma cidade leva direto ao catálogo.'
            )
          ),
        ],
        keywords: ['sobre', 'plataforma'],
      },
      {
        id: 'primeiros-passos-onde-usar',
        title: 'Onde usar: site, app Android e iPhone',
        intro: 'Escolha o jeito de usar que combina com o seu aparelho.',
        blocks: [
          list(
            '**No computador ou em qualquer celular**: pelo navegador. Tudo o que é do site funciona assim, inclusive o Portal e a área da equipe.',
            '**No Android**: instale o app (veja [Como instalar o app no Android](#primeiros-passos-android)). Ele tem o mapa, a compra de pacotes e vouchers, as avaliações e a aba **Validar** para parceiros.',
            '**No iPhone**: o app para iOS chega depois. Instale o site na Tela de Início e use como um app (veja [Como instalar o site no iPhone](#primeiros-passos-iphone)).'
          ),
          tip(
            'Tema claro ou escuro',
            'O botão com o sol, no topo das páginas, à direita, troca entre o tema claro e o escuro. Com uma conta, em **Conta > Aparência**, você também pode seguir o tema do aparelho.'
          ),
        ],
        keywords: ['navegador', 'celular', 'computador', 'tema', 'escuro'],
      },
      {
        id: 'primeiros-passos-android',
        title: 'Como instalar o app no Android',
        intro:
          'Para ter o mapa, a compra e a aba Validar no celular. O app é uma versão beta, fora da Play Store.',
        needs: ['um celular Android 7.0 ou mais novo', 'espaço para um arquivo de cerca de 110 MB'],
        blocks: [
          steps(
            'No celular Android, abra a página [Baixar o app](/app). O link também está no rodapé de todas as páginas públicas, em **Baixar o app**. Se estiver no computador, aponte a câmera do celular para o QR da página.',
            'Toque no botão laranja **Baixar para Android**. Se puder, use o Wi-Fi.',
            'Abra o arquivo baixado. O Android pede para permitir apps desta fonte: permita. É o esperado, porque o app ainda não está na loja.',
            'Toque em **Instalar** e depois em **Abrir**.'
          ),
          figures(
            image(
              'inicio-app',
              'Página "O Experimente+ no seu celular" com o selo Beta e o botão laranja "Baixar para Android" destacado; o código QR da página aparece coberto.',
              'A página /app. O botão Baixar para Android fica logo abaixo do título.'
            )
          ),
        ],
        result:
          'o ícone do Experimente+ aparece no celular e o app abre em **Explorar**. Para atualizar, baixe de novo pela mesma página e instale por cima: a conta e os dados continuam.',
        troubleshooting: [
          'O Android não deixa instalar: nas opções que ele mostra, permita instalar apps do navegador que você usou para baixar.',
          'O arquivo não termina de baixar: confira a conexão e tente de novo, de preferência no Wi-Fi.',
        ],
        keywords: ['apk', 'baixar', 'instalar', 'android', 'atualizar'],
      },
      {
        id: 'primeiros-passos-iphone',
        title: 'Como instalar o site no iPhone',
        intro:
          'Para abrir o Experimente+ no iPhone como um app, em tela cheia, enquanto a versão para iOS não chega.',
        needs: ['um iPhone ou iPad com o Safari'],
        blocks: [
          steps(
            'No iPhone, abra a página [Baixar o app](/app) no **Safari**. A parte **Instale no iPhone** mostra estes mesmos passos.',
            'Na barra do Safari, toque em **Compartilhar** (o quadrado com a seta para cima). Se ele não aparecer, toque antes nos três pontos.',
            'Role as opções e escolha **Adicionar à Tela de Início**.',
            'Confirme em **Adicionar**.'
          ),
          figures(
            image(
              'inicio-iphone',
              'Parte "Instale no iPhone" da página /app no celular, com os passos Abra no Safari, Toque em Compartilhar e Adicione à Tela de Início destacados.',
              'Os passos para iPhone, como aparecem na página /app.'
            )
          ),
          info(
            'Em outros navegadores do iPhone',
            'No Chrome e no Edge do iPhone, a opção fica no mesmo menu **Compartilhar**.'
          ),
        ],
        result:
          'o ícone E+ fica na Tela de Início e abre o Experimente+ em tela cheia, sem a barra do Safari, com a mesma conta.',
        keywords: ['iphone', 'ios', 'safari', 'tela de início', 'pwa', 'atalho'],
      },
      {
        id: 'primeiros-passos-palavras',
        title: 'Palavras que aparecem nas telas',
        intro: 'Para entender os nomes que o Experimente+ usa, do cadastro ao comprovante.',
        blocks: [
          table(
            'Palavras do Experimente+',
            ['Palavra', 'O que quer dizer'],
            [
              'Operação',
              'A região atendida pelo Experimente+ (hoje, o norte do Paraná). Toda conta faz parte de uma operação, e o cadastro já faz essa ligação.',
            ],
            [
              'Seletor de operação',
              'O quadro com o nome da operação, no topo do Portal e da área da equipe. Mostra em que operação você está; quem participa de mais de uma troca por ali.',
            ],
            [
              'Membro da operação, Responsável pela operação',
              'Aparecem embaixo do menu azul e em **Conta**. Dizem só como a conta está ligada à operação e não dão permissões. Responsável pela operação não é o mesmo que **Responsável técnico**, o papel da equipe do Experimente+ que pode tudo na plataforma.',
            ],
            [
              'Organização (negócio)',
              'A empresa parceira, com razão social e CNPJ. Uma organização pode ter vários lugares, em cidades diferentes.',
            ],
            [
              'Lugar (unidade)',
              'Cada endereço que recebe o público: um restaurante, um café, um espaço cultural. Tem página própria no app e no site.',
            ],
            [
              'Edição',
              'O pacote de benefícios de uma cidade, com preço, período de venda e período de uso.',
            ],
            [
              'Oferta',
              'O que cada lugar oferece dentro de uma edição (por exemplo, "peça um, ganhe outro"). Quem cria é o parceiro.',
            ],
            [
              'Acesso',
              'O direito de uma pessoa a uma edição: nasce da compra, de uma cortesia ou de uma concessão da equipe. Aparece como um cartão na **Carteira**.',
            ],
            ['Benefício', 'Uma oferta dentro do acesso de uma pessoa: é o que ela usa no lugar.'],
            [
              'Apresentação',
              'O QR (ou o código) que a pessoa mostra no balcão para usar um benefício. Vale por 5 minutos.',
            ],
            [
              'Utilização',
              'O uso confirmado pelo lugar. Só conta depois de **Confirmar utilização**.',
            ],
            [
              'Comprovante',
              'O registro da utilização, com código, data e lugar. Fica em **Utilizações**, para a pessoa e para o lugar.',
            ],
            [
              'Resgate',
              'Usar o benefício: mostrar o QR, o lugar conferir e confirmar. Veja [Resgate por QR code](#resgate).',
            ]
          ),
        ],
        keywords: [
          'glossário',
          'significado',
          'operação',
          'organização',
          'negócio',
          'unidade',
          'edição',
          'oferta',
          'acesso',
          'apresentação',
          'utilização',
          'comprovante',
          'membro da operação',
          'responsável pela operação',
          'seletor',
        ],
      },
      {
        id: 'primeiros-passos-ajuda',
        title: 'Como encontrar ajuda enquanto usa o site',
        intro: 'Para abrir este manual na parte certa, sem perder o que você estava fazendo.',
        blocks: [
          steps(
            'Em qualquer página pública, role até o rodapé e toque em **Manual**.',
            'Na Carteira e na Conta, no Portal do parceiro e na área da equipe, toque no **?** (**Ajuda**) do topo, à direita.',
            'No menu que abre, escolha **Ajuda desta página** para ir direto à parte do manual sobre a tela em que você está. **Manual completo** abre o começo, e **Baixar manual em PDF** salva a versão para imprimir.'
          ),
          figures(
            image(
              'inicio-rodape',
              'Rodapé do site com os links Explorar cidades, Baixar o app, Manual, Termos de Uso e Privacidade; o link Manual está destacado.',
              'O link Manual, no rodapé das páginas públicas.'
            ),
            image(
              'parceiro-ajuda',
              'Menu de ajuda aberto no topo do Portal, com as opções Ajuda desta página (destacada), Manual completo e Baixar manual em PDF.',
              'O menu do ?, no topo da Carteira, do Portal e da área da equipe.'
            )
          ),
        ],
        result:
          'o manual abre em outra aba, já na parte certa. A aba de antes continua como estava.',
        keywords: ['manual', 'pdf', 'ajuda', 'imprimir'],
      },
    ],
  },
  {
    id: 'perfis',
    title: 'Perfis de acesso',
    audience: 'Para todo mundo',
    profiles: 'todos os perfis',
    summary: 'Quem vê o quê, quem pode fazer o quê e como ganhar cada acesso.',
    icon: UsersRound,
    sections: [
      {
        id: 'perfis-como-funciona',
        title: 'Três coisas definem o seu acesso',
        intro: 'Para entender por que duas pessoas veem telas diferentes.',
        blocks: [
          p('O que cada pessoa vê é a soma de três coisas independentes:'),
          list(
            '**O papel na plataforma**: Explorador (a conta comum), Moderador, Administrador ou Responsável técnico. Os três últimos são da equipe do Experimente+.',
            '**Fazer parte da operação**: toda conta que entra precisa estar ligada à região atendida pelo Experimente+. O cadastro já faz essa ligação.',
            '**Fazer parte de um negócio**: quem trabalha num negócio parceiro tem um papel na organização dele (Proprietário, Administrador, Editor ou Analista).'
          ),
          p(
            'Os perfis se somam. A mesma pessoa pode ser exploradora (usa benefícios), parceira (cuida de um café) e moderadora ao mesmo tempo, e vê as áreas de todos eles.'
          ),
        ],
        keywords: ['papel', 'permissão', 'acesso', 'perfil'],
      },
      {
        id: 'perfis-qual-e-o-meu',
        title: 'Qual é o meu perfil?',
        intro: 'Compare os perfis e veja onde cada um começa depois de entrar.',
        blocks: [
          table(
            'Os perfis do Experimente+',
            ['Perfil', 'O que vê', 'O que pode fazer', 'Onde começa', 'Como conseguir'],
            [
              'Visitante (sem conta)',
              'Cidades, lugares, avaliações, conteúdo dos parceiros, agenda e o Concierge.',
              'Explorar, perguntar ao Concierge, denunciar um conteúdo sem se identificar e baixar o app.',
              'Não precisa entrar.',
              'Basta abrir o site ou o app.',
            ],
            [
              'Explorador (conta comum)',
              'Tudo do visitante, mais a Carteira e a Conta.',
              'Usar benefícios pelo QR, ver comprovantes e cuidar da conta. No app: favoritos, seguindo, interesses, roteiros, avaliações e compras. Também pode cadastrar um negócio.',
              'Carteira.',
              'Criar uma conta.',
            ],
            [
              'Parceiro',
              'O Portal do parceiro, com os lugares do negócio.',
              'Depende do papel no negócio: Proprietário, Administrador, Editor ou Analista.',
              'Portal (Visão geral).',
              'Cadastrar o próprio negócio ou aceitar o convite de um Proprietário ou Administrador do negócio.',
            ],
            [
              'Equipe do Experimente+',
              'A área da equipe: Hoje, caixa de moderação, regras, benefícios, pessoas e catálogo.',
              'Depende do papel: Moderador, Administrador ou Responsável técnico.',
              'Hoje (Administrador e Responsável técnico) ou Dados de lugares, na Caixa de moderação (Moderador).',
              'Só a equipe técnica do Experimente+ concede; não há tela para pedir.',
            ]
          ),
        ],
        keywords: ['tabela', 'comparação', 'perfis', 'login'],
      },
      {
        id: 'perfil-visitante',
        title: 'Visitante',
        intro: 'Quem só quer descobrir lugares, sem criar conta.',
        blocks: [
          p('O que dá para fazer, e onde está explicado:'),
          list(
            '[Escolher uma cidade](#visitante-explorar), [buscar e filtrar](#visitante-buscar) e [navegar por categorias](#visitante-categorias).',
            '[Ver os detalhes de um lugar](#visitante-lugar), [chegar até ele](#visitante-mapa) e [ler as avaliações](#visitante-avaliacoes).',
            '[Ver a agenda da cidade](#visitante-agenda) e [pedir sugestões ao Concierge](#visitante-concierge).',
            '[Denunciar um conteúdo](#visitante-denunciar) e [instalar o app](#primeiros-passos-android).'
          ),
        ],
        keywords: ['sem conta', 'visitante'],
      },
      {
        id: 'perfil-explorador',
        title: 'Explorador',
        intro: 'A conta comum: tudo do visitante, mais os seus benefícios.',
        blocks: [
          list(
            '[Criar a conta](#consumidor-criar-conta), [entrar](#consumidor-entrar) e [recuperar a senha](#consumidor-senha).',
            '[Ver os benefícios na carteira](#consumidor-carteira), [usar um benefício pelo QR](#consumidor-apresentar) e [ver os comprovantes](#consumidor-utilizacoes).',
            '[Mudar seus dados e o tema](#consumidor-conta) e [excluir a conta](#consumidor-excluir-conta).',
            'No app: [comprar](#app-comprar), [favoritos, seguindo, roteiros e interesses](#app-favoritos) e [avaliar](#app-avaliar).',
            'Cadastrar o seu negócio: veja [Como cadastrar o seu negócio](#parceiro-cadastrar).'
          ),
          p('Depois de entrar, o Explorador começa na **Carteira**.'),
        ],
        keywords: ['conta comum', 'consumidor', 'cliente'],
      },
      {
        id: 'perfil-parceiro',
        title: 'Parceiro: os papéis dentro de um negócio',
        intro:
          'Quem trabalha num negócio parceiro entra no Portal; o papel diz o que cada pessoa pode fazer.',
        blocks: [
          table(
            'Papéis dentro de um negócio',
            ['Papel', 'O que pode fazer', 'No menu do Portal'],
            [
              'Proprietário',
              'Controle total: dados da organização, lugares, benefícios, desempenho e toda a equipe, inclusive outros proprietários.',
              'Tudo, com **Validar benefício**, **Desempenho** e **Equipe**.',
            ],
            [
              'Administrador',
              'Cuida dos dados da organização, dos lugares e dos benefícios, vê o desempenho e convida ou gerencia Editores e Analistas.',
              'Tudo, com **Validar benefício**, **Desempenho** e **Equipe**.',
            ],
            [
              'Editor',
              'Atualiza lugares, experiências, eventos, vitrine e ofertas, responde avaliações e valida benefícios no balcão. Não vê o desempenho nem gerencia a equipe.',
              'Sem **Desempenho** e sem **Equipe**.',
            ],
            [
              'Analista',
              'Acompanha o desempenho e consulta as utilizações, sem editar dados nem validar benefícios.',
              'Sem **Validar benefício** e sem **Equipe**.',
            ]
          ),
          tip(
            'Quem só valida no balcão',
            'Para quem só valida no balcão, escolha **Editor**. Não existe um papel só de validação: o Editor também edita dados e ofertas.'
          ),
          p(
            'Todos começam no **Portal**, na **Visão geral**. O menu azul da esquerda mostra só o que o seu papel permite.'
          ),
          figures(
            image(
              'parceiro-menu',
              'Menu lateral azul do Portal do parceiro com Visão geral, Validar benefício, Utilizações, Avaliações, Experiências e eventos, Dados do lugar, Desempenho e Equipe (destacado).',
              'O menu do Portal, para um Administrador do negócio.'
            )
          ),
          p(
            'Como ganhar o acesso: cadastrando o seu negócio (você vira Proprietário; veja [Como cadastrar o seu negócio](#parceiro-cadastrar)) ou aceitando o convite de um Proprietário ou Administrador (veja [Como dar acesso a um funcionário](#parceiro-equipe-convidar) e [Como aceitar um convite](#parceiro-aceitar-convite)).'
          ),
          p(
            'Tarefas do parceiro: [Visão geral](#parceiro-visao-geral), [editar um lugar](#parceiro-editar-lugar), [publicar conteúdo](#parceiro-conteudo), [responder avaliações](#parceiro-avaliacoes), [validar benefícios](#parceiro-validar), [ofertas](#parceiro-beneficios), [desempenho](#parceiro-desempenho) e [equipe](#parceiro-equipe-convidar).'
          ),
        ],
        keywords: [
          'perfil',
          'proprietário',
          'dono',
          'administrador',
          'editor',
          'analista',
          'organização',
          'membro',
          'funcionário',
          'atendente',
          'garçom',
          'caixa',
          'colaborador',
        ],
      },
      {
        id: 'perfil-equipe',
        title: 'Equipe do Experimente+: moderação e administração',
        intro:
          'Quem opera a plataforma. Esses papéis são concedidos pela equipe técnica do Experimente+.',
        blocks: [
          table(
            'Papéis da equipe',
            ['Papel', 'O que pode fazer', 'Onde começa'],
            [
              'Moderador',
              'Hoje e a caixa de moderação: dados de lugares, conteúdo de parceiros e denúncias (inclusive banir e desbanir autor). Vê Edições, Acessos e Arquivos, sem mudar edições nem acessos.',
              'Caixa de moderação.',
            ],
            [
              'Administrador',
              'Tudo do Moderador, mais as regras (avaliações, publicação e Concierge), edições e benefícios, cortesias, categorias, regiões e cidades e as contas em **Pessoas e acesso**. Vê as permissões, sem mudá-las.',
              'Hoje.',
            ],
            ['Responsável técnico', 'Tudo, inclusive mudar as permissões de cada papel.', 'Hoje.']
          ),
          figures(
            image(
              'admin-menu',
              'Menu lateral da área da equipe com as seções Operação, Caixa de moderação, Regras da operação, Pessoas e acesso e Administração; o item Hoje está destacado.',
              'O menu da equipe, para um Administrador.'
            ),
            image(
              'admin-papeis',
              'Página Papéis com os cartões Administrador, Visitante, Moderador (destacado), Responsável técnico e Explorador e as permissões de cada um.',
              'A página Papéis mostra o que cada papel permite.'
            )
          ),
          p(
            'Tarefas da equipe: [Hoje](#administracao-hoje), [dados de lugares](#administracao-dados-de-lugares), [conteúdo](#administracao-conteudo), [denúncias](#administracao-denuncias), [regras](#administracao-regras), [edições](#administracao-edicoes) e [acessos](#administracao-acessos).'
          ),
        ],
        keywords: ['moderador', 'administrador', 'responsável técnico', 'equipe', 'operação'],
      },
      {
        id: 'perfis-mudar',
        title: 'Ganhar ou mudar de perfil',
        intro: 'Quem concede cada acesso, em poucas palavras.',
        blocks: [
          list(
            '**Explorador**: é você quem cria, no cadastro. Uma conta criada pela equipe em **Pessoas e acesso** também já nasce como exploradora.',
            '**Parceiro**: nasce ao cadastrar o seu negócio (você vira Proprietário) ou ao aceitar o convite que um Proprietário ou Administrador envia pela página **Equipe** do Portal. Veja [Como dar acesso a um funcionário](#parceiro-equipe-convidar).',
            '**Mudar de papel num negócio**: um Proprietário ou Administrador muda na página **Equipe**, em **Gerenciar > Alterar papel** (veja [Como mudar o papel, suspender ou remover alguém](#parceiro-equipe-gerenciar)).',
            '**Suspenso**: perde o acesso ao Portal daquele negócio até ser reativado. **Removido**: só volta com um convite novo.',
            'O negócio sempre mantém um Proprietário ativo: antes de suspender, remover ou mudar o papel do último, promova outra pessoa a Proprietária.',
            '**Equipe do Experimente+**: Moderador, Administrador e Responsável técnico são concedidos pela equipe técnica do Experimente+. Não há tela para pedir nem para conceder esses papéis.',
            'Conta antiga que ainda não faz parte da operação: a equipe abre a conta em **Pessoas e acesso > Usuários > Editar usuário** e toca em **Vincular à operação**.'
          ),
        ],
        keywords: [
          'convite',
          'incluir pessoa',
          'remover',
          'suspenso',
          'mudar papel',
          'equipe do negócio',
          'funcionário',
        ],
      },
      {
        id: 'perfis-combinacoes',
        title: 'Combinações de perfis',
        intro: 'Quando a mesma pessoa tem mais de um perfil.',
        blocks: [
          p(
            'Exemplo: a dona de um café que também compra pacotes. Ela usa a **Carteira** como exploradora e o **Portal** como Proprietária. Para passar de uma área à outra:'
          ),
          list(
            '**Nas páginas públicas** (cidades e lugares): no topo ficam **Explorar**, **Carteira** e **Conta**; à direita, **Negócios** (o Portal) e **Sair**. No celular, tudo isso fica na barra de baixo.',
            '**Na Carteira**: no topo, **Explorar**, **Carteira** e **Conta** (no celular, na barra de baixo); **Sair** é o ícone da porta, no topo à direita. Para ir ao Portal, toque em **Explorar** e depois em **Negócios**.',
            '**No Portal e na área da equipe**: toque no seu nome, no topo à direita (no celular, no círculo com as suas iniciais). O menu tem **Explorar**, **Carteira**, **Negócios** ou **Operação** (a área da equipe), **Conta e preferências** e **Sair**, conforme os seus perfis.'
          ),
          p('Depois de entrar, a primeira tela segue esta ordem:'),
          list(
            'Equipe: Administrador e Responsável técnico começam em **Hoje**; Moderador, em **Dados de lugares**, na seção **Caixa de moderação** do menu.',
            'Parceiro: começa no **Portal**.',
            'Explorador: começa na **Carteira**.',
            'Conta ainda não ligada à região atendida: começa na lista de **Cidades** (veja [Área indisponível para sua conta](#duvidas-carteira)).'
          ),
        ],
        keywords: ['vários perfis', 'primeira tela', 'depois do login'],
      },
      {
        id: 'perfis-teste',
        title: 'Perfis de teste da homologação',
        intro: 'Para experimentar cada perfil sem usar dados reais.',
        blocks: [
          p(
            'Existem três contas de teste: uma de **administração**, uma de **parceiro** e uma de **consumidor**. A de parceiro é Administradora do negócio de demonstração, e a de consumidor já tem um benefício de cortesia na carteira.'
          ),
          warning(
            'Credenciais só em particular',
            'Os e-mails e as senhas dessas contas são enviados a cada pessoa, em particular, pela equipe do Experimente+. Eles não aparecem neste manual e não devem ser repassados.'
          ),
        ],
        keywords: ['homologação', 'teste', 'contas de teste'],
      },
    ],
  },
  {
    id: 'resgate',
    title: 'Resgate por QR code',
    audience: 'Para quem usa e para quem valida benefícios',
    profiles: 'Explorador e Parceiro',
    summary:
      'Do QR na carteira ao comprovante: o que o cliente faz, o que o lugar faz e o que cada recusa quer dizer.',
    icon: QrCode,
    sections: [
      {
        id: 'resgate-como-funciona',
        title: 'Como funciona o resgate por QR code',
        intro: 'Para entender o caminho do benefício, do QR na carteira ao comprovante.',
        blocks: [
          steps(
            'O cliente abre a **Carteira** e toca em **Usar benefício** (no app, **Apresentar**). Aparece um QR que vale por 5 minutos.',
            'O lugar lê o QR: no app, pela aba **Validar**; no site, pela página **Validar benefício**.',
            'Aparece a prévia **Apresentação válida**, com o benefício, o titular e as regras. Conferir não gasta nada.',
            'O lugar toca em **Confirmar utilização**. Só então o benefício é usado, e o comprovante aparece para o cliente e para o lugar.'
          ),
          figures(
            image(
              'resgate-fluxo',
              'Três telas lado a lado: o QR do cliente com o contador Expira em (1, com um QR de exemplo), a prévia Apresentação válida do lugar (2) e o comprovante Utilização confirmada (3).',
              'O QR do cliente (1), a prévia do lugar (2) e o comprovante (3).'
            )
          ),
          info(
            'O QR é pessoal',
            'O QR e o link de validação dão acesso ao benefício de quem os mostra. O cliente não deve enviá-los a outras pessoas, e o lugar não deve fotografá-los.'
          ),
        ],
        keywords: [
          'resgate',
          'resgatar',
          'qr code',
          'cupom',
          'promoção',
          'desconto',
          'usar benefício',
          'validar',
          'balcão',
        ],
      },
      {
        id: 'consumidor-apresentar',
        title: 'Como usar um benefício no lugar (QR de 5 minutos)',
        intro: 'Para ganhar o benefício na hora de pedir ou de pagar.',
        needs: ['um benefício **Disponível agora**', 'estar no lugar do benefício'],
        blocks: [
          steps(
            'Abra a **Carteira**. No site, ela fica no topo (no celular, na barra de baixo); no app, na aba **Carteira**.',
            'No benefício que você vai usar, toque em **Usar benefício** (no app, **Apresentar**).',
            'Mostre o QR para quem está atendendo. O contador **Expira em** mostra quanto falta: o código vale por 5 minutos.',
            'Espere o lugar conferir e confirmar. Só a confirmação do lugar conta como uso.'
          ),
          figures(
            image(
              'carteira-apresentar-celular',
              'Tela Usar benefício no celular com o QR coberto por um bloco "QR de exemplo" e o contador "Expira em" destacado, acima do botão Copiar link de validação.',
              'O QR é pessoal e temporário (aqui, um QR de exemplo).'
            )
          ),
          info(
            'No site, a tela do QR não muda sozinha',
            'Depois que o lugar confirma, a tela continua com o contador. Para ver a confirmação, abra **Utilizações** na Carteira.'
          ),
        ],
        result:
          'o lugar vê **Benefício validado e comprovante emitido**, e o comprovante aparece em **Utilizações**.',
        troubleshooting: [
          'O código expirou: toque em **Gerar novo código** e mostre o QR novo.',
          'O lugar não consegue ler o QR: toque em **Copiar link de validação** e envie o link só para quem está atendendo.',
          'O lugar recusou: veja [O que cada recusa quer dizer](#resgate-recusas).',
        ],
        keywords: [
          'qr',
          'usar benefício',
          'código',
          'apresentar',
          'expira',
          '5 minutos',
          'cupom',
          'resgatar',
          'resgate',
          'promoção',
          'desconto',
        ],
      },
      {
        id: 'parceiro-validar',
        title: 'Como validar um benefício',
        intro: 'Para registrar o uso do benefício que o cliente mostrou no balcão.',
        needs: [
          'papel Proprietário, Administrador ou Editor no negócio do benefício',
          'o QR (ou o link) que o cliente está mostrando',
        ],
        blocks: [
          p(
            'No celular, o jeito mais rápido é a aba **Validar** do app (veja [Como validar um benefício no app](#app-validar)). No site:'
          ),
          steps(
            'No menu da esquerda, toque em **Validar benefício** (no celular, abra antes o menu ☰, no alto, à esquerda).',
            'Leia a apresentação do cliente: cole o link (ou o código) que ele mostrou ou enviou em **Link da apresentação** e toque em **Conferir**.',
            'Confira o benefício, o lugar, o **Titular** e as **Regras**. O quadro **Apresentação válida** mostra quantas utilizações restam. Até aqui, nada foi usado.',
            'Toque em **Confirmar utilização** e, na janela, em **Confirmar utilização** de novo.'
          ),
          info(
            'Ler o QR pela câmera, na própria página',
            'A página **Validar benefício** está ganhando a leitura do QR pela câmera. Enquanto essa opção não aparece para você, digite o link ou o código, ou use a dica abaixo.'
          ),
          tip(
            'Sem digitar nada: a câmera do celular',
            'Com o Portal aberto no navegador do celular, aponte a câmera comum do aparelho para o QR do cliente e toque no link que ela mostrar. A página **Validar benefício** abre já com a apresentação.'
          ),
          figures(
            image(
              'parceiro-validar',
              'Página Validar benefício no computador com o campo Link da apresentação (1) e o botão Conferir (2) destacados.',
              'Cole o link ou o código (1) e confira (2).'
            ),
            image(
              'parceiro-validar-previa-celular',
              'Prévia no celular com o benefício, o lugar, o titular (e-mail borrado), as regras, o aviso Apresentação válida e o botão laranja Confirmar utilização destacado.',
              'A prévia: nada é usado até você confirmar.'
            ),
            image(
              'parceiro-validar-confirmar-celular',
              'Janela "Confirmar utilização?" com o botão azul Confirmar utilização destacado e Cancelar embaixo.',
              'A confirmação final.'
            ),
            image(
              'parceiro-comprovante-celular',
              'Comprovante com a mensagem Benefício validado e comprovante emitido, o selo Utilização confirmada destacado, o código coberto e o e-mail do titular borrado.',
              'O comprovante emitido (código coberto nesta imagem).'
            )
          ),
        ],
        result:
          'aparece **Benefício validado e comprovante emitido**, com o comprovante da utilização.',
        troubleshooting: [
          'Uma recusa apareceu: veja [O que cada recusa quer dizer](#resgate-recusas).',
          'A internet caiu na confirmação: toque de novo em **Confirmar utilização**. Se o uso já foi registrado, o mesmo comprovante é devolvido. Na dúvida, confira em **Utilizações**.',
        ],
        keywords: [
          'validar',
          'qr',
          'benefício',
          'confirmar utilização',
          'balcão',
          'resgatar',
          'resgate',
          'cupom',
          'atendente',
          'caixa',
          'garçom',
        ],
      },
      {
        id: 'resgate-recusas',
        title: 'O que cada recusa quer dizer',
        intro: 'Para saber o que fazer quando a validação não passa.',
        blocks: [
          table(
            'Recusas na validação',
            ['Situação', 'O que o lugar vê', 'O que fazer'],
            [
              'O QR expirou (mais de 5 minutos)',
              'No site: **Esta apresentação é inválida ou expirou.** No app: **Este código não é uma apresentação válida.**',
              'O cliente toca em **Gerar novo código** e mostra o QR novo.',
            ],
            [
              'O QR já foi usado',
              '**Não foi possível validar esta apresentação.**',
              'Confira em **Utilizações**: se o uso foi registrado, o comprovante está lá. Se o cliente ainda tem usos, ele gera um novo código.',
            ],
            [
              'O benefício acabou, ou está fora do dia ou do horário',
              '**Não foi possível validar esta apresentação.**',
              'O cliente confere na **Carteira** as regras e quando o benefício vale.',
            ],
            [
              'A oferta ou a edição está pausada',
              '**Não foi possível validar esta apresentação.**',
              'A oferta volta a valer quando for reativada (**Ativar**, em **Benefícios** do lugar). Uma edição pausada volta pela equipe do Experimente+.',
            ],
            [
              'O benefício é de outro negócio',
              'A apresentação é recusada. Nesta versão, pode aparecer uma mensagem de erro genérica.',
              'Cada lugar só valida as próprias ofertas. O cliente vê na carteira em qual lugar o benefício vale.',
            ],
            [
              'Conta sem permissão para validar',
              '**Sua conta não pode validar este benefício.**',
              'Peça a um Proprietário ou Administrador para mudar o seu papel para **Editor**.',
            ]
          ),
        ],
        keywords: [
          'recusado',
          'expirado',
          'já usado',
          'pausado',
          'outro negócio',
          'não foi possível validar',
          'inválida',
        ],
      },
    ],
  },
  {
    id: 'visitante',
    title: 'Descobrir lugares',
    audience: 'Para quem quer explorar',
    profiles: 'Visitante e Explorador',
    summary: 'Cidades, busca, página do lugar, agenda, Concierge e denúncias.',
    icon: Compass,
    sections: [
      {
        id: 'visitante-explorar',
        title: 'Como escolher uma cidade',
        intro: 'Para ver o que existe na cidade que você quer conhecer.',
        blocks: [
          steps(
            'No topo da página, toque em **Explorar**. No celular, **Explorar** fica na barra de baixo.',
            'Toque no cartão da cidade. Cada cartão mostra quantos lugares já estão publicados ali.'
          ),
          figures(
            image(
              'visitante-cidades',
              'Página "Escolha uma cidade" com os cartões de Londrina (destacado), Maringá e Apucarana e o número de lugares publicados em cada um.',
              'As cidades atendidas. Toque no cartão para abrir a cidade.'
            ),
            image(
              'visitante-cidade-celular',
              'Página de Londrina no celular, com a barra de baixo mostrando Explorar (destacado), Entrar e Cadastrar negócio.',
              'No celular, Explorar fica na barra de baixo.'
            )
          ),
        ],
        result:
          'a página da cidade abre com a busca, o Concierge, a agenda e **Todos os lugares**.',
        keywords: ['cidade', 'Londrina', 'Maringá'],
      },
      {
        id: 'visitante-buscar',
        title: 'Como buscar e filtrar lugares',
        intro: 'Para achar rápido um tipo de lugar, um nome ou o que está aberto agora.',
        blocks: [
          steps(
            'Na página da cidade, no quadro **Encontre um lugar**, escreva um nome ou uma palavra em **O que você procura?** (por exemplo "café" ou "cinema"). Se quiser, deixe em branco.',
            'Em **Categoria**, escolha um tipo de lugar. O número entre parênteses é quantos lugares a cidade tem ali.',
            'Se quiser, marque **Aberto agora** e mude **Ordenar por**.',
            'Toque em **Buscar**.'
          ),
          figures(
            image(
              'visitante-busca',
              'Quadro "Encontre um lugar" com a categoria Restaurantes (1), Aberto agora marcado (2) e o botão Buscar (3) destacados, e dois resultados logo abaixo.',
              'Categoria (1), Aberto agora (2) e Buscar (3).'
            )
          ),
        ],
        result:
          'a lista mostra só os lugares que atendem aos filtros, e os filtros aplicados aparecem como etiquetas embaixo do quadro.',
        troubleshooting: [
          'Nenhum resultado: toque em **Limpar filtros** (à direita das etiquetas) e tente com menos filtros. **Aberto agora** esconde o que está fechado neste momento.',
        ],
        keywords: ['busca', 'filtro', 'procurar', 'aberto agora', 'categoria'],
      },
      {
        id: 'visitante-categorias',
        title: 'Como navegar por categorias',
        intro: 'Para ver a cidade organizada por tipo de lugar.',
        blocks: [
          steps(
            'Na página da cidade, logo abaixo do título, toque em **Categorias**.',
            'Escolha uma categoria e toque em **Explorar categoria**.'
          ),
          figures(
            image(
              'visitante-categorias',
              'Página "Categorias em Londrina" com o botão Categorias destacado e os cartões Restaurantes, Bares e Cafés, cada um com Explorar categoria.',
              'As categorias da cidade, agrupadas por família.'
            )
          ),
        ],
        result: 'aparecem só os lugares daquela categoria na cidade.',
        keywords: ['categoria', 'restaurantes', 'bares', 'cafés'],
      },
      {
        id: 'visitante-lugar',
        title: 'Como ver os detalhes de um lugar',
        intro: 'Para saber se vale a visita: horário, endereço, contatos, fotos e avaliações.',
        blocks: [
          steps(
            'Na lista da cidade, toque no cartão do lugar.',
            'No alto, veja a foto, a categoria e se o lugar está **Aberto agora**. À direita (no celular, logo abaixo), o quadro **Entre em contato** reúne **Como chegar**, os canais do lugar e **Compartilhar**.',
            'Role para ver o **Endereço**, os **Horários** (o dia de hoje vem marcado e as **Datas especiais**, como feriados, aparecem embaixo), as **Avaliações**, as **Fotos publicadas** e as **Informações úteis**.'
          ),
          figures(
            image(
              'visitante-lugar',
              'Página da Cantina Vale Verde com a foto de capa, o selo Aberto agora e o quadro "Entre em contato" destacado, com Como chegar, Visitar o site e Compartilhar.',
              'O topo da página do lugar.'
            ),
            image(
              'visitante-lugar-horarios',
              'Quadro Horários com a linha de domingo marcada como Hoje (destacada) e as datas especiais de feriado.',
              'Os horários: a linha de hoje vem marcada.'
            )
          ),
          info(
            'Tudo foi revisado',
            'No fim da página, **Conteúdo publicado** mostra as datas de publicação e de atualização. Os dados passam pela equipe do Experimente+ antes de aparecer.'
          ),
        ],
        keywords: ['lugar', 'horário', 'endereço', 'contato', 'whatsapp', 'telefone', 'fotos'],
      },
      {
        id: 'visitante-mapa',
        title: 'Como chegar a um lugar',
        intro: 'Para abrir a rota até o lugar no mapa do seu celular ou computador.',
        blocks: [
          steps(
            'Na página do lugar, no quadro **Entre em contato**, toque em **Como chegar**.',
            'O Google Maps abre em outra aba, com a rota a partir de onde você está.'
          ),
          figures(
            image(
              'visitante-como-chegar',
              'Quadro "Entre em contato" com o botão azul Como chegar destacado, seguido de Visitar o site e Compartilhar.',
              'Como chegar abre a rota no Google Maps.'
            )
          ),
          p(
            'O mapa com todos os lugares da cidade fica no app (veja [Como usar o mapa no app](#app-mapa)).'
          ),
        ],
        keywords: ['mapa', 'rota', 'google maps', 'como chegar', 'endereço'],
      },
      {
        id: 'visitante-avaliacoes',
        title: 'Como ler as avaliações',
        intro: 'Para saber o que outras pessoas acharam do lugar.',
        blocks: [
          steps(
            'Na página do lugar, role até o quadro **Avaliações**.',
            'Veja a nota média, o total e as três avaliações mais recentes, com as fotos que as pessoas enviaram e a resposta do lugar, quando houver.',
            'Para ler todas ou escrever a sua, use o app (veja [Como avaliar no app](#app-avaliar)).'
          ),
          figures(
            image(
              'visitante-lugar-avaliacoes',
              'Quadro Avaliações com nota 3,8 em 4 avaliações e três avaliações com estrelas; o link "Denunciar avaliação" da primeira está destacado.',
              'As avaliações mais recentes. Cada uma tem o link Denunciar avaliação.'
            )
          ),
        ],
        keywords: ['avaliação', 'nota', 'estrelas', 'comentário'],
      },
      {
        id: 'visitante-para-viver-aqui',
        title: 'Como ver experiências, eventos e vitrine de um lugar',
        intro: 'Para descobrir o que o próprio lugar oferece além do básico.',
        blocks: [
          steps(
            'Na página do lugar, role até **Descubra mais neste lugar**, com o título pequeno **Novidades do parceiro** logo acima.',
            'Veja as **Experiências** (atividades), os **Eventos** (com data e horário) e a **Vitrine** (itens em destaque, com preço informativo). No app, essa parte se chama **Para viver aqui**.'
          ),
          figures(
            image(
              'visitante-lugar-para-viver',
              'Seção "Descubra mais neste lugar", abaixo de Novidades do parceiro, com a experiência "Aula de massa fresca em família" e o começo da lista de eventos.',
              'Experiências, eventos e vitrine do lugar.'
            )
          ),
        ],
        keywords: [
          'experiências',
          'eventos',
          'vitrine',
          'descubra mais',
          'novidades do parceiro',
          'para viver aqui',
          'cardápio',
        ],
      },
      {
        id: 'visitante-agenda',
        title: 'Como ver a agenda da cidade',
        intro: 'Para saber o que acontece hoje e nos próximos dias.',
        blocks: [
          steps(
            'Na página da cidade, role até **O que está acontecendo**.',
            'Veja **Acontecendo hoje**, **Em breve** (os próximos dias) e **Novidades** (o que foi publicado por último). Use as setas à direita de cada faixa para ver mais.',
            'Toque num cartão para abrir o lugar do evento.'
          ),
          figures(
            image(
              'visitante-agenda',
              'Agenda de Londrina com o evento de hoje e a faixa Em breve; a seta para ver os próximos eventos está destacada.',
              'A seta mostra mais eventos da faixa.'
            )
          ),
        ],
        keywords: ['agenda', 'eventos', 'hoje', 'em breve', 'novidades'],
      },
      {
        id: 'visitante-concierge',
        title: 'Como pedir sugestões ao Concierge',
        intro: 'Para receber ideias de lugares a partir de uma pergunta comum.',
        blocks: [
          steps(
            'Na página da cidade, no quadro **Concierge**, escreva o que você quer em **Sua pergunta** (até 300 caracteres). Exemplo: "quero um café tranquilo e depois algo para fazer à tarde".',
            'Toque em **Perguntar**.',
            'Leia a sugestão e toque nos cartões para abrir os lugares citados.'
          ),
          figures(
            image(
              'visitante-concierge',
              'Concierge de Londrina com a pergunta escrita (1) e, abaixo, a sugestão com dois cartões de lugares (2).',
              'A pergunta (1) e os lugares sugeridos (2).'
            )
          ),
          info(
            'O que o Concierge não faz',
            'Ele só cita lugares, experiências e eventos publicados no Experimente+ e não faz reservas nem compras.'
          ),
        ],
        result: 'aparece **Sugestão ancorada no catálogo**, com os lugares citados em cartões.',
        troubleshooting: [
          'Aparece **Sugestões do catálogo** com "O assistente está indisponível agora": o assistente não respondeu, e a página mostra lugares publicados no lugar da resposta. Use essa lista ou tente de novo mais tarde.',
          'Há um limite diário de perguntas por pessoa, definido pela equipe. Passado o limite, também aparece a lista do catálogo.',
          '**Posso ajudar com descoberta local**: a pergunta saiu do assunto. Pergunte sobre lugares, experiências e eventos da cidade.',
        ],
        keywords: ['concierge', 'ia', 'assistente', 'sugestão', 'pergunta'],
      },
      {
        id: 'visitante-denunciar',
        title: 'Como denunciar um conteúdo',
        intro:
          'Para avisar a equipe sobre uma avaliação ofensiva, falsa ou com propaganda, ou um lugar com informação errada.',
        blocks: [
          steps(
            'Toque em **Denunciar avaliação**, embaixo da avaliação, ou em **Denunciar este lugar**, no fim da página do lugar.',
            'Em **Qual é o problema?**, escolha o motivo.',
            'Se quiser, explique melhor no campo de baixo.',
            'Toque em **Enviar denúncia**.'
          ),
          figures(
            image(
              'visitante-denunciar',
              'Janela "Denunciar avaliação" com o motivo Informação falsa escolhido (1) e o botão Enviar denúncia (2) destacados.',
              'O motivo (1) e Enviar denúncia (2).'
            ),
            image(
              'visitante-denuncia-enviada',
              'Janela "Denúncia registrada" com o protocolo da denúncia destacado e o botão Fechar.',
              'Guarde o protocolo.'
            )
          ),
        ],
        result:
          'aparece **Denúncia registrada** com um protocolo que começa com DEN-. A denúncia é anônima, e a equipe analisa dentro do prazo definido.',
        troubleshooting: [
          'E depois? A equipe decide se o conteúdo sai do ar, se o autor é advertido ou se não havia problema. Nesta versão de testes ainda não há página para acompanhar a denúncia nem aviso da decisão: se quiser falar sobre ela com a equipe do Experimente+, informe o protocolo.',
          'Informação errada num lugar (horário, telefone, endereço): quem corrige é o próprio negócio, pelo Portal, e a correção passa pela moderação da equipe antes de aparecer.',
        ],
        keywords: ['denúncia', 'denunciar', 'ofensivo', 'falso', 'spam'],
      },
    ],
  },
  {
    id: 'consumidor',
    title: 'Sua conta e seus benefícios',
    audience: 'Para quem tem conta',
    profiles: 'Explorador',
    summary: 'Criar conta, entrar, carteira, QR, comprovantes e dados da conta.',
    icon: WalletCards,
    sections: [
      {
        id: 'consumidor-criar-conta',
        title: 'Como criar uma conta',
        intro: 'Para guardar benefícios na carteira e usar tudo o que é pessoal.',
        needs: ['um e-mail que você use'],
        blocks: [
          steps(
            'No topo da página, à direita, toque em **Entrar**.',
            'Abaixo do quadro, em "Ainda não tem conta?", toque em **Criar conta**.',
            'Preencha **Nome completo**, **E-mail**, **Usuário** (opcional), **Senha** e **Confirmar senha**. A lista **Para continuar** marca o que já está certo na senha.',
            'Marque **Li e aceito os documentos obrigatórios** (os links abrem os Termos de Uso e a Política de Privacidade).',
            'Toque em **Criar conta**.'
          ),
          figures(
            image(
              'conta-criar-link',
              'Página Entrar com o link "Criar conta", abaixo do quadro, destacado.',
              'O link Criar conta fica abaixo do quadro de entrar.'
            ),
            image(
              'conta-cadastro',
              'Formulário de cadastro com a senha oculta, a lista Para continuar marcada, o aceite dos documentos marcado e o botão Criar conta destacado.',
              'O fim do cadastro.'
            )
          ),
        ],
        result:
          'você já entra na conta e volta para a lista de cidades. Chega um e-mail de confirmação: toque no link para ver **E-mail confirmado**. O link vale por 24 horas.',
        troubleshooting: [
          'Aviso embaixo de um campo: corrija o que ele pede e toque em **Criar conta** de novo.',
          'O e-mail de confirmação não chegou: veja [Não recebi o e-mail](#duvidas-email).',
        ],
        keywords: ['cadastro', 'registrar', 'criar conta', 'senha'],
      },
      {
        id: 'consumidor-entrar',
        title: 'Como entrar na sua conta',
        intro: 'Para usar a carteira, o Portal ou a área da equipe.',
        needs: ['uma conta'],
        blocks: [
          steps(
            'No topo da página, à direita, toque em **Entrar** (no celular, na barra de baixo).',
            'Escreva o e-mail (ou o nome de usuário) em **E-mail ou usuário** e a **Senha**.',
            'Toque em **Entrar**.'
          ),
          figures(
            image(
              'conta-entrar',
              'Página Entrar com os campos E-mail ou usuário e Senha, o link Esqueceu a senha? e o botão Entrar destacado.',
              'O quadro de entrar.'
            )
          ),
        ],
        result:
          'a primeira tela depende do seu perfil: Carteira, Portal ou a área da equipe (veja [Combinações de perfis](#perfis-combinacoes)).',
        troubleshooting: ['Não lembra a senha? Veja [Como recuperar a senha](#consumidor-senha).'],
        keywords: ['login', 'entrar', 'acessar'],
      },
      {
        id: 'consumidor-senha',
        title: 'Como recuperar a senha',
        intro: 'Para criar uma senha nova quando você não lembra a antiga.',
        needs: ['acesso ao e-mail da conta'],
        blocks: [
          steps(
            'Na página **Entrar**, toque em **Esqueceu a senha?**, à direita do campo **Senha**.',
            'Informe o **E-mail** da conta e toque em **Enviar link de redefinição**.',
            'Abra o e-mail que chegar e siga o link para criar a senha nova.'
          ),
          figures(
            image(
              'conta-esqueci-senha-enviado',
              'Página "Esqueceu sua senha?" com a mensagem destacada "Se existir uma conta com este e-mail, enviamos um link para redefinir a senha".',
              'A mensagem é a mesma exista ou não a conta, por privacidade.'
            )
          ),
        ],
        result: 'depois de salvar a senha nova, entre normalmente.',
        troubleshooting: [
          'O link vale por pouco tempo e só uma vez. Um pedido novo cancela os links anteriores: use sempre o e-mail mais recente.',
          'O e-mail não chegou: veja [Não recebi o e-mail](#duvidas-email).',
        ],
        keywords: ['senha', 'esqueci', 'redefinir', 'recuperar', 'trocar senha', 'mudar senha'],
      },
      {
        id: 'consumidor-conta',
        title: 'Como mudar seus dados e o tema',
        intro: 'Para corrigir o nome, o usuário ou a aparência do site.',
        needs: ['estar na sua conta'],
        blocks: [
          steps(
            'No topo, toque em **Conta**.',
            'Na aba **Perfil**, mude o **Nome completo** ou o **Nome de usuário** e toque em **Salvar alterações**.',
            'Na aba **Aparência**, escolha **Claro**, **Escuro** ou **Do dispositivo**.'
          ),
          info(
            'Trocar a senha ou o e-mail',
            'Para trocar a senha, saia da conta e use **Esqueceu a senha?**, na página **Entrar** (veja [Como recuperar a senha](#consumidor-senha)). O e-mail de acesso ainda não muda pelo site: fale com a equipe do Experimente+.'
          ),
          figures(
            image(
              'conta-preferencias',
              'Página "Conta e preferências" com as abas Perfil, Aparência e Segurança destacadas e o formulário Dados pessoais.',
              'As abas da Conta.'
            )
          ),
        ],
        result: 'aparece a mensagem **Dados pessoais atualizados**.',
        keywords: [
          'perfil',
          'nome',
          'usuário',
          'tema',
          'aparência',
          'trocar senha',
          'trocar e-mail',
          'mudar senha',
        ],
      },
      {
        id: 'consumidor-excluir-conta',
        title: 'Como excluir sua conta',
        intro: 'Para apagar a sua conta do Experimente+.',
        needs: ['a sua senha atual'],
        blocks: [
          steps(
            'No topo, toque em **Conta** e abra a aba **Segurança**.',
            'Digite a **Senha atual**.',
            'Em **Confirmação de exclusão**, escreva EXCLUIR MINHA CONTA.',
            'Toque em **Excluir minha conta**.',
            'Na janela, toque em **Confirmar exclusão**.'
          ),
          figures(
            image(
              'conta-seguranca',
              'Aba Segurança com a senha atual preenchida (oculta), a frase EXCLUIR MINHA CONTA e o botão vermelho Excluir minha conta destacado.',
              'A aba Segurança, pronta para excluir.'
            ),
            image(
              'conta-excluir',
              'Janela "Excluir sua conta permanentemente?" com o botão vermelho Confirmar exclusão destacado.',
              'A confirmação final.'
            )
          ),
          warning(
            'Não dá para desfazer',
            'A exclusão desativa a conta, revoga o acesso e anonimiza os dados pessoais. Você perde a carteira e o Portal. O que precisa ficar para auditoria permanece sem identificar você.'
          ),
        ],
        result: 'você sai da conta e volta para a página inicial. A conta não entra mais.',
        keywords: ['excluir', 'apagar', 'deletar', 'encerrar conta'],
      },
      {
        id: 'consumidor-carteira',
        title: 'Como ver seus benefícios na carteira',
        intro: 'Para saber quais benefícios você tem e quais valem agora.',
        needs: ['uma conta com um pacote, voucher ou cortesia'],
        blocks: [
          steps(
            'No topo, toque em **Carteira**. No celular, **Carteira** fica na barra de baixo.',
            'Veja os números do topo: acessos, benefícios, quantos estão disponíveis agora e as utilizações que você já fez.',
            'Em cada pacote, confira os benefícios. O selo diz se o benefício está **Disponível agora** ou **Fora do horário**.'
          ),
          figures(
            image(
              'carteira',
              'Carteira no computador com os benefícios de um pacote; o botão laranja Usar benefício de um benefício disponível está destacado.',
              'Os benefícios de um pacote.'
            ),
            image(
              'carteira-celular',
              'Carteira no celular, com a barra de baixo mostrando Explorar, Carteira (destacada) e Conta.',
              'No celular, Carteira fica na barra de baixo.'
            )
          ),
          p(
            'A compra de pacotes e vouchers é feita no app (veja [Como comprar no app](#app-comprar)).'
          ),
        ],
        troubleshooting: [
          'Não aparece **Carteira**, ou aparece **Área indisponível para sua conta**: veja [Área indisponível](#duvidas-carteira).',
        ],
        keywords: ['carteira', 'benefícios', 'pacote', 'voucher', 'cortesia'],
      },
      {
        id: 'consumidor-utilizacoes',
        title: 'Como ver seus comprovantes',
        intro: 'Para conferir quando e onde você usou cada benefício.',
        needs: ['ter usado um benefício'],
        blocks: [
          steps(
            'Na **Carteira**, toque em **Utilizações**: no computador, fica no topo, à direita; no celular, logo abaixo do título **Minha carteira**.',
            'No benefício usado, toque em **Ver comprovante**.'
          ),
          figures(
            image(
              'carteira-utilizacoes-celular',
              'Lista Utilizações no celular com dois benefícios usados; o botão Ver comprovante do primeiro está destacado e os códigos aparecem cobertos.',
              'A lista de utilizações.'
            ),
            image(
              'carteira-comprovante-celular',
              'Comprovante no celular com o selo Utilização confirmada destacado, o código do comprovante coberto, a edição e o número da utilização.',
              'O comprovante (código coberto nesta imagem).'
            )
          ),
        ],
        result:
          'o comprovante mostra o benefício, o lugar, o código, a data e o número da utilização.',
        keywords: ['comprovante', 'utilizações', 'histórico'],
      },
      {
        id: 'consumidor-explorador',
        title: 'Favoritos, seguindo, roteiros e avaliações',
        intro: 'As listas pessoais e as avaliações ficam no app.',
        blocks: [
          p(
            'Favoritos, lugares seguidos, roteiros, interesses e a escrita de avaliações com fotos estão no app Android. Veja [Favoritos, seguindo, roteiros e interesses](#app-favoritos) e [Como avaliar no app](#app-avaliar).'
          ),
        ],
        keywords: ['favoritos', 'seguindo', 'roteiros', 'interesses', 'avaliar'],
      },
    ],
  },
  {
    id: 'parceiro',
    title: 'Portal do parceiro',
    audience: 'Para a equipe de um negócio',
    profiles: 'Parceiro (Proprietário, Administrador, Editor e Analista)',
    summary:
      'Cadastrar o negócio, dados do lugar, conteúdo, avaliações, benefícios, desempenho e equipe.',
    note: 'No celular, o menu da esquerda fica atrás do botão ☰ (**Abrir navegação**), no alto, à esquerda.',
    icon: Store,
    sections: [
      {
        id: 'parceiro-visao-geral',
        title: 'Como começar o dia no Portal',
        intro: 'Para ver de uma vez o que pede a sua atenção.',
        needs: ['uma conta de parceiro'],
        blocks: [
          steps(
            'Entre com a sua conta. O Portal abre na **Visão geral**. Se você também é explorador, toque em **Negócios**, no topo.',
            'Veja os três quadros: **Avaliações sem resposta**, **Dados do lugar** e **Experiências e eventos**. O link de cada um leva à tarefa.',
            'Para validar um benefício, use o botão laranja **Validar benefício**, no topo da Visão geral.'
          ),
          figures(
            image(
              'parceiro-visao-geral',
              'Visão geral do Portal com os quadros Avaliações sem resposta (1), Dados do lugar (2) e Experiências e eventos (3); os links de cada quadro estão destacados.',
              'Os três quadros do dia e os seus links.'
            )
          ),
        ],
        result: 'você sabe o que responder, revisar ou publicar hoje.',
        keywords: ['visão geral', 'portal', 'início', 'tarefas'],
      },
      {
        id: 'parceiro-cadastrar',
        title: 'Como cadastrar o seu negócio',
        intro: 'Para ter o Portal e publicar os lugares do seu negócio.',
        needs: [
          'uma conta (veja [Como criar uma conta](#consumidor-criar-conta))',
          'a razão social, o CNPJ, um e-mail e um telefone do negócio',
        ],
        blocks: [
          steps(
            'Entre na sua conta e, no topo, à direita, toque em **Negócios**.',
            'Na primeira vez, o Portal mostra **Comece pela organização**: toque em **Criar organização**. (Quem já tem um negócio usa **Nova organização**, na Visão geral.)',
            'Preencha **Razão social**, **Nome fantasia**, **CNPJ**, **E-mail** e **Telefone** (obrigatórios). **Endereço da página** e **Website** são opcionais: sem endereço, usamos o nome fantasia. A razão social e o CNPJ ficam privados.',
            'Toque em **Criar organização**. Ela nasce como **Rascunho**, e você vira **Proprietário** dela.',
            'Na página da organização, toque em **Novo lugar** e cadastre os lugares (veja [Como editar os dados de um lugar](#parceiro-editar-lugar)). Dá para preencher tudo enquanto a organização é rascunho.',
            'Em **Dados da organização**, confira tudo (enquanto a organização é rascunho, o quadro já vem aberto) e toque em **Enviar para análise**. Na janela, confirme em **Enviar para análise**.'
          ),
          figures(
            image(
              'perfil-negocios',
              'Topo do site para uma pessoa com conta, com Explorar, Carteira e Conta e, à direita, o botão Negócios destacado.',
              'Negócios, no topo, leva ao Portal.'
            ),
            image(
              'perfil-portal-vazio',
              'Portal de uma pessoa sem negócio, com a mensagem "Comece pela organização" e o botão Criar organização destacado.',
              'O primeiro acesso ao Portal.'
            ),
            image(
              'parceiro-nova-organizacao',
              'Formulário Nova organização preenchido com dados fictícios, com e-mail e telefone, e o botão Criar organização destacado.',
              'Os dados da organização.'
            ),
            image(
              'parceiro-organizacao-enviar',
              'Quadro Dados da organização aberto numa organização em rascunho, com os dados fictícios e o botão Enviar para análise destacado.',
              'Enviar a organização para análise.'
            )
          ),
        ],
        result:
          'a organização fica **Em análise**. A equipe do Experimente+ confere a razão social, o CNPJ e os contatos e aprova (a organização fica **Ativa**), pede correções (**Correções solicitadas**: ajuste e envie de novo) ou rejeita. Só depois de **Ativa** os lugares dela podem ir para a moderação e aparecer no app e no site.',
        troubleshooting: [
          'Durante a análise, a edição da organização e dos lugares pode ficar indisponível por um tempo. Ela volta quando a equipe responder.',
          '**A organização precisa estar ativa antes do envio para moderação.**: um lugar só vai para a moderação depois que a organização é aprovada.',
          '**Salve ou descarte os dados antes de enviar a organização para análise.**: toque em **Salvar dados** e depois em **Enviar para análise**.',
        ],
        keywords: [
          'cadastrar negócio',
          'organização',
          'cnpj',
          'novo lugar',
          'enviar para análise',
          'aprovação',
        ],
      },
      {
        id: 'parceiro-lugares',
        title: 'Como encontrar os seus lugares',
        intro: 'Para chegar rápido ao lugar que você quer cuidar.',
        needs: ['uma conta de parceiro'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Dados do lugar**. Aparecem todos os lugares dos seus negócios, com a situação de cada um.',
            'Toque em **Editar dados** (dados públicos) ou **Benefícios** (ofertas) no lugar. **Desempenho**, ao lado do nome de cada organização, abre os números dela.',
            'Para ver uma organização e todos os lugares dela, toque em **Abrir**, na Visão geral.'
          ),
          figures(
            image(
              'parceiro-lugares',
              'Lista Dados do lugar com os lugares da organização, cada um com o selo Publicado e os botões Benefícios e Editar dados; o primeiro Editar dados está destacado.',
              'Todos os seus lugares.'
            ),
            image(
              'parceiro-organizacao',
              'Página da organização Grupo Experimente Norte com os números de lugares, completos, em análise e publicados; os botões Equipe (1) e Novo lugar (2) estão destacados.',
              'Uma organização: a equipe (1) e um lugar novo (2).'
            )
          ),
        ],
        keywords: ['lugares', 'organização', 'unidades'],
      },
      {
        id: 'parceiro-editar-lugar',
        title: 'Como editar os dados de um lugar',
        intro:
          'Para corrigir horário, contato, fotos ou descrição. A versão atual continua no ar até a nova ser aprovada.',
        needs: ['papel Proprietário, Administrador ou Editor no negócio'],
        blocks: [
          steps(
            'Em **Dados do lugar**, toque em **Editar dados** no lugar.',
            'No alto, à direita, toque em **Editar dados do lugar**. Uma nova versão, em rascunho, é criada.',
            'Use as etapas da esquerda (**Identidade**, **Endereço**, **Categorias**, **Características**, **Horários**, **Mídia**) e mude o que precisar.',
            'Ao terminar cada etapa, toque no botão **Salvar** dela (por exemplo, **Salvar identidade**, no fim do quadro).',
            'No alto, à direita, toque em **Enviar para análise**.'
          ),
          figures(
            image(
              'parceiro-editar-botao',
              'Topo da página Padaria Primavera com o selo Publicada e o botão Editar dados do lugar destacado.',
              'Editar dados do lugar cria a nova versão.'
            ),
            image(
              'parceiro-editar-lugar',
              'Etapa Identidade com o campo Descrição curta alterado (1) e o botão Salvar identidade (2) destacados.',
              'Mude o campo (1) e salve a etapa (2).'
            ),
            image(
              'parceiro-editar-enviar',
              'Topo do lugar em rascunho, pronto para envio, com o botão Enviar para análise destacado.',
              'Enviar para análise, no topo.'
            ),
            image(
              'parceiro-lugar-em-analise',
              'Página do lugar com a mensagem "Ficha enviada para moderação" e o selo Em moderação destacado.',
              'Depois do envio: Em moderação.'
            )
          ),
        ],
        result:
          'aparece **Ficha enviada para moderação** e o lugar fica **Em moderação**. Quando a equipe aprova, a nova versão vai para o app e para o site.',
        troubleshooting: [
          'Os campos estão bloqueados: toque antes em **Editar dados do lugar**. Se o lugar está **Em moderação**, a edição volta quando a equipe responder.',
          '**Salve antes de enviar**: ainda há etapa sem salvar. Salve cada etapa e envie de novo.',
          '**Correções pedidas**: a equipe explica o que ajustar. Corrija e toque em **Reenviar para análise**.',
          'Fotos: na etapa **Mídia**, envie as imagens e escolha a capa. Só imagens aprovadas aparecem para o público.',
        ],
        keywords: [
          'editar',
          'horário',
          'contato',
          'fotos',
          'moderação',
          'rascunho',
          'enviar para análise',
        ],
      },
      {
        id: 'parceiro-conteudo',
        title: 'Como publicar uma experiência, um evento ou um item de vitrine',
        intro:
          'Para mostrar o que o lugar oferece em "Descubra mais neste lugar", no site, e em "Para viver aqui", no app.',
        needs: [
          'papel Proprietário, Administrador ou Editor',
          'uma imagem JPEG, PNG ou WebP de até 10 MB',
        ],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Experiências e eventos** e escolha a aba: **Experiências**, **Eventos** (com **Início** e **Fim**) ou **Vitrine** (com **Preço informativo**).',
            'No quadro **Adicionar**, escolha o **Lugar**, escreva o **Título** e, se quiser, a **Descrição**.',
            'Toque em **Criar rascunho**. O cartão aparece logo abaixo, como **Rascunho**.',
            'No cartão, em **Imagens**, arraste a imagem (ou toque para escolher), escreva o **Texto alternativo** (o que a imagem mostra, para quem não enxerga), marque **Usar como capa** e toque em **Enviar imagem**.',
            'Toque em **Publicar** ou em **Enviar para análise**, conforme a regra da operação para aquele tipo de conteúdo: só um dos dois aparece.'
          ),
          figures(
            image(
              'parceiro-conteudo-form',
              'Quadro Adicionar experiência com o lugar Café Aurora, o título e a descrição preenchidos e o botão Criar rascunho destacado.',
              'Criar o rascunho.'
            ),
            image(
              'parceiro-conteudo-imagem',
              'Cartão do rascunho com a imagem escolhida, o texto alternativo, Usar como capa marcado e o botão Enviar imagem destacado.',
              'Enviar a imagem.'
            ),
            image(
              'parceiro-conteudo-publicado',
              'Cartão publicado com a imagem de capa e o selo Imagem em análise destacado.',
              'Publicado; a imagem aguarda a análise.'
            )
          ),
          info(
            'Quando passa pela moderação',
            'A equipe decide, nas regras da operação, o que precisa de aprovação antes de aparecer. Sem essa exigência, o texto é publicado na hora; com ela, o conteúdo fica **Em análise** até a decisão. As imagens sempre passam pela moderação.'
          ),
          figures(
            image(
              'parceiro-evento-em-analise',
              'Cartão do evento Sexta do chorinho, com data e horário, e o selo Em análise destacado.',
              'Um evento aguardando a aprovação da equipe.'
            )
          ),
        ],
        result:
          'o cartão fica **Publicado** (ou **Em análise**, se precisar de aprovação) e aparece na página do lugar. A imagem entra quando for aprovada.',
        troubleshooting: [
          '**Escolha uma imagem JPEG, PNG ou WebP.**: você tocou em **Enviar imagem** sem escolher o arquivo, ou o formato não é aceito.',
          'Ficou **Em análise**: é a regra da operação para esse tipo de conteúdo; a equipe decide e o cartão muda sozinho.',
        ],
        keywords: ['experiência', 'evento', 'vitrine', 'publicar', 'imagem', 'rascunho'],
      },
      {
        id: 'parceiro-avaliacoes',
        title: 'Como responder uma avaliação',
        intro: 'Para agradecer e mostrar cuidado a quem lê as avaliações.',
        needs: ['papel Proprietário, Administrador ou Editor'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Avaliações**.',
            'Em **Lugar**, escolha o lugar. A aba **Sem resposta** mostra o que ainda espera por você.',
            'Escreva em **Sua resposta pública**.',
            'Toque em **Publicar resposta**.'
          ),
          figures(
            image(
              'parceiro-avaliacao-resposta',
              'Página Avaliações na aba Sem resposta, com uma avaliação de 4 estrelas, a resposta escrita e o botão Publicar resposta destacado; à direita, as dicas Uma boa resposta.',
              'Respondendo uma avaliação.'
            )
          ),
          tip(
            'Uma boa resposta',
            'Agradeça a visita, seja cordial também com as críticas e não exponha dados de clientes. Avaliação ofensiva ou falsa? Use **Denunciar avaliação** no app ou no site.'
          ),
        ],
        result:
          'a resposta aparece abaixo da avaliação, no app e no site, e a avaliação vai para **Respondidas**. A nota não muda. Para mudar, use **Editar resposta**.',
        keywords: ['avaliação', 'responder', 'resposta', 'comentário'],
      },
      {
        id: 'parceiro-utilizacoes',
        title: 'Como consultar as utilizações',
        intro: 'Para conferir os benefícios usados nos seus lugares.',
        needs: ['papel Proprietário, Administrador, Editor ou Analista'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Utilizações**.',
            'Veja o benefício, o titular, quando foi usado e o comprovante. Toque na linha para abrir o comprovante completo.'
          ),
          figures(
            image(
              'parceiro-utilizacoes',
              'Página Utilizações com a lista de benefícios usados; a primeira linha está destacada e os códigos aparecem cobertos.',
              'O histórico de utilizações.'
            ),
            image(
              'parceiro-validar-recusado-celular',
              'Página Validar benefício no celular com o aviso destacado "Não foi possível validar esta apresentação. Peça ao cliente para consultar a carteira e gerar um novo código, se o benefício estiver disponível."',
              'O aviso quando um código já usado é lido de novo.'
            )
          ),
        ],
        keywords: ['utilizações', 'comprovantes', 'histórico'],
      },
      {
        id: 'parceiro-beneficios',
        title: 'Como criar e ativar uma oferta',
        intro: 'Para o seu lugar participar de um pacote ou edição de benefícios.',
        needs: [
          'papel Proprietário, Administrador ou Editor',
          'uma edição aberta para a cidade do lugar',
        ],
        blocks: [
          steps(
            'Em **Dados do lugar**, toque em **Benefícios** no lugar.',
            'No quadro **Nova oferta**, escolha a **Edição** e a **Modalidade** (compre um e ganhe outro, desconto percentual, desconto em reais, item cortesia ou personalizado).',
            'Escreva o **Título** e **Como funciona**. Se quiser, preencha as regras e exceções, os dias e o horário em que vale, o mínimo de pessoas e os usos por acesso.',
            'Toque em **Criar oferta**. Ela nasce como **Rascunho**.',
            'Revise os termos no cartão da oferta e toque em **Ativar**.'
          ),
          figures(
            image(
              'parceiro-nova-oferta',
              'Quadro Nova oferta preenchido com a edição, a modalidade Item cortesia, o título e o texto de Como funciona; o botão Criar oferta está destacado.',
              'A nova oferta.'
            ),
            image(
              'parceiro-oferta-criada',
              'Cartão da oferta Pão de queijo de cortesia, em Rascunho, com os botões Editar, Ativar (destacado) e Arquivar.',
              'A oferta em rascunho, pronta para ativar.'
            )
          ),
        ],
        result: 'a oferta fica **Ativa** e aparece para quem tem aquela edição na carteira.',
        troubleshooting: [
          'Não aparece **Nova oferta**: o lugar já tem uma oferta em cada edição disponível. Cada lugar participa uma vez por edição.',
          'Para mudar os termos de uma oferta ativa, toque antes em **Pausar**.',
        ],
        keywords: ['oferta', 'benefício', 'edição', 'ativar', 'pausar', 'desconto'],
      },
      {
        id: 'parceiro-desempenho',
        title: 'Como acompanhar o desempenho',
        intro:
          'Para saber quantas vezes seus lugares apareceram e o que as pessoas fizeram depois.',
        needs: ['papel Proprietário, Administrador ou Analista'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Desempenho**. Se você cuida de mais de uma organização, a lista **Dados do lugar** abre: toque em **Desempenho**, ao lado do nome da organização.',
            'Escolha o período em **De** e **Até** e toque em **Atualizar período**.',
            'Veja **Vezes que apareceu**, **Visitas à página**, **Contatos** e **Pico de visitantes**, o gráfico **Dia a dia**, os **Contatos por canal** e o **Desempenho por lugar**.'
          ),
          figures(
            image(
              'parceiro-desempenho-organizacoes',
              'Lista Dados do lugar com duas organizações; o link Desempenho ao lado do nome da primeira está destacado.',
              'Com mais de uma organização, escolha qual.'
            ),
            image(
              'parceiro-desempenho',
              'Página Desempenho da descoberta com o período, os quadros de números e o gráfico dia a dia; o botão Atualizar período está destacado.',
              'O desempenho da organização.'
            ),
            image(
              'parceiro-desempenho-celular',
              'Desempenho no celular, com os números em cartões empilhados; o cartão Vezes que apareceu está destacado.',
              'No celular, os números viram cartões.'
            )
          ),
        ],
        result:
          'os números mostram o período escolhido. Ninguém é identificado: tudo é somado por dia.',
        troubleshooting: [
          'Não aparece **Desempenho** no menu: o seu papel é Editor. O desempenho fica com Proprietários, Administradores e Analistas.',
        ],
        keywords: ['desempenho', 'números', 'visitas', 'contatos', 'relatório', 'estatísticas'],
      },
      {
        id: 'parceiro-equipe-convidar',
        title: 'Como dar acesso a um funcionário',
        intro: 'Para que alguém da sua equipe entre no Portal com o papel certo.',
        needs: [
          'papel Proprietário ou Administrador no negócio',
          'o e-mail que a pessoa usa (ou vai usar) na conta dela',
        ],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Equipe**. Se você cuida de mais de uma organização, escolha qual e toque em **Gerenciar equipe**.',
            'Toque em **Convidar pessoa**.',
            'Escreva o **E-mail** da pessoa e escolha o **Papel na organização**.',
            'Toque em **Enviar convite**.',
            'A pessoa recebe o e-mail "Convite para participar de…", abre o link, entra (ou cria a conta) com esse mesmo e-mail e toca em **Aceitar convite**. Depois, ela cai direto no Portal (veja [Como aceitar um convite](#parceiro-aceitar-convite)).'
          ),
          tip(
            'Qual papel escolher',
            'Para quem só valida no balcão, escolha **Editor** (não existe um papel só de validação; o Editor também edita dados e ofertas). Para quem só acompanha números, **Analista**. O que cada papel faz está em [Parceiro](#perfil-parceiro) e no fim da página **Equipe**.'
          ),
          figures(
            image(
              'parceiro-equipe',
              'Página Equipe do Portal com a lista Pessoas, os e-mails borrados, e o botão Convidar pessoa destacado.',
              'A página Equipe (e-mails borrados nesta imagem).'
            ),
            image(
              'parceiro-convidar',
              'Janela Convidar com o e-mail de exemplo preenchido, o papel Editor escolhido em Papel na organização e o botão Enviar convite destacado.',
              'O convite: e-mail e papel.'
            ),
            image(
              'parceiro-convite-pendente',
              'Lista Convites pendentes com o convite de exemplo como Editor, o selo Aguardando aceite e a data em Vale até destacados, com Reenviar e Cancelar.',
              'Aguardando aceite (1) e a validade do link (2).'
            )
          ),
        ],
        result:
          'aparece **Convite enviado para … como …** e o convite fica em **Convites pendentes**, com a validade em **Vale até**. Quando a pessoa aceita, ela passa para a lista **Pessoas**.',
        troubleshooting: [
          'A pessoa não recebeu o e-mail: confira o endereço e o spam. **Reenviar** manda um link novo e invalida o anterior; **Cancelar** desfaz o convite.',
          '**…mas o e-mail não pôde ser enviado**: o convite foi criado; toque em **Reenviar** em alguns minutos.',
          '**Esta pessoa já faz parte da equipe**: para mudar o acesso dela, use **Gerenciar > Alterar papel**.',
          'Administradores convidam só Editores e Analistas. Para convidar um Proprietário ou Administrador, peça a um Proprietário.',
          '**Convites indisponíveis**: organizações rejeitadas ou arquivadas não recebem convites.',
        ],
        keywords: [
          'funcionário',
          'atendente',
          'garçom',
          'caixa',
          'colaborador',
          'convite',
          'convidar',
          'equipe do negócio',
          'incluir pessoa',
          'dar acesso',
        ],
      },
      {
        id: 'parceiro-equipe-gerenciar',
        title: 'Como mudar o papel, suspender ou remover alguém',
        intro: 'Para ajustar o acesso de quem já faz parte da equipe.',
        needs: ['papel Proprietário ou Administrador no negócio'],
        blocks: [
          steps(
            'Em **Equipe**, ache a pessoa na lista **Pessoas** e toque em **Gerenciar**.',
            'Escolha **Alterar papel** (marque o **Novo papel** e toque em **Salvar papel**), **Suspender acesso** ou **Remover da equipe**.',
            'Na janela, confirme em **Suspender acesso** ou **Remover da equipe**.',
            'Para devolver o acesso de quem foi suspenso, toque em **Reativar** na linha da pessoa.'
          ),
          figures(
            image(
              'parceiro-equipe-gerenciar',
              'Menu Gerenciar aberto na linha de uma pessoa da equipe, com Alterar papel, Suspender acesso e Remover da equipe; Alterar papel está destacado.',
              'As opções de Gerenciar.'
            )
          ),
          info(
            'Suspender ou remover?',
            '**Suspender** tira o acesso ao Portal desta organização, mas mantém a pessoa na lista e o histórico: dá para reativar. **Remover** tira o acesso de vez: para voltar, só com um convite novo.'
          ),
        ],
        result:
          'a mudança vale na hora e aparece uma mensagem, como **… agora é Editor nesta organização.**',
        troubleshooting: [
          '**A organização precisa de pelo menos um proprietário ativo…**: promova outra pessoa a Proprietário antes de mudar o último.',
          'Não aparece **Gerenciar** para alguém: o seu papel não permite. Administradores gerenciam só Editores e Analistas.',
          '**Você pode ver a equipe, mas não alterá-la**: convites e mudanças de papel ficam com Proprietários e Administradores.',
        ],
        keywords: [
          'mudar papel',
          'alterar papel',
          'suspender',
          'remover',
          'reativar',
          'funcionário',
          'demitir',
          'equipe do negócio',
        ],
      },
      {
        id: 'parceiro-aceitar-convite',
        title: 'Como aceitar um convite',
        intro: 'Para entrar na equipe de um negócio que convidou você.',
        needs: ['o e-mail do convite'],
        blocks: [
          steps(
            'Abra o e-mail **Convite para participar de…** e toque em **Aceitar convite**.',
            'A página do convite abre, com o seu papel e a validade. Se você ainda não entrou, toque em **Entrar para aceitar** ou, sem conta, em **Criar conta**. Use o mesmo e-mail que recebeu o convite: depois, você volta direto para esta página.',
            'Toque em **Aceitar convite**.'
          ),
          figures(
            image(
              'parceiro-convite-aceitar',
              'Página Convite para Grupo Experimente Norte com o papel Editor, a validade, o e-mail da conta borrado e o botão Aceitar convite destacado.',
              'O convite, pronto para aceitar.'
            ),
            image(
              'parceiro-menu-editor',
              'Menu do Portal de um Editor, com Visão geral, Validar benefício, Utilizações, Avaliações, Experiências e eventos e Dados do lugar, sem Desempenho e sem Equipe.',
              'O menu de quem entrou como Editor.'
            )
          ),
        ],
        result:
          'aparece **Convite aceito. Você agora faz parte de … como …** e a página da organização abre no Portal. O menu mostra só o que o seu papel permite.',
        troubleshooting: [
          '**Você entrou com uma conta de outro e-mail**: toque em **Sair e entrar com outra conta** e entre com o e-mail convidado.',
          '**Convite expirado**: o link vale alguns dias. Peça a quem convidou para tocar em **Reenviar**.',
          '**Convite cancelado** ou **Link de convite inválido**: peça um convite novo. O link mais recente substitui os anteriores.',
          'Acesso suspenso: um convite não reativa. Peça a um Proprietário ou Administrador para tocar em **Reativar**.',
        ],
        keywords: ['convite', 'aceitar convite', 'entrar na equipe', 'funcionário', 'convidado'],
      },
      {
        id: 'parceiro-feedback',
        title: 'Como enviar feedback do piloto',
        intro: 'Para contar à equipe o que funcionou e o que atrapalha.',
        needs: ['uma conta de parceiro'],
        blocks: [
          steps(
            'Na **Visão geral** (ou no fim do editor do lugar), vá até **Feedback do piloto**.',
            'Escolha a **Nota** de 1 a 5 e, se quiser, a **Organização** e o **Lugar relacionado**.',
            'Escreva a **Mensagem** e toque em **Enviar feedback**.'
          ),
          figures(
            image(
              'parceiro-feedback-enviado',
              'Quadro Feedback do piloto com a mensagem destacada "Feedback enviado. Obrigado por ajudar a melhorar o piloto."',
              'Feedback enviado.'
            )
          ),
        ],
        result: 'aparece **Feedback enviado. Obrigado por ajudar a melhorar o piloto.**',
        keywords: ['feedback', 'sugestão', 'piloto'],
      },
    ],
  },
  {
    id: 'administracao',
    title: 'Área da equipe',
    audience: 'Para a equipe do Experimente+',
    profiles: 'Equipe do Experimente+ (Moderador, Administrador e Responsável técnico)',
    summary: 'Filas de moderação, denúncias, regras, benefícios, pessoas e catálogo.',
    note: 'No celular, o menu da esquerda fica atrás do botão ☰ (**Abrir navegação**), no alto, à esquerda.',
    icon: ShieldCheck,
    sections: [
      {
        id: 'administracao-hoje',
        title: 'Como ver o que resolver hoje',
        intro: 'Para começar pelo que tem prazo mais curto.',
        needs: ['papel Moderador, Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Hoje**.',
            'Veja os quadros **Dados de lugares para revisar**, **Conteúdo em análise**, **Denúncias pendentes** (os casos fora do prazo aparecem em destaque) e **Feedback do piloto**.',
            'Na **Caixa de moderação**, que lista tudo com o prazo mais curto primeiro, toque em **Revisar** no item.'
          ),
          figures(
            image(
              'admin-hoje',
              'Página "O que resolver hoje" com os quatro quadros e a Caixa de moderação destacada, listando denúncia, dados de lugar e evento, cada um com o botão Revisar.',
              'Hoje: tudo o que espera decisão.'
            )
          ),
        ],
        keywords: ['hoje', 'fila', 'caixa de moderação', 'prazos'],
      },
      {
        id: 'administracao-dados-de-lugares',
        title: 'Como revisar os dados de um lugar',
        intro: 'Para aprovar, pedir correção ou rejeitar o que um parceiro enviou.',
        needs: ['papel Moderador, Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'No menu da esquerda, em **Caixa de moderação**, toque em **Dados de lugares** e depois em **Revisar** no lugar.',
            'Em **Comparado à versão publicada**, os campos alterados vêm destacados, com o valor de antes. Marque **Mostrar só o que mudou** para esconder o resto.',
            'À direita, confira **Pendências para publicação**: a aprovação só é liberada sem pendências.',
            'Em **Decisão**, escolha uma saída: **Aprovar revisão** (com uma **Observação** opcional), **Enviar correções** (com o resumo e as pendências) ou **Rejeitar revisão** (com o motivo).'
          ),
          figures(
            image(
              'admin-revisao-mudancas',
              'Revisão da Padaria Primavera com a opção Mostrar só o que mudou (1) e o campo Descrição curta alterado, com o valor anterior (2), destacados.',
              'O que mudou (2); a opção (1) esconde o resto.'
            ),
            image(
              'admin-revisao-decisao',
              'Seção Decisão com os quadros Aprovar e publicar, Solicitar correções e Rejeitar definitivamente; o botão Aprovar revisão está destacado.',
              'As três decisões possíveis.'
            )
          ),
        ],
        result:
          'aparece **Revisão aprovada e publicada** e a nova versão vai para o app e o site. Nas correções, a versão volta ao parceiro com o que ajustar.',
        troubleshooting: [
          '**Aprovar revisão** desligado: ainda há pendência (por exemplo, falta uma capa aprovada ou há imagem sem análise). Resolva a pendência ou peça correção.',
        ],
        keywords: ['moderação', 'revisar', 'aprovar', 'correções', 'rejeitar', 'lugar'],
      },
      {
        id: 'administracao-conteudo',
        title: 'Como aprovar conteúdo e imagens de parceiros',
        intro: 'Para decidir experiências, eventos, vitrine e imagens enviados pelos parceiros.',
        needs: ['papel Moderador, Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'Em **Caixa de moderação**, toque em **Conteúdo de parceiros**. A lista abre em **Em análise**.',
            'Leia o item e toque em **Aprovar e publicar**, ou em **Recusar** (com o **Motivo da recusa**, que volta para o parceiro).',
            'Nas imagens, em **Mídia deste conteúdo**, toque em **Aprovar imagem** ou **Recusar imagem**. A decisão da imagem é separada da do texto.'
          ),
          figures(
            image(
              'admin-conteudo-em-analise',
              'Fila Conteúdo de parceiros com o evento Sexta do chorinho em análise e o botão Aprovar e publicar destacado, ao lado de Recusar e Arquivar.',
              'Um evento em análise.'
            ),
            image(
              'admin-conteudo-imagem',
              'Cartão da experiência publicada Café com prosa, com a imagem em análise e o botão Aprovar imagem destacado.',
              'A decisão da imagem.'
            )
          ),
          tip(
            'Imagem nova em conteúdo já publicado',
            'Ela não aparece na lista **Em análise**. Filtre **Estado: Publicado** (e, se quiser, o **Código da unidade**) para encontrá-la.'
          ),
          p(
            'Em qualquer item, **Corrigir** ajusta o texto, **Histórico** mostra o caminho do conteúdo e **Arquivar** tira da descoberta na hora.'
          ),
        ],
        result: 'aparece **Conteúdo aprovado e publicado** e o item vai para a página do lugar.',
        keywords: ['conteúdo', 'experiência', 'evento', 'vitrine', 'imagem', 'aprovar'],
      },
      {
        id: 'administracao-denuncias',
        title: 'Como resolver uma denúncia',
        intro: 'Para decidir, dentro do prazo, o que foi denunciado.',
        needs: ['papel Moderador, Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'Em **Caixa de moderação**, toque em **Denúncias**. Cada caso mostra o protocolo, o motivo, quando chegou, o **Prazo** e o **Conteúdo denunciado**.',
            'Leia o conteúdo (o link **Abrir a página pública da unidade** mostra onde ele aparece).',
            'Em **Desfecho**, escolha: **Ocultar o conteúdo**, **Sem violação**, **Autor advertido** ou **Denúncia repetida**. Ocultar só aparece para avaliações, respostas e conteúdo de parceiros.',
            'Escreva a **Nota da decisão** e toque em **Resolver** (ou em **Descartar**, para uma denúncia sem fundamento).'
          ),
          figures(
            image(
              'admin-denuncias',
              'Página Denúncias de conteúdo com um caso pendente; o prazo da denúncia está destacado.',
              'Uma denúncia pendente, com prazo.'
            ),
            image(
              'admin-denuncia-decisao',
              'Área de decisão da denúncia com o Desfecho Sem violação, a nota da decisão e o botão Resolver destacado, acima de Descartar.',
              'Resolvendo a denúncia.'
            )
          ),
        ],
        result: 'a denúncia sai de **Pendente** e aparece em **Resolvida** (filtro **Estado**).',
        troubleshooting: [
          'Denúncia sobre informação errada de um lugar: o lugar não sai do ar por denúncia, e **Ocultar o conteúdo** não aparece. Escolha o desfecho que descreve o caso, registre na **Nota da decisão** e peça ao negócio para corrigir os dados pelo Portal; a correção passa por **Dados de lugares**.',
          'Caso grave de um autor: **Banir autor** pede um motivo e impede novas publicações dele.',
          'Os casos fora do prazo aparecem em destaque em **Hoje**.',
          'Quem denunciou não é avisado da decisão: a denúncia é anônima.',
        ],
        keywords: ['denúncia', 'prazo', 'banir', 'resolver', 'descartar'],
      },
      {
        id: 'administracao-feedback',
        title: 'Como fazer a triagem do feedback do piloto',
        intro: 'Para transformar os relatos dos parceiros em decisões.',
        needs: ['papel Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Feedback do piloto**. Filtre por **Status** e **Contexto**, se quiser.',
            'Em cada relato, mude o **Status**, registre uma **Nota interna** e toque em **Salvar triagem**.'
          ),
          figures(
            image(
              'admin-feedback',
              'Página Feedback do piloto com um relato de nota 4/5 e os campos Status e Nota interna; o botão Salvar triagem está destacado.',
              'Um relato para triagem.'
            )
          ),
        ],
        keywords: ['feedback', 'triagem', 'piloto'],
      },
      {
        id: 'administracao-regras',
        title: 'Como ajustar as regras de avaliação, moderação e publicação',
        intro: 'Para definir os limites que valem para a operação inteira.',
        needs: ['papel Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'Em **Regras da operação**, toque em **Avaliações e publicação**.',
            'Em **Regras de avaliação**, defina a comprovação de visita, o tamanho do texto, fotos e vídeos por avaliação, o limite por dia e os prazos de edição. Toque em **Salvar regras**.',
            'Em **Moderação automática**, escolha para cada regra (dados de contato, dados de pagamento, links e termos bloqueados) se ela fica desligada, só abre denúncia ou retém o conteúdo até alguém decidir. Toque em **Salvar regras de moderação**.',
            'Em **Publicação e limites**, marque o que precisa de aprovação antes de publicar (experiências, eventos, vitrine), o máximo de mídias e a antecedência dos eventos. Toque em **Salvar regras de publicação**.'
          ),
          figures(
            image(
              'admin-regras-moderacao',
              'Quadro Moderação automática com as regras Dados de contato, Dados de pagamento, Links e Termos bloqueados e o botão Salvar regras de moderação destacado.',
              'Moderação automática.'
            ),
            image(
              'admin-regras-publicacao',
              'Quadro Publicação e limites com a opção "Aprovar eventos antes de publicar" marcada e destacada.',
              'O que passa pela moderação antes de publicar.'
            )
          ),
          warning(
            'Valores provisórios',
            'Os números atuais mantêm a plataforma funcionando até a operação definir os seus e podem mudar. Mudar uma regra não reescreve o que já foi publicado.'
          ),
        ],
        result:
          'aparece a confirmação do quadro salvo (por exemplo, **Regras de moderação automática atualizadas.**) e a regra vale para os próximos envios.',
        keywords: ['regras', 'moderação automática', 'publicação', 'avaliações', 'limites'],
      },
      {
        id: 'administracao-concierge',
        title: 'Como configurar o Concierge',
        intro: 'Para ligar ou desligar o assistente e definir os limites dele.',
        needs: ['papel Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'Em **Regras da operação**, toque em **Concierge IA**.',
            'Marque ou desmarque **Concierge ativo nesta operação**.',
            'Defina **Itens do catálogo por pergunta** (de 8 a 40) e **Perguntas por pessoa por dia** (de 1 a 200).',
            'Toque em **Salvar configuração**.'
          ),
          figures(
            image(
              'admin-concierge',
              'Página Concierge IA com Concierge ativo nesta operação marcado, os campos de limites e o botão Salvar configuração destacado.',
              'Os parâmetros do Concierge.'
            )
          ),
        ],
        result:
          'aparece **Configuração do Concierge atualizada.** e o Concierge passa a responder com os novos limites. Passado o limite do dia, o app mostra o catálogo sem o assistente.',
        keywords: ['concierge', 'ia', 'assistente', 'limite'],
      },
      {
        id: 'administracao-edicoes',
        title: 'Como preparar uma edição de benefícios',
        intro: 'Para criar o pacote de uma cidade ou uma edição de compra local.',
        needs: ['papel Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Edições e benefícios**.',
            'No quadro **Prepare a próxima edição**, escolha a **Cidade**, escreva o **Nome da edição**, a apresentação, o preço e os períodos de venda e de uso, e toque em **Criar edição**.',
            'Espere os lugares cadastrarem e ativarem as ofertas.',
            'No cartão da edição, toque em **Publicar**. O botão só funciona quando existe ao menos uma oferta ativa.',
            'Depois, use **Acessos**, **Pausar** ou **Arquivar** no mesmo cartão quando precisar.'
          ),
          figures(
            image(
              'admin-edicoes',
              'Página Edições e benefícios com o quadro Prepare a próxima edição destacado e o cartão de uma edição publicada, com preço, período e ofertas ativas.',
              'As edições da operação.'
            )
          ),
        ],
        keywords: ['edição', 'pacote', 'benefícios', 'preço', 'cidade'],
      },
      {
        id: 'administracao-acessos',
        title: 'Como liberar uma edição na carteira de alguém',
        intro: 'Para dar uma cortesia ou corrigir um acesso.',
        needs: ['papel Administrador ou Responsável técnico', 'o e-mail da conta da pessoa'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Acessos a edições**.',
            'No quadro **Liberar uma carteira**, escolha a **Edição**.',
            'Informe o **E-mail do titular** (o mesmo do cadastro) e a **Origem** (concessão manual ou cortesia).',
            'Se quiser, registre uma **Observação interna** e toque em **Conceder acesso**.'
          ),
          figures(
            image(
              'admin-acessos',
              'Página Acessos a edições com o formulário Liberar uma carteira preenchido e o botão Conceder acesso destacado; à direita, os cartões dos acessos ativos. Os e-mails aparecem borrados.',
              'Conceder um acesso (e-mails borrados nesta imagem).'
            )
          ),
        ],
        result:
          'aparece **Acesso concedido. A edição já aparece na carteira do usuário.** Para desfazer, use **Revogar** no cartão; o histórico fica preservado.',
        troubleshooting: [
          'A conta precisa estar ligada à operação. Se não estiver, a concessão é recusada: confira o e-mail ou peça à pessoa para criar a conta antes.',
        ],
        keywords: ['acesso', 'cortesia', 'carteira', 'liberar', 'revogar'],
      },
      {
        id: 'administracao-pessoas',
        title: 'Como criar contas e consultar pessoas e papéis',
        intro: 'Para achar ou criar uma conta e entender o que cada papel pode fazer.',
        needs: ['papel Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'Em **Pessoas e acesso**, toque em **Usuários**. Busque por nome ou e-mail e veja os papéis, a situação e a data de cadastro.',
            'Para criar uma conta, toque em **Adicionar usuário** e preencha **Nome completo**, **E-mail**, **Senha** e **Confirmar senha**. A conta entra na operação em uso como membro: ganha carteira e pode ser convidada para a equipe de um negócio.',
            'Conta antiga que ainda não faz parte da operação: na linha da conta, toque nos três pontos (**Abrir ações do usuário**) e em **Editar usuário**; no quadro **Operação**, toque em **Vincular à operação**.',
            'Em **Papéis** e **Permissões**, veja o que cada papel permite.'
          ),
          figures(
            image(
              'admin-usuarios',
              'Página Usuários com a busca por nome ou e-mail, a lista de contas de demonstração com os e-mails borrados e o botão Adicionar usuário destacado.',
              'A lista de usuários (e-mails borrados nesta imagem).'
            )
          ),
          info(
            'Quem concede os papéis',
            '**Adicionar usuário** não escolhe papel: a conta nasce como Explorador. Moderador, Administrador e Responsável técnico são concedidos pela equipe técnica do Experimente+, sem tela para isso. O acesso a um negócio vem do convite do próprio negócio (veja [Como dar acesso a um funcionário](#parceiro-equipe-convidar)), não de **Papéis**.'
          ),
        ],
        result: 'a conta nova aparece em **Usuários** e já pode entrar.',
        keywords: [
          'usuários',
          'papéis',
          'permissões',
          'pessoas',
          'adicionar usuário',
          'vincular à operação',
          'criar conta',
        ],
      },
      {
        id: 'administracao-catalogo',
        title: 'Como manter categorias, regiões e cidades',
        intro: 'Para organizar a descoberta e dizer onde a operação atua.',
        needs: ['papel Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'Em **Administração**, toque em **Categorias** para cuidar das famílias (como Comer & Beber) e das categorias que o visitante filtra e o parceiro escolhe.',
            'Em **Regiões e cidades**, cuide das regiões, das cidades e do fuso de cada uma, que decide o **Aberto agora** e a agenda do dia.',
            'Use **Editar** ou **Desativar** em cada item.'
          ),
          figures(
            image(
              'admin-categorias',
              'Página Categorias com as famílias, cada uma com Editar e Desativar; o botão de criar está destacado.',
              'Famílias e categorias.'
            )
          ),
        ],
        result:
          'desativar tira o item da descoberta sem apagar o histórico dos lugares que o usaram.',
        keywords: ['categorias', 'cidades', 'regiões', 'fuso'],
      },
      {
        id: 'administracao-painel',
        title: 'Como ver os indicadores e os arquivos',
        intro: 'Para uma visão de longo prazo da operação.',
        needs: ['papel Administrador ou Responsável técnico'],
        blocks: [
          steps(
            'No menu da esquerda, toque em **Painel operacional** para ver usuários, operações, arquivos, papéis e a evolução por mês. Para o dia a dia, **Abrir Hoje** leva às filas.',
            'Em **Administração > Arquivos**, veja os arquivos administrativos da operação.'
          ),
          figures(
            image(
              'admin-painel',
              'Painel operacional com o destaque "O que pede atenção hoje" e o botão Abrir Hoje destacado, acima dos números da operação.',
              'O Painel operacional.'
            )
          ),
        ],
        keywords: ['painel', 'indicadores', 'arquivos', 'dashboard'],
      },
    ],
  },
  {
    id: 'app-celular',
    title: 'O app no celular',
    audience: 'Para quem usa o Android',
    profiles: 'Visitante, Explorador e Parceiro',
    summary: 'Instalar, explorar com mapa, comprar, carteira, avaliar e a aba Validar.',
    icon: Smartphone,
    sections: [
      {
        id: 'app-instalar',
        title: 'Como instalar e atualizar o app',
        intro:
          'Para ter o Experimente+ no Android. No iPhone, use o site instalado na Tela de Início.',
        needs: ['um celular Android 7.0 ou mais novo'],
        blocks: [
          steps(
            'No celular, abra a página [Baixar o app](/app) e toque no botão laranja **Baixar para Android**.',
            'Abra o arquivo e permita instalar apps desta fonte quando o Android pedir.',
            'Toque em **Instalar** e depois em **Abrir**.'
          ),
          figures(
            image(
              'app-instalar',
              'Página /app no celular com o selo Beta e o botão laranja Baixar para Android destacado, acima de Usar no navegador.',
              'Baixar para Android, na página /app.'
            )
          ),
          p(
            'Para atualizar, baixe de novo pela mesma página e instale por cima: a conta e os dados continuam. No iPhone, siga [Como instalar o site no iPhone](#primeiros-passos-iphone).'
          ),
          tip(
            'Ajuda dentro do app',
            'O app abre este manual na parte certa: **Como usar o app**, na aba **Entrar**; o **?** do mapa; **Ajuda**, no menu **Mais opções** de um lugar; e o link de ajuda da compra.'
          ),
        ],
        result: 'o app abre na aba **Explorar**, sem pedir conta.',
        troubleshooting: ['O app não instala: veja [Problemas no app](#app-problemas).'],
        keywords: ['instalar', 'apk', 'atualizar', 'iphone', 'pwa', 'ajuda'],
      },
      {
        id: 'app-explorar',
        title: 'Como explorar no app',
        intro: 'Para achar lugares da cidade na lista, com busca e filtros.',
        blocks: [
          steps(
            'Na aba **Explorar**, toque na cidade, no topo, à direita (por exemplo **Londrina**), e escolha outra em **Cidade**. Toque de novo no botão para fechar.',
            'Toque em **Buscar lugares** e escreva um nome ou uma palavra.',
            'Use os filtros logo abaixo, como **Aberto agora** e as categorias.',
            'Role a lista **Lugares em** e toque num lugar para abrir a página dele.'
          ),
          figures(
            image(
              'app-explorar',
              'Aba Explorar do app com a cidade Londrina (1), a busca Buscar lugares (2) e o filtro Aberto agora (3) destacados, acima da lista Lugares em Londrina.',
              'A cidade (1), a busca (2) e os filtros (3).'
            ),
            image(
              'app-cidade',
              'Topo da aba Explorar com a lista de cidades aberta e destacada: Londrina marcada, Maringá e Apucarana.',
              'A troca de cidade.'
            )
          ),
          p(
            'Mais abaixo na aba ficam **Para você** (sugestões pelos seus interesses, quando você tem conta), a agenda, as novidades e o Concierge.'
          ),
        ],
        troubleshooting: [
          '**Nada encontrado**: toque em **Limpar filtros** ou em **Ver todos os lugares**.',
        ],
        keywords: ['explorar', 'buscar', 'filtros', 'cidade', 'para você'],
      },
      {
        id: 'app-mapa',
        title: 'Como usar o mapa no app',
        intro: 'Para ver onde ficam os lugares da cidade.',
        blocks: [
          steps(
            'Na aba **Explorar**, toque em **Ver no mapa**, à direita de **Lugares em**.',
            'Os lugares próximos aparecem agrupados em círculos com um número: toque num grupo para aproximar.',
            'Toque num lugar: aparece o cartão com a foto, a categoria, a nota e o atendimento. Toque no cartão para abrir o lugar, ou no **X** para fechar.',
            'Se você arrastou o mapa para longe, toque em **Centralizar**, no alto, à direita. Para voltar à lista, toque em **Ver em lista**.'
          ),
          figures(
            image(
              'app-mapa',
              'Mapa de Londrina no app com os lugares agrupados em círculos numerados; o grupo com 9 lugares está destacado.',
              'Um grupo de lugares: toque para aproximar.'
            ),
            image(
              'app-mapa-lugar',
              'Mapa com o cartão do lugar Pedal Norte Bicicletaria destacado, com foto, categoria, nota e Consulte o atendimento.',
              'O cartão do lugar, embaixo do mapa.'
            ),
            image(
              'app-mapa-centralizar',
              'Mapa arrastado para longe da cidade, com o botão Centralizar (1) e o botão de ajuda ? (2) destacados.',
              'Centralizar (1) volta à cidade; o ? (2) abre este manual.'
            )
          ),
        ],
        keywords: ['mapa', 'agrupamento', 'centralizar', 'cartão do lugar'],
      },
      {
        id: 'app-lugar',
        title: 'Como usar a página do lugar no app',
        intro: 'Para ver os detalhes, chegar lá, salvar, acompanhar e, se preciso, denunciar.',
        blocks: [
          steps(
            'Toque num lugar, na lista ou no cartão do mapa.',
            'No topo, à direita: **Compartilhar**, o coração (**Favoritar**) e **Mais opções** (os três pontos).',
            'Abaixo do nome: **Como chegar** (abre o mapa do celular), o sino (**Seguir**) e **Adicionar a um roteiro**.',
            'Se o lugar vende um benefício, o cartão **Benefício** mostra o preço e **Ver oferta** (veja [Como comprar no app](#app-comprar)).',
            'Role para ver **Para viver aqui**, o endereço, o horário, os contatos e as **Avaliações**.',
            'Para denunciar o lugar, toque em **Mais opções** e em **Denunciar este lugar**. No mesmo menu, **Ajuda** abre esta parte do manual.'
          ),
          figures(
            image(
              'app-lugar',
              'Página do Ateliê do Café no app com Compartilhar, Favoritar e Mais opções (1), Como chegar, seguir e roteiro (2) e o botão laranja Ver oferta (3) destacados.',
              'As ações do topo (1), de visita (2) e o benefício (3).'
            ),
            image(
              'app-lugar-menu',
              'Menu Mais opções aberto na página do lugar, com Denunciar este lugar (1) e Ajuda (2) destacados e Cancelar embaixo.',
              'O menu Mais opções.'
            )
          ),
        ],
        keywords: ['lugar', 'como chegar', 'seguir', 'roteiro', 'compartilhar', 'denunciar'],
      },
      {
        id: 'app-novidades',
        title: 'Como ver a agenda, as novidades e "Para viver aqui" no app',
        intro: 'Para saber o que acontece hoje e o que os lugares publicaram.',
        blocks: [
          steps(
            'Na aba **Explorar**, role até **Acontecendo hoje** e **Em breve**: os eventos da cidade, por data.',
            'Mais abaixo, **Novidades** ("Publicados recentemente") mostra o que os lugares publicaram.',
            'Na página de um lugar, **Para viver aqui** reúne as experiências, os eventos e a vitrine dele.',
            'Toque num item: abre um painel com a foto, o texto e as opções **Compartilhar** e **Denunciar**. Toque em **Fechar** para voltar.'
          ),
          figures(
            image(
              'app-novidades',
              'Aba Explorar com a faixa Acontecendo hoje (1), com a Roda de samba ao vivo, e o título Em breve (2) destacados.',
              'A agenda na aba Explorar.'
            ),
            image(
              'app-lugar-para-viver',
              'Página do lugar com a faixa Para viver aqui e o cartão da experiência Oficina de métodos de preparo destacado.',
              'Para viver aqui, na página do lugar.'
            ),
            image(
              'app-novidades-item',
              'Painel aberto de uma experiência, com o título e o texto destacados e os botões Compartilhar, Denunciar e Fechar.',
              'O painel de um item.'
            )
          ),
        ],
        keywords: ['agenda', 'novidades', 'eventos', 'para viver aqui', 'hoje', 'em breve'],
      },
      {
        id: 'app-concierge',
        title: 'Como perguntar ao Concierge no app',
        intro: 'Para receber sugestões de lugares a partir de uma pergunta.',
        blocks: [
          steps(
            'Na aba **Explorar**, role até o cartão **Perguntar ao Concierge** ("Não sabe por onde começar?") e toque nele.',
            'No quadro **Concierge**, escreva a pergunta. Exemplo: "quero um café tranquilo e depois algo para fazer à tarde".',
            'Toque em **Perguntar** e toque nos lugares sugeridos para abri-los.'
          ),
          figures(
            image(
              'app-concierge-card',
              'Fim da aba Explorar com o cartão Perguntar ao Concierge, "Não sabe por onde começar?", destacado.',
              'O atalho para o Concierge.'
            ),
            image(
              'app-concierge',
              'Quadro Concierge "O que você quer fazer?" com o campo da pergunta (1) e o botão Perguntar (2) destacados.',
              'A pergunta (1) e Perguntar (2).'
            )
          ),
        ],
        result: 'aparece **Sugestão ancorada no catálogo** com os lugares citados.',
        troubleshooting: [
          'Aviso de assistente indisponível: o app mostra opções do catálogo no lugar da resposta. Tente de novo mais tarde.',
        ],
        keywords: ['concierge', 'pergunta', 'ia', 'sugestão'],
      },
      {
        id: 'app-conta',
        title: 'Como criar a conta, entrar e recuperar a senha no app',
        intro: 'Para ter carteira, listas pessoais e avaliações no app.',
        blocks: [
          steps(
            'Na barra de baixo, toque em **Entrar**. A tela **Entre na sua conta** abre.',
            'Para uma conta nova, toque em **Criar conta**. Preencha **Nome completo**, **E-mail**, **Usuário (opcional)**, **Senha** e **Confirmar senha**, marque **Li e aceito os Termos de Uso e a Política de Privacidade** e toque em **Criar conta**.',
            'Para entrar, informe **E-mail ou usuário** e **Senha** e toque em **Entrar**.',
            'Esqueceu a senha? Toque em **Esqueci minha senha**, informe o **E-mail** e toque em **Solicitar link**. O link chega por e-mail e abre no navegador, onde você define a senha nova.'
          ),
          figures(
            image(
              'app-entrar',
              'Tela Entre na sua conta do app com os campos E-mail ou usuário e Senha, Esqueci minha senha, Entrar, Criar conta (destacado) e Como usar o app.',
              'A aba Entrar. Criar conta fica embaixo.'
            ),
            image(
              'app-cadastro',
              'Tela Criar conta do app com o aceite dos Termos de Uso e da Política de Privacidade (1) e o botão Criar conta (2) destacados.',
              'O aceite (1) e Criar conta (2).'
            ),
            image(
              'app-recuperar-senha',
              'Tela Recuperar senha do app com o campo E-mail e o botão Solicitar link destacado.',
              'Recuperar a senha.'
            )
          ),
          p(
            'Com a conta, a barra de baixo mostra **Explorar**, **Carteira** e **Conta**. Em **Conta** ficam **Editar perfil** (mude **Nome** e **Usuário** e toque em **Salvar alterações**) e **Excluir conta** (informe a **Senha atual**, escreva a confirmação pedida e toque em **Excluir permanentemente**).'
          ),
        ],
        result: 'você entra na conta e a barra de baixo passa a mostrar **Carteira** e **Conta**.',
        keywords: ['conta', 'entrar', 'cadastro', 'senha', 'perfil', 'excluir'],
      },
      {
        id: 'app-favoritos',
        title: 'Como usar favoritos, seguindo, roteiros e interesses',
        intro: 'Para guardar lugares, acompanhar novidades e montar programas.',
        needs: ['uma conta'],
        blocks: [
          steps(
            'Na página do lugar, toque no coração (**Favoritar**) para guardar o lugar. A lista fica em **Conta > Favoritos**.',
            'Toque no sino (**Seguir**) para acompanhar as novidades do lugar. A lista fica em **Conta > Seguindo**.',
            'Toque em **Adicionar a um roteiro** para pôr o lugar numa lista sua. Em **Conta > Roteiros**, **Novo roteiro** cria uma lista (ex.: "Sábado no centro") com **Criar roteiro**.',
            'Em **Conta > Interesses**, escolha o que você gosta e toque em **Salvar interesses**. As sugestões aparecem em **Para você**, na aba Explorar.'
          ),
          figures(
            image(
              'app-favoritar',
              'Página do lugar com o coração Favoritar (1), o sino Seguir (2) e o botão Adicionar a um roteiro (3) destacados.',
              'Favoritar (1), Seguir (2) e roteiro (3).'
            )
          ),
          info('Só você vê', 'Favoritos, seguidos, roteiros e interesses são privados.'),
        ],
        troubleshooting: [
          'Sem conta, o app pede para entrar antes de guardar: veja [Como criar a conta no app](#app-conta).',
        ],
        keywords: ['favoritos', 'seguindo', 'roteiros', 'interesses', 'coração', 'sino'],
      },
      {
        id: 'app-comprar',
        title: 'Como comprar um pacote ou voucher no app',
        intro: 'Para ter benefícios na carteira. Na homologação, o pagamento é simulado.',
        needs: ['uma conta'],
        blocks: [
          steps(
            'Na página do lugar, toque em **Ver oferta** (ou, na **Carteira**, em **Ver benefícios disponíveis**).',
            'Confira **O que está incluído**, **Compre até**, **Use até** e as condições (**Ver condições**).',
            'Sem conta, toque em **Entrar para comprar** e entre.',
            'Em **Forma de pagamento**, escolha **Pix**, marque **Li e aceito as condições** e toque em **Ir para o pagamento**.',
            'A tela **Meu pedido** mostra o que acontece agora e confere o pagamento sozinha.'
          ),
          figures(
            image(
              'app-produto',
              'Tela do voucher avulso Item em dobro com O que está incluído, Compre até e Use até, o link Ver condições (1) e o botão Entrar para comprar (2) destacados.',
              'O produto: as condições (1) e o botão de comprar (2).'
            )
          ),
          warning(
            'Pagamento simulado',
            'Nesta versão de testes nada é cobrado: o pedido mostra **Pagamento simulado** e fica aguardando até a equipe técnica do Experimente+ confirmar no servidor (não há botão para isso no app nem na área da equipe). O cartão de crédito aparece como "Em breve pelo aplicativo".'
          ),
        ],
        result: 'quando o pagamento é confirmado, os benefícios aparecem na **Carteira**.',
        troubleshooting: [
          'Pedido pendente: a tela **Meu pedido** confere sozinha; toque em **Consultar carteira** para ver se já chegou. Um pedido pendente pode ser cancelado nessa mesma tela.',
          'Acompanhe todos os pedidos em **Carteira > Meus pedidos**.',
        ],
        keywords: ['comprar', 'pacote', 'voucher', 'pix', 'pedido', 'pagamento', 'cancelar'],
      },
      {
        id: 'app-carteira',
        title: 'Como usar a carteira e o QR no app',
        intro: 'Para ver seus benefícios e usá-los no lugar.',
        needs: ['uma conta com benefícios'],
        blocks: [
          steps(
            'Na barra de baixo, toque em **Carteira**.',
            'No benefício, toque em **Apresentar**.',
            'Mostre o QR para quem está atendendo. O código vale por 5 minutos; se expirar, toque em **Gerar novo código**.',
            'Espere o lugar confirmar. Os comprovantes ficam em **Meus usos**.'
          ),
          p(
            'As telas são as mesmas do site: veja as imagens em [Como usar um benefício no lugar](#consumidor-apresentar).'
          ),
        ],
        result: 'o uso aparece em **Meus usos**, com o comprovante.',
        troubleshooting: [
          '**Este código expirou. Gere um novo para apresentar.**: toque em **Gerar novo código**.',
        ],
        keywords: ['carteira', 'qr', 'apresentar', 'meus usos', 'comprovante'],
      },
      {
        id: 'app-avaliar',
        title: 'Como avaliar um lugar no app',
        intro: 'Para contar a sua experiência com nota, comentário e fotos.',
        needs: ['uma conta'],
        blocks: [
          steps(
            'Na página do lugar, role até **Avaliações** e toque em **Avaliar este lugar** (sem conta, o botão diz **Entrar para avaliar**).',
            'Toque nas estrelas para dar a nota.',
            'Se quiser, escreva em **Conte como foi** e adicione fotos (até o número que a operação permite).',
            'Toque em **Publicar avaliação**.'
          ),
          figures(
            image(
              'app-avaliar',
              'Fim das avaliações na página do lugar, com duas avaliações de demonstração e o botão Entrar para avaliar destacado.',
              'O botão de avaliar, embaixo das avaliações.'
            )
          ),
          p(
            'Cada pessoa avalia um lugar uma vez. Para mudar, abra **Conta > Avaliações** e toque em **Editar**.'
          ),
        ],
        result: 'a avaliação aparece no app e no site, e o lugar pode responder publicamente.',
        troubleshooting: [
          '**Você já avaliou este lugar. Edite a avaliação existente.**: use **Conta > Avaliações**.',
          '**Uma foto não pôde ser enviada.**: tente a foto de novo, com a conexão boa.',
        ],
        keywords: ['avaliar', 'nota', 'estrelas', 'foto', 'comentário'],
      },
      {
        id: 'app-validar',
        title: 'Como validar um benefício no app (parceiros)',
        intro: 'Para ler o QR do cliente com a câmera e registrar o uso.',
        needs: ['conta de parceiro com papel Proprietário, Administrador ou Editor'],
        blocks: [
          steps(
            'Na barra de baixo, toque em **Validar**. Na primeira vez, toque em **Permitir câmera**.',
            'Aponte para o código que o cliente está mostrando.',
            'Confira o benefício, o cliente e os usos restantes. Ler o código não usa o benefício.',
            'Toque em **Confirmar utilização**.'
          ),
          p(
            'O histórico fica em **Ver utilizações**, na mesma aba. A prévia e o comprovante são como os do site: veja [Como validar um benefício](#parceiro-validar).'
          ),
        ],
        result: 'o comprovante da utilização aparece na tela.',
        troubleshooting: [
          'Câmera bloqueada: toque em **Abrir configurações** e permita a câmera para o Experimente+.',
          '**Este código não é uma apresentação válida. Peça um novo ao cliente.**',
          'A confirmação não completou: tentar de novo é seguro; se o uso já foi registrado, o mesmo comprovante é devolvido.',
        ],
        keywords: ['validar', 'câmera', 'qr', 'parceiro', 'confirmar'],
      },
      {
        id: 'app-problemas',
        title: 'Problemas no app',
        intro: 'O que fazer quando algo não sai como esperado.',
        blocks: [
          list(
            '**Sem conexão com a internet**: o app avisa e espera. Confira o Wi-Fi ou os dados móveis; as telas carregam de novo quando a conexão volta. Se aparecer **Tentar de novo**, toque nele.',
            '**Código expirado**: na carteira, toque em **Gerar novo código**.',
            '**Câmera sem permissão** (aba Validar): toque em **Abrir configurações** e permita a câmera.',
            '**O app não instala**: permita instalar apps do navegador usado para baixar, confira o espaço livre e baixe de novo pela página [Baixar o app](/app).'
          ),
        ],
        keywords: ['problema', 'erro', 'sem conexão', 'offline', 'câmera', 'não instala'],
      },
    ],
  },
  {
    id: 'duvidas',
    title: 'Dúvidas frequentes',
    audience: 'Respostas rápidas',
    profiles: 'todos os perfis',
    summary: 'E-mail, QR, lugares, pagamento, acesso e mensagens comuns.',
    icon: CircleHelp,
    sections: [
      {
        id: 'duvidas-email',
        title: 'Não recebi o e-mail',
        intro: 'Vale para a confirmação do cadastro e para a recuperação da senha.',
        blocks: [
          list(
            'Confira a caixa de spam ou de lixo eletrônico e se o endereço foi digitado certo.',
            'Confirmação do cadastro: o link vale por 24 horas. Se expirou, entre na conta e abra o link de novo: a página **Link expirado** tem o botão **Enviar novo link**.',
            'Para a senha, peça de novo em **Esqueceu a senha?**: cada pedido novo cancela os links anteriores.',
            'Convite para a equipe de um negócio: peça a quem convidou para tocar em **Reenviar**, na página **Equipe**.',
            'Nesta versão beta, a conta funciona mesmo antes de o e-mail ser confirmado.'
          ),
        ],
        keywords: ['email', 'spam', 'confirmação', 'confirmar e-mail', 'link expirado', 'convite'],
      },
      {
        id: 'duvidas-qr-expirou',
        title: 'O QR expirou',
        intro: 'O QR vale por 5 minutos, por segurança.',
        blocks: [
          p(
            'Toque em **Gerar novo código** na mesma tela e mostre o QR novo. Se o lugar já confirmou o uso, o comprovante está em **Utilizações**. As outras recusas estão em [O que cada recusa quer dizer](#resgate-recusas).'
          ),
        ],
        keywords: ['qr', 'expirado', 'código'],
      },
      {
        id: 'duvidas-beneficio-recusado',
        title: '"Não foi possível validar esta apresentação"',
        intro: 'O aviso que o lugar vê quando o benefício não vale naquele momento.',
        blocks: [
          p(
            'O benefício já foi usado todas as vezes permitidas, está fora do dia ou do horário da oferta, ou a oferta foi pausada. Confira na carteira quando o benefício vale. Se o aviso falar em apresentação inválida ou expirada, gere um novo código. Veja todas as situações em [O que cada recusa quer dizer](#resgate-recusas).'
          ),
        ],
        keywords: ['validar', 'recusado', 'benefício'],
      },
      {
        id: 'duvidas-lugar-nao-aparece',
        title: 'O lugar não aparece',
        intro: 'Quando você procura um lugar e não encontra.',
        blocks: [
          list(
            'Confira a cidade escolhida e toque em **Limpar filtros** (principalmente **Aberto agora**).',
            'Um lugar só aparece depois que a equipe aprova os dados. No Portal, veja se ele está **Em moderação** ou com **Correções pedidas**.',
            'Mudanças num lugar já publicado aparecem quando a nova versão é aprovada; até lá, continua no ar a anterior.'
          ),
        ],
        keywords: ['lugar', 'sumiu', 'não aparece', 'busca'],
      },
      {
        id: 'duvidas-pagamento',
        title: 'O pagamento é real?',
        intro: 'Sobre a compra nesta fase de testes.',
        blocks: [
          p(
            'Não. Esta é uma versão beta em homologação: lugares, eventos e benefícios são fictícios, de demonstração, e o pagamento é simulado. Nada é cobrado.'
          ),
          p(
            'O pedido fica aguardando até a equipe técnica do Experimente+ confirmar o pagamento simulado no servidor; não há botão para isso na área da equipe. Depois da confirmação, os benefícios entram na **Carteira**. Se um pedido ficar muito tempo pendente, avise a equipe que acompanha os testes.'
          ),
        ],
        keywords: ['pagamento', 'cobrança', 'pix', 'simulado'],
      },
      {
        id: 'duvidas-carteira',
        title: '"Área indisponível para sua conta"',
        intro: 'O aviso de quem ainda não está ligado à região atendida.',
        blocks: [
          p(
            'A Carteira e o Portal precisam de uma conta ligada a uma região do Experimente+. Se a sua ainda não está, essas áreas mostram este aviso; explorar os lugares continua livre. Se parecer engano, fale com a equipe do Experimente+.'
          ),
          figures(
            image(
              'conta-nova-carteira',
              'Aviso "Área indisponível para sua conta" destacado, com os botões Voltar ao início e Explorar cidades.',
              'O aviso de área indisponível.'
            )
          ),
        ],
        keywords: ['área indisponível', 'carteira', 'região', 'operação'],
      },
      {
        id: 'duvidas-portal',
        title: 'Não vejo o Portal (ou a área da equipe)',
        intro: 'Quando falta uma área que você esperava ver.',
        blocks: [
          list(
            'O Portal aparece para quem faz parte de um negócio. Se você acabou de cadastrar o seu, toque em **Negócios**, no topo.',
            'Para entrar num negócio que já existe, peça um convite a um Proprietário ou Administrador dele (veja [Como aceitar um convite](#parceiro-aceitar-convite)).',
            'Falta um item no menu do Portal, como **Desempenho** ou **Equipe**: o menu mostra só o que o seu papel permite (veja [Parceiro](#perfil-parceiro)).',
            'A área da equipe só aparece para Moderador, Administrador e Responsável técnico. Veja [Perfis de acesso](#perfis).'
          ),
        ],
        keywords: ['portal', 'negócios', 'acesso', 'perfil'],
      },
      {
        id: 'duvidas-campos-bloqueados',
        title: 'Os campos do meu lugar estão bloqueados',
        intro: 'O esperado quando os dados estão publicados ou em moderação.',
        blocks: [
          p(
            'Toque em **Editar dados do lugar** para preparar uma nova versão (veja [Como editar os dados de um lugar](#parceiro-editar-lugar)). Se o lugar está **Em moderação**, a edição volta quando a equipe responder.'
          ),
        ],
        keywords: ['bloqueado', 'editar', 'lugar'],
      },
      {
        id: 'duvidas-iphone',
        title: 'Tenho iPhone',
        intro: 'O app para iOS ainda não saiu.',
        blocks: [
          p(
            'Use o site no Safari e, se quiser, instale na Tela de Início (veja [Como instalar o site no iPhone](#primeiros-passos-iphone)). Descoberta, conta, carteira e Portal funcionam pelo site. A compra de pacotes e vouchers e a escrita de avaliações, por enquanto, ficam no app Android.'
          ),
        ],
        keywords: ['iphone', 'ios', 'apple'],
      },
    ],
  },
]

/** Every anchor in the manual, chapters first, in reading order. */
export function manualAnchors(): string[] {
  return MANUAL_CHAPTERS.flatMap((chapter) => [
    chapter.id,
    ...chapter.sections.map((section) => section.id),
  ])
}
