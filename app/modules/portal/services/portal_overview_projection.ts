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
