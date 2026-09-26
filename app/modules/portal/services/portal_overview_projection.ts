export interface FeedbackOverviewProjection {
  organizations: readonly {
    id: number
    trade_name: string
    establishments: readonly {
      id: number
      public_name: string
    }[]
  }[]
}

export function feedbackTargetsFromOverview(overview: FeedbackOverviewProjection) {
  return {
    organizations: overview.organizations.map((organization) => ({
      id: organization.id,
      label: organization.trade_name,
    })),
    establishments: overview.organizations.flatMap((organization) =>
      organization.establishments.map((establishment) => ({
        id: establishment.id,
        organization_id: organization.id,
        label: establishment.public_name,
      }))
    ),
  }
}

export interface ReadablePlacesOverviewProjection {
  organizations: readonly {
    allowed_actions: {
      establishments: { read: boolean; update: boolean }
    }
    establishments: readonly { id: number; public_name: string }[]
  }[]
}

/**
 * The places a partner may see on cross-place pages (Avaliações, the overview's
 * task cards), with the server's projection of whether they may act on each.
 * It reads the same overview the rest of the portal renders; the services
 * behind every write still resolve the organization policy themselves.
 */
export function readablePlacesFromOverview(overview: ReadablePlacesOverviewProjection) {
  return overview.organizations
    .filter((organization) => organization.allowed_actions.establishments.read)
    .flatMap((organization) =>
      organization.establishments.map((establishment) => ({
        id: establishment.id,
        name: establishment.public_name,
        can_reply: organization.allowed_actions.establishments.update,
      }))
    )
}
