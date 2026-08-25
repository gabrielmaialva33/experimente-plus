export const PILOT_FEEDBACK_CONTEXTS = [
  'general',
  'onboarding',
  'organization',
  'establishment',
  'catalog',
  'analytics',
  'moderation',
] as const

export const PILOT_FEEDBACK_STATUSES = ['new', 'in_review', 'resolved', 'dismissed'] as const

export namespace IPilotFeedback {
  export type Context = (typeof PILOT_FEEDBACK_CONTEXTS)[number]
  export type Status = (typeof PILOT_FEEDBACK_STATUSES)[number]

  export interface CreatePayload {
    context: Context
    rating: number
    message: string
    organization_id?: number
    establishment_id?: number
  }

  export interface ReviewPayload {
    status: Exclude<Status, 'new'>
    internal_notes?: string | null
  }

  export interface ListQuery {
    status?: Status
    context?: Context
    organization_id?: number
    establishment_id?: number
    page: number
    per_page: number
  }
}

export default IPilotFeedback
