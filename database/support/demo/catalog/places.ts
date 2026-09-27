import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import type { DemoMotif } from '#database/support/demo/illustration/scenes'

/**
 * The fictitious places of the demo.
 *
 * Every name is invented and generic, and is published with the suffix
 * " — demonstração", the convention the homologation baseline set; every
 * description ends with a sentence saying the place is fictitious; every
 * address is "Endereço demonstrativo" in a real district, with coordinates
 * spread around the city centre so the map looks alive without pointing at a
 * real doorstep. There are no phone numbers or social handles: a plausible
 * number or profile could belong to someone.
 */

export type DemoHoursProfile =
  | 'lunch_dinner'
  | 'lunch'
  | 'dinner'
  | 'bar'
  | 'cafe'
  | 'bakery'
  | 'sweets'
  | 'icecream'
  | 'shop'
  | 'museum'
  | 'cinema'
  | 'culture'
  | 'bookshop'
  | 'entertainment'
  | 'park'
  | 'adventure'
  | 'rural'
  | 'studio'
  | 'barber'
  | 'services'

export type DemoAvailability = DemoHoursProfile | 'appointment' | 'always'

export interface DemoPlace {
  key: string
  name: string
  city: string
  district: string
  category: string
  secondary?: string
  organization: string
  motif: DemoMotif
  /** Additional gallery images, framed closer than the cover. */
  gallery?: DemoMotif[]
  short: string
  description: string
  availability: DemoAvailability
  /** Attribute values by key; select attributes take the option value. */
  attributes?: Record<string, boolean | number | string>
  business_status?: 'temporarily_closed'
  /** Submitted but left for a moderator, so the review queue has a real case. */
  publication?: 'pending_review'
  /** Places without a website still publish an e-mail address. */
  website?: boolean
}

export const DEMO_MARKER = ' — demonstração'
export const DEMO_PLACE_NOTICE =
  'Estabelecimento fictício, criado para demonstrar a plataforma: nome, endereço e contatos não correspondem a um negócio real.'

type Interval = readonly [string, string]
function days(weekdays: number[], ...intervals: Interval[]): IEstablishment.WeeklyHourPayload[] {
  return weekdays.flatMap((weekday) =>
    intervals.map(([opens, closes], index) => ({
      weekday,
      opens_at: opens,
      closes_at: closes,
      spans_next_day: closes < opens,
      sort_order: index,
    }))
  )
}

const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

/** Weekday 0 is Sunday, as in the catalogue's `catalog_is_open_now`. */
export const DEMO_HOURS: Record<DemoHoursProfile, IEstablishment.WeeklyHourPayload[]> = {
  lunch_dinner: [
    ...days([2, 3, 4, 5, 6], ['11:30', '15:00'], ['18:30', '23:00']),
    ...days([0], ['11:30', '16:00']),
  ],
  lunch: [...days([1, 2, 3, 4, 5, 6], ['11:00', '15:00']), ...days([0], ['11:00', '15:30'])],
  dinner: [
    ...days([2, 3, 4], ['18:00', '23:30']),
    ...days([5, 6], ['18:00', '00:30']),
    ...days([0], ['18:00', '23:00']),
  ],
  bar: [
    ...days([2, 3, 4], ['17:00', '23:59']),
    ...days([5, 6], ['17:00', '02:00']),
    ...days([0], ['12:00', '18:00']),
  ],
  cafe: [
    ...days(WEEKDAYS, ['07:30', '19:00']),
    ...days([6], ['08:00', '17:00']),
    ...days([0], ['08:00', '13:00']),
  ],
  bakery: [...days([1, 2, 3, 4, 5, 6], ['06:00', '20:00']), ...days([0], ['06:30', '13:00'])],
  sweets: [...days([2, 3, 4, 5, 6], ['10:00', '19:00']), ...days([0], ['14:00', '19:00'])],
  icecream: days(EVERY_DAY, ['12:00', '22:00']),
  shop: [...days(WEEKDAYS, ['09:00', '19:00']), ...days([6], ['09:00', '14:00'])],
  museum: [...days([2, 3, 4, 5], ['09:00', '17:00']), ...days([6, 0], ['10:00', '16:00'])],
  cinema: days([3, 4, 5, 6, 0], ['14:00', '23:00']),
  culture: [...days([3, 4, 5, 6], ['18:00', '23:59']), ...days([0], ['15:00', '21:00'])],
  bookshop: [
    ...days(WEEKDAYS, ['09:00', '19:00']),
    ...days([6], ['09:00', '17:00']),
    ...days([0], ['10:00', '14:00']),
  ],
  entertainment: [
    ...days([2, 3, 4], ['17:00', '23:00']),
    ...days([5, 6], ['14:00', '23:59']),
    ...days([0], ['14:00', '21:00']),
  ],
  park: days(EVERY_DAY, ['06:00', '19:00']),
  adventure: [...days([3, 4, 5], ['08:00', '16:00']), ...days([6, 0], ['07:00', '17:00'])],
  rural: [...days([5], ['09:00', '17:00']), ...days([6, 0], ['08:00', '17:30'])],
  studio: [
    ...days(WEEKDAYS, ['06:30', '11:30'], ['16:30', '21:00']),
    ...days([6], ['08:00', '12:00']),
  ],
  barber: [...days([2, 3, 4, 5], ['09:00', '20:00']), ...days([6], ['08:00', '17:00'])],
  services: [...days(WEEKDAYS, ['08:00', '18:00']), ...days([6], ['08:00', '12:00'])],
}

export const DEMO_PLACES: DemoPlace[] = [
  // ------------------------------------------------------------------ Londrina
  {
    key: 'londrina-cantina-vale-verde',
    name: 'Cantina Vale Verde',
    city: 'londrina',
    district: 'Centro',
    category: 'restaurantes',
    organization: 'casa-paineira',
    motif: 'pasta',
    gallery: ['pasta', 'homestyle'],
    short: 'Massas frescas feitas no dia, molhos longos e mesas para a família inteira.',
    description:
      'Cantina de salão amplo com massa fresca aberta à vista, molhos de cozimento lento e sobremesas da casa. Aos domingos o almoço vira encontro de família, com porções para dividir.',
    availability: 'lunch_dinner',
    attributes: { price_range: 'moderado', accepts_reservations: true, vegetarian_options: true },
  },
  {
    key: 'londrina-brasa-paineira',
    name: 'Brasa Paineira',
    city: 'londrina',
    district: 'Gleba Palhano',
    category: 'restaurantes',
    organization: 'casa-paineira',
    motif: 'grill',
    gallery: ['grill'],
    short: 'Cortes na brasa, legumes na grelha e carta curta de vinhos.',
    description:
      'Casa de grelhados com parrilla aberta, cortes regionais servidos na tábua e acompanhamentos de estação. O menu executivo do almoço muda a cada semana.',
    availability: 'lunch_dinner',
    attributes: { price_range: 'especial', accepts_reservations: true },
  },
  {
    key: 'londrina-balcao-pe-vermelho',
    name: 'Balcão Pé-Vermelho',
    city: 'londrina',
    district: 'Vila Nova',
    category: 'bares',
    organization: 'casa-paineira',
    motif: 'bar',
    gallery: ['bar'],
    short: 'Boteco de esquina com petiscos regionais e chope gelado.',
    description:
      'Bar de balcão comprido, mesas na calçada e cardápio de petiscos com mandioca, torresmo e pastéis. Às sextas tem roda de samba no fim da tarde.',
    availability: 'bar',
    attributes: {
      live_music: true,
      service_style: 'table',
      minimum_age: 18,
      price_range: 'economico',
    },
  },
  {
    key: 'londrina-ipe-cafe',
    name: 'Ipê Café Especial',
    city: 'londrina',
    district: 'Vila Casoni',
    category: 'cafes',
    organization: 'ipe-cafes',
    motif: 'coffee',
    gallery: ['coffee', 'bakery'],
    short: 'Cafés especiais do Norte Pioneiro, métodos filtrados e confeitaria leve.',
    description:
      'Cafeteria de torra própria com grãos de pequenos produtores da região, métodos coados na hora e mesa comunitária para quem trabalha fora de casa.',
    availability: 'cafe',
    attributes: {
      specialty_coffee: true,
      service_style: 'counter',
      average_ticket: 38,
      pet_friendly: true,
    },
  },
  {
    key: 'londrina-forno-fermento',
    name: 'Forno & Fermento Londrina',
    city: 'londrina',
    district: 'Jardim Alpes',
    category: 'padarias',
    organization: 'forno-fermento',
    motif: 'bakery',
    gallery: ['bakery'],
    short: 'Pães de fermentação natural, café da manhã e encomendas.',
    description:
      'Padaria artesanal com fornada de pão de fermentação natural toda manhã, balcão de frios e mesas para o café da manhã completo aos fins de semana.',
    availability: 'bakery',
    attributes: { breakfast: true, service_style: 'counter', delivery: true },
  },
  {
    key: 'londrina-doce-figueira',
    name: 'Doce Figueira Confeitaria',
    city: 'londrina',
    district: 'Jardim Canadá',
    category: 'docerias',
    organization: 'forno-fermento',
    motif: 'sweets',
    short: 'Bolos caseiros, doces finos e tortas por fatia.',
    description:
      'Confeitaria de bairro com bolos de receita antiga, doces finos para festas e tortas servidas por fatia no fim da tarde.',
    availability: 'sweets',
    attributes: { price_range: 'moderado', delivery: true },
  },
  {
    key: 'londrina-smash-do-norte',
    name: 'Smash do Norte',
    city: 'londrina',
    district: 'Gleba Palhano',
    category: 'hamburguerias',
    organization: 'terra-roxa',
    motif: 'burger',
    short: 'Hambúrguer prensado na chapa, batata rústica e milk-shakes.',
    description:
      'Hamburgueria de balcão com blends moídos na casa, pão de brioche próprio e opções vegetarianas de grão-de-bico.',
    availability: 'dinner',
    attributes: { price_range: 'economico', service_style: 'counter', vegetarian_options: true },
  },
  {
    key: 'londrina-massa-madre-pizzaria',
    name: 'Massa Madre Pizzaria',
    city: 'londrina',
    district: 'Vila Brasil',
    category: 'pizzarias',
    organization: 'terra-roxa',
    motif: 'pizza',
    gallery: ['pizza'],
    short: 'Pizza de longa fermentação assada em forno a lenha.',
    description:
      'Pizzaria de massa com 48 horas de fermentação, forno a lenha à vista e coberturas com queijos da região.',
    availability: 'dinner',
    attributes: { price_range: 'moderado', accepts_reservations: true, delivery: true },
  },
  {
    key: 'londrina-kaiten-norte',
    name: 'Kaiten Norte',
    city: 'londrina',
    district: 'Centro',
    category: 'cozinha-japonesa',
    organization: 'terra-roxa',
    motif: 'sushi',
    short: 'Balcão de sushi, lámen aos sábados e pratos quentes.',
    description:
      'Casa japonesa de balcão onde o sushiman monta as peças na frente do cliente. Aos sábados o cardápio ganha lámen e guiozas.',
    availability: 'lunch_dinner',
    attributes: { price_range: 'moderado', accepts_reservations: true },
  },
  {
    key: 'londrina-cineclube-lanterna',
    name: 'Cineclube Lanterna',
    city: 'londrina',
    district: 'Centro',
    category: 'cinema-e-audiovisual',
    organization: 'palco-norte',
    motif: 'cinema',
    short: 'Sessões de cinema independente e debates depois do filme.',
    description:
      'Sala pequena dedicada a filmes independentes e clássicos restaurados, com conversa após as sessões e mostras temáticas a cada mês.',
    availability: 'cinema',
    attributes: { wheelchair_accessible: true, kids_friendly: false },
  },
  {
    key: 'londrina-casa-tramela',
    name: 'Casa de Cultura Tramela',
    city: 'londrina',
    district: 'Vila Nova',
    category: 'cultura-e-eventos',
    organization: 'palco-norte',
    motif: 'music',
    short: 'Casa cultural com música ao vivo, oficinas e feira de artistas.',
    description:
      'Casarão com quintal que recebe shows acústicos, oficinas de percussão e uma feira de artistas locais no último domingo do mês.',
    availability: 'culture',
    attributes: { free_entry: false, wheelchair_accessible: true, kids_friendly: true },
  },
  {
    key: 'londrina-galeria-janela-aberta',
    name: 'Galeria Janela Aberta',
    city: 'londrina',
    district: 'Centro',
    category: 'museus-e-galerias',
    organization: 'palco-norte',
    motif: 'gallery',
    short: 'Arte contemporânea de artistas do Paraná, com entrada gratuita.',
    description:
      'Galeria de rua com exposições que mudam a cada seis semanas, visitas mediadas para escolas e um pequeno acervo de gravuras.',
    availability: 'museum',
    attributes: { free_entry: true, wheelchair_accessible: true, kids_friendly: true },
  },
  {
    key: 'londrina-parque-das-seriemas',
    name: 'Parque das Seriemas',
    city: 'londrina',
    district: 'Aeroporto',
    category: 'parques-e-trilhas',
    organization: 'rotas-norte',
    motif: 'park',
    gallery: ['park'],
    short: 'Área verde com trilha curta, lago e observação de aves.',
    description:
      'Parque com trilha sombreada de dois quilômetros, lago com deque e placas sobre as aves da região. Bom para caminhar cedo.',
    availability: 'park',
    attributes: { free_entry: true, kids_friendly: true, pet_friendly: true, parking: true },
  },
  {
    key: 'londrina-pedal-norte',
    name: 'Pedal Norte Bicicletaria',
    city: 'londrina',
    district: 'Presidente',
    category: 'bicicletarias',
    organization: 'oficina-cia',
    motif: 'bike',
    short: 'Oficina de bicicletas, peças e pedais guiados aos domingos.',
    description:
      'Bicicletaria com oficina completa, revisão com hora marcada e um grupo de pedal que sai da loja aos domingos de manhã.',
    availability: 'services',
    attributes: { price_range: 'moderado', delivery: false, parking: true },
  },
  {
    key: 'londrina-respiro-yoga',
    name: 'Estúdio Respiro Yoga',
    city: 'londrina',
    district: 'Gleba Palhano',
    category: 'yoga-e-pilates',
    organization: 'raiz-bem-estar',
    motif: 'yoga',
    short: 'Aulas de yoga para iniciantes e práticas ao ar livre.',
    description:
      'Estúdio com turmas pequenas de hatha e vinyasa, aulas para iniciantes e uma prática mensal ao ar livre no parque do bairro.',
    availability: 'studio',
    attributes: { price_range: 'moderado', wheelchair_accessible: true },
  },
  {
    key: 'londrina-traco-fino-tattoo',
    name: 'Traço Fino Tattoo',
    city: 'londrina',
    district: 'Centro',
    category: 'estudios-de-tatuagem',
    organization: 'traco-fino',
    motif: 'tattoo',
    short: 'Estúdio de tatuagem fine line e flash autoral, com hora marcada.',
    description:
      'Estúdio com artistas residentes em traço fino, blackwork e flash autoral. O atendimento é somente com agendamento prévio.',
    availability: 'appointment',
    attributes: { price_range: 'especial' },
  },
  {
    key: 'londrina-atelie-barro-fogo',
    name: 'Ateliê Barro & Fogo',
    city: 'londrina',
    district: 'Vila Casoni',
    category: 'oficinas-criativas',
    organization: 'oficina-cia',
    motif: 'ceramics',
    gallery: ['ceramics'],
    short: 'Cerâmica no torno, modelagem manual e peças para levar.',
    description:
      'Ateliê de cerâmica com turmas de torno e modelagem manual, queima em forno próprio e loja com peças de ceramistas da região.',
    availability: 'services',
    attributes: { price_range: 'moderado', kids_friendly: true },
  },
  {
    key: 'londrina-brisa-gelatos',
    name: 'Brisa Gelatos',
    city: 'londrina',
    district: 'Jardim Canadá',
    category: 'sorveterias',
    organization: 'casa-paineira',
    motif: 'icecream',
    short: 'Gelatos de frutas brasileiras e picolés artesanais.',
    description:
      'Sorveteria de receitas próprias com sabores de frutas da estação, opções sem lactose e picolés de fruta para levar.',
    availability: 'icecream',
    attributes: { price_range: 'economico', vegetarian_options: true, pet_friendly: true },
  },
  // ------------------------------------------------------------------ Maringá
  {
    key: 'maringa-terra-roxa-cozinha',
    name: 'Terra Roxa Cozinha Regional',
    city: 'maringa',
    district: 'Zona 01',
    category: 'restaurantes',
    organization: 'terra-roxa',
    motif: 'homestyle',
    gallery: ['homestyle', 'grill'],
    short: 'Comida regional no almoço, com buffet e pratos do dia.',
    description:
      'Restaurante de almoço com receitas do interior do Paraná, arroz carreteiro às quartas e feijoada aos sábados.',
    availability: 'lunch',
    attributes: { price_range: 'economico', service_style: 'counter', vegetarian_options: true },
  },
  {
    key: 'maringa-bistro-cancao',
    name: 'Bistrô Canção',
    city: 'maringa',
    district: 'Zona 07',
    category: 'restaurantes',
    organization: 'terra-roxa',
    motif: 'pasta',
    short: 'Bistrô de menu curto, massas e carta de vinhos da casa.',
    description:
      'Bistrô intimista com menu que muda a cada estação, massas frescas, pratos para dividir e sobremesas de confeitaria.',
    availability: 'dinner',
    attributes: { price_range: 'especial', accepts_reservations: true, vegetarian_options: true },
  },
  {
    key: 'maringa-chopp-e-prosa',
    name: 'Chopp & Prosa',
    city: 'maringa',
    district: 'Novo Centro',
    category: 'bares',
    organization: 'terra-roxa',
    motif: 'bar',
    short: 'Chope artesanal, tábuas de frios e música ao vivo.',
    description:
      'Bar com torneiras de cervejarias do Paraná, tábuas de frios para dividir e shows acústicos de quinta a sábado.',
    availability: 'bar',
    attributes: {
      live_music: true,
      service_style: 'table',
      minimum_age: 18,
      price_range: 'moderado',
    },
  },
  {
    key: 'maringa-ipe-cafe',
    name: 'Ipê Café Especial',
    city: 'maringa',
    district: 'Zona 07',
    category: 'cafes',
    organization: 'ipe-cafes',
    motif: 'coffee',
    short: 'A mesma torra do Ipê de Londrina, agora perto da universidade.',
    description:
      'Segunda unidade do Ipê, com os mesmos grãos de torra própria, cardápio de brunch aos sábados e tomadas em todas as mesas.',
    availability: 'cafe',
    attributes: {
      specialty_coffee: true,
      service_style: 'table',
      average_ticket: 42,
      vegetarian_options: true,
    },
  },
  {
    key: 'maringa-forno-fermento',
    name: 'Forno & Fermento Maringá',
    city: 'maringa',
    district: 'Jardim Alvorada',
    category: 'padarias',
    organization: 'forno-fermento',
    motif: 'bakery',
    short: 'Pão quentinho de hora em hora e café da manhã completo.',
    description:
      'Padaria de bairro com fornadas ao longo do dia, salgados assados e mesa de café da manhã aos domingos.',
    availability: 'bakery',
    attributes: { breakfast: true, service_style: 'counter' },
  },
  {
    key: 'maringa-flor-de-laranjeira',
    name: 'Confeitaria Flor de Laranjeira',
    city: 'maringa',
    district: 'Zona 05',
    category: 'docerias',
    organization: 'forno-fermento',
    motif: 'sweets',
    short: 'Doces finos, bolos decorados e cafés da tarde.',
    description:
      'Confeitaria de doces finos para festas, bolos decorados sob encomenda e mesas para o café da tarde.',
    availability: 'sweets',
    attributes: { price_range: 'moderado', service_style: 'table' },
  },
  {
    key: 'maringa-hamburguer-do-bosque',
    name: 'Hambúrguer do Bosque',
    city: 'maringa',
    district: 'Zona 02',
    category: 'hamburguerias',
    organization: 'terra-roxa',
    motif: 'burger',
    short: 'Hambúrguer artesanal com cebola caramelizada e batata da casa.',
    description:
      'Hamburgueria com varanda arborizada, pão de fermentação natural e molhos preparados na casa.',
    availability: 'dinner',
    attributes: { price_range: 'moderado', delivery: true },
  },
  {
    key: 'maringa-pizzaria-lenha-viva',
    name: 'Pizzaria Lenha Viva',
    city: 'maringa',
    district: 'Jardim Alvorada',
    category: 'pizzarias',
    organization: 'terra-roxa',
    motif: 'pizza',
    short: 'Pizzas tradicionais no forno a lenha e rodízio às terças.',
    description:
      'Pizzaria de família com forno a lenha, massa fina e rodízio de pizzas às terças-feiras.',
    availability: 'dinner',
    attributes: { price_range: 'moderado', delivery: true, accepts_reservations: false },
  },
  {
    key: 'maringa-sushi-hanami',
    name: 'Sushi Hanami',
    city: 'maringa',
    district: 'Zona 01',
    category: 'cozinha-japonesa',
    organization: 'terra-roxa',
    motif: 'sushi',
    gallery: ['sushi'],
    short: 'Combinados, temakis e pratos quentes em ambiente tranquilo.',
    description:
      'Restaurante japonês com combinados montados na hora, temakis e pratos quentes como tempurá e yakisoba.',
    availability: 'lunch_dinner',
    attributes: { price_range: 'moderado', delivery: true },
  },
  {
    key: 'maringa-emporio-colheita',
    name: 'Empório Colheita',
    city: 'maringa',
    district: 'Zona 02',
    category: 'emporios',
    organization: 'casa-paineira',
    motif: 'deli',
    short: 'Queijos, geleias, cafés e vinhos de pequenos produtores.',
    description:
      'Empório com produtos de sítios da região, queijos curados, geleias artesanais e degustações aos sábados.',
    availability: 'shop',
    attributes: { price_range: 'moderado', delivery: true, parking: false },
  },
  {
    key: 'maringa-cine-varanda',
    name: 'Cine Varanda',
    city: 'maringa',
    district: 'Zona 01',
    category: 'cinema-e-audiovisual',
    organization: 'palco-norte',
    motif: 'cinema',
    short: 'Cinema de rua com sessões ao ar livre nas noites de verão.',
    description:
      'Sala de cinema com programação de filmes nacionais e sessões ao ar livre na varanda durante o verão.',
    availability: 'cinema',
    attributes: { wheelchair_accessible: true, kids_friendly: true },
  },
  {
    key: 'maringa-livraria-pagina-viva',
    name: 'Livraria Página Viva',
    city: 'maringa',
    district: 'Zona 07',
    category: 'livrarias',
    organization: 'palco-norte',
    motif: 'books',
    short: 'Livros novos e usados, clube de leitura e café no fundo da loja.',
    description:
      'Livraria independente com sebo, seção infantil e um clube de leitura que se reúne na primeira segunda do mês.',
    availability: 'bookshop',
    attributes: { wheelchair_accessible: true, kids_friendly: true },
  },
  {
    key: 'maringa-trilha-corrego-verde',
    name: 'Trilha do Córrego Verde',
    city: 'maringa',
    district: 'Jardim Universitário',
    category: 'parques-e-trilhas',
    organization: 'rotas-norte',
    motif: 'trail',
    short: 'Trilha urbana ao longo do córrego, com mata e mirante.',
    description:
      'Caminho de terra batida à beira do córrego, com trechos de mata nativa, pontes de madeira e um pequeno mirante.',
    availability: 'park',
    attributes: { free_entry: true, pet_friendly: true, kids_friendly: true },
  },
  {
    key: 'maringa-raiz-pilates',
    name: 'Estúdio Raiz Pilates',
    city: 'maringa',
    district: 'Zona 05',
    category: 'yoga-e-pilates',
    organization: 'raiz-bem-estar',
    motif: 'yoga',
    short: 'Pilates em aparelhos e solo, com turmas de até quatro pessoas.',
    description:
      'Estúdio de pilates com aparelhos, aulas de solo e turmas pequenas acompanhadas por fisioterapeutas.',
    availability: 'studio',
    attributes: { price_range: 'moderado', parking: true },
  },
  {
    key: 'maringa-espaco-lavanda',
    name: 'Espaço Lavanda Spa',
    city: 'maringa',
    district: 'Novo Centro',
    category: 'beleza-e-bem-estar',
    organization: 'raiz-bem-estar',
    motif: 'spa',
    gallery: ['spa'],
    short: 'Massagens, escalda-pés e rituais de relaxamento com hora marcada.',
    description:
      'Spa urbano com salas silenciosas, massagem relaxante, reflexologia e rituais de escalda-pés. Atendimento somente com agendamento.',
    availability: 'appointment',
    attributes: { price_range: 'especial', wheelchair_accessible: true },
  },
  {
    key: 'maringa-pata-amiga',
    name: 'Pata Amiga Pet',
    city: 'maringa',
    district: 'Vila Operária',
    category: 'pet',
    organization: 'oficina-cia',
    motif: 'pet',
    short: 'Banho, tosa e acessórios, com busca e entrega no bairro.',
    description:
      'Pet shop de bairro com banho e tosa, rações selecionadas e serviço de busca e entrega com hora marcada.',
    availability: 'services',
    attributes: { price_range: 'moderado', delivery: true },
  },
  {
    key: 'maringa-quiosque-sabor-de-feira',
    name: 'Quiosque Sabor de Feira',
    city: 'maringa',
    district: 'Vila Operária',
    category: 'restaurantes',
    organization: 'terra-roxa',
    motif: 'homestyle',
    short: 'Pastéis, caldo de cana e pratos de feira ao ar livre.',
    description:
      'Quiosque com pastéis fritos na hora, caldo de cana e pratos rápidos. A ficha aguarda a análise da operação.',
    availability: 'lunch',
    attributes: { price_range: 'economico' },
    publication: 'pending_review',
  },
  // ------------------------------------------------------------------ Apucarana
  {
    key: 'apucarana-ipe-cafe',
    name: 'Ipê Café Especial',
    city: 'apucarana',
    district: 'Centro',
    category: 'cafes',
    organization: 'ipe-cafes',
    motif: 'coffee',
    short: 'Cafés filtrados e pão de queijo da casa no centro da cidade.',
    description:
      'A unidade de Apucarana do Ipê tem balcão de métodos filtrados, pão de queijo assado a cada hora e vitrine de grãos para levar.',
    availability: 'cafe',
    attributes: { specialty_coffee: true, service_style: 'counter', average_ticket: 32 },
  },
  {
    key: 'apucarana-cantina-serra-azul',
    name: 'Cantina Serra Azul',
    city: 'apucarana',
    district: 'Vila Nova',
    category: 'restaurantes',
    organization: 'vale-ivai',
    motif: 'pasta',
    short: 'Massas caseiras e polenta frita no alto da serra.',
    description:
      'Cantina de família com massas caseiras, polenta frita e vinho da casa servido em jarra.',
    availability: 'lunch_dinner',
    attributes: { price_range: 'moderado', accepts_reservations: true },
  },
  {
    key: 'apucarana-bar-mirante-do-vale',
    name: 'Bar Mirante do Vale',
    city: 'apucarana',
    district: 'Jardim América',
    category: 'bares',
    organization: 'vale-ivai',
    motif: 'bar',
    short: 'Petiscos e caipirinhas com vista para o vale ao entardecer.',
    description:
      'Bar de varanda com vista para o vale, petiscos de boteco e caipirinhas de frutas da estação.',
    availability: 'bar',
    attributes: { live_music: false, service_style: 'table', price_range: 'economico' },
  },
  {
    key: 'apucarana-hamburguer-morro-alto',
    name: 'Hambúrguer Morro Alto',
    city: 'apucarana',
    district: 'Centro',
    category: 'hamburguerias',
    organization: 'vale-ivai',
    motif: 'burger',
    short: 'Hambúrguer smash, fritas e shakes até tarde.',
    description:
      'Hamburgueria de balcão com smash duplo, fritas crocantes e milk-shakes de doce de leite.',
    availability: 'dinner',
    attributes: { price_range: 'economico', service_style: 'counter' },
  },
  {
    key: 'apucarana-cine-teatro-pequeno-ato',
    name: 'Cine Teatro Pequeno Ato',
    city: 'apucarana',
    district: 'Centro',
    category: 'cultura-e-eventos',
    organization: 'palco-norte',
    motif: 'music',
    short: 'Teatro de bolso com peças, música e sessões de cinema.',
    description:
      'Teatro de bolso com cem lugares que alterna peças de grupos locais, shows intimistas e sessões de cinema aos domingos.',
    availability: 'culture',
    attributes: { free_entry: false, wheelchair_accessible: true },
  },
  {
    key: 'apucarana-trilha-serra-do-vale',
    name: 'Trilha da Serra do Vale',
    city: 'apucarana',
    district: 'Jardim Primavera',
    category: 'esportes-e-aventura',
    organization: 'rotas-norte',
    motif: 'trail',
    gallery: ['lookout'],
    short: 'Trilha guiada, rapel e pôr do sol no mirante.',
    description:
      'Base de ecoturismo com trilhas guiadas, rapel para iniciantes e saídas ao mirante no fim da tarde, sempre com instrutores.',
    availability: 'adventure',
    attributes: { price_range: 'moderado', kids_friendly: false, parking: true },
  },
  {
    key: 'apucarana-traco-fino-tattoo',
    name: 'Traço Fino Tattoo Apucarana',
    city: 'apucarana',
    district: 'Centro',
    category: 'estudios-de-tatuagem',
    organization: 'traco-fino',
    motif: 'tattoo',
    short: 'A segunda casa do Traço Fino, com agenda aberta às quintas.',
    description:
      'Unidade do Traço Fino com dois artistas residentes e agenda aberta para flash às quintas. Atendimento com hora marcada.',
    availability: 'appointment',
    attributes: { price_range: 'moderado' },
  },
  // ------------------------------------------------------------------ Arapongas
  {
    key: 'arapongas-grelha-araponga',
    name: 'Grelha Araponga',
    city: 'arapongas',
    district: 'Centro',
    category: 'restaurantes',
    organization: 'vale-ivai',
    motif: 'grill',
    short: 'Churrasco no espeto, buffet de saladas e sobremesas caseiras.',
    description:
      'Restaurante de grelhados com espeto corrido no almoço, buffet de saladas e doces caseiros de sobremesa.',
    availability: 'lunch',
    attributes: { price_range: 'moderado', parking: true },
  },
  {
    key: 'arapongas-pizzaria-bella-forno',
    name: 'Pizzaria Bella Forno',
    city: 'arapongas',
    district: 'Jardim Tropical',
    category: 'pizzarias',
    organization: 'vale-ivai',
    motif: 'pizza',
    short: 'Pizzas de borda recheada e esfihas abertas.',
    description:
      'Pizzaria de bairro com massa média, bordas recheadas e esfihas abertas assadas no mesmo forno.',
    availability: 'dinner',
    attributes: { price_range: 'economico', delivery: true },
  },
  {
    key: 'arapongas-forno-fermento',
    name: 'Forno & Fermento Arapongas',
    city: 'arapongas',
    district: 'Centro',
    category: 'padarias',
    organization: 'forno-fermento',
    motif: 'bakery',
    short: 'Pão francês a toda hora e sonhos recheados.',
    description:
      'Padaria com pão francês saindo a toda hora, sonhos recheados e café coado no balcão.',
    availability: 'bakery',
    attributes: { breakfast: true, service_style: 'counter' },
  },
  {
    key: 'arapongas-canto-do-passaro',
    name: 'Sorveteria Canto do Pássaro',
    city: 'arapongas',
    district: 'Vila Nova',
    category: 'sorveterias',
    organization: 'vale-ivai',
    motif: 'icecream',
    short: 'Sorvete de massa, açaí e picolés de fruta.',
    description:
      'Sorveteria com sorvete de massa por quilo, açaí montado na hora e picolés de frutas da região. Fechada temporariamente para reforma do salão.',
    availability: 'icecream',
    attributes: { price_range: 'economico' },
    business_status: 'temporarily_closed',
  },
  {
    key: 'arapongas-arena-jogos',
    name: 'Arena Jogos & Boliche',
    city: 'arapongas',
    district: 'Jardim Primavera',
    category: 'entretenimento',
    organization: 'rotas-norte',
    motif: 'bowling',
    short: 'Boliche, fliperamas e lanchonete para grupos.',
    description:
      'Centro de entretenimento com quatro pistas de boliche, fliperamas e lanchonete para aniversários e grupos.',
    availability: 'entertainment',
    attributes: { price_range: 'moderado', kids_friendly: true, parking: true },
  },
  {
    key: 'arapongas-roda-livre',
    name: 'Roda Livre Bicicletaria',
    city: 'arapongas',
    district: 'Centro',
    category: 'bicicletarias',
    organization: 'oficina-cia',
    motif: 'bike',
    short: 'Conserto rápido, peças e acessórios para ciclistas.',
    description:
      'Bicicletaria com conserto no mesmo dia, peças para bicicletas urbanas e de trilha e aluguel de bicicletas aos fins de semana.',
    availability: 'services',
    attributes: { price_range: 'economico' },
  },
  // ------------------------------------------------------------------ Cambé
  {
    key: 'cambe-paineira-cozinha-caseira',
    name: 'Paineira Cozinha Caseira',
    city: 'cambe',
    district: 'Centro',
    category: 'restaurantes',
    organization: 'casa-paineira',
    motif: 'homestyle',
    short: 'Prato feito caprichado e comida de fogão a lenha.',
    description:
      'Restaurante de almoço com prato feito, comida de fogão a lenha e sobremesa inclusa às sextas.',
    availability: 'lunch',
    attributes: { price_range: 'economico', service_style: 'counter' },
  },
  {
    key: 'cambe-bar-do-coreto',
    name: 'Bar do Coreto',
    city: 'cambe',
    district: 'Centro',
    category: 'bares',
    organization: 'casa-paineira',
    motif: 'bar',
    short: 'Bar de praça com petiscos e samba aos sábados.',
    description:
      'Bar tradicional de frente para a praça, com porções generosas e samba ao vivo nas tardes de sábado.',
    availability: 'bar',
    attributes: { live_music: true, service_style: 'table', price_range: 'economico' },
  },
  {
    key: 'cambe-padaria-grao-nobre',
    name: 'Padaria Grão Nobre',
    city: 'cambe',
    district: 'Vila Nova',
    category: 'padarias',
    organization: 'forno-fermento',
    motif: 'bakery',
    short: 'Pães, bolos caseiros e salgados assados.',
    description:
      'Padaria de bairro com pães variados, bolos caseiros por fatia e salgados assados para o lanche da tarde.',
    availability: 'bakery',
    attributes: { breakfast: false, service_style: 'counter' },
  },
  {
    key: 'cambe-sitio-pe-de-cafe',
    name: 'Sítio Pé de Café',
    city: 'cambe',
    district: 'Jardim Primavera',
    category: 'turismo-rural',
    organization: 'rotas-norte',
    motif: 'farm',
    gallery: ['coffee'],
    short: 'Colhe-e-pague de frutas, cafezal e café colonial no fim de semana.',
    description:
      'Sítio aberto à visitação com colhe-e-pague de frutas da estação, passeio pelo cafezal e café colonial aos sábados e domingos.',
    availability: 'rural',
    attributes: { price_range: 'moderado', kids_friendly: true, pet_friendly: true, parking: true },
  },
  {
    key: 'cambe-floricultura-jardim-suspenso',
    name: 'Floricultura Jardim Suspenso',
    city: 'cambe',
    district: 'Centro',
    category: 'floriculturas',
    organization: 'oficina-cia',
    motif: 'flowers',
    short: 'Arranjos, plantas de interior e entregas no mesmo dia.',
    description:
      'Floricultura com arranjos montados na hora, plantas de interior e entregas no mesmo dia na cidade.',
    availability: 'shop',
    attributes: { delivery: true },
  },
  {
    key: 'cambe-barbearia-navalha',
    name: 'Barbearia Navalha Clássica',
    city: 'cambe',
    district: 'Centro',
    category: 'barbearias',
    organization: 'traco-fino',
    motif: 'barber',
    short: 'Corte, barba com toalha quente e café por conta da casa.',
    description:
      'Barbearia de cadeiras antigas com corte na tesoura, barba com toalha quente e café servido enquanto se espera.',
    availability: 'barber',
    attributes: { price_range: 'economico', accepts_reservations: true },
  },
  // ------------------------------------------------------------------ Rolândia
  {
    key: 'rolandia-forno-fermento',
    name: 'Forno & Fermento Rolândia',
    city: 'rolandia',
    district: 'Centro',
    category: 'padarias',
    organization: 'forno-fermento',
    motif: 'bakery',
    short: 'Pães de centeio, cucas e receitas de tradição europeia.',
    description:
      'Unidade do Forno & Fermento com pães de centeio, cucas de frutas e roscas de receitas de tradição europeia.',
    availability: 'bakery',
    attributes: { breakfast: true, service_style: 'table' },
  },
  {
    key: 'rolandia-cafe-colonial-linde',
    name: 'Café Colonial Linde',
    city: 'rolandia',
    district: 'Jardim Europa',
    category: 'cafes',
    organization: 'forno-fermento',
    motif: 'sweets',
    gallery: ['coffee'],
    short: 'Café colonial com tortas, cucas e geleias caseiras.',
    description:
      'Casa de chá e café colonial com mesa farta de tortas, cucas, pães caseiros e geleias feitas na cozinha dos fundos.',
    availability: 'cafe',
    attributes: { specialty_coffee: false, service_style: 'table', average_ticket: 65 },
  },
  {
    key: 'rolandia-cervejaria-vale-do-fermento',
    name: 'Cervejaria Vale do Fermento',
    city: 'rolandia',
    district: 'Jardim Novo Horizonte',
    category: 'bares',
    organization: 'casa-paineira',
    motif: 'bar',
    short: 'Cerveja fabricada no local, tábuas e petiscos de inspiração alemã.',
    description:
      'Cervejaria com fábrica à vista, estilos de inspiração alemã e cardápio de petiscos com salsichas e batatas.',
    availability: 'bar',
    attributes: {
      live_music: false,
      service_style: 'table',
      minimum_age: 18,
      price_range: 'moderado',
    },
  },
  {
    key: 'rolandia-casa-tilia',
    name: 'Casa Tília Restaurante',
    city: 'rolandia',
    district: 'Centro',
    category: 'restaurantes',
    organization: 'casa-paineira',
    motif: 'grill',
    short: 'Cozinha de família com pratos de forno e sobremesas de confeitaria.',
    description:
      'Restaurante em casa antiga com pratos de forno, joelho de porco aos domingos e sobremesas de confeitaria.',
    availability: 'lunch_dinner',
    attributes: { price_range: 'moderado', accepts_reservations: true },
  },
  {
    key: 'rolandia-espaco-memoria-colonial',
    name: 'Espaço Memória Colonial',
    city: 'rolandia',
    district: 'Centro',
    category: 'museus-e-galerias',
    organization: 'palco-norte',
    motif: 'heritage',
    short: 'Pequeno acervo sobre a colonização do norte do Paraná.',
    description:
      'Espaço de memória com fotografias, objetos do cotidiano e relatos sobre a formação das cidades do norte do Paraná.',
    availability: 'museum',
    attributes: { free_entry: true, wheelchair_accessible: false, kids_friendly: true },
  },
  {
    key: 'rolandia-recanto-das-araucarias',
    name: 'Recanto das Araucárias',
    city: 'rolandia',
    district: 'Jardim Novo Horizonte',
    category: 'parques-e-trilhas',
    organization: 'rotas-norte',
    motif: 'trail',
    short: 'Bosque de araucárias com trilha e área de piquenique.',
    description:
      'Bosque com trilha sinalizada entre araucárias, área de piquenique e parquinho para crianças.',
    availability: 'park',
    attributes: { free_entry: true, kids_friendly: true, pet_friendly: false },
  },
  // ------------------------------------------------------------------ Ibiporã
  {
    key: 'ibipora-cozinha-do-rio',
    name: 'Cozinha do Rio',
    city: 'ibipora',
    district: 'Centro',
    category: 'restaurantes',
    organization: 'casa-paineira',
    motif: 'grill',
    short: 'Peixes de rio, moquecas e almoço de domingo.',
    description:
      'Restaurante de peixes de água doce, moquecas para dividir e almoço demorado aos domingos.',
    availability: 'lunch',
    attributes: { price_range: 'moderado', pet_friendly: true },
  },
  {
    key: 'ibipora-pesqueiro-aguas-claras',
    name: 'Pesqueiro Águas Claras',
    city: 'ibipora',
    district: 'Jardim Primavera',
    category: 'turismo-rural',
    organization: 'rotas-norte',
    motif: 'lake',
    short: 'Pesca esportiva, quiosques e porções de peixe na beira do lago.',
    description:
      'Pesqueiro com lagos para pesca esportiva, quiosques com churrasqueira e porções de peixe preparadas na hora.',
    availability: 'rural',
    attributes: { price_range: 'moderado', kids_friendly: true, parking: true },
  },
  {
    key: 'ibipora-cafe-plataforma',
    name: 'Café Plataforma',
    city: 'ibipora',
    district: 'Centro',
    category: 'cafes',
    organization: 'ipe-cafes',
    motif: 'coffee',
    short: 'Café e pão na chapa perto da antiga estação.',
    description:
      'Cafeteria pequena com café coado, pão na chapa e bolos caseiros, parada de quem passa pelo centro.',
    availability: 'cafe',
    attributes: { specialty_coffee: true, service_style: 'counter', average_ticket: 25 },
  },
  {
    key: 'ibipora-pata-amiga',
    name: 'Pata Amiga Pet Ibiporã',
    city: 'ibipora',
    district: 'Vila Nova',
    category: 'pet',
    organization: 'oficina-cia',
    motif: 'pet',
    short: 'Banho e tosa com hora marcada e acessórios.',
    description:
      'Unidade do Pata Amiga com banho e tosa agendados, acessórios e rações para cães e gatos.',
    availability: 'services',
    attributes: { price_range: 'economico', delivery: false },
  },
  {
    key: 'ibipora-salao-flor-de-cerejeira',
    name: 'Salão Flor de Cerejeira',
    city: 'ibipora',
    district: 'Jardim América',
    category: 'beleza-e-bem-estar',
    organization: 'raiz-bem-estar',
    motif: 'spa',
    short: 'Cabelo, unhas e massagem relaxante com agendamento.',
    description:
      'Salão de beleza com cabelo, manicure e massagem relaxante. O atendimento é feito com hora marcada.',
    availability: 'appointment',
    attributes: { price_range: 'moderado', parking: true },
  },
  // ------------------------------------------------------------------ Cornélio Procópio
  {
    key: 'cornelio-sabor-pioneiro',
    name: 'Restaurante Sabor Pioneiro',
    city: 'cornelio-procopio',
    district: 'Centro',
    category: 'restaurantes',
    organization: 'sabores-pioneiro',
    motif: 'homestyle',
    short: 'Buffet de comida caseira e churrasco aos domingos.',
    description:
      'Restaurante de buffet com comida caseira no almoço durante a semana e churrasco aos domingos.',
    availability: 'lunch',
    attributes: { price_range: 'economico', service_style: 'counter', parking: true },
  },
  {
    key: 'cornelio-bar-trilho-velho',
    name: 'Bar Trilho Velho',
    city: 'cornelio-procopio',
    district: 'Vila Nova',
    category: 'bares',
    organization: 'sabores-pioneiro',
    motif: 'bar',
    short: 'Bar temático com petiscos e música ao vivo às sextas.',
    description:
      'Bar com decoração de antigas estações de trem, petiscos de boteco e música ao vivo nas noites de sexta.',
    availability: 'bar',
    attributes: {
      live_music: true,
      service_style: 'table',
      minimum_age: 18,
      price_range: 'economico',
    },
  },
  {
    key: 'cornelio-doceria-acucar-mascavo',
    name: 'Doceria Açúcar Mascavo',
    city: 'cornelio-procopio',
    district: 'Centro',
    category: 'docerias',
    organization: 'sabores-pioneiro',
    motif: 'sweets',
    short: 'Doces caseiros, pudim e brigadeiros gourmet.',
    description:
      'Doceria com pudim de leite, doces de compota e brigadeiros em caixas para presente.',
    availability: 'sweets',
    attributes: { price_range: 'economico', delivery: true },
  },
  {
    key: 'cornelio-sala-pioneira',
    name: 'Sala Pioneira de Cinema',
    city: 'cornelio-procopio',
    district: 'Centro',
    category: 'cinema-e-audiovisual',
    organization: 'palco-norte',
    motif: 'cinema',
    short: 'Cinema de uma sala só, com sessões de clássicos e estreias.',
    description:
      'Cinema de uma sala com programação de estreias e sessões de clássicos às quartas. Fechado temporariamente para troca do projetor.',
    availability: 'cinema',
    attributes: { wheelchair_accessible: true, kids_friendly: true },
    business_status: 'temporarily_closed',
  },
  {
    key: 'cornelio-mirante-do-pioneiro',
    name: 'Mirante do Pioneiro',
    city: 'cornelio-procopio',
    district: 'Jardim Europa',
    category: 'parques-e-trilhas',
    organization: 'rotas-norte',
    motif: 'lookout',
    short: 'Mirante aberto o tempo todo, com vista do pôr do sol sobre o vale.',
    description:
      'Mirante com deque de madeira, bancos e vista do pôr do sol sobre as plantações. Aberto todos os dias, a qualquer hora.',
    availability: 'always',
    attributes: { free_entry: true, pet_friendly: true, parking: true },
  },
  {
    key: 'cornelio-atelie-linha-agulha',
    name: 'Ateliê Linha & Agulha',
    city: 'cornelio-procopio',
    district: 'Jardim América',
    category: 'oficinas-criativas',
    organization: 'oficina-cia',
    motif: 'sewing',
    short: 'Costura criativa, bordado livre e ajustes de roupa.',
    description:
      'Ateliê com oficinas de bordado livre e costura criativa, além de ajustes e reformas de roupa com hora marcada.',
    availability: 'appointment',
    attributes: { price_range: 'economico', kids_friendly: false },
  },
  // ------------------------------------------------------------------ Bandeirantes
  {
    key: 'bandeirantes-cantina-bandeirante',
    name: 'Cantina Bandeirante',
    city: 'bandeirantes',
    district: 'Centro',
    category: 'restaurantes',
    organization: 'sabores-pioneiro',
    motif: 'pasta',
    short: 'Massas, frango assado e almoço de domingo em família.',
    description:
      'Cantina simples com massas da casa, frango assado aos domingos e pudim de sobremesa.',
    availability: 'lunch_dinner',
    attributes: { price_range: 'economico', accepts_reservations: false },
  },
  {
    key: 'bandeirantes-cafe-estacao-norte',
    name: 'Café Estação Norte',
    city: 'bandeirantes',
    district: 'Vila Maria',
    category: 'cafes',
    organization: 'sabores-pioneiro',
    motif: 'coffee',
    short: 'Café da região, pão de queijo e bolos de fubá.',
    description:
      'Cafeteria com cafés de produtores do Norte Pioneiro, pão de queijo e bolos de fubá saídos do forno.',
    availability: 'cafe',
    attributes: { specialty_coffee: true, service_style: 'counter', average_ticket: 22 },
  },
  {
    key: 'bandeirantes-fazenda-recanto-pioneiro',
    name: 'Fazenda Recanto Pioneiro',
    city: 'bandeirantes',
    district: 'Jardim Europa',
    category: 'turismo-rural',
    organization: 'rotas-norte',
    motif: 'farm',
    short: 'Dia de campo com trator, ordenha e almoço de fazenda.',
    description:
      'Fazenda aberta para visitas com passeio de trator, ordenha pela manhã e almoço de fogão a lenha aos fins de semana.',
    availability: 'rural',
    attributes: { price_range: 'moderado', kids_friendly: true, parking: true },
  },
  {
    key: 'bandeirantes-floricultura-sempre-viva',
    name: 'Floricultura Sempre-Viva',
    city: 'bandeirantes',
    district: 'Centro',
    category: 'floriculturas',
    organization: 'oficina-cia',
    motif: 'flowers',
    short: 'Buquês, coroas e plantas ornamentais.',
    description: 'Floricultura de bairro com buquês, plantas ornamentais e arranjos para eventos.',
    availability: 'shop',
    attributes: { delivery: true, parking: false },
    website: false,
  },
]
