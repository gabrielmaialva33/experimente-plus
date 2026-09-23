import vine from '@vinejs/vine'

export const establishmentParamsValidator = vine.compile(
  vine.object({
    establishmentId: vine.number().min(1),
  })
)

export const itineraryParamsValidator = vine.compile(
  vine.object({
    id: vine.number().min(1),
  })
)

export const itineraryStopParamsValidator = vine.compile(
  vine.object({
    id: vine.number().min(1),
    stopId: vine.number().min(1),
  })
)

export const itineraryPayloadValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
  })
)

export const stopPayloadValidator = vine.compile(
  vine.object({
    establishment_id: vine.number().min(1),
    note: vine.string().trim().maxLength(280).nullable().optional(),
  })
)

/**
 * Reordering carries the whole sequence. The cap matches nothing in the
 * database on purpose: there is no limit on stops per itinerary yet — that is
 * one of the pendencies of ADR-0030 — and this only keeps a single request
 * from being unbounded.
 */
export const reorderPayloadValidator = vine.compile(
  vine.object({
    stop_ids: vine.array(vine.number().min(1)).minLength(1).maxLength(200),
  })
)

/**
 * Interests are chosen by slug, the identity the public catalogue gives a
 * category. It never publishes the numeric id, so the app has nothing else to
 * send.
 */
export const interestsPayloadValidator = vine.compile(
  vine.object({
    category_slugs: vine.array(vine.string().trim().minLength(1).maxLength(140)).maxLength(100),
  })
)
