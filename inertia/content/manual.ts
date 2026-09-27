import type { LucideIcon } from 'lucide-react'
import {
  CircleHelp,
  Compass,
  Rocket,
  ShieldCheck,
  Smartphone,
  Store,
  WalletCards,
} from 'lucide-react'

import { MANUAL_MEDIA, type ManualMediaId } from '~/content/manual_media'
import { MANUAL_MEDIA_PATH } from '~/config/help'

/**
 * The user manual at /manual, as data: the page, the PDF and the contextual help
 * all read it. Every step was run in the site before it was written here; the
 * pictures come from the development demo (fictitious places and people).
 *
 * Inline text accepts two marks: **bold** and [label](/path or #anchor).
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

export interface ManualSection {
  id: string
  title: string
  blocks: readonly ManualBlock[]
}

export interface ManualChapter {
  id: string
  title: string
  /** Who the chapter is for, in a few words. */
  audience: string
  summary: string
  icon: LucideIcon
  sections: readonly ManualSection[]
}

function image(id: ManualMediaId, alt: string, caption?: string): ManualImage {
  const { width, height } = MANUAL_MEDIA[id]
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

export const MANUAL_CHAPTERS: readonly ManualChapter[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros passos',
    audience: 'Para todo mundo',
    summary: 'O que é o Experimente+, onde usar e como instalar o app.',
    icon: Rocket,
    sections: [
      {
        id: 'primeiros-passos-o-que-e',
        title: 'O que é o Experimente+',
        blocks: [
          p(
            'O Experimente+ reúne lugares e serviços das cidades do norte do Paraná: restaurantes, bares, cafés, cultura, lazer, bem-estar e serviços locais. Qualquer pessoa explora sem criar conta. Com uma conta, dá para usar benefícios comprados na carteira; os negócios cuidam dos próprios dados pelo Portal do parceiro, e a equipe do Experimente+ revisa tudo antes de publicar.'
          ),
          figures(
            image(
              'inicio-home',
              'Página inicial do Experimente+ com o título "Encontre lugares e serviços na sua cidade" e o botão laranja "Escolher uma cidade".',
              'A página inicial. O botão "Escolher uma cidade" leva direto ao catálogo.'
            )
          ),
        ],
      },
      {
        id: 'primeiros-passos-quem-usa',
        title: 'Quem usa o quê',
        blocks: [
          list(
            '**Visitante**: explora cidades, lugares, agenda e o Concierge, sem login. Veja [Visitante](#visitante).',
            '**Consumidor**: cria uma conta, compra pacotes e vouchers pelo app e apresenta o benefício por QR. Veja [Consumidor](#consumidor).',
            '**Parceiro**: a equipe de um negócio. Edita os dados do lugar, publica experiências e eventos, responde avaliações e valida benefícios. Veja [Parceiro](#parceiro).',
            '**Operação**: a equipe do Experimente+. Revisa o que os parceiros enviam, cuida das denúncias e das regras. Veja [Administração](#administracao).'
          ),
          p(
            'Uma mesma conta pode ter mais de um papel. Quem é parceiro encontra o Portal em **Negócios**, no menu da conta; quem é da operação encontra a área **Operação** no mesmo menu.'
          ),
        ],
      },
      {
        id: 'primeiros-passos-app',
        title: 'Site e app: instalar no Android e usar no iPhone',
        blocks: [
          p(
            'O site funciona em qualquer navegador, no computador ou no celular. O app para Android é uma versão beta distribuída fora da Play Store, na página [Baixar o app](/app).'
          ),
          steps(
            'No celular Android, abra a página [Baixar o app](/app) (o link também está no rodapé do site). Se estiver no computador, aponte a câmera do celular para o QR da página.',
            'Toque em **Baixar para Android**. O arquivo é grande: se puder, use o Wi-Fi.',
            'Ao abrir o arquivo, o Android pede para permitir apps desta fonte. É esperado, porque o app ainda não está na loja.',
            'Toque em **Instalar** e abra o Experimente+.'
          ),
          figures(
            image(
              'inicio-app',
              'Página "O Experimente+ no seu celular" com o selo Beta, o botão "Baixar para Android" e, à direita, o quadro "Está no computador?" com o código QR.',
              'A página /app. O código QR (encoberto aqui) abre a mesma página no celular.'
            )
          ),
          info(
            'No iPhone',
            'A versão para iOS chega depois, pela App Store. Por enquanto, use o Experimente+ pelo navegador do iPhone, com a mesma conta.'
          ),
          tip(
            'Tema claro ou escuro',
            'O botão com o sol, no topo de todas as páginas, alterna entre o tema claro e o escuro. Em **Conta e preferências > Aparência** você também pode acompanhar o tema do celular.'
          ),
        ],
      },
      {
        id: 'primeiros-passos-usuarios-de-teste',
        title: 'Usuários de teste',
        blocks: [
          p(
            'Nesta fase existem contas de teste prontas para cada papel (consumidor, parceiro e operação). Os e-mails e as senhas são enviados a cada pessoa, em particular, pela equipe do Experimente+. Eles não aparecem neste manual e não devem ser repassados.'
          ),
          p(
            'Para explorar como visitante você não precisa de nenhuma delas. Para testar como consumidor, você também pode criar a sua própria conta (veja [Criar conta](#consumidor-criar-conta)).'
          ),
        ],
      },
    ],
  },
  {
    id: 'visitante',
    title: 'Visitante: descobrir sem conta',
    audience: 'Para quem quer explorar',
    summary: 'Cidades, busca, página do lugar, agenda, Concierge e denúncias.',
    icon: Compass,
    sections: [
      {
        id: 'visitante-explorar',
        title: 'Escolher a cidade',
        blocks: [
          p(
            'Toque em **Explorar** (no topo da página ou na barra de baixo, no celular) e escolha uma das cidades. Cada cartão mostra quantos lugares já estão publicados ali.'
          ),
          figures(
            image(
              'visitante-cidades',
              'Página "Escolha uma cidade" com cartões de Londrina, Maringá e Apucarana, cada um com o número de lugares publicados e o link "Explorar cidade".',
              'As cidades atendidas. Os números mudam conforme os lugares são publicados.'
            ),
            image(
              'visitante-cidade-celular',
              'Página de Londrina no celular, com a busca "Encontre um lugar" e a barra de navegação de baixo com Explorar, Entrar e Cadastrar negócio.',
              'No celular, a navegação fica na barra de baixo.'
            )
          ),
        ],
      },
      {
        id: 'visitante-buscar',
        title: 'Buscar e filtrar',
        blocks: [
          p(
            'Na página da cidade, o quadro **Encontre um lugar** reúne a busca e os filtros. Eles valem juntos: combine o quanto quiser e toque em **Buscar**.'
          ),
          list(
            '**O que você procura?**: escreva um nome ou uma palavra, como "café", "cinema" ou "tatuagem".',
            '**Categoria**: mostra só um tipo de lugar. O número ao lado é quantos lugares a cidade tem naquela categoria.',
            '**Ordenar por**: muda a ordem da lista.',
            '**Aberto agora**: mostra só o que está aberto neste momento, pelo horário da cidade.'
          ),
          p(
            'Os filtros aplicados aparecem logo abaixo, como etiquetas. **Limpar filtros** volta para a lista completa.'
          ),
          figures(
            image(
              'visitante-busca',
              'Busca em Londrina com a categoria Restaurantes e o filtro "Aberto agora" aplicados, dois resultados e o botão "Limpar filtros".',
              'Categoria "Restaurantes" com "Aberto agora": dois resultados.'
            )
          ),
        ],
      },
      {
        id: 'visitante-categorias',
        title: 'Navegar por categorias',
        blocks: [
          p(
            'O botão **Categorias**, no alto da página da cidade, mostra as famílias (Comer & Beber, Cultura & Lazer, Bem-estar & Estilo e outras) e as categorias que já têm lugares ali. Toque em **Explorar categoria** para ver só aqueles lugares.'
          ),
          figures(
            image(
              'visitante-categorias',
              'Página "Categorias em Londrina" com as famílias Comer & Beber, Cultura & Lazer, Ar livre & Esportes, Bem-estar & Estilo e Serviços locais.',
              'As categorias de Londrina, agrupadas por família.'
            )
          ),
        ],
      },
      {
        id: 'visitante-mapa',
        title: 'Mapa e rotas',
        blocks: [
          p(
            'O mapa com todos os lugares da cidade está no app (veja [O app no celular](#app-explorar)). No site, cada lugar tem o botão **Como chegar**, que abre a rota no Google Maps, a partir de onde você está.'
          ),
        ],
      },
      {
        id: 'visitante-lugar',
        title: 'A página do lugar',
        blocks: [
          p('Toque em um lugar para abrir a página dele. Ali estão, de cima para baixo:'),
          list(
            'a foto de capa, a categoria e se o lugar está **Aberto agora**;',
            '**Entre em contato**: **Como chegar**, WhatsApp, telefone, site, Instagram ou agendamento (só os canais que o lugar informou) e **Compartilhar**;',
            'o **Endereço** e os **Horários** da semana, com o dia de hoje marcado e as **Datas especiais**, como feriados;',
            'as **Avaliações**, as **Fotos publicadas** e as **Informações úteis** (faixa de preço, reservas, opções vegetarianas, pets e o que mais a categoria pedir).'
          ),
          figures(
            image(
              'visitante-lugar',
              'Página da Cantina Vale Verde com a foto de capa, o selo "Aberto agora" e, à direita, o quadro "Entre em contato" com os botões Como chegar, Visitar o site e Compartilhar.',
              'O topo da página do lugar.'
            ),
            image(
              'visitante-lugar-horarios',
              'Quadro "Horários" com os dias da semana, o domingo marcado como "Hoje" e as datas especiais de feriado.',
              'Horários regulares e datas especiais.'
            )
          ),
          tip(
            'Tudo o que você vê foi revisado',
            'O rodapé da página mostra **Conteúdo publicado**, com as datas de publicação e de atualização. Os dados passam pela equipe do Experimente+ antes de aparecer.'
          ),
        ],
      },
      {
        id: 'visitante-avaliacoes',
        title: 'Avaliações',
        blocks: [
          p(
            'O quadro **Avaliações** mostra a nota média, o total e as três avaliações mais recentes, com as fotos que as pessoas enviaram e a resposta do lugar, quando houver. Para avaliar, use o app (veja [Avaliar com fotos](#consumidor-avaliar)).'
          ),
          figures(
            image(
              'visitante-lugar-avaliacoes',
              'Quadro "Avaliações" com nota 3,8 em 4 avaliações, três avaliações com estrelas, uma delas com foto, e o link "Denunciar avaliação" em cada uma.',
              'As avaliações mais recentes. Todas estão no app.'
            )
          ),
        ],
      },
      {
        id: 'visitante-para-viver-aqui',
        title: 'Para viver aqui: experiências, eventos e vitrine',
        blocks: [
          p(
            'Mais abaixo, **Descubra mais neste lugar** traz o que o próprio lugar publicou: **Experiências** (atividades que ele oferece), **Eventos** (com data e horário) e a **Vitrine** (itens em destaque, com preço informativo).'
          ),
          figures(
            image(
              'visitante-lugar-para-viver',
              'Seção "Descubra mais neste lugar" com a experiência "Aula de massa fresca em família" e o início da lista de eventos.',
              'Experiências, eventos e vitrine publicados pelo lugar.'
            )
          ),
        ],
      },
      {
        id: 'visitante-agenda',
        title: 'Agenda e novidades da cidade',
        blocks: [
          p(
            'Na página da cidade, **O que está acontecendo** reúne, em ordem, os eventos de todos os lugares: **Acontecendo hoje**, **Em breve** (os próximos dias) e **Novidades** (o que foi publicado por último). Use as setas para ver mais e toque em um cartão para abrir o lugar.'
          ),
          figures(
            image(
              'visitante-agenda',
              'Agenda de Londrina com o evento de hoje "Roda de samba ao vivo" e a faixa "Em breve" com as próximas datas.',
              'A agenda da cidade.'
            )
          ),
        ],
      },
      {
        id: 'visitante-concierge',
        title: 'Concierge',
        blocks: [
          p(
            'O Concierge sugere lugares a partir de uma pergunta em linguagem comum. Ele fica na página da cidade.'
          ),
          steps(
            'Escreva o que você quer fazer em **Sua pergunta** (até 300 caracteres). Por exemplo: "quero um café tranquilo e depois algo para fazer à tarde".',
            'Toque em **Perguntar**.',
            'Leia a sugestão e toque nos cartões para abrir os lugares citados.'
          ),
          figures(
            image(
              'visitante-concierge',
              'Concierge de Londrina com a pergunta sobre um café tranquilo e, abaixo, a sugestão ancorada no catálogo com dois cartões: uma degustação de cafés e uma aula de yoga.',
              'Uma sugestão do Concierge, com os lugares citados.'
            )
          ),
          info(
            'O que o Concierge não faz',
            'Ele só cita lugares, experiências e eventos publicados no Experimente+, e não faz reservas nem compras. Há um limite de perguntas por pessoa por dia, definido pela operação.'
          ),
        ],
      },
      {
        id: 'visitante-denunciar',
        title: 'Denunciar um conteúdo',
        blocks: [
          p(
            'Viu uma avaliação ofensiva, falsa ou com propaganda? Ou um lugar com informação errada? A denúncia é anônima e não pede login.'
          ),
          steps(
            'Toque em **Denunciar avaliação** (embaixo de cada avaliação) ou em **Denunciar este lugar** (no fim da página).',
            'Escolha **Qual é o problema?** e, se quiser, explique melhor.',
            'Toque em **Enviar denúncia** e guarde o protocolo que aparece (começa com DEN-).'
          ),
          figures(
            image(
              'visitante-denunciar',
              'Janela "Denunciar avaliação" com os motivos Ofensivo ou discriminatório, Assédio, Conteúdo inadequado, Informação falsa, Spam ou propaganda, Conflito de interesse e Outro motivo.',
              'Os motivos de denúncia.'
            ),
            image(
              'visitante-denuncia-enviada',
              'Janela "Denúncia registrada" com o protocolo da denúncia e o botão Fechar.',
              'O protocolo da denúncia.'
            )
          ),
          p(
            'A operação analisa cada denúncia dentro do prazo definido (veja [Denúncias e prazos](#administracao-denuncias)).'
          ),
        ],
      },
    ],
  },
  {
    id: 'consumidor',
    title: 'Consumidor: conta, carteira e benefícios',
    audience: 'Para quem tem conta',
    summary: 'Criar conta, preferências, compra, carteira, QR e avaliações.',
    icon: WalletCards,
    sections: [
      {
        id: 'consumidor-criar-conta',
        title: 'Criar conta',
        blocks: [
          steps(
            'Toque em **Entrar** e depois em **Criar conta**.',
            'Preencha **Nome completo**, **E-mail**, **Usuário**, **Senha** e **Confirmar senha**. A lista ao lado da senha mostra o que falta para ela ficar forte.',
            'Marque que leu e aceita os [Termos de Uso](/termos) e a [Política de Privacidade](/privacidade).',
            'Toque em **Criar conta**. Você já entra na conta e volta ao catálogo.'
          ),
          figures(
            image(
              'conta-cadastro',
              'Formulário "Criar conta" preenchido com o nome Ana Demonstração, e-mail de demonstração, usuário, senha oculta e o aceite dos termos marcado.',
              'O cadastro, com dados de demonstração.'
            )
          ),
          p(
            'Enviamos um e-mail para confirmar o endereço. Se ele não chegar, veja [Não recebi o e-mail](#duvidas-email).'
          ),
        ],
      },
      {
        id: 'consumidor-entrar',
        title: 'Entrar e recuperar a senha',
        blocks: [
          p(
            'Em **Entrar**, use o e-mail ou o nome de usuário e a senha. Esqueceu a senha? Toque em **Esqueceu a senha?**, informe o e-mail e siga o link que chega por e-mail. O link vale por pouco tempo e só uma vez.'
          ),
          figures(
            image(
              'conta-entrar',
              'Página "Entrar" com os campos E-mail ou usuário e Senha e o link para recuperar a senha.',
              'Entrar na conta.'
            ),
            image(
              'conta-esqueci-senha-enviado',
              'Página "Esqueceu sua senha?" com a mensagem "Se existir uma conta com este e-mail, enviamos um link para redefinir a senha".',
              'Por privacidade, a mensagem é a mesma exista ou não a conta.'
            )
          ),
        ],
      },
      {
        id: 'consumidor-conta',
        title: 'Conta e preferências',
        blocks: [
          p(
            'Em **Conta** ficam três abas: **Perfil** (nome completo e nome de usuário; o e-mail de acesso ainda não muda por esta tela), **Aparência** (tema claro, escuro ou do dispositivo) e **Segurança** (excluir a conta). Depois de mudar o perfil, toque em **Salvar alterações**: aparece a confirmação "Dados pessoais atualizados".'
          ),
          figures(
            image(
              'conta-preferencias',
              'Página "Conta e preferências" com as abas Perfil, Aparência e Segurança e o formulário de dados pessoais.',
              'A aba Perfil.'
            )
          ),
        ],
      },
      {
        id: 'consumidor-excluir-conta',
        title: 'Excluir a conta',
        blocks: [
          steps(
            'Em **Conta**, abra a aba **Segurança**.',
            'Digite a **Senha atual** e, em **Confirmação de exclusão**, escreva EXCLUIR MINHA CONTA.',
            'Toque em **Excluir minha conta** e confirme em **Confirmar exclusão**.'
          ),
          figures(
            image(
              'conta-excluir',
              'Janela "Excluir sua conta permanentemente?" com os botões Cancelar e Confirmar exclusão.',
              'A confirmação final.'
            )
          ),
          warning(
            'Não dá para desfazer',
            'A exclusão desativa a conta, revoga o acesso e anonimiza os dados pessoais. Você sai da conta e perde o acesso à carteira e ao Portal. O que precisa ficar para auditoria permanece sem identificar você.'
          ),
        ],
      },
      {
        id: 'consumidor-explorador',
        title: 'Favoritos, seguindo, roteiros e interesses',
        blocks: [
          p(
            'Estas listas pessoais ficam no app, na aba **Conta**: **Favoritos** (lugares salvos), **Seguindo** (lugares cujas novidades você acompanha), **Roteiros** (listas que você monta) e **Interesses** (o que você gosta de fazer). São privadas: só você vê. Na página de um lugar, os botões de coração, sino e roteiro fazem o mesmo. Veja [O app no celular](#app-conta).'
          ),
        ],
      },
      {
        id: 'consumidor-comprar',
        title: 'Comprar um pacote ou voucher',
        blocks: [
          p(
            'A compra é feita pelo app. Um **pacote** reúne benefícios de vários lugares de uma cidade; um **voucher** é o benefício de um lugar só.'
          ),
          steps(
            'Na página do lugar, toque em **Ver oferta** (ou, na Carteira vazia, em **Ver benefícios disponíveis**).',
            'Confira o que está incluído, até quando dá para comprar e usar e as condições.',
            'Escolha **Pix**, marque que leu e aceita as condições e toque em **Ir para o pagamento**.',
            'A tela **Meu pedido** acompanha o pagamento sozinha. Quando ele é confirmado, os benefícios aparecem na **Carteira**.'
          ),
          warning(
            'Pagamento simulado',
            'Nesta versão de testes nada é cobrado e não há o que pagar: o pedido mostra **Pagamento simulado** e a equipe confirma. O cartão de crédito aparece como "Em breve".'
          ),
          p('As telas do app estão em [Comprar no app](#app-comprar).'),
        ],
      },
      {
        id: 'consumidor-carteira',
        title: 'A carteira',
        blocks: [
          p(
            'Em **Carteira** estão os acessos que a sua conta tem (pacotes e vouchers) e os benefícios de cada um. Os números do topo contam acessos, benefícios, quantos estão disponíveis agora e quantas utilizações você já fez. Cada benefício diz se está **Disponível agora** ou **Fora do horário**, e a disponibilidade é conferida de novo na hora de usar.'
          ),
          figures(
            image(
              'carteira',
              'Página "Minha carteira" com os números Acessos 4, Benefícios 22, Disponíveis 13 e Utilizações concluídas 0, e os benefícios do Passaporte Experimente Maringá.',
              'A carteira no computador.'
            ),
            image(
              'carteira-celular',
              'Carteira no celular, com a barra de navegação de baixo mostrando Explorar, Carteira e Conta.',
              'A carteira no celular.'
            )
          ),
          tip(
            'Não vê a Carteira?',
            'Ela aparece quando a conta está ligada a uma região do Experimente+. Veja [Área indisponível para sua conta](#duvidas-carteira).'
          ),
        ],
      },
      {
        id: 'consumidor-apresentar',
        title: 'Usar o benefício: o QR de 5 minutos',
        blocks: [
          p('Use o benefício só quando estiver no lugar, na hora de pedir ou de pagar.'),
          steps(
            'Na Carteira, toque em **Usar benefício** no benefício que você quer.',
            'Mostre o QR para quem está atendendo. O código vale por 5 minutos; o contador **Expira em** mostra quanto falta.',
            'O lugar lê o QR, confere o benefício e confirma a utilização. Só a confirmação do lugar conta como uso.',
            'O comprovante fica guardado em **Utilizações**.'
          ),
          figures(
            image(
              'carteira-apresentar-celular',
              'Tela "Usar benefício" no celular com o benefício "Peça um petisco e receba outro", o código QR encoberto, o contador "Expira em 4:58" e o botão "Copiar link de validação".',
              'O QR é pessoal e temporário (encoberto nesta imagem).'
            ),
            image(
              'carteira-comprovante-celular',
              'Comprovante de utilização com o selo "Utilização confirmada", o código do comprovante, a edição e o número da utilização.',
              'O comprovante, depois que o lugar confirma.'
            )
          ),
          list(
            'O código expirou? Toque em **Gerar novo código**.',
            'O lugar não consegue ler o QR? Toque em **Copiar link de validação** e envie o link para quem está atendendo.',
            'Não compartilhe o QR nem o link com outras pessoas: eles dão acesso ao seu benefício.'
          ),
          info(
            'A tela do QR não muda sozinha',
            'Depois que o lugar confirma, a tela do QR continua mostrando o contador. Para ver a confirmação, abra **Utilizações** na Carteira.'
          ),
        ],
      },
      {
        id: 'consumidor-avaliar',
        title: 'Avaliar com fotos',
        blocks: [
          p('As avaliações são escritas no app e aparecem no app e no site.'),
          steps(
            'Na página do lugar, no app, toque em **Avaliar este lugar** (sem conta, o botão diz **Entrar para avaliar**).',
            'Toque nas estrelas para dar a nota.',
            'Se quiser, conte como foi e adicione fotos (o número máximo de fotos é definido pela operação).',
            'Toque em **Publicar avaliação**.'
          ),
          p(
            'Cada pessoa avalia um lugar uma vez; depois, edite a avaliação existente em **Conta > Avaliações**. O lugar pode responder publicamente, e a resposta não muda a nota.'
          ),
        ],
      },
    ],
  },
  {
    id: 'parceiro',
    title: 'Parceiro: o Portal',
    audience: 'Para a equipe de um negócio',
    summary: 'Dados do lugar, experiências e eventos, avaliações, benefícios e desempenho.',
    icon: Store,
    sections: [
      {
        id: 'parceiro-visao-geral',
        title: 'Visão geral: o que fazer hoje',
        blocks: [
          p(
            'Entre com a conta de parceiro. O Portal abre na **Visão geral**, que resume o que pede atenção: **Avaliações sem resposta**, a situação dos **Dados do lugar** e das **Experiências e eventos**, e as **Organizações disponíveis** com os lugares de cada uma. O botão laranja **Validar benefício** está sempre à mão.'
          ),
          figures(
            image(
              'parceiro-visao-geral',
              'Visão geral do Portal do parceiro com os botões Utilizações, Nova organização e Validar benefício e os quadros Avaliações sem resposta, Dados do lugar e Experiências e eventos.',
              'A Visão geral do Portal.'
            )
          ),
          tip(
            'Ajuda desta página',
            'No topo do Portal e da Operação, o botão **?** abre o menu de ajuda: **Ajuda desta página** leva à parte deste manual sobre a tela em que você está, **Manual completo** abre o manual inteiro e **Baixar manual em PDF** salva a versão para imprimir. O manual abre em outra aba, sem perder o que você estava preenchendo.'
          ),
          figures(
            image(
              'parceiro-ajuda',
              'Menu de ajuda aberto no topo do Portal, com as opções Ajuda desta página, Manual completo e Baixar manual em PDF.',
              'O menu de ajuda, no topo de todas as páginas do Portal e da Operação.'
            )
          ),
        ],
      },
      {
        id: 'parceiro-lugares',
        title: 'Organizações e lugares',
        blocks: [
          p(
            'Uma **organização** é o negócio (razão social e equipe) e pode ter vários **lugares**, inclusive em cidades diferentes. Em **Dados do lugar** você vê todos os seus lugares, com os atalhos **Benefícios**, **Editar dados** e **Desempenho**. Ao abrir uma organização, aparecem os lugares dela, quantos estão completos, em análise e publicados, e o botão **Novo lugar**.'
          ),
          figures(
            image(
              'parceiro-lugares',
              'Lista "Dados do lugar" com os lugares da organização Casa Paineira Gastronomia, cada um com o selo Publicado e os botões Benefícios e Editar dados.',
              'Todos os seus lugares.'
            ),
            image(
              'parceiro-organizacao',
              'Página da organização Grupo Experimente Norte com os números Lugares 3, Completos 3, Em análise 1 e Publicados 3 e os cartões dos lugares.',
              'Uma organização e seus lugares.'
            )
          ),
        ],
      },
      {
        id: 'parceiro-editar-lugar',
        title: 'Editar os dados do lugar',
        blocks: [
          p(
            'Os dados publicados ficam bloqueados. Para mudar algo, você prepara uma nova versão; a versão atual continua no ar até a moderação aprovar a nova.'
          ),
          steps(
            'Em **Dados do lugar**, abra o lugar e toque em **Editar dados do lugar**.',
            'Use as etapas à esquerda (Identidade, Endereço, Categorias, Características, Horários, Mídia) e mude o que precisar.',
            'Em cada etapa, toque em **Salvar** (por exemplo, **Salvar identidade**). Enquanto houver etapa sem salvar, o envio fica bloqueado.',
            'Toque em **Enviar para análise**. O lugar passa a **Em moderação** e a edição volta quando a operação responder.'
          ),
          figures(
            image(
              'parceiro-editar-lugar',
              'Editor de dados do lugar com o andamento em 100%, as etapas à esquerda, o aviso "1 etapa não salva" e o campo Descrição curta alterado.',
              'Uma etapa alterada e ainda não salva.'
            ),
            image(
              'parceiro-lugar-em-analise',
              'Página do lugar com a mensagem "Ficha enviada para moderação" e o selo "Em moderação".',
              'Depois do envio: em moderação.'
            )
          ),
          list(
            'Aprovada, a nova versão é publicada no app e no site.',
            'Se a operação pedir correções, o lugar mostra **Correções pedidas** com o que ajustar; corrija e toque em **Reenviar para análise**.',
            'Fotos: na etapa **Mídia**, envie as imagens, escolha a capa e acompanhe a análise de cada uma. Só imagens aprovadas aparecem para o público.'
          ),
        ],
      },
      {
        id: 'parceiro-conteudo',
        title: 'Experiências, eventos e vitrine',
        blocks: [
          p(
            'Em **Experiências e eventos** você publica o que aparece em "Para viver aqui" na página do lugar. As abas separam **Experiências**, **Eventos** (com início e fim) e **Vitrine** (com preço informativo).'
          ),
          steps(
            'Escolha a aba e preencha **Lugar**, **Título** e, se quiser, a **Descrição**. Toque em **Criar rascunho**.',
            'No cartão do rascunho, adicione uma imagem: arraste o arquivo (JPEG, PNG ou WebP até 10 MB), escreva o **Texto alternativo** (a descrição da imagem para quem não enxerga), marque **Usar como capa** se for o caso e toque em **Enviar imagem**.',
            'Toque em **Publicar**.'
          ),
          figures(
            image(
              'parceiro-conteudo-imagem',
              'Cartão do rascunho "Roda de viola no quintal" com a área para arrastar a imagem, o texto alternativo preenchido e a opção "Usar como capa".',
              'Um rascunho recebendo a imagem.'
            ),
            image(
              'parceiro-conteudo-publicado',
              'Cartão "Roda de viola no quintal" com o selo Publicado e a imagem de capa com o selo "Imagem em análise".',
              'Texto publicado; a imagem aguarda a análise.'
            )
          ),
          info(
            'Quando passa pela moderação',
            'A operação decide, em suas regras, se experiências, eventos e itens de vitrine precisam de aprovação antes de aparecer. Sem essa exigência, o texto é publicado na hora; com ela, o conteúdo fica **Em análise** até a decisão. As imagens sempre passam pela moderação: só aparecem depois de aprovadas.'
          ),
        ],
      },
      {
        id: 'parceiro-avaliacoes',
        title: 'Responder avaliações',
        blocks: [
          steps(
            'Abra **Avaliações** e escolha o **Lugar**. A aba **Sem resposta** mostra o que ainda espera por você.',
            'Escreva a resposta em **Sua resposta pública**.',
            'Toque em **Publicar resposta**. Ela aparece abaixo da avaliação, no app e no site; a nota não muda. Depois, use **Editar resposta** se precisar.'
          ),
          figures(
            image(
              'parceiro-avaliacao-resposta',
              'Página Avaliações com a aba "Sem resposta", uma avaliação de 5 estrelas e a resposta pública sendo escrita, ao lado das dicas "Uma boa resposta".',
              'Respondendo uma avaliação.'
            )
          ),
          tip(
            'Uma boa resposta',
            'Agradeça a visita, seja cordial também com as críticas e não exponha dados de clientes. Se a avaliação for ofensiva ou falsa, use **Denunciar avaliação** no app ou no site.'
          ),
        ],
      },
      {
        id: 'parceiro-validar',
        title: 'Validar um benefício',
        blocks: [
          p(
            'Quando um cliente mostra o QR do benefício, a validação leva poucos segundos. No celular, o jeito mais rápido é a aba **Validar** do app (veja [Validar no app](#app-validar)). Pelo site:'
          ),
          steps(
            'Entre no Portal no navegador do celular e aponte a câmera para o QR do cliente: o link abre a página **Validar benefício** já preenchida. Se o cliente enviou o link, abra o link; se for um código, cole em **Link da apresentação** e toque em **Conferir**.',
            'Confira o benefício, o lugar, o titular e as regras. A mensagem **Apresentação válida** mostra quantas utilizações restam.',
            'Toque em **Confirmar utilização** e confirme na janela. Pronto: o comprovante é emitido.'
          ),
          figures(
            image(
              'parceiro-validar-previa-celular',
              'Prévia da apresentação no celular com o benefício, o lugar Bar Estação 43, o titular Cliente Experimente+ e o aviso "Apresentação válida" com 1 utilização restante.',
              'A prévia: nada é usado até você confirmar.'
            ),
            image(
              'parceiro-comprovante-celular',
              'Comprovante com a mensagem "Benefício validado e comprovante emitido" e o selo "Utilização confirmada".',
              'O comprovante emitido.'
            )
          ),
          list(
            'Conferir não usa o benefício: só a confirmação conta.',
            'Se a confirmação não completar (a internet caiu, por exemplo), toque de novo em **Confirmar utilização**: se o uso já foi registrado, o mesmo comprovante é devolvido. Na dúvida, confira em **Utilizações**.',
            'Se aparecer **Não foi possível validar esta apresentação**, o benefício não está disponível agora (já foi usado, está fora do dia ou do horário, ou a oferta foi pausada). Peça ao cliente para conferir a carteira.'
          ),
          figures(
            image(
              'parceiro-validar',
              'Página "Validar benefício" no computador, com o campo "Link da apresentação" e o botão Conferir.',
              'A validação no computador, colando o link ou o código.'
            )
          ),
        ],
      },
      {
        id: 'parceiro-utilizacoes',
        title: 'Utilizações e comprovantes',
        blocks: [
          p(
            'Em **Utilizações** ficam todos os benefícios usados nos seus lugares: benefício, titular, data e código do comprovante. Toque na linha para ver o comprovante completo.'
          ),
          figures(
            image(
              'parceiro-utilizacoes',
              'Página Utilizações com uma linha: "Peça um petisco e receba outro", Bar Estação 43, Cliente Experimente+, a data e o código do comprovante.',
              'O histórico de utilizações.'
            )
          ),
        ],
      },
      {
        id: 'parceiro-beneficios',
        title: 'Benefícios do lugar',
        blocks: [
          p(
            'Em **Dados do lugar > Benefícios** ficam as ofertas do lugar em cada edição (o pacote da cidade ou a edição de compra local). Cada lugar participa uma vez por edição.'
          ),
          steps(
            'Em **Nova oferta**, escolha a **Edição**, a **Modalidade** (compre um e ganhe outro, desconto, item cortesia...), o **Título**, **Como funciona** e os dias e horários em que vale.',
            'Toque em **Criar oferta**. Ela nasce como **Rascunho**.',
            'Revise os termos e toque em **Ativar**. Uma oferta ativa pode ser **Pausada**; para mudar os termos de uma oferta ativa, pause antes.'
          ),
          figures(
            image(
              'parceiro-oferta-criada',
              'Oferta "Porção de pastel de cortesia" em rascunho, com o benefício Item cortesia, dias, horário e validade da edição e os botões Editar, Ativar e Arquivar.',
              'Uma oferta nova, em rascunho.'
            )
          ),
        ],
      },
      {
        id: 'parceiro-desempenho',
        title: 'Desempenho',
        blocks: [
          p(
            'Em **Desempenho**, escolha o período e toque em **Atualizar período**. Você vê quantas vezes seus lugares apareceram, as visitas à página, os contatos (como chegar, WhatsApp, telefone, site) e o desempenho de cada lugar. Ninguém é identificado: os números são somados por dia.'
          ),
          figures(
            image(
              'parceiro-desempenho',
              'Página "Desempenho da descoberta" com o período, os quadros Vezes que apareceu, Visitas à página, Contatos e Pico de visitantes, o gráfico dia a dia e os contatos por canal.',
              'O desempenho da organização.'
            )
          ),
        ],
      },
      {
        id: 'parceiro-feedback',
        title: 'Feedback do piloto',
        blocks: [
          p(
            'Na **Visão geral** e no editor do lugar há o quadro **Feedback do piloto**: dê uma **Nota** de 1 a 5, escolha, se quiser, a organização e o lugar, escreva a **Mensagem** e toque em **Enviar feedback**. A equipe do Experimente+ lê cada relato.'
          ),
          figures(
            image(
              'parceiro-feedback-enviado',
              'Quadro "Feedback do piloto" com a mensagem "Feedback enviado. Obrigado por ajudar a melhorar o piloto."',
              'Feedback enviado.'
            )
          ),
        ],
      },
    ],
  },
  {
    id: 'administracao',
    title: 'Administração: a Operação',
    audience: 'Para a equipe do Experimente+',
    summary: 'Filas de moderação, denúncias, regras, benefícios, pessoas e catálogo.',
    icon: ShieldCheck,
    sections: [
      {
        id: 'administracao-hoje',
        title: 'Hoje: por onde começar',
        blocks: [
          p(
            'A área de **Operação** abre em **Hoje**, que junta o que precisa de decisão: **Dados de lugares para revisar**, **Conteúdo em análise**, **Denúncias pendentes** (com os casos fora do prazo em destaque) e **Feedback do piloto**. A **Caixa de moderação** lista tudo com o prazo mais curto primeiro; **Revisar** abre o item.'
          ),
          figures(
            image(
              'admin-hoje',
              'Página "O que resolver hoje" com os quadros Dados de lugares para revisar 1, Conteúdo em análise 1, Denúncias pendentes 0 e Feedback do piloto 1, e a Caixa de moderação com um lugar e um evento.',
              'Hoje: tudo o que espera decisão.'
            )
          ),
        ],
      },
      {
        id: 'administracao-dados-de-lugares',
        title: 'Revisar os dados de um lugar',
        blocks: [
          p(
            'Em **Caixa de moderação > Dados de lugares** estão as versões que os parceiros enviaram, das mais antigas para as mais novas. Ao abrir uma, você vê:'
          ),
          list(
            '**Comparado à versão publicada**: os campos alterados vêm destacados, com o valor de antes. **Mostrar só o que mudou** esconde o resto.',
            '**Pendências para publicação**: o que impede a aprovação, como falta de capa aprovada ou imagens ainda sem análise.',
            'O **Histórico** da versão.'
          ),
          figures(
            image(
              'admin-revisao-mudancas',
              'Revisão da Padaria Primavera com "2 campos alterados", a Descrição curta destacada com o valor anterior e o quadro "Pendências para publicação" dizendo que a revisão pode ser publicada.',
              'O que mudou desde a versão publicada.'
            )
          ),
          p('Em **Decisão**, escolha uma das três saídas:'),
          list(
            '**Aprovar e publicar**: com uma observação opcional, toque em **Aprovar revisão**. Só fica disponível quando não há pendências.',
            '**Solicitar correções**: escreva o resumo, adicione as pendências (onde corrigir, o que corrigir e a severidade) e toque em **Enviar correções**. A versão volta ao parceiro.',
            '**Rejeitar definitivamente**: informe o motivo e toque em **Rejeitar revisão**. Uma nova tentativa exigirá outra versão.'
          ),
          figures(
            image(
              'admin-revisao-decisao',
              'Seção Decisão com os quadros Aprovar e publicar, Solicitar correções e Rejeitar definitivamente.',
              'As três decisões possíveis.'
            )
          ),
        ],
      },
      {
        id: 'administracao-conteudo',
        title: 'Conteúdo de parceiros e imagens',
        blocks: [
          p(
            'Em **Conteúdo de parceiros** ficam as experiências, os eventos e os itens de vitrine que os parceiros enviaram e que precisam de aprovação (a regra é da operação; veja [Regras](#administracao-regras)). Leia, confira as imagens e decida:'
          ),
          list(
            '**Aprovar e publicar**: o conteúdo aparece na hora no app e no site.',
            '**Recusar**: devolve ao parceiro com o **Motivo da recusa**.',
            '**Corrigir** ajusta o texto, **Histórico** mostra o caminho do conteúdo e **Arquivar** tira da descoberta na hora.'
          ),
          figures(
            image(
              'admin-conteudo-em-analise',
              'Fila "Conteúdo de parceiros" com o evento "Quinta da viola caipira" em análise e os botões Corrigir, Histórico, Arquivar, Recusar e Aprovar e publicar.',
              'Um evento em análise.'
            )
          ),
          p(
            'As imagens têm decisão própria, independente do texto: **Aprovar imagem** ou **Recusar imagem**. Só arquivos aprovados aparecem para o público.'
          ),
          figures(
            image(
              'admin-conteudo-imagem',
              'Cartão da experiência publicada "Roda de viola no quintal", com a seção "Mídia deste conteúdo", a imagem em análise e os botões Aprovar imagem e Recusar imagem.',
              'A decisão da imagem é separada da do texto.'
            )
          ),
          tip(
            'Imagem nova em conteúdo já publicado',
            'Quando o parceiro adiciona uma imagem a um conteúdo que já está no ar, filtre **Estado: Publicado** (e, se quiser, o **Código da unidade**) para encontrá-la.'
          ),
        ],
      },
      {
        id: 'administracao-denuncias',
        title: 'Denúncias e prazos',
        blocks: [
          p(
            'Em **Denúncias** estão os casos abertos por quem usa o catálogo e pela moderação automática. Cada caso mostra o protocolo, o motivo, quando chegou, o **Prazo**, o que o denunciante escreveu e o **Conteúdo denunciado**, com o link para a página pública.'
          ),
          figures(
            image(
              'admin-denuncias',
              'Página "Denúncias de conteúdo" com um caso pendente: protocolo, motivo Informação falsa, recebida em, prazo, denúncia anônima, o texto do denunciante e a avaliação denunciada.',
              'Uma denúncia pendente, com prazo.'
            )
          ),
          steps(
            'Leia o conteúdo denunciado.',
            'Escolha o **Desfecho**: ocultar o conteúdo, sem violação, autor advertido ou denúncia repetida.',
            'Escreva a **Nota da decisão** e toque em **Resolver** (ou **Descartar**, para uma denúncia sem fundamento). Para casos graves, **Banir autor** pede um motivo.'
          ),
          figures(
            image(
              'admin-denuncia-decisao',
              'Área de decisão da denúncia com o Desfecho "Sem violação", a nota da decisão e os botões Resolver e Descartar.',
              'Resolvendo uma denúncia.'
            )
          ),
          info(
            'Prazos',
            'O prazo de cada denúncia vem das regras da operação. Os casos fora do prazo aparecem em destaque em **Hoje**.'
          ),
        ],
      },
      {
        id: 'administracao-feedback',
        title: 'Feedback do piloto',
        blocks: [
          p(
            'Em **Feedback do piloto** chegam os relatos dos parceiros, com a nota, o contexto e a mensagem. Filtre por status e contexto, mude o **Status**, registre uma **Nota interna** e toque em **Salvar triagem**. Esta fila é separada da moderação de conteúdo.'
          ),
          figures(
            image(
              'admin-feedback',
              'Página "Feedback do piloto" com um relato de nota 5/5 do Parceiro Experimente+ e os campos Status e Nota interna.',
              'Um relato para triagem.'
            )
          ),
        ],
      },
      {
        id: 'administracao-regras',
        title: 'Regras: avaliações, moderação automática e publicação',
        blocks: [
          p(
            'Em **Regras da operação > Avaliações e publicação** ficam os limites que valem para a operação inteira. Mudar uma regra não reescreve o que já foi publicado.'
          ),
          list(
            '**Regras de avaliação**: exigir comprovação de visita, tamanho do texto, fotos e vídeos por avaliação, limite por dia e prazos de edição.',
            '**Moderação automática**: para dados de contato, dados de pagamento, links e termos bloqueados, escolha se a regra fica desligada, só abre denúncia ou retém o conteúdo até uma pessoa decidir.',
            '**Publicação e limites**: quais experiências, eventos e itens de vitrine precisam de aprovação antes de aparecer, quantas imagens cada conteúdo pode ter e a antecedência mínima dos eventos.'
          ),
          figures(
            image(
              'admin-regras-moderacao',
              'Quadro "Moderação automática" com as regras Dados de contato, Dados de pagamento, Links e Termos bloqueados e a lista de termos bloqueados.',
              'Moderação automática.'
            ),
            image(
              'admin-regras-publicacao',
              'Quadro "Publicação e limites" com "Aprovar eventos antes de publicar" marcado e o máximo de 6 mídias por conteúdo.',
              'O que passa pela moderação.'
            )
          ),
          warning(
            'Valores provisórios',
            'Os números atuais mantêm a plataforma funcionando até a operação definir os seus e podem mudar a qualquer momento.'
          ),
        ],
      },
      {
        id: 'administracao-concierge',
        title: 'Concierge IA',
        blocks: [
          p(
            'Em **Concierge IA** você liga ou desliga o assistente nesta operação, define quantos itens do catálogo ele considera por pergunta e quantas perguntas cada pessoa pode fazer por dia. Passado o limite, o app mostra o catálogo sem o assistente.'
          ),
          figures(
            image(
              'admin-concierge',
              'Página "Concierge IA" com "Concierge ativo nesta operação" marcado, 20 itens do catálogo por pergunta e 20 perguntas por pessoa por dia.',
              'Os parâmetros do Concierge.'
            )
          ),
        ],
      },
      {
        id: 'administracao-edicoes',
        title: 'Edições e benefícios',
        blocks: [
          p(
            'Uma **edição** é o que o consumidor compra: o pacote de uma cidade ou uma edição de compra local, com preço, período de venda e de uso. Em **Edições e benefícios**, **Prepare a próxima edição** cria uma nova; cada edição mostra as ofertas ativas, os acessos e os botões **Acessos**, **Pausar** e **Arquivar**. A publicação só é liberada quando existe ao menos uma oferta ativa.'
          ),
          figures(
            image(
              'admin-edicoes',
              'Página "Edições e benefícios" com o formulário "Prepare a próxima edição" e o cartão da edição Experimente Londrina Compra local, publicada, com preço, período e ofertas ativas.',
              'As edições da operação.'
            )
          ),
        ],
      },
      {
        id: 'administracao-acessos',
        title: 'Acessos a edições',
        blocks: [
          p(
            'Um **acesso** liga uma pessoa a uma edição. Os acessos nascem da compra confirmada ou de uma concessão manual (cortesia).'
          ),
          steps(
            'Em **Liberar uma carteira**, escolha a **Edição**.',
            'Informe o **E-mail do titular** (o mesmo do cadastro; a conta precisa estar associada à operação) e a **Origem**.',
            'Registre, se quiser, uma **Observação interna** e toque em **Conceder acesso**. A carteira da pessoa é liberada na hora.'
          ),
          figures(
            image(
              'admin-acessos',
              'Página "Acessos a edições" com o formulário "Liberar uma carteira" e os cartões dos acessos ativos, de origem Cortesia.',
              'Conceder e acompanhar acessos.'
            )
          ),
          p('Um acesso pode ser revogado; o histórico fica preservado.'),
        ],
      },
      {
        id: 'administracao-pessoas',
        title: 'Pessoas e acessos',
        blocks: [
          p(
            'Em **Pessoas e acesso** ficam os **Usuários** (busca por nome ou e-mail, papéis, situação e data de cadastro; **Adicionar usuário** cria uma conta administrativa), os **Papéis** globais e as **Permissões** de cada papel.'
          ),
          figures(
            image(
              'admin-usuarios',
              'Página "Usuários" com a busca por nome ou e-mail e a lista de contas de demonstração com papel Explorador e situação "Não verificado".',
              'A lista de usuários (contas de demonstração).'
            )
          ),
          info(
            'Parceiro não é um papel global',
            'Quem é parceiro recebe acesso por organização: a equipe de cada negócio é definida na própria organização, não em Papéis.'
          ),
        ],
      },
      {
        id: 'administracao-catalogo',
        title: 'Categorias, regiões e cidades',
        blocks: [
          p(
            'Em **Administração**, **Categorias** organiza as famílias (como Comer & Beber) e as categorias que o visitante filtra e o parceiro escolhe. **Regiões e cidades** define onde a operação atua e o fuso de cada cidade, que decide o "Aberto agora" e a agenda do dia. Nada é apagado: desativar tira da descoberta sem perder o histórico.'
          ),
          figures(
            image(
              'admin-categorias',
              'Página "Categorias" com as famílias Comer & Beber, Cultura & Lazer, Ar livre & Esportes, Bem-estar & Estilo e Serviços locais, cada uma com Editar e Desativar.',
              'Famílias e categorias.'
            )
          ),
        ],
      },
      {
        id: 'administracao-painel',
        title: 'Painel operacional e arquivos',
        blocks: [
          p(
            'O **Painel operacional** mostra a visão de longo prazo: usuários, operações, arquivos e papéis, novos usuários e a distribuição por mês. Para o dia a dia, comece por **Hoje**. Em **Arquivos** ficam os arquivos administrativos da operação.'
          ),
          figures(
            image(
              'admin-painel',
              'Painel operacional com o destaque "O que pede atenção hoje" e os quadros Usuários na operação, Minhas operações, Arquivos da operação e Papéis globais.',
              'O Painel operacional.'
            )
          ),
        ],
      },
    ],
  },
  {
    id: 'app',
    title: 'O app no celular',
    audience: 'Para quem usa o Android',
    summary: 'As mesmas jornadas no app, com mapa, compra e a aba Validar.',
    icon: Smartphone,
    sections: [
      {
        id: 'app-explorar',
        title: 'Explorar em lista e no mapa',
        blocks: [
          p(
            'Na aba **Explorar**, escolha a cidade no topo, busque por nome e use os filtros (como **Aberto agora** e as categorias). **Ver no mapa** mostra os mesmos lugares agrupados no mapa; toque em um grupo para aproximar e em um lugar para ver a foto, a nota e se está aberto. **Ver em lista** volta para a lista. Mais abaixo ficam a agenda, as novidades e o Concierge.'
          ),
          figures(
            image(
              'app-explorar',
              'Aba Explorar do app com a cidade Londrina, a busca, os filtros Aberto agora e Gastronomia demonstrativa e o cartão de um lugar.',
              'Explorar em lista.'
            ),
            image(
              'app-mapa',
              'Mapa de Londrina no app com os lugares agrupados em círculos numerados e os nomes de alguns lugares.',
              'O mesmo filtro, no mapa.'
            )
          ),
        ],
      },
      {
        id: 'app-lugar',
        title: 'A página do lugar no app',
        blocks: [
          p(
            'No topo ficam **Compartilhar**, o coração (**Favoritar**) e o menu **Mais opções**. Logo abaixo, **Como chegar**, o sino (**Seguir**, para acompanhar as novidades do lugar) e o botão **Adicionar a um roteiro**. Quando o lugar tem benefício à venda, o cartão laranja mostra o preço e **Ver oferta**.'
          ),
          figures(
            image(
              'app-lugar',
              'Página do Ateliê do Café no app com nota 4,5, o selo Aberto agora, os botões Como chegar, seguir e roteiro e o cartão do benefício "Item em dobro" por R$ 14,90 com o botão Ver oferta.',
              'Um lugar com benefício à venda.'
            )
          ),
        ],
      },
      {
        id: 'app-comprar',
        title: 'Comprar no app',
        blocks: [
          steps(
            '**Ver oferta** abre o produto: o que está incluído, até quando comprar e usar, e as condições.',
            'Em **Forma de pagamento**, escolha **Pix**, marque o aceite das condições e toque em **Ir para o pagamento**.',
            '**Meu pedido** mostra o que acontece agora. Nesta versão de testes, o pagamento é simulado e a equipe confirma o pedido. Depois, os benefícios aparecem na **Carteira**.'
          ),
          figures(
            image(
              'app-compra',
              'Tela do voucher "Item em dobro" com o que está incluído, as datas "Compre até" e "Use até" e o início da forma de pagamento.',
              'O produto.'
            ),
            image(
              'app-pagamento',
              'Forma de pagamento com Pix selecionado, cartão de crédito "Em breve pelo aplicativo", o aceite das condições marcado e o botão "Ir para o pagamento".',
              'Pix e o aceite das condições.'
            ),
            image(
              'app-pedido',
              'Tela "Meu pedido" com o selo Pedido pendente, o valor e os passos do que acontece agora.',
              'O pedido aguardando a confirmação.'
            )
          ),
        ],
      },
      {
        id: 'app-carteira',
        title: 'Carteira e QR no app',
        blocks: [
          p(
            'A aba **Carteira** mostra os seus benefícios, pedidos e usos. O QR funciona como no site: vale por 5 minutos e só conta como uso depois que o lugar confirma (veja [Usar o benefício](#consumidor-apresentar)). O **Histórico** guarda os comprovantes.'
          ),
          figures(
            image(
              'app-carteira',
              'Aba Carteira vazia com a mensagem "Sua carteira está vazia", o botão "Ver benefícios disponíveis" e o Histórico sem usos.',
              'A Carteira, antes da primeira compra.'
            )
          ),
        ],
      },
      {
        id: 'app-conta',
        title: 'Conta no app',
        blocks: [
          p(
            'A aba **Conta** reúne **Editar perfil**, as listas pessoais (**Favoritos**, **Seguindo**, **Roteiros** e **Avaliações**), as preferências (**Interesses** e **Cidade**) e as opções da conta, como sair e excluir.'
          ),
          figures(
            image(
              'app-conta',
              'Aba Conta do app com o perfil de uma conta de demonstração, a seção Minhas coisas com Favoritos, Seguindo, Roteiros e Avaliações e a seção Preferências com Interesses e Cidade.',
              'A aba Conta (conta de demonstração).'
            )
          ),
        ],
      },
      {
        id: 'app-validar',
        title: 'Validar no app (parceiros)',
        blocks: [
          p(
            'Contas de parceiro com permissão para validar ganham a aba **Validar**. Na primeira vez, o app pede acesso à câmera (**Permitir câmera**).'
          ),
          steps(
            'Abra **Validar** e aponte a câmera para o QR que o cliente está mostrando.',
            'Confira o benefício e o titular. Ler o código não usa o benefício.',
            'Toque em **Confirmar utilização**. O comprovante fica em **Ver utilizações**.'
          ),
          p(
            'Se a confirmação não completar, tentar de novo é seguro: se o uso já foi registrado, o mesmo comprovante é devolvido. Um código que não vale mais pede um novo ao cliente.'
          ),
        ],
      },
    ],
  },
  {
    id: 'duvidas',
    title: 'Dúvidas frequentes',
    audience: 'Respostas rápidas',
    summary: 'E-mail, QR, lugares, pagamento e mensagens comuns.',
    icon: CircleHelp,
    sections: [
      {
        id: 'duvidas-email',
        title: 'Não recebi o e-mail',
        blocks: [
          p(
            'Confira a caixa de spam ou de lixo eletrônico e se o endereço foi digitado certo. Para a senha, peça de novo em **Esqueceu a senha?**: cada novo pedido invalida os links anteriores. Nesta versão beta, a conta funciona mesmo antes de o e-mail ser confirmado.'
          ),
        ],
      },
      {
        id: 'duvidas-qr-expirou',
        title: 'O QR expirou',
        blocks: [
          p(
            'O QR vale por 5 minutos, por segurança. Toque em **Gerar novo código** na mesma tela e mostre o novo QR. Se o lugar já confirmou o uso, o comprovante está em **Utilizações**.'
          ),
        ],
      },
      {
        id: 'duvidas-beneficio-recusado',
        title: '"Não foi possível validar esta apresentação"',
        blocks: [
          p(
            'O benefício não está disponível neste momento: já foi usado todas as vezes permitidas, está fora do dia ou do horário da oferta, ou a oferta foi pausada. O cliente pode conferir na Carteira quando o benefício vale. Se a mensagem falar em apresentação inválida ou expirada, peça um novo código.'
          ),
        ],
      },
      {
        id: 'duvidas-lugar-nao-aparece',
        title: 'O lugar não aparece',
        blocks: [
          list(
            'Confira a cidade escolhida e limpe os filtros (principalmente **Aberto agora**).',
            'Um lugar só aparece depois que a operação aprova os dados. No Portal, veja se ele está **Em moderação** ou com **Correções pedidas**.',
            'Mudanças em um lugar já publicado aparecem quando a nova versão é aprovada; até lá, continua no ar a versão anterior.'
          ),
        ],
      },
      {
        id: 'duvidas-pagamento',
        title: 'O pagamento é real?',
        blocks: [
          p(
            'Não. Esta é uma versão beta em homologação: lugares, eventos e benefícios são fictícios, de demonstração, e o pagamento é simulado. Nada é cobrado.'
          ),
        ],
      },
      {
        id: 'duvidas-carteira',
        title: '"Área indisponível para sua conta"',
        blocks: [
          p(
            'A Carteira e o Portal precisam de uma conta ligada a uma região do Experimente+. Se a sua ainda não está ligada a nenhuma, essas áreas mostram este aviso; explorar os lugares continua livre. Se parecer um engano, fale com a equipe do Experimente+.'
          ),
          figures(
            image(
              'conta-nova-carteira',
              'Aviso "Área indisponível para sua conta" com os botões Voltar ao início e Explorar cidades.',
              'O aviso de área indisponível.'
            )
          ),
        ],
      },
      {
        id: 'duvidas-campos-bloqueados',
        title: 'Os campos do meu lugar estão bloqueados',
        blocks: [
          p(
            'É o esperado quando os dados estão publicados ou em moderação. Toque em **Editar dados do lugar** para preparar uma nova versão (veja [Editar os dados do lugar](#parceiro-editar-lugar)). Se o lugar está **Em moderação**, a edição volta quando a operação responder.'
          ),
        ],
      },
      {
        id: 'duvidas-iphone',
        title: 'Tenho iPhone',
        blocks: [
          p(
            'O app para iOS ainda não está disponível. Use o site no navegador do iPhone: a descoberta, a conta, a carteira e o Portal funcionam por ali. A compra de pacotes e vouchers e a escrita de avaliações, por enquanto, ficam no app Android.'
          ),
        ],
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
