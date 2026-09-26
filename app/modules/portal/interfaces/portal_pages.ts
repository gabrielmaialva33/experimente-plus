/**
 * Portal page contracts added with the partner's task-first overview.
 *
 * Type aliases, not interfaces: Inertia types `render` props against
 * `Record<string, JSONDataTypes>`, and a named interface has no implicit index
 * signature, which would turn the page's props into `never`.
 */

/** Where a place stands, as a partner reads it on the overview and the chooser. */
export type PartnerPlaceState = 'published' | 'pending_review' | 'changes_requested' | 'draft'

/** The three task cards of the overview. Every count comes from the server. */
export type PortalTasks = {
  unanswered_reviews: number
  places: Record<PartnerPlaceState, number> & { total: number }
  content: { pending_review: number; draft: number; published: number }
}

/** The "Dados do lugar" chooser, when a partner has more than one place. */
export type PartnerPlacesPageProps = {
  organizations: {
    id: number
    name: string
    can_read_analytics: boolean
    places: {
      id: number
      name: string
      state: PartnerPlaceState
      can_list_benefits: boolean
    }[]
  }[]
}
