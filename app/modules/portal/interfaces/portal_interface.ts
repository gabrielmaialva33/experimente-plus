import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'

export namespace IPortal {
  export interface EstablishmentSummary {
    id: number
    organization_id: number
    lifecycle_status: string
    business_status: string
    published_revision_id: number | null
    revision: Record<string, unknown> | null
    published_revision: Record<string, unknown> | null
    completeness: IEstablishment.CompletenessResult
  }

  export interface OrganizationSummary {
    id: number
    legal_name: string
    trade_name: string
    status: string
    role: string | null
    establishments: EstablishmentSummary[]
    totals: {
      establishments: number
      published: number
      pending_review: number
      complete: number
    }
    onboarding: Array<{
      key: string
      label: string
      completed: boolean
      href: string
    }>
  }

  export interface Overview {
    organizations: OrganizationSummary[]
    totals: {
      organizations: number
      establishments: number
      published: number
      pending_review: number
      complete: number
    }
  }
}

export default IPortal
