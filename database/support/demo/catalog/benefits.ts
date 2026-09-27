import type IBenefit from '#modules/benefits/interfaces/benefit_interface'

/**
 * City packages ("passaportes") and their offers. A package is sold as a whole;
 * offers with a `standalone_price_cents` can also be bought one by one — the
 * vouchers of the storefront. Conditions follow what a real partner would set:
 * weekdays, a daily window, minimum party size, reservation. Everything is
 * fictitious and says so in its terms; payments stay in the sandbox adapter.
 */

export interface DemoOffer {
  place: string
  title: string
  description: string
  benefit_type: IBenefit.Type
  discount_percentage?: number
  discount_amount_cents?: number
  terms: string
  /** Bit per weekday, Sunday = 1, Monday = 2 … Saturday = 64. */
  weekdays?: number
  daily_window?: readonly [string, string]
  minimum_party_size?: number
  reservation_required?: boolean
  max_redemptions_per_access?: number
  standalone_price_cents?: number
}

export interface DemoEdition {
  slug: string
  city: string
  name: string
  description: string
  price_cents: number
  offers: DemoOffer[]
}

export const DEMO_OFFER_TERMS_NOTICE =
  'Oferta fictícia de demonstração: nenhum estabelecimento real está vinculado e nenhuma cobrança real é feita.'

const SUN = 1
const MON = 2
const TUE = 4
const WED = 8
const THU = 16
const FRI = 32
const SAT = 64
const ALL = 127

export const DEMO_EDITIONS: DemoEdition[] = [
  {
    slug: 'passaporte-londrina-demo',
    city: 'londrina',
    name: 'Passaporte Experimente Londrina — demonstração',
    description:
      'Pacote fictício com benefícios em restaurantes, cafés, cultura e bem-estar de Londrina, válido por dez meses. Demonstração sem cobrança real.',
    price_cents: 5990,
    offers: [
      {
        place: 'londrina-cantina-vale-verde',
        title: 'Segundo prato de massa por conta da casa',
        description:
          'Na compra de um prato de massa, o segundo de valor igual ou menor sai como benefício.',
        benefit_type: 'buy_one_get_one',
        terms:
          'Válido no jantar, de terça a quinta, para consumo no local. Não cumulativo com outras promoções.',
        weekdays: TUE | WED | THU,
        daily_window: ['18:30', '22:30'],
        minimum_party_size: 2,
        standalone_price_cents: 1990,
      },
      {
        place: 'londrina-brasa-paineira',
        title: '20% no menu executivo',
        description: 'Desconto de 20% no menu executivo do almoço.',
        benefit_type: 'percentage',
        discount_percentage: 20,
        terms: 'Válido de terça a sexta, no almoço, para até quatro pessoas da mesma mesa.',
        weekdays: TUE | WED | THU | FRI,
        daily_window: ['11:30', '15:00'],
      },
      {
        place: 'londrina-balcao-pe-vermelho',
        title: 'Porção de mandioca de cortesia',
        description: 'Uma porção de mandioca frita na compra de dois chopes.',
        benefit_type: 'complimentary_item',
        terms:
          'Válido para consumo no local. Proibida a venda de bebidas alcoólicas para menores de 18 anos.',
        weekdays: TUE | WED | THU | FRI,
        standalone_price_cents: 990,
      },
      {
        place: 'londrina-ipe-cafe',
        title: 'Café coado de cortesia',
        description: 'O café coado da semana na compra de qualquer item da confeitaria.',
        benefit_type: 'complimentary_item',
        terms: 'Válido uma vez por acesso, sujeito à disponibilidade do grão da semana.',
        max_redemptions_per_access: 2,
      },
      {
        place: 'londrina-doce-figueira',
        title: 'R$ 10 de desconto em bolos inteiros',
        description: 'Desconto de R$ 10 em bolos inteiros acima de R$ 60.',
        benefit_type: 'fixed_amount',
        discount_amount_cents: 1000,
        terms: 'Encomendas com 48 horas de antecedência. Não vale para doces finos.',
      },
      {
        place: 'londrina-massa-madre-pizzaria',
        title: 'Pizza média em dobro às terças',
        description: 'Na compra de uma pizza média, a segunda sai como benefício.',
        benefit_type: 'buy_one_get_one',
        terms: 'Válido às terças, no salão. A segunda pizza deve ter valor igual ou menor.',
        weekdays: TUE,
        standalone_price_cents: 2490,
      },
      {
        place: 'londrina-kaiten-norte',
        title: '15% nos combinados',
        description: 'Desconto de 15% em qualquer combinado do cardápio.',
        benefit_type: 'percentage',
        discount_percentage: 15,
        terms: 'Válido no almoço de terça a sexta. Não vale para delivery.',
        weekdays: TUE | WED | THU | FRI,
        daily_window: ['11:30', '15:00'],
      },
      {
        place: 'londrina-cineclube-lanterna',
        title: 'Pipoca de cortesia na sessão',
        description: 'Uma pipoca média para acompanhar qualquer sessão.',
        benefit_type: 'complimentary_item',
        terms: 'Válido de quarta a domingo, mediante apresentação do ingresso.',
        weekdays: WED | THU | FRI | SAT | SUN,
      },
      {
        place: 'londrina-atelie-barro-fogo',
        title: '25% na primeira oficina de cerâmica',
        description: 'Desconto de 25% na primeira oficina de torno ou modelagem.',
        benefit_type: 'percentage',
        discount_percentage: 25,
        terms: 'Vagas limitadas; reserve com antecedência pelo canal do ateliê.',
        reservation_required: true,
        standalone_price_cents: 2990,
      },
      {
        place: 'londrina-respiro-yoga',
        title: 'Aula experimental sem custo',
        description: 'Uma aula experimental de yoga em qualquer turma com vaga.',
        benefit_type: 'complimentary_item',
        terms: 'Mediante reserva prévia. Válido para quem ainda não é aluno do estúdio.',
        reservation_required: true,
      },
    ],
  },
  {
    slug: 'passaporte-maringa-demo',
    city: 'maringa',
    name: 'Passaporte Experimente Maringá — demonstração',
    description:
      'Pacote fictício com benefícios em gastronomia, cultura e bem-estar de Maringá, válido por dez meses. Demonstração sem cobrança real.',
    price_cents: 5490,
    offers: [
      {
        place: 'maringa-terra-roxa-cozinha',
        title: '15% no almoço',
        description: 'Desconto de 15% no buffet ou no prato do dia.',
        benefit_type: 'percentage',
        discount_percentage: 15,
        terms: 'Válido de segunda a sexta. Não cumulativo com outras promoções.',
        weekdays: MON | TUE | WED | THU | FRI,
      },
      {
        place: 'maringa-bistro-cancao',
        title: 'Sobremesa da casa de cortesia',
        description: 'Uma sobremesa da casa para cada dois pratos principais.',
        benefit_type: 'complimentary_item',
        terms: 'Mediante reserva, para mesas a partir de duas pessoas.',
        reservation_required: true,
        minimum_party_size: 2,
        standalone_price_cents: 1590,
      },
      {
        place: 'maringa-chopp-e-prosa',
        title: 'Chope em dobro na quinta',
        description: 'Peça um chope e receba outro do mesmo estilo.',
        benefit_type: 'buy_one_get_one',
        terms: 'Válido às quintas até as 21h. Proibida a venda para menores de 18 anos.',
        weekdays: THU,
        daily_window: ['17:00', '21:00'],
      },
      {
        place: 'maringa-ipe-cafe',
        title: 'Café coado de cortesia',
        description: 'O café coado da semana na compra de qualquer item do brunch.',
        benefit_type: 'complimentary_item',
        terms: 'Válido uma vez por acesso, sujeito à disponibilidade.',
      },
      {
        place: 'maringa-flor-de-laranjeira',
        title: 'R$ 8 de desconto no café da tarde',
        description: 'Desconto de R$ 8 em pedidos a partir de R$ 40 no salão.',
        benefit_type: 'fixed_amount',
        discount_amount_cents: 800,
        terms: 'Válido de terça a sexta, das 14h às 18h.',
        weekdays: TUE | WED | THU | FRI,
        daily_window: ['14:00', '18:00'],
      },
      {
        place: 'maringa-hamburguer-do-bosque',
        title: 'Hambúrguer em dobro',
        description:
          'Na compra de um hambúrguer, o segundo de valor igual ou menor sai como benefício.',
        benefit_type: 'buy_one_get_one',
        terms: 'Válido de terça a quinta, para consumo no local.',
        weekdays: TUE | WED | THU,
        standalone_price_cents: 1790,
      },
      {
        place: 'maringa-sushi-hanami',
        title: '20% nos temakis',
        description: 'Desconto de 20% em qualquer temaki.',
        benefit_type: 'percentage',
        discount_percentage: 20,
        terms: 'Válido todos os dias no salão.',
        weekdays: ALL,
      },
      {
        place: 'maringa-cine-varanda',
        title: 'Pipoca de cortesia',
        description: 'Uma pipoca média para acompanhar a sessão.',
        benefit_type: 'complimentary_item',
        terms: 'Mediante apresentação do ingresso.',
      },
      {
        place: 'maringa-espaco-lavanda',
        title: '15% na massagem relaxante',
        description: 'Desconto de 15% na massagem relaxante de sessenta minutos.',
        benefit_type: 'percentage',
        discount_percentage: 15,
        terms: 'Mediante agendamento com 24 horas de antecedência.',
        reservation_required: true,
        standalone_price_cents: 3990,
      },
      {
        place: 'maringa-emporio-colheita',
        title: 'R$ 15 de desconto em cestas',
        description: 'Desconto de R$ 15 em cestas a partir de R$ 100.',
        benefit_type: 'fixed_amount',
        discount_amount_cents: 1500,
        terms: 'Válido para compras na loja. Não vale para vinhos importados.',
      },
    ],
  },
  {
    slug: 'passaporte-apucarana-demo',
    city: 'apucarana',
    name: 'Passaporte Experimente Apucarana — demonstração',
    description:
      'Pacote fictício com benefícios em cafés, bares e aventura em Apucarana. Demonstração sem cobrança real.',
    price_cents: 3990,
    offers: [
      {
        place: 'apucarana-ipe-cafe',
        title: 'Pão de queijo de cortesia',
        description: 'Um pão de queijo na compra de qualquer café.',
        benefit_type: 'complimentary_item',
        terms: 'Válido uma vez por acesso.',
      },
      {
        place: 'apucarana-cantina-serra-azul',
        title: '10% no almoço de domingo',
        description: 'Desconto de 10% na conta do almoço de domingo.',
        benefit_type: 'percentage',
        discount_percentage: 10,
        terms: 'Válido aos domingos, para mesas de até seis pessoas.',
        weekdays: SUN,
      },
      {
        place: 'apucarana-bar-mirante-do-vale',
        title: 'Caipirinha em dobro no pôr do sol',
        description: 'Peça uma caipirinha e receba outra igual.',
        benefit_type: 'buy_one_get_one',
        terms: 'Válido das 17h às 19h. Proibida a venda para menores de 18 anos.',
        daily_window: ['17:00', '19:00'],
        standalone_price_cents: 1290,
      },
      {
        place: 'apucarana-hamburguer-morro-alto',
        title: 'Milk-shake de cortesia',
        description: 'Um milk-shake pequeno na compra de um combo.',
        benefit_type: 'complimentary_item',
        terms: 'Válido de terça a quinta.',
        weekdays: TUE | WED | THU,
      },
      {
        place: 'apucarana-trilha-serra-do-vale',
        title: '10% no rapel com trilha',
        description: 'Desconto de 10% na saída de rapel com trilha guiada.',
        benefit_type: 'percentage',
        discount_percentage: 10,
        terms: 'Mediante reserva; sujeito às condições do tempo.',
        reservation_required: true,
      },
    ],
  },
]
