import type { RedemptionPreviewView, RedemptionReceipt } from '~/types/benefit_redemption'

/** Shaped like a real presentation token; used to prove it never leaks. */
export const PRESENTATION_TOKEN = `${'e'.repeat(30)}.${'f'.repeat(43)}`
export const PRESENTATION_URL = `https://experimente.test/portal/redemptions/validate?token=${PRESENTATION_TOKEN}`

export const previewFixture: RedemptionPreviewView = {
  expires_at: '2026-09-27T20:05:00.000Z',
  holder: { id: 5, full_name: 'Ana Souza', email: 'ana@example.test' },
  benefit: {
    access_id: 1,
    offer_id: 2,
    edition_id: 3,
    edition_name: 'Experimente Londrina',
    organization_id: 4,
    establishment_id: 8,
    establishment_name: 'Café Central',
    offer_title: 'Sobremesa cortesia',
    offer_description: 'Na compra de um prato principal.',
    terms: 'Uma por mesa.',
    benefit_type: 'courtesy',
    reservation_required: false,
    on_premise_only: true,
    minimum_party_size: 1,
    max_redemptions_per_access: 1,
    redeemed_count: 0,
    remaining_redemptions: 1,
  },
}

export const receiptFixture: RedemptionReceipt = {
  id: 9,
  receipt_code: 'EXP-0123456789ABCDEF',
  redemption_number: 1,
  redeemed_at: '2026-09-27T20:01:00.000Z',
  edition: { id: 3, name: 'Experimente Londrina' },
  offer: { id: 2, title: 'Sobremesa cortesia', benefit_type: 'courtesy', terms: null },
  establishment: { id: 8, name: 'Café Central' },
  holder: { id: 5, full_name: 'Ana Souza', email: 'ana@example.test' },
  redeemed_by: 2,
}
