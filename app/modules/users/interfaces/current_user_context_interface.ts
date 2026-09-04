import type IOrganization from '#modules/organizations/interfaces/organization_interface'

namespace ICurrentUserContext {
  export type PlatformAccess = IOrganization.ActorAccessSnapshot['platform_access']

  export interface UserProjection {
    id: number
    full_name: string
    email: string
    username: string | null
    email_verified: boolean
    email_verified_at: string | null
  }

  export interface ActiveOperationProjection {
    id: number
    name: string
    slug: string
  }

  export interface OperationProjection extends ActiveOperationProjection {
    role: string
    is_current: boolean
  }

  export interface CapabilitiesProjection {
    consumer: {
      wallet: {
        read: true
      }
    }
    partner: {
      enabled: boolean
      redemptions: {
        read: boolean
        validate: boolean
      }
    }
    platform_access: PlatformAccess
  }

  export interface Projection {
    user: UserProjection
    active_operation: ActiveOperationProjection
    operations: OperationProjection[]
    capabilities: CapabilitiesProjection
  }
}

export default ICurrentUserContext
