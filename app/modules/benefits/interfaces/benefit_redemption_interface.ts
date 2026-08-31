namespace IBenefitRedemption {
  export interface PresentationClaims {
    version: 1
    tenant_id: number
    access_id: number
    offer_id: number
    user_id: number
    nonce: string
    issued_at: number
    expires_at: number
  }

  export interface BenefitSummary {
    access_id: number
    offer_id: number
    edition_id: number
    edition_name: string
    establishment_id: number
    establishment_name: string
    offer_title: string
    offer_description: string
    terms: string | null
    benefit_type: string
    reservation_required: boolean
    on_premise_only: boolean
    minimum_party_size: number
    max_redemptions_per_access: number
    redeemed_count: number
    remaining_redemptions: number
  }

  export interface PresentationProjection {
    token: string
    validation_url: string
    qr_data_url: string
    issued_at: string
    expires_at: string
    expires_in_seconds: number
    benefit: BenefitSummary
  }

  export interface PreviewProjection {
    token: string
    expires_at: string
    holder: {
      id: number
      full_name: string
      email: string
    }
    benefit: BenefitSummary
  }

  export interface ReceiptProjection {
    id: number
    receipt_code: string
    redemption_number: number
    redeemed_at: string
    edition: {
      id: number
      name: string
    }
    offer: {
      id: number
      title: string
      benefit_type: string
      terms: string | null
    }
    establishment: {
      id: number
      name: string
    }
    holder: {
      id: number
      full_name: string
      email: string
    }
    redeemed_by: number
  }

  export interface HistoryProjection {
    redemptions: ReceiptProjection[]
    total: number
  }
}

export default IBenefitRedemption
