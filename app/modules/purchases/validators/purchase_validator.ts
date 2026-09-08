import vine from '@vinejs/vine'

export const purchaseValidator = vine.compile(
  vine.object({
    offer_id: vine.number().positive().withoutDecimals().nullable().optional(),
    edition_id: vine.number().positive().withoutDecimals(),
    amount_cents: vine.number().positive().withoutDecimals().max(2147483647),
    terms_version: vine.string().regex(/^[a-f0-9]{64}$/),
    method: vine.enum(['pix', 'card']),
    card_token: vine.string().maxLength(512).optional(),
    payment_method_id: vine
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,60}$/)
      .optional(),
    document_type: vine.enum(['CPF', 'CNPJ']).optional(),
    document_number: vine
      .string()
      .regex(/^\d{11,14}$/)
      .optional(),
  })
)
export const refundValidator = vine.compile(
  vine.object({ reason: vine.string().trim().minLength(5).maxLength(1000) })
)
export const refundDecisionValidator = vine.compile(
  vine.object({
    approve: vine.boolean(),
    amount_cents: vine.number().positive().withoutDecimals().max(2147483647).optional(),
    reason: vine.string().trim().minLength(5).maxLength(1000),
  })
)
export const purchaseIdValidator = vine.compile(
  vine.object({ id: vine.string().uuid(), refundId: vine.string().uuid().optional() })
)

export const reconciliationValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(5).maxLength(1000),
    provider_id: vine
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,150}$/)
      .optional(),
  })
)
export const settlementValidator = vine.compile(
  vine.object({
    provider_id: vine.string().regex(/^[a-zA-Z0-9_-]{1,150}$/),
    statement_reference: vine.string().regex(/^[a-zA-Z0-9_.-]{1,150}$/),
    line_reference: vine.string().regex(/^[a-zA-Z0-9_.-]{1,150}$/),
    currency: vine.literal('BRL'),
    gross_cents: vine.number().min(0).max(2147483647).withoutDecimals(),
    fee_cents: vine.number().min(0).max(2147483647).withoutDecimals(),
    net_cents: vine.number().min(-2147483647).max(2147483647).withoutDecimals(),
    refunded_cents: vine.number().min(0).max(2147483647).withoutDecimals(),
    settled_at: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/),
  })
)
