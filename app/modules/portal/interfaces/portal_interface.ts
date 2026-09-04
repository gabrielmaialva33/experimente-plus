import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'

export namespace IPortal {
  export interface EstablishmentSummary {
    id: number
    organization_id: number
    public_name: string
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
    slug: string
    tax_id: string
    email: string
    phone: string
    website: string | null
    status: string
    role: string | null
    allowed_actions: IOrganization.AllowedActions
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
      available: boolean
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

  export interface FeedbackTarget {
    id: number
    label: string
    organization_id?: number
  }

  export interface FeedbackTargets {
    organizations: FeedbackTarget[]
    establishments: FeedbackTarget[]
  }
}

export default IPortal
