import type { DemoFraming, DemoMotif } from '#database/support/demo/illustration/scenes'

/**
 * Partner content of the demo — experiences, events and showcase items — as
 * each place's organization would publish it through the partner portal.
 * Descriptions end with a sentence saying the content is fictitious.
 */

export const DEMO_CONTENT_NOTICE =
  'Conteúdo fictício de demonstração; não descreve programação, produto ou preço reais.'

export interface DemoExperience {
  key: string
  place: string
  title: string
  description: string
  motif: DemoMotif
  framing?: DemoFraming
}

export interface DemoShowcaseItem {
  key: string
  place: string
  title: string
  description: string
  price_cents: number
  /** Items with a motif get an approved image. */
  motif?: DemoMotif
}

/**
 * When an event happens, in the city's own calendar.
 *
 * `today` places the event on the run's local day (at `hour`, or right away
 * when that hour has passed). `weekly` dates it on the next occurrences of a
 * weekday strictly after today: occurrence 0 is the first, 1 the week after.
 * Keys carry the local date, so a run in the same week finds every occurrence
 * already there, and a run a week later adds the one that entered the horizon.
 */
export type DemoEventSchedule =
  | { kind: 'today'; hour: number }
  | {
      kind: 'weekly'
      weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
      hour: number
      minute?: number
      weeks: number[]
    }

export interface DemoEvent {
  key: string
  place: string
  title: string
  description: string
  motif: DemoMotif
  schedule: DemoEventSchedule
  duration_hours: number
}

export const DEMO_EXPERIENCES: DemoExperience[] = [
  {
    key: 'londrina-massa-fresca',
    place: 'londrina-cantina-vale-verde',
    title: 'Aula de massa fresca em família',
    description:
      'Duas horas na cozinha da cantina aprendendo a abrir massa na mão, cortar talharim e preparar um molho de tomate assado. No fim, todos almoçam o que fizeram.',
    motif: 'pasta',
    framing: 'detail',
  },
  {
    key: 'londrina-cortes-na-brasa',
    place: 'londrina-brasa-paineira',
    title: 'Menu degustação de cortes na brasa',
    description:
      'Sequência de cinco tempos com cortes regionais, legumes na grelha e sobremesa, harmonizada com vinhos da carta.',
    motif: 'grill',
    framing: 'detail',
  },
  {
    key: 'londrina-degustacao-cafes',
    place: 'londrina-ipe-cafe',
    title: 'Degustação guiada de cafés do Norte Pioneiro',
    description:
      'Prova comparada de três cafés da região em métodos diferentes, com conversa sobre torra, moagem e notas sensoriais.',
    motif: 'coffee',
    framing: 'detail',
  },
  {
    key: 'londrina-fermentacao-natural',
    place: 'londrina-forno-fermento',
    title: 'Oficina de pão de fermentação natural',
    description:
      'Manhã de sábado com o padeiro da casa: alimentar o fermento, sovar, modelar e levar para casa um pão assado no forno da padaria.',
    motif: 'bakery',
    framing: 'detail',
  },
  {
    key: 'londrina-balcao-sushi',
    place: 'londrina-kaiten-norte',
    title: 'Balcão do chef: sequência de sushi',
    description:
      'Doze peças servidas uma a uma no balcão, com o sushiman explicando cada peixe e cada corte.',
    motif: 'sushi',
    framing: 'detail',
  },
  {
    key: 'londrina-sessao-comentada',
    place: 'londrina-cineclube-lanterna',
    title: 'Sessão comentada de clássicos',
    description:
      'Um clássico restaurado por mês, apresentado por um convidado e seguido de conversa com o público.',
    motif: 'cinema',
  },
  {
    key: 'londrina-percussao',
    place: 'londrina-casa-tramela',
    title: 'Oficina de percussão para iniciantes',
    description:
      'Encontro de duas horas com instrumentos emprestados pela casa para aprender os ritmos básicos do samba e do maracatu.',
    motif: 'music',
  },
  {
    key: 'londrina-visita-mediada',
    place: 'londrina-galeria-janela-aberta',
    title: 'Visita mediada à exposição do mês',
    description:
      'Percurso de quarenta minutos com mediadores da galeria, pensado para grupos, famílias e escolas.',
    motif: 'gallery',
  },
  {
    key: 'londrina-observacao-aves',
    place: 'londrina-parque-das-seriemas',
    title: 'Caminhada de observação de aves',
    description:
      'Saída cedo pela trilha do parque com binóculos emprestados e um guia que apresenta as aves mais comuns da região.',
    motif: 'park',
  },
  {
    key: 'londrina-pedal-entardecer',
    place: 'londrina-pedal-norte',
    title: 'Pedal guiado ao entardecer',
    description:
      'Roteiro de doze quilômetros por ciclovias e ruas calmas, com parada para água de coco. Bicicletas de aluguel disponíveis.',
    motif: 'bike',
  },
  {
    key: 'londrina-yoga-iniciantes',
    place: 'londrina-respiro-yoga',
    title: 'Aula experimental de yoga para iniciantes',
    description:
      'Uma aula tranquila para quem nunca praticou, com tapetes e blocos fornecidos pelo estúdio.',
    motif: 'yoga',
  },
  {
    key: 'londrina-ceramica-torno',
    place: 'londrina-atelie-barro-fogo',
    title: 'Oficina de cerâmica no torno',
    description:
      'Três horas para centralizar o barro, levantar uma peça e escolher o esmalte. A peça fica pronta depois da queima.',
    motif: 'ceramics',
    framing: 'detail',
  },
  {
    key: 'maringa-almoco-domingo',
    place: 'maringa-terra-roxa-cozinha',
    title: 'Almoço de domingo com receitas de família',
    description:
      'Mesa posta com pratos do interior do Paraná servidos em travessas, como na casa das avós.',
    motif: 'homestyle',
  },
  {
    key: 'maringa-cervejas-artesanais',
    place: 'maringa-chopp-e-prosa',
    title: 'Degustação de cervejas artesanais do Paraná',
    description:
      'Cinco estilos servidos em taças pequenas, com explicação sobre ingredientes e petiscos para acompanhar.',
    motif: 'bar',
  },
  {
    key: 'maringa-queijos-geleias',
    place: 'maringa-emporio-colheita',
    title: 'Degustação de queijos e geleias da região',
    description:
      'Tábua comentada com queijos de pequenos produtores e geleias artesanais, servida no balcão do empório.',
    motif: 'deli',
    framing: 'detail',
  },
  {
    key: 'maringa-clube-leitura',
    place: 'maringa-livraria-pagina-viva',
    title: 'Clube de leitura da livraria',
    description:
      'Encontro mensal para conversar sobre o livro escolhido pelo grupo, com café servido no fundo da loja.',
    motif: 'books',
  },
  {
    key: 'maringa-trilha-interpretativa',
    place: 'maringa-trilha-corrego-verde',
    title: 'Trilha interpretativa com guia',
    description:
      'Caminhada leve pela mata ciliar do córrego, com paradas para falar de árvores nativas, nascentes e fauna urbana.',
    motif: 'trail',
  },
  {
    key: 'maringa-pilates-experimental',
    place: 'maringa-raiz-pilates',
    title: 'Aula experimental de pilates',
    description: 'Avaliação postural rápida e uma aula completa nos aparelhos, em dupla.',
    motif: 'yoga',
  },
  {
    key: 'maringa-ritual-relaxamento',
    place: 'maringa-espaco-lavanda',
    title: 'Ritual de relaxamento com escalda-pés',
    description:
      'Noventa minutos com escalda-pés de ervas, massagem relaxante e chá, em sala silenciosa.',
    motif: 'spa',
    framing: 'detail',
  },
  {
    key: 'cambe-colha-e-prove',
    place: 'cambe-sitio-pe-de-cafe',
    title: 'Colha e prove: do pé à xícara',
    description:
      'Passeio pelo cafezal, colheita manual, torra na panela de ferro e café coado na varanda do sítio.',
    motif: 'farm',
  },
  {
    key: 'rolandia-visita-fabrica',
    place: 'rolandia-cervejaria-vale-do-fermento',
    title: 'Visita à fábrica com degustação',
    description:
      'Tour pela área de produção com o mestre-cervejeiro e degustação de quatro estilos da casa.',
    motif: 'bar',
    framing: 'detail',
  },
  {
    key: 'rolandia-cafe-colonial',
    place: 'rolandia-cafe-colonial-linde',
    title: 'Café colonial completo aos domingos',
    description:
      'Mesa com mais de vinte itens entre tortas, cucas, pães, frios e geleias, servida à vontade.',
    motif: 'sweets',
  },
  {
    key: 'apucarana-rapel-trilha',
    place: 'apucarana-trilha-serra-do-vale',
    title: 'Rapel e trilha com instrutores',
    description:
      'Meia jornada com trilha de subida, treino em solo e descida de rapel de vinte metros, com todo o equipamento incluso.',
    motif: 'trail',
    framing: 'detail',
  },
  {
    key: 'arapongas-boliche-grupo',
    place: 'arapongas-arena-jogos',
    title: 'Noite de boliche em grupo',
    description:
      'Pista reservada por duas horas, sapatos inclusos e combo de lanches para até seis pessoas.',
    motif: 'bowling',
  },
  {
    key: 'ibipora-pesca-almoco',
    place: 'ibipora-pesqueiro-aguas-claras',
    title: 'Pesca esportiva com almoço',
    description:
      'Manhã de pesca com equipamento emprestado e almoço de peixe frito no quiosque da beira do lago.',
    motif: 'lake',
  },
  {
    key: 'bandeirantes-dia-de-campo',
    place: 'bandeirantes-fazenda-recanto-pioneiro',
    title: 'Dia de campo na fazenda',
    description:
      'Passeio de trator, ordenha, trato dos animais e almoço de fogão a lenha. Pensado para famílias com crianças.',
    motif: 'farm',
  },
  {
    key: 'cornelio-bordado-livre',
    place: 'cornelio-atelie-linha-agulha',
    title: 'Oficina de bordado livre',
    description:
      'Tarde de bordado para iniciantes com bastidor, linhas e um risco para levar para casa.',
    motif: 'sewing',
  },
  {
    key: 'cornelio-por-do-sol',
    place: 'cornelio-mirante-do-pioneiro',
    title: 'Piquenique do pôr do sol',
    description:
      'Cesta com lanches da região para retirar no centro e aproveitar no deque do mirante no fim da tarde.',
    motif: 'lookout',
  },
]

export const DEMO_SHOWCASE_ITEMS: DemoShowcaseItem[] = [
  {
    key: 'londrina-talharim',
    place: 'londrina-cantina-vale-verde',
    title: 'Talharim ao molho de tomate assado',
    description: 'Massa fresca da casa com tomates assados e manjericão.',
    price_cents: 4890,
    motif: 'pasta',
  },
  {
    key: 'londrina-lasanha',
    place: 'londrina-cantina-vale-verde',
    title: 'Lasanha da casa',
    description: 'Camadas de massa fresca, ragu de cozimento lento e queijo gratinado.',
    price_cents: 5290,
  },
  {
    key: 'londrina-picanha-dois',
    place: 'londrina-brasa-paineira',
    title: 'Corte na brasa para dois',
    description: 'Corte do dia servido na tábua com farofa, vinagrete e legumes.',
    price_cents: 14900,
    motif: 'grill',
  },
  {
    key: 'londrina-porcao-mandioca',
    place: 'londrina-balcao-pe-vermelho',
    title: 'Porção de mandioca frita',
    description: 'Mandioca cozida e frita na hora, com molho da casa.',
    price_cents: 3200,
  },
  {
    key: 'londrina-chope',
    place: 'londrina-balcao-pe-vermelho',
    title: 'Chope artesanal 400 ml',
    description: 'Estilo da semana de cervejaria paranaense.',
    price_cents: 1800,
  },
  {
    key: 'londrina-cafe-coado',
    place: 'londrina-ipe-cafe',
    title: 'Café coado da semana',
    description: 'Grão da semana preparado no método de sua preferência.',
    price_cents: 1200,
    motif: 'coffee',
  },
  {
    key: 'londrina-pao-queijo',
    place: 'londrina-ipe-cafe',
    title: 'Pão de queijo recheado',
    description: 'Pão de queijo grande recheado com requeijão de corte.',
    price_cents: 900,
  },
  {
    key: 'londrina-pao-fermentacao',
    place: 'londrina-forno-fermento',
    title: 'Pão de fermentação natural',
    description: 'Pão de 800 g com casca crocante, assado toda manhã.',
    price_cents: 2400,
    motif: 'bakery',
  },
  {
    key: 'londrina-bolo-fuba',
    place: 'londrina-doce-figueira',
    title: 'Fatia de bolo de fubá com goiabada',
    description: 'Receita da casa servida morna.',
    price_cents: 1400,
    motif: 'sweets',
  },
  {
    key: 'londrina-smash-duplo',
    place: 'londrina-smash-do-norte',
    title: 'Smash duplo com cheddar',
    description: 'Dois discos prensados na chapa, cheddar e pão de brioche.',
    price_cents: 3690,
    motif: 'burger',
  },
  {
    key: 'londrina-margherita',
    place: 'londrina-massa-madre-pizzaria',
    title: 'Pizza margherita média',
    description: 'Molho de tomate, muçarela fresca e manjericão.',
    price_cents: 5900,
    motif: 'pizza',
  },
  {
    key: 'londrina-combinado',
    place: 'londrina-kaiten-norte',
    title: 'Combinado de 20 peças',
    description: 'Seleção do sushiman com peças de salmão, atum e vegetarianas.',
    price_cents: 7900,
    motif: 'sushi',
  },
  {
    key: 'londrina-gelato',
    place: 'londrina-brisa-gelatos',
    title: 'Gelato de dois sabores',
    description: 'Duas bolas em casquinha ou copo.',
    price_cents: 1600,
    motif: 'icecream',
  },
  {
    key: 'londrina-revisao-bike',
    place: 'londrina-pedal-norte',
    title: 'Revisão completa de bicicleta',
    description: 'Ajuste de freios e câmbio, lubrificação e calibragem.',
    price_cents: 12000,
  },
  {
    key: 'londrina-caneca',
    place: 'londrina-atelie-barro-fogo',
    title: 'Caneca de cerâmica artesanal',
    description: 'Peça feita no torno e esmaltada no ateliê.',
    price_cents: 6500,
    motif: 'ceramics',
  },
  {
    key: 'maringa-tabua-frios',
    place: 'maringa-chopp-e-prosa',
    title: 'Tábua de frios para dividir',
    description: 'Queijos, embutidos, pães e geleia da casa.',
    price_cents: 6900,
    motif: 'deli',
  },
  {
    key: 'maringa-burger-cebola',
    place: 'maringa-hamburguer-do-bosque',
    title: 'Hambúrguer com cebola caramelizada',
    description: 'Blend da casa, queijo prato e cebola caramelizada.',
    price_cents: 3490,
  },
  {
    key: 'maringa-pizza-portuguesa',
    place: 'maringa-pizzaria-lenha-viva',
    title: 'Pizza portuguesa grande',
    description: 'Receita tradicional no forno a lenha.',
    price_cents: 7400,
  },
  {
    key: 'maringa-temaki',
    place: 'maringa-sushi-hanami',
    title: 'Temaki de salmão',
    description: 'Salmão, cream cheese e cebolinha.',
    price_cents: 3200,
    motif: 'sushi',
  },
  {
    key: 'maringa-cesta-queijos',
    place: 'maringa-emporio-colheita',
    title: 'Cesta de queijos regionais',
    description: 'Três queijos de pequenos produtores com geleia artesanal.',
    price_cents: 8900,
    motif: 'deli',
  },
  {
    key: 'maringa-kit-leitura',
    place: 'maringa-livraria-pagina-viva',
    title: 'Kit do clube de leitura',
    description: 'Livro do mês com marcador e café para levar.',
    price_cents: 7900,
  },
  {
    key: 'maringa-banho-tosa',
    place: 'maringa-pata-amiga',
    title: 'Banho e tosa para porte pequeno',
    description: 'Banho, tosa higiênica e corte de unhas.',
    price_cents: 6000,
    motif: 'pet',
  },
  {
    key: 'maringa-doces-finos',
    place: 'maringa-flor-de-laranjeira',
    title: 'Caixa com doze doces finos',
    description: 'Seleção de doces finos para presente.',
    price_cents: 7200,
  },
  {
    key: 'cambe-buque-campo',
    place: 'cambe-floricultura-jardim-suspenso',
    title: 'Buquê de flores do campo',
    description: 'Buquê montado na hora com flores da estação.',
    price_cents: 9000,
    motif: 'flowers',
  },
  {
    key: 'cambe-corte-barba',
    place: 'cambe-barbearia-navalha',
    title: 'Corte e barba',
    description: 'Corte na tesoura e barba com toalha quente.',
    price_cents: 7000,
  },
  {
    key: 'rolandia-cuca-uva',
    place: 'rolandia-cafe-colonial-linde',
    title: 'Fatia de cuca de uva',
    description: 'Cuca com farofa crocante e uvas da estação.',
    price_cents: 1500,
  },
  {
    key: 'rolandia-pao-centeio',
    place: 'rolandia-forno-fermento',
    title: 'Pão de centeio',
    description: 'Pão denso de centeio com sementes.',
    price_cents: 2200,
  },
  {
    key: 'arapongas-picole',
    place: 'arapongas-canto-do-passaro',
    title: 'Picolé de fruta da estação',
    description: 'Feito com polpa de frutas da região.',
    price_cents: 800,
  },
  {
    key: 'arapongas-esfiha',
    place: 'arapongas-pizzaria-bella-forno',
    title: 'Esfiha aberta de carne',
    description: 'Assada no forno das pizzas.',
    price_cents: 900,
  },
  {
    key: 'cornelio-doces',
    place: 'cornelio-doceria-acucar-mascavo',
    title: 'Caixa com seis brigadeiros',
    description: 'Brigadeiros de chocolate belga e de pistache.',
    price_cents: 4200,
    motif: 'sweets',
  },
  {
    key: 'bandeirantes-frango',
    place: 'bandeirantes-cantina-bandeirante',
    title: 'Frango assado com polenta',
    description: 'Meio frango assado com polenta frita, aos domingos.',
    price_cents: 4500,
  },
]

export const DEMO_EVENTS: DemoEvent[] = [
  {
    key: 'londrina-roda-de-samba',
    place: 'londrina-balcao-pe-vermelho',
    title: 'Roda de samba ao vivo',
    description: 'Roda de samba na calçada do bar, com mesas por ordem de chegada.',
    motif: 'music',
    schedule: { kind: 'today', hour: 18 },
    duration_hours: 4,
  },
  {
    key: 'maringa-acustico-varanda',
    place: 'maringa-chopp-e-prosa',
    title: 'Show acústico na varanda',
    description: 'Voz e violão com repertório de música brasileira.',
    motif: 'music',
    schedule: { kind: 'today', hour: 19 },
    duration_hours: 3,
  },
  {
    key: 'apucarana-curtas-paranaenses',
    place: 'apucarana-cine-teatro-pequeno-ato',
    title: 'Sessão de curtas paranaenses',
    description: 'Seleção de curtas-metragens de realizadores do estado, seguida de conversa.',
    motif: 'cinema',
    schedule: { kind: 'today', hour: 19 },
    duration_hours: 2,
  },
  {
    key: 'londrina-noite-massa-fresca',
    place: 'londrina-cantina-vale-verde',
    title: 'Noite da massa fresca',
    description: 'Menu especial de massas feitas na hora, com música instrumental no salão.',
    motif: 'pasta',
    schedule: { kind: 'weekly', weekday: 4, hour: 19, minute: 30, weeks: [0, 1, 2] },
    duration_hours: 3,
  },
  {
    key: 'londrina-roda-de-choro',
    place: 'londrina-casa-tramela',
    title: 'Roda de choro no quintal',
    description: 'Músicos convidados e roda aberta para quem quiser tocar.',
    motif: 'music',
    schedule: { kind: 'weekly', weekday: 6, hour: 17, weeks: [0, 1, 2] },
    duration_hours: 3,
  },
  {
    key: 'londrina-mostra-paranaense',
    place: 'londrina-cineclube-lanterna',
    title: 'Mostra de cinema paranaense',
    description: 'Longas e curtas produzidos no estado, com a presença de convidados.',
    motif: 'cinema',
    schedule: { kind: 'weekly', weekday: 3, hour: 19, minute: 30, weeks: [0, 1] },
    duration_hours: 2.5,
  },
  {
    key: 'londrina-abertura-exposicao',
    place: 'londrina-galeria-janela-aberta',
    title: 'Abertura da exposição Cores do Norte',
    description: 'Noite de abertura com os artistas, visita comentada e música.',
    motif: 'gallery',
    schedule: { kind: 'weekly', weekday: 5, hour: 19, weeks: [1] },
    duration_hours: 3,
  },
  {
    key: 'londrina-aves-domingo',
    place: 'londrina-parque-das-seriemas',
    title: 'Caminhada de observação de aves',
    description: 'Saída às sete da manhã do portão principal, com guia e binóculos.',
    motif: 'park',
    schedule: { kind: 'weekly', weekday: 7, hour: 7, weeks: [0, 1, 2] },
    duration_hours: 2,
  },
  {
    key: 'londrina-pedal-domingo',
    place: 'londrina-pedal-norte',
    title: 'Pedal urbano de domingo',
    description: 'Roteiro leve de vinte quilômetros, saindo da loja.',
    motif: 'bike',
    schedule: { kind: 'weekly', weekday: 7, hour: 8, weeks: [0, 1] },
    duration_hours: 3,
  },
  {
    key: 'londrina-yoga-parque',
    place: 'londrina-respiro-yoga',
    title: 'Yoga ao ar livre no parque',
    description: 'Prática aberta para todos os níveis; traga sua canga ou tapete.',
    motif: 'yoga',
    schedule: { kind: 'weekly', weekday: 6, hour: 8, weeks: [0, 2] },
    duration_hours: 1.5,
  },
  {
    key: 'londrina-degustacao-sabado',
    place: 'londrina-ipe-cafe',
    title: 'Degustação de cafés do Norte Pioneiro',
    description: 'Prova guiada de três cafés com notas sensoriais diferentes.',
    motif: 'coffee',
    schedule: { kind: 'weekly', weekday: 6, hour: 10, weeks: [0, 1] },
    duration_hours: 2,
  },
  {
    key: 'londrina-ceramica-aberta',
    place: 'londrina-atelie-barro-fogo',
    title: 'Oficina aberta de cerâmica',
    description: 'Noite de modelagem livre com argila e ferramentas do ateliê.',
    motif: 'ceramics',
    schedule: { kind: 'weekly', weekday: 3, hour: 19, weeks: [0, 1] },
    duration_hours: 2,
  },
  {
    key: 'maringa-quinta-jazz',
    place: 'maringa-chopp-e-prosa',
    title: 'Quinta do jazz',
    description: 'Trio instrumental com clássicos do jazz e da bossa nova.',
    motif: 'music',
    schedule: { kind: 'weekly', weekday: 4, hour: 20, weeks: [0, 1, 2] },
    duration_hours: 3,
  },
  {
    key: 'maringa-clube-leitura',
    place: 'maringa-livraria-pagina-viva',
    title: 'Clube de leitura: autoras paranaenses',
    description: 'Conversa sobre o livro do mês, aberta a novos participantes.',
    motif: 'books',
    schedule: { kind: 'weekly', weekday: 1, hour: 19, weeks: [0, 1] },
    duration_hours: 2,
  },
  {
    key: 'maringa-cinema-varanda',
    place: 'maringa-cine-varanda',
    title: 'Cinema na varanda',
    description: 'Sessão ao ar livre com cadeiras de praia e pipoca.',
    motif: 'cinema',
    schedule: { kind: 'weekly', weekday: 5, hour: 20, weeks: [0, 1, 2] },
    duration_hours: 2.5,
  },
  {
    key: 'maringa-degustacao-queijos',
    place: 'maringa-emporio-colheita',
    title: 'Degustação de queijos da região',
    description: 'Mesa de degustação no balcão do empório, com produtores convidados.',
    motif: 'deli',
    schedule: { kind: 'weekly', weekday: 6, hour: 11, weeks: [0, 1] },
    duration_hours: 3,
  },
  {
    key: 'maringa-noite-lamen',
    place: 'maringa-sushi-hanami',
    title: 'Noite do lámen',
    description: 'Cardápio especial de lámen e guiozas, só às terças.',
    motif: 'sushi',
    schedule: { kind: 'weekly', weekday: 2, hour: 19, weeks: [0, 1] },
    duration_hours: 3,
  },
  {
    key: 'apucarana-trilha-por-do-sol',
    place: 'apucarana-trilha-serra-do-vale',
    title: 'Trilha do pôr do sol',
    description: 'Subida guiada até o mirante para ver o sol se pôr sobre o vale.',
    motif: 'lookout',
    schedule: { kind: 'weekly', weekday: 6, hour: 16, weeks: [0, 1, 2] },
    duration_hours: 3,
  },
  {
    key: 'arapongas-torneio-boliche',
    place: 'arapongas-arena-jogos',
    title: 'Torneio de boliche em duplas',
    description: 'Inscrições no local; premiação simbólica para as três primeiras duplas.',
    motif: 'bowling',
    schedule: { kind: 'weekly', weekday: 6, hour: 15, weeks: [1] },
    duration_hours: 5,
  },
  {
    key: 'cambe-samba-na-praca',
    place: 'cambe-bar-do-coreto',
    title: 'Samba na praça',
    description: 'Roda de samba em frente ao bar, na tarde de sábado.',
    motif: 'music',
    schedule: { kind: 'weekly', weekday: 6, hour: 16, weeks: [0, 1] },
    duration_hours: 4,
  },
  {
    key: 'cambe-colheita-cafe',
    place: 'cambe-sitio-pe-de-cafe',
    title: 'Colheita de café com café colonial',
    description: 'Manhã no cafezal com colheita, torra e café colonial na varanda.',
    motif: 'farm',
    schedule: { kind: 'weekly', weekday: 7, hour: 9, weeks: [0, 1] },
    duration_hours: 5,
  },
  {
    key: 'rolandia-festa-primavera',
    place: 'rolandia-cervejaria-vale-do-fermento',
    title: 'Festa da cerveja de primavera',
    description: 'Lançamento do estilo da estação, com música e petiscos especiais.',
    motif: 'bar',
    schedule: { kind: 'weekly', weekday: 5, hour: 18, weeks: [1] },
    duration_hours: 5,
  },
  {
    key: 'rolandia-visita-guiada',
    place: 'rolandia-espaco-memoria-colonial',
    title: 'Visita guiada: memória da colonização',
    description: 'Percurso comentado pelo acervo de fotografias e objetos.',
    motif: 'heritage',
    schedule: { kind: 'weekly', weekday: 6, hour: 10, weeks: [0, 1] },
    duration_hours: 1.5,
  },
  {
    key: 'ibipora-torneio-pesca',
    place: 'ibipora-pesqueiro-aguas-claras',
    title: 'Torneio de pesca esportiva',
    description: 'Pesca e solta com medição dos peixes e almoço no quiosque.',
    motif: 'lake',
    schedule: { kind: 'weekly', weekday: 7, hour: 7, weeks: [1] },
    duration_hours: 6,
  },
  {
    key: 'cornelio-sexta-rock',
    place: 'cornelio-bar-trilho-velho',
    title: 'Sexta do rock nacional',
    description: 'Banda da casa com clássicos do rock brasileiro.',
    motif: 'music',
    schedule: { kind: 'weekly', weekday: 5, hour: 21, weeks: [0, 1, 2] },
    duration_hours: 3,
  },
  {
    key: 'cornelio-musica-mirante',
    place: 'cornelio-mirante-do-pioneiro',
    title: 'Pôr do sol com música no mirante',
    description: 'Apresentação acústica no deque durante o pôr do sol.',
    motif: 'lookout',
    schedule: { kind: 'weekly', weekday: 6, hour: 17, minute: 30, weeks: [0] },
    duration_hours: 2,
  },
  {
    key: 'bandeirantes-dia-de-campo',
    place: 'bandeirantes-fazenda-recanto-pioneiro',
    title: 'Dia de campo com almoço',
    description: 'Programação completa na fazenda, com almoço de fogão a lenha.',
    motif: 'farm',
    schedule: { kind: 'weekly', weekday: 7, hour: 9, weeks: [1] },
    duration_hours: 6,
  },
]
