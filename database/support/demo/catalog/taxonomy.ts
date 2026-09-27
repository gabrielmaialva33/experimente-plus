import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'

/**
 * The discovery taxonomy of the demo: five families covering gastronomy,
 * culture, leisure outdoors, well-being and local services. The first three
 * families and their original categories keep the slugs the development seed
 * always had, so existing databases converge instead of duplicating.
 */

export interface DemoFamily {
  slug: string
  name: string
  description: string
  icon: string
  sort_order: number
}

export interface DemoCategory {
  slug: string
  name: string
  family_slug: string
  description: string
  icon: string
  sort_order: number
  allows_always_open?: boolean
}

export interface DemoAttributeOption {
  value: string
  label: string
}

export interface DemoAttribute {
  key: string
  name: string
  description: string
  data_type: IEstablishment.AttributeDataType
  is_required?: boolean
  is_filterable?: boolean
  validation_rules?: Record<string, unknown>
  options?: DemoAttributeOption[]
}

export const DEMO_FAMILIES: DemoFamily[] = [
  {
    slug: 'comer-e-beber',
    name: 'Comer & Beber',
    description: 'Restaurantes, cafés, bares, padarias e outras experiências gastronômicas.',
    icon: 'utensils',
    sort_order: 0,
  },
  {
    slug: 'cultura-e-lazer',
    name: 'Cultura & Lazer',
    description: 'Cinema, eventos, arte e experiências culturais para aproveitar a cidade.',
    icon: 'ticket',
    sort_order: 10,
  },
  {
    slug: 'ar-livre-e-esportes',
    name: 'Ar livre & Esportes',
    description: 'Parques, trilhas, turismo rural e aventura perto da cidade.',
    icon: 'trees',
    sort_order: 15,
  },
  {
    slug: 'bem-estar-e-estilo',
    name: 'Bem-estar & Estilo',
    description: 'Cuidados pessoais, beleza, tatuagem e experiências de bem-estar.',
    icon: 'sparkles',
    sort_order: 20,
  },
  {
    slug: 'servicos-locais',
    name: 'Serviços locais',
    description: 'Negócios de bairro: flores, pets, bicicletas, ateliês e oficinas criativas.',
    icon: 'store',
    sort_order: 30,
  },
]

export const DEMO_CATEGORIES: DemoCategory[] = [
  // Comer & Beber
  {
    slug: 'restaurantes',
    name: 'Restaurantes',
    family_slug: 'comer-e-beber',
    description: 'Casas com serviço de refeições e experiências completas à mesa.',
    icon: 'utensils',
    sort_order: 0,
  },
  {
    slug: 'bares',
    name: 'Bares',
    family_slug: 'comer-e-beber',
    description: 'Bares, gastrobares, petiscos e programação noturna.',
    icon: 'glass-water',
    sort_order: 10,
  },
  {
    slug: 'cafes',
    name: 'Cafés',
    family_slug: 'comer-e-beber',
    description: 'Cafeterias, cafés especiais, brunch e encontros durante o dia.',
    icon: 'coffee',
    sort_order: 20,
  },
  {
    slug: 'padarias',
    name: 'Padarias',
    family_slug: 'comer-e-beber',
    description: 'Panificação, confeitaria, café da manhã e produtos artesanais.',
    icon: 'croissant',
    sort_order: 30,
  },
  {
    slug: 'docerias',
    name: 'Docerias',
    family_slug: 'comer-e-beber',
    description: 'Doces, sobremesas, bolos e presentes gastronômicos.',
    icon: 'cake-slice',
    sort_order: 40,
  },
  {
    slug: 'hamburguerias',
    name: 'Hamburguerias',
    family_slug: 'comer-e-beber',
    description: 'Hambúrgueres artesanais, acompanhamentos e menus descontraídos.',
    icon: 'sandwich',
    sort_order: 50,
  },
  {
    slug: 'pizzarias',
    name: 'Pizzarias',
    family_slug: 'comer-e-beber',
    description: 'Pizzas artesanais, tradicionais e contemporâneas.',
    icon: 'pizza',
    sort_order: 60,
  },
  {
    slug: 'cozinha-japonesa',
    name: 'Cozinha japonesa',
    family_slug: 'comer-e-beber',
    description: 'Sushi, pratos quentes e experiências inspiradas na culinária japonesa.',
    icon: 'fish',
    sort_order: 70,
  },
  {
    slug: 'sorveterias',
    name: 'Sorveterias',
    family_slug: 'comer-e-beber',
    description: 'Sorvetes, gelatos, picolés de fruta e sobremesas geladas.',
    icon: 'ice-cream-cone',
    sort_order: 80,
  },
  {
    slug: 'emporios',
    name: 'Empórios & mercearias',
    family_slug: 'comer-e-beber',
    description: 'Queijos, vinhos, geleias e produtos de pequenos produtores.',
    icon: 'shopping-basket',
    sort_order: 90,
  },
  // Cultura & Lazer
  {
    slug: 'cinema-e-audiovisual',
    name: 'Cinema & Audiovisual',
    family_slug: 'cultura-e-lazer',
    description: 'Salas, cineclubes, mostras e experiências audiovisuais.',
    icon: 'clapperboard',
    sort_order: 0,
  },
  {
    slug: 'cultura-e-eventos',
    name: 'Cultura & Eventos',
    family_slug: 'cultura-e-lazer',
    description: 'Casas culturais, oficinas, exposições, música e eventos independentes.',
    icon: 'music',
    sort_order: 10,
  },
  {
    slug: 'museus-e-galerias',
    name: 'Museus & galerias',
    family_slug: 'cultura-e-lazer',
    description: 'Acervos, exposições, memória regional e arte contemporânea.',
    icon: 'landmark',
    sort_order: 20,
  },
  {
    slug: 'livrarias',
    name: 'Livrarias & sebos',
    family_slug: 'cultura-e-lazer',
    description: 'Livros novos e usados, clubes de leitura e lançamentos.',
    icon: 'book-open',
    sort_order: 30,
  },
  {
    slug: 'entretenimento',
    name: 'Entretenimento',
    family_slug: 'cultura-e-lazer',
    description: 'Boliche, jogos e diversão em grupo.',
    icon: 'gamepad-2',
    sort_order: 40,
  },
  // Ar livre & Esportes
  {
    slug: 'parques-e-trilhas',
    name: 'Parques & trilhas',
    family_slug: 'ar-livre-e-esportes',
    description: 'Áreas verdes, mirantes, caminhadas e observação da natureza.',
    icon: 'trees',
    sort_order: 0,
    allows_always_open: true,
  },
  {
    slug: 'esportes-e-aventura',
    name: 'Esportes & aventura',
    family_slug: 'ar-livre-e-esportes',
    description: 'Trilhas guiadas, rapel, pedal e atividades ao ar livre.',
    icon: 'mountain',
    sort_order: 10,
  },
  {
    slug: 'turismo-rural',
    name: 'Turismo rural',
    family_slug: 'ar-livre-e-esportes',
    description: 'Sítios, fazendas, pesqueiros e colhe-e-pague perto da cidade.',
    icon: 'tractor',
    sort_order: 20,
  },
  // Bem-estar & Estilo
  {
    slug: 'estudios-de-tatuagem',
    name: 'Estúdios de tatuagem',
    family_slug: 'bem-estar-e-estilo',
    description: 'Estúdios, artistas e experiências de arte corporal com atendimento agendado.',
    icon: 'pen-tool',
    sort_order: 0,
  },
  {
    slug: 'beleza-e-bem-estar',
    name: 'Beleza & Bem-estar',
    family_slug: 'bem-estar-e-estilo',
    description: 'Autocuidado, terapias, beleza e experiências para desacelerar.',
    icon: 'flower-2',
    sort_order: 10,
  },
  {
    slug: 'yoga-e-pilates',
    name: 'Yoga & Pilates',
    family_slug: 'bem-estar-e-estilo',
    description: 'Aulas, estúdios e práticas de movimento e respiração.',
    icon: 'person-standing',
    sort_order: 20,
  },
  {
    slug: 'barbearias',
    name: 'Barbearias',
    family_slug: 'bem-estar-e-estilo',
    description: 'Corte, barba e cuidados masculinos.',
    icon: 'scissors',
    sort_order: 30,
  },
  // Serviços locais
  {
    slug: 'floriculturas',
    name: 'Floriculturas',
    family_slug: 'servicos-locais',
    description: 'Flores, arranjos, plantas e presentes.',
    icon: 'flower',
    sort_order: 0,
  },
  {
    slug: 'pet',
    name: 'Pet: banho & cuidados',
    family_slug: 'servicos-locais',
    description: 'Banho, tosa, acessórios e cuidados para animais de estimação.',
    icon: 'paw-print',
    sort_order: 10,
  },
  {
    slug: 'bicicletarias',
    name: 'Bicicletarias',
    family_slug: 'servicos-locais',
    description: 'Manutenção, peças e acessórios para quem pedala.',
    icon: 'bike',
    sort_order: 20,
  },
  {
    slug: 'oficinas-criativas',
    name: 'Ateliês & oficinas',
    family_slug: 'servicos-locais',
    description: 'Cerâmica, costura, bordado e cursos livres com as mãos.',
    icon: 'palette',
    sort_order: 30,
  },
]

const PRICE_RANGE: DemoAttribute = {
  key: 'price_range',
  name: 'Faixa de preço',
  description: 'Gasto médio por pessoa.',
  data_type: 'single_select',
  is_filterable: true,
  options: [
    { value: 'economico', label: 'Econômico (até R$ 40)' },
    { value: 'moderado', label: 'Moderado (R$ 40 a R$ 90)' },
    { value: 'especial', label: 'Especial (acima de R$ 90)' },
  ],
}

const SERVICE_STYLE = (required: boolean, order: DemoAttributeOption[]): DemoAttribute => ({
  key: 'service_style',
  name: 'Estilo de atendimento',
  description: 'Principal formato de atendimento da unidade.',
  data_type: 'single_select',
  is_required: required,
  is_filterable: true,
  options: order,
})

const COUNTER = { label: 'No balcão', value: 'counter' }
const TABLE = { label: 'À mesa', value: 'table' }
const TAKEAWAY = { label: 'Retirada', value: 'takeaway' }

const boolean = (key: string, name: string, description: string): DemoAttribute => ({
  key,
  name,
  description,
  data_type: 'boolean',
  is_filterable: true,
})

const RESERVATIONS = boolean(
  'accepts_reservations',
  'Aceita reservas',
  'Reservas de mesa ou horário.'
)
const VEGETARIAN = boolean(
  'vegetarian_options',
  'Opções vegetarianas',
  'Pratos sem carne no cardápio.'
)
const PET_FRIENDLY = boolean('pet_friendly', 'Aceita pets', 'Animais de estimação são bem-vindos.')
const ACCESSIBLE = boolean(
  'wheelchair_accessible',
  'Acessível para cadeira de rodas',
  'Entrada e circulação sem degraus.'
)
const FREE_ENTRY = boolean('free_entry', 'Entrada gratuita', 'Acesso sem cobrança de ingresso.')
const KIDS = boolean(
  'kids_friendly',
  'Bom para crianças',
  'Programação ou espaço pensado para crianças.'
)
const PARKING = boolean('parking', 'Estacionamento', 'Vagas próprias ou conveniadas.')
const DELIVERY = boolean('delivery', 'Faz entrega', 'Entrega em domicílio na cidade.')

/**
 * Attribute definitions per category. The café, bar and bakery definitions are
 * the ones the development seed has always created, with the same keys and
 * required flags, so the two paths describe one form.
 */
export const DEMO_ATTRIBUTES: Record<string, DemoAttribute[]> = {
  'restaurantes': [
    PRICE_RANGE,
    SERVICE_STYLE(false, [TABLE, COUNTER, TAKEAWAY]),
    RESERVATIONS,
    VEGETARIAN,
    PET_FRIENDLY,
  ],
  'bares': [
    {
      key: 'live_music',
      name: 'Música ao vivo',
      description: 'Informa se a unidade possui programação de música ao vivo.',
      data_type: 'boolean',
      is_required: true,
      is_filterable: true,
    },
    SERVICE_STYLE(true, [TABLE, COUNTER, TAKEAWAY]),
    {
      key: 'minimum_age',
      name: 'Idade mínima',
      description: 'Idade mínima informada para eventos noturnos.',
      data_type: 'integer',
      validation_rules: { minimum: 0, maximum: 18 },
    },
    PRICE_RANGE,
    PET_FRIENDLY,
  ],
  'cafes': [
    {
      key: 'specialty_coffee',
      name: 'Café especial',
      description: 'Informa se o estabelecimento trabalha com cafés especiais.',
      data_type: 'boolean',
      is_required: true,
      is_filterable: true,
    },
    SERVICE_STYLE(true, [COUNTER, TABLE, TAKEAWAY]),
    {
      key: 'average_ticket',
      name: 'Ticket médio',
      description: 'Valor médio por pessoa, em reais.',
      data_type: 'decimal',
      validation_rules: { minimum: 0, maximum: 500 },
    },
    VEGETARIAN,
    PET_FRIENDLY,
  ],
  'padarias': [
    {
      key: 'breakfast',
      name: 'Café da manhã',
      description: 'Informa se a unidade oferece café da manhã completo.',
      data_type: 'boolean',
      is_required: true,
      is_filterable: true,
    },
    SERVICE_STYLE(true, [COUNTER, TABLE, TAKEAWAY]),
    {
      key: 'menu_url',
      name: 'Cardápio digital',
      description: 'Endereço público do cardápio da unidade.',
      data_type: 'url',
    },
    DELIVERY,
  ],
  'docerias': [PRICE_RANGE, SERVICE_STYLE(false, [COUNTER, TABLE, TAKEAWAY]), DELIVERY, VEGETARIAN],
  'hamburguerias': [
    PRICE_RANGE,
    SERVICE_STYLE(false, [TABLE, COUNTER, TAKEAWAY]),
    VEGETARIAN,
    DELIVERY,
  ],
  'pizzarias': [
    PRICE_RANGE,
    SERVICE_STYLE(false, [TABLE, COUNTER, TAKEAWAY]),
    RESERVATIONS,
    DELIVERY,
    VEGETARIAN,
  ],
  'cozinha-japonesa': [
    PRICE_RANGE,
    SERVICE_STYLE(false, [TABLE, COUNTER, TAKEAWAY]),
    RESERVATIONS,
    DELIVERY,
  ],
  'sorveterias': [PRICE_RANGE, VEGETARIAN, PET_FRIENDLY],
  'emporios': [PRICE_RANGE, DELIVERY, PARKING],
  'cinema-e-audiovisual': [FREE_ENTRY, ACCESSIBLE, KIDS],
  'cultura-e-eventos': [FREE_ENTRY, ACCESSIBLE, KIDS],
  'museus-e-galerias': [FREE_ENTRY, ACCESSIBLE, KIDS],
  'livrarias': [ACCESSIBLE, KIDS, DELIVERY],
  'entretenimento': [PRICE_RANGE, KIDS, PARKING, ACCESSIBLE],
  'parques-e-trilhas': [FREE_ENTRY, KIDS, PET_FRIENDLY, PARKING],
  'esportes-e-aventura': [PRICE_RANGE, KIDS, PARKING],
  'turismo-rural': [PRICE_RANGE, KIDS, PET_FRIENDLY, PARKING],
  'estudios-de-tatuagem': [PRICE_RANGE, ACCESSIBLE],
  'beleza-e-bem-estar': [PRICE_RANGE, ACCESSIBLE, PARKING],
  'yoga-e-pilates': [PRICE_RANGE, ACCESSIBLE, PARKING],
  'barbearias': [PRICE_RANGE, RESERVATIONS, ACCESSIBLE],
  'floriculturas': [DELIVERY, PARKING],
  'pet': [PRICE_RANGE, DELIVERY, PARKING],
  'bicicletarias': [PRICE_RANGE, DELIVERY, PARKING],
  'oficinas-criativas': [PRICE_RANGE, KIDS, ACCESSIBLE],
}
