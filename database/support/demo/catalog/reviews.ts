import { seededRandom } from '#database/support/demo/illustration/palette'
import type { DemoMotif } from '#database/support/demo/illustration/scenes'
import { DEMO_CONSUMERS, type DemoPerson } from '#database/support/demo/catalog/people'
import type { DemoPlace } from '#database/support/demo/catalog/places'

/**
 * Reviews written by the fictitious consumers, and the replies of the places.
 *
 * Texts are composed from small pools per kind of place and per rating, so a
 * place reads like a place and a two-star review sounds like one. They avoid
 * everything the automatic moderation looks for — links, handles, contacts,
 * payment data — because a demo review held by a rule would only show the
 * rule working, not the product.
 */

type Tone = 'food' | 'bar' | 'cafe' | 'culture' | 'outdoor' | 'wellness' | 'services'

const TONE_BY_CATEGORY: Record<string, Tone> = {
  'restaurantes': 'food',
  'hamburguerias': 'food',
  'pizzarias': 'food',
  'cozinha-japonesa': 'food',
  'bares': 'bar',
  'cafes': 'cafe',
  'padarias': 'cafe',
  'docerias': 'cafe',
  'sorveterias': 'cafe',
  'emporios': 'cafe',
  'cinema-e-audiovisual': 'culture',
  'cultura-e-eventos': 'culture',
  'museus-e-galerias': 'culture',
  'livrarias': 'culture',
  'entretenimento': 'culture',
  'parques-e-trilhas': 'outdoor',
  'esportes-e-aventura': 'outdoor',
  'turismo-rural': 'outdoor',
  'estudios-de-tatuagem': 'wellness',
  'beleza-e-bem-estar': 'wellness',
  'yoga-e-pilates': 'wellness',
  'barbearias': 'wellness',
  'floriculturas': 'services',
  'pet': 'services',
  'bicicletarias': 'services',
  'oficinas-criativas': 'services',
}

const OPENINGS: Record<Tone, Record<5 | 4 | 3 | 2, string[]>> = {
  food: {
    5: [
      'Comida muito bem feita, com tempero de casa e porção honesta.',
      'Um dos melhores almoços que fiz na cidade este ano.',
      'Tudo chegou quente e no ponto, e o atendimento foi atencioso do começo ao fim.',
      'Fomos em família e todo mundo saiu satisfeito, das crianças aos avós.',
      'Sabor impecável e ambiente agradável para conversar sem pressa.',
      'Pedi a sugestão do garçom e acertou em cheio.',
    ],
    4: [
      'Comida gostosa e bem servida, só demorou um pouco no horário de pico.',
      'Gostei bastante do prato principal; a sobremesa podia ser mais caprichada.',
      'Lugar confortável e comida boa, preço justo para o que entrega.',
      'Atendimento simpático e cardápio variado, voltaria para provar outras opções.',
      'Bom custo-benefício no almoço durante a semana.',
    ],
    3: [
      'A comida é boa, mas o salão estava barulhento e a espera foi longa.',
      'Prato correto, nada que surpreenda. Atendimento um pouco confuso.',
      'Gostei do tempero, mas a porção veio menor do que esperava.',
      'Experiência mediana: algumas coisas muito boas, outras esquecíveis.',
    ],
    2: [
      'Esperamos quase uma hora e o prato chegou morno.',
      'Esperava mais pelo preço; o ponto da carne veio diferente do pedido.',
      'Atendimento desatento no dia em que fui, precisei chamar várias vezes.',
    ],
  },
  bar: {
    5: [
      'Chope gelado, petiscos caprichados e um clima ótimo para encontrar os amigos.',
      'Melhor lugar para terminar a semana, com música boa e atendimento rápido.',
      'As porções são generosas e saem rápido mesmo com a casa cheia.',
      'Ambiente animado sem ser apertado, fomos bem recebidos.',
      'Ótima seleção de cervejas locais e equipe que conhece o que serve.',
    ],
    4: [
      'Bom bar, só achei a música um pouco alta para conversar.',
      'Petiscos gostosos e preço justo; lotado no sábado, vale chegar cedo.',
      'Gostei das cervejas, o atendimento podia ser mais ágil.',
      'Lugar agradável, mesas na calçada são a melhor pedida.',
    ],
    3: [
      'Legal para ir com a turma, mas a espera pelos pedidos foi longa.',
      'Chope bom, porções só medianas.',
      'Bom ambiente, mas faltou variedade no cardápio de petiscos.',
    ],
    2: [
      'Muito cheio e desorganizado, a conta veio errada duas vezes.',
      'Demora grande para ser atendido e petisco frio.',
    ],
  },
  cafe: {
    5: [
      'Café excelente e confeitaria caprichada, virou parada obrigatória.',
      'Atendimento carinhoso e tudo fresquinho, dá vontade de ficar a tarde toda.',
      'O pão estava crocante por fora e macio por dentro, perfeito.',
      'Ambiente aconchegante, bom para ler ou trabalhar um pouco.',
      'Doces delicados e bem feitos, sem exagero no açúcar.',
      'Fui pelo café e voltei pelo bolo da casa.',
    ],
    4: [
      'Tudo muito gostoso, só achei os preços um pouco altos.',
      'Café bom e ambiente tranquilo; nos fins de semana fica cheio.',
      'Gostei bastante, mas algumas opções da vitrine já tinham acabado à tarde.',
      'Atendimento rápido e produtos frescos.',
    ],
    3: [
      'Café correto, mas o salão estava abafado.',
      'Bom para uma parada rápida, nada muito especial.',
      'Gostei do bolo, o café veio frio.',
    ],
    2: [
      'Fila longa e atendimento desatento.',
      'Produto do dia anterior na vitrine, esperava mais cuidado.',
    ],
  },
  culture: {
    5: [
      'Programação cuidadosa e equipe muito receptiva.',
      'Saí com vontade de voltar na próxima semana, que lugar bom para a cidade.',
      'Espaço acolhedor e bem cuidado, ótima curadoria.',
      'Levei as crianças e todos se divertiram.',
      'Experiência muito bem organizada, começou no horário e com boa estrutura.',
    ],
    4: [
      'Gostei muito da programação; as cadeiras podiam ser mais confortáveis.',
      'Bom espaço cultural, falta só um pouco mais de divulgação.',
      'Equipe atenciosa e ambiente agradável.',
      'Vale a visita, principalmente nos dias de evento.',
    ],
    3: [
      'Interessante, mas o espaço é pequeno para a procura.',
      'Boa proposta, a organização da fila precisa melhorar.',
      'Gostei, mas esperava uma programação mais variada.',
    ],
    2: [
      'Atrasou muito para começar e ninguém avisou o motivo.',
      'Som ruim no dia em que fui, difícil de acompanhar.',
    ],
  },
  outdoor: {
    5: [
      'Lugar lindo e bem cuidado, ótimo para passar a manhã.',
      'Passeio tranquilo, com sombra e boa sinalização.',
      'Os guias são atenciosos e explicam tudo com calma.',
      'Programa perfeito para a família no fim de semana.',
      'Vista incrível no fim da tarde, recomendo levar água e boné.',
    ],
    4: [
      'Muito bonito, só faltam mais banheiros.',
      'Bom passeio, mas o acesso é de terra e fica ruim na chuva.',
      'Gostei bastante, vale ir cedo para evitar o sol forte.',
      'Estrutura simples e agradável, bom para desligar da cidade.',
    ],
    3: [
      'Bonito, mas estava lotado no domingo.',
      'Faltou manutenção em alguns trechos.',
      'Legal, mas esperava mais atividades para as crianças.',
    ],
    2: [
      'Estava fechado no horário informado quando fui.',
      'Pouca estrutura e sinalização confusa.',
    ],
  },
  wellness: {
    5: [
      'Atendimento cuidadoso e profissional, saí renovada.',
      'Ambiente limpo, calmo e pontual no horário marcado.',
      'Profissionais atenciosos que explicam cada etapa.',
      'Excelente experiência do agendamento ao final.',
      'Resultado exatamente como combinamos, recomendo.',
    ],
    4: [
      'Muito bom, só é difícil conseguir horário nos fins de semana.',
      'Gostei do atendimento, o espaço é um pouco pequeno.',
      'Profissionais competentes e preço justo.',
      'Ambiente agradável e atendimento pontual.',
    ],
    3: [
      'Bom serviço, mas atrasou meia hora para começar.',
      'Gostei do resultado, o atendimento podia ser mais caloroso.',
      'Correto, nada além do esperado.',
    ],
    2: ['Remarcaram meu horário em cima da hora.', 'Esperei muito e o atendimento foi apressado.'],
  },
  services: {
    5: [
      'Serviço caprichado e entregue no prazo combinado.',
      'Atendimento de bairro, daqueles em que conhecem o cliente pelo nome.',
      'Preço justo e muita atenção aos detalhes.',
      'Resolveram rápido e ainda deram boas dicas.',
      'Equipe cuidadosa e loja organizada.',
    ],
    4: [
      'Bom atendimento, só demorou um dia a mais do que o previsto.',
      'Gostei do resultado, o preço é um pouco acima da média.',
      'Loja bem abastecida e equipe prestativa.',
      'Serviço bem feito, voltaria.',
    ],
    3: [
      'Serviço ok, mas precisei voltar para um ajuste.',
      'Atendimento bom, prazo nem tanto.',
      'Correto, mas faltou explicar melhor o que foi feito.',
    ],
    2: ['Prazo não foi cumprido e não avisaram.', 'Atendimento confuso e sem retorno.'],
  },
}

const CLOSINGS: Record<5 | 4 | 3 | 2, string[]> = {
  5: ['Volto com certeza.', 'Recomendo muito.', 'Já quero voltar.', 'Nota máxima.', '', ''],
  4: ['Vale a visita.', 'Recomendo.', 'Voltaria.', '', ''],
  3: ['Talvez volte para dar outra chance.', 'Pode melhorar.', ''],
  2: ['Espero que melhorem.', 'Não foi uma boa experiência.', ''],
}

const REPLIES: Record<'positive' | 'critical', string[]> = {
  positive: [
    'Obrigado pela visita, {name}! Ficamos muito felizes com o seu retorno e esperamos você de novo.',
    'Que bom que gostou, {name}. Vamos compartilhar seu comentário com toda a equipe.',
    '{name}, muito obrigado pelas palavras. Até a próxima!',
    'Agradecemos a avaliação, {name}. É um prazer receber você.',
  ],
  critical: [
    '{name}, obrigado pelo retorno. Já conversamos com a equipe sobre o que aconteceu e queremos receber você de novo.',
    'Sentimos muito pela experiência, {name}. Estamos ajustando a organização nos horários de maior movimento.',
    'Obrigado por contar, {name}. Sua observação já virou ajuste aqui na casa.',
  ],
}

const RATING_SEQUENCE: Array<5 | 4 | 3 | 2> = [5, 4, 5, 5, 3, 4, 5, 4, 2, 5, 4, 5, 3, 5, 4]

export interface DemoReviewPlan {
  key: string
  place: string
  consumer: DemoPerson
  rating: 5 | 4 | 3 | 2
  comment: string
  reply: string | null
  /** How long ago the review was written. */
  days_ago: number
  photo: DemoMotif | null
}

/** Places whose first review carries a photo, as the review-photo feature expects. */
const PHOTO_REVIEWS: Record<string, DemoMotif> = {
  'londrina-cantina-vale-verde': 'pasta',
  'londrina-massa-madre-pizzaria': 'pizza',
  'londrina-ipe-cafe': 'coffee',
  'maringa-sushi-hanami': 'sushi',
  'cambe-sitio-pe-de-cafe': 'farm',
  'londrina-parque-das-seriemas': 'park',
}

/**
 * The deterministic review plan of a place: how many reviews, by whom, with
 * which rating and text, whether the place replied and when it happened.
 */
export function demoReviewPlan(place: DemoPlace): DemoReviewPlan[] {
  if (place.publication === 'pending_review') return []
  const rng = seededRandom(`reviews|${place.key}`)
  const big = place.city === 'londrina' || place.city === 'maringa'
  const count = place.business_status ? 2 : big ? rng.int(3, 5) : rng.int(2, 4)
  const tone = TONE_BY_CATEGORY[place.category] ?? 'services'
  const start = rng.int(0, DEMO_CONSUMERS.length - 1)
  const offset = rng.int(0, RATING_SEQUENCE.length - 1)
  const plans: DemoReviewPlan[] = []
  for (let index = 0; index < count; index++) {
    const consumer = DEMO_CONSUMERS[(start + index * 5) % DEMO_CONSUMERS.length]
    const rating = RATING_SEQUENCE[(offset + index) % RATING_SEQUENCE.length]
    const opening = rng.pick(OPENINGS[tone][rating])
    const closing = rng.pick(CLOSINGS[rating])
    const firstName = consumer.full_name.split(' ')[0]
    const replies = rating <= 3 || rng.chance(0.45)
    plans.push({
      key: `review:${place.key}:${consumer.key}`,
      place: place.key,
      consumer,
      rating,
      comment: closing ? `${opening} ${closing}` : opening,
      reply: replies
        ? rng.pick(REPLIES[rating <= 3 ? 'critical' : 'positive']).replace('{name}', firstName)
        : null,
      days_ago: rng.int(4, 150),
      photo: index === 0 ? (PHOTO_REVIEWS[place.key] ?? null) : null,
    })
  }
  return plans
}
