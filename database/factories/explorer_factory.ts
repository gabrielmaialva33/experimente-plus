import factory from '@adonisjs/lucid/factories'

import { relationParent } from '#database/factories/support/relations'
import ExplorerFavorite from '#modules/explorer/models/explorer_favorite'
import ExplorerFollow from '#modules/explorer/models/explorer_follow'
import ExplorerInterest from '#modules/explorer/models/explorer_interest'
import ExplorerItinerary from '#modules/explorer/models/explorer_itinerary'
import ExplorerItineraryItem from '#modules/explorer/models/explorer_itinerary_item'

/**
 * The Explorer's private layer (ADR-0030). Every row belongs to a person
 * inside one operation — the user must be a member of the tenant — and points
 * at an establishment or category of that same tenant, which the composite
 * keys enforce. Each pair is unique: favouriting twice is one favourite.
 */
export const ExplorerFavoriteFactory = factory
  .define(ExplorerFavorite, () => ({
    tenant_id: 1,
    user_id: 1,
    establishment_id: 1,
  }))
  .build()

export const ExplorerFollowFactory = factory
  .define(ExplorerFollow, () => ({
    tenant_id: 1,
    user_id: 1,
    establishment_id: 1,
  }))
  .build()

export const ExplorerInterestFactory = factory
  .define(ExplorerInterest, () => ({
    tenant_id: 1,
    user_id: 1,
    category_id: 1,
  }))
  .build()

const ITINERARIES = [
  ['Sábado de cafés pelo centro', 'Começar cedo e terminar com um doce.'],
  ['Domingo em família', 'Almoço sem pressa e passeio à tarde.'],
  ['Noite de música ao vivo', null],
  ['Roteiro para receber visitas', 'Lugares para mostrar a cidade a quem chega.'],
] as const

const STOP_NOTES = ['Chegar antes das 12h', 'Pedir o prato do dia', null, 'Reservar mesa'] as const

/**
 * One stop of an itinerary. Without an explicit `position` it goes to the
 * end, as `ExplorerService` appends. Created through
 * `ExplorerItineraryFactory.with('items', n)`, it also takes the itinerary's
 * tenant; merge `establishment_id` in the callback.
 */
export const ExplorerItineraryItemFactory = factory
  .define(ExplorerItineraryItem, ({ faker }) => ({
    tenant_id: 1,
    itinerary_id: 1,
    establishment_id: 1,
    note: faker.helpers.arrayElement(STOP_NOTES),
  }))
  .before('create', async (builder, item, { $trx }) => {
    const itinerary = relationParent(builder)
    if (itinerary instanceof ExplorerItinerary) {
      item.tenant_id = itinerary.tenant_id
    }
    if (item.position === undefined) {
      const row = await ExplorerItineraryItem.query({ client: $trx })
        .where('tenant_id', item.tenant_id)
        .where('itinerary_id', item.itinerary_id)
        .max('position as highest')
        .first()
      const highest = row?.$extras.highest
      item.position = highest === null || highest === undefined ? 0 : Number(highest) + 1
    }
  })
  .build()

/** A saved itinerary with a pt-BR name; `with('items', n)` adds its stops in order. */
export const ExplorerItineraryFactory = factory
  .define(ExplorerItinerary, ({ faker }) => {
    const [name, notes] = faker.helpers.arrayElement(ITINERARIES)
    return {
      tenant_id: 1,
      user_id: 1,
      name,
      notes,
    }
  })
  .relation('items', () => ExplorerItineraryItemFactory)
  .build()
