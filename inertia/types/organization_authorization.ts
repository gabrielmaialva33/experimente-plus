/**
 * Inertia contract projected by the backend after combining global permissions
 * with organization membership policy. These flags control presentation only;
 * every mutation is authorized again by the server.
 */
export interface OrganizationAllowedActions {
  organizations: {
    read: boolean
    update: boolean
    submit: boolean
  }
  establishments: {
    read: boolean
    list: boolean
    create: boolean
    create_revision: boolean
    update: boolean
    submit: boolean
    archive: boolean
  }
  benefit_offers: {
    read: boolean
    list: boolean
    create: boolean
    update: boolean
    activate: boolean
    pause: boolean
    archive: boolean
  }
  redemptions: {
    read: boolean
    validate: boolean
  }
  analytics: {
    read: boolean
  }
  pilot_feedback: {
    create: boolean
  }
  team: {
    /** See the members and pending invitations of the organization. */
    read: boolean
    /** Invite people or change, suspend and remove members. */
    manage: boolean
  }
}

/** `resource.action` of an organization-scoped Portal action, e.g. `analytics.read`. */
export type OrganizationActionKey = {
  [Resource in keyof OrganizationAllowedActions]: `${Resource}.${Extract<
    keyof OrganizationAllowedActions[Resource],
    string
  >}`
}[keyof OrganizationAllowedActions]
