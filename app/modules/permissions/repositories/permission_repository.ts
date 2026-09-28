import db from '@adonisjs/lucid/services/db'
import LucidRepository from '#shared/lucid/lucid_repository'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import Permission from '#modules/permissions/models/permission'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import { type PaginateResult } from '#shared/lucid/lucid_repository_interface'

const PERMISSION_NAME_LOCK_NAMESPACE = -0x5045524d // "PERM"; negative avoids tenant-id lock namespaces.

type PlatformCapability = {
  resource: string
  action: string
  context: string
}

export default class PermissionRepository
  extends LucidRepository<typeof Permission>
  implements IPermission.Repository
{
  constructor() {
    super(Permission)
  }

  async findByName(name: string): Promise<Permission | null> {
    return this.model.findBy('name', name)
  }

  async findByResourceAction(
    resource: string,
    action: string,
    context: string = IPermission.Contexts.ANY
  ): Promise<Permission | null> {
    return this.model
      .query()
      .where('resource', resource)
      .where('action', action)
      .where('context', context)
      .first()
  }

  async syncPermissions(
    permissions: IPermission.SyncPermissionData[],
    trx?: TransactionClientContract
  ): Promise<void> {
    for (const permissionData of permissions) {
      await this.model.firstOrCreate(
        {
          resource: permissionData.resource,
          action: permissionData.action,
          context: permissionData.context ?? IPermission.Contexts.ANY,
        },
        {
          name: permissionData.name,
          description: permissionData.description,
        },
        { client: trx }
      )
    }
  }

  /**
   * Paginate permissions with optional resource/action filters, ordered by
   * resource then action.
   */
  async paginateFiltered(
    page: number,
    perPage: number,
    resource?: string,
    action?: string
  ): Promise<PaginateResult<typeof Permission>> {
    const query = this.model.query()

    if (resource) {
      query.where('resource', resource)
    }

    if (action) {
      query.where('action', action)
    }

    return query.orderBy('resource', 'asc').orderBy('action', 'asc').paginate(page, perPage)
  }

  /**
   * List every permission ordered by resource, action and context (read model
   * for the web permissions page).
   */
  async listOrderedByResource(): Promise<Permission[]> {
    return this.model
      .query()
      .orderBy('resource', 'asc')
      .orderBy('action', 'asc')
      .orderBy('context', 'asc')
  }

  /**
   * All permission ids (used to grant every permission to the ROOT role).
   */
  async findAllIds(trx?: TransactionClientContract): Promise<number[]> {
    const rows = await this.model.query({ client: trx }).select('id')
    return rows.map((row) => row.id)
  }

  /**
   * Permission ids granted to the ADMIN role: everything except permission
   * management, plus read/list on permissions.
   */
  async findAdminPermissionIds(trx?: TransactionClientContract): Promise<number[]> {
    const rows = await this.model
      .query({ client: trx })
      .whereNot('resource', IPermission.Resources.PERMISSIONS)
      .orWhere((query) => {
        query
          .where('resource', IPermission.Resources.PERMISSIONS)
          .whereIn('action', [IPermission.Actions.READ, IPermission.Actions.LIST])
      })
      .select('id')

    return rows.map((row) => row.id)
  }

  async findModeratorPermissionIds(trx?: TransactionClientContract): Promise<number[]> {
    const names = [
      'organizations.read',
      'organizations.list',
      'organizations.approve',
      'organizations.reject',
      'organizations.request_changes',
      'organizations.suspend',
      'organizations.restore',
      'organization_claims.read',
      'organization_claims.list',
      'organization_claims.approve',
      'organization_claims.reject',
      'establishments.read',
      'establishments.list',
      'establishments.approve',
      'establishments.reject',
      'establishments.request_changes',
      'benefit_editions.read',
      'benefit_editions.list',
      'benefit_offers.read',
      'benefit_offers.list',
      'benefit_accesses.read',
      'benefit_accesses.list',
      'media.read',
      'media.list',
      'media.approve',
      'media.reject',
    ]
    const rows = await this.model.query({ client: trx }).whereIn('name', names).select('id')
    return rows.map((row) => row.id)
  }

  /**
   * The default USER role owns personal features plus the global half of
   * organization-scoped Portal actions. Organization policies still constrain
   * those actions to an active membership. It cannot create operations or
   * administer platform users, roles, and permissions.
   */
  async findUserPermissionIds(trx?: TransactionClientContract): Promise<number[]> {
    const names = [
      'files.create',
      'files.read',
      'files.list',
      'files.delete.own',
      'tenants.read',
      'tenants.list',
      'organizations.create',
      'organizations.read',
      'organizations.update',
      'organizations.list',
      'organizations.submit',
      'organizations.archive',
      'organization_members.read',
      'organization_members.update',
      'organization_members.delete',
      'organization_members.list',
      'organization_invitations.create',
      'organization_invitations.read',
      'organization_invitations.list',
      'organization_invitations.resend',
      'organization_invitations.revoke',
      'organization_invitations.accept',
      'organization_claims.create',
      'organization_claims.read',
      'organization_claims.list',
      'establishments.create',
      'establishments.read',
      'establishments.update',
      'establishments.list',
      'establishments.submit',
      'establishments.archive',
      'benefit_editions.read',
      'benefit_editions.list',
      'benefit_offers.create',
      'benefit_offers.read',
      'benefit_offers.update',
      'benefit_offers.list',
      'benefit_offers.archive',
      'media.create',
      'media.read',
      'media.update',
      'media.delete',
      'media.list',
      'analytics.read',
      'pilot_feedback.create',
    ]
    const rows = await this.model.query({ client: trx }).whereIn('name', names).select('id')
    return rows.map((row) => row.id)
  }

  /**
   * GUEST is a neutral role by default. Applications may opt in to public or
   * guest capabilities explicitly instead of inheriting broad global reads.
   */
  async findGuestPermissionIds(_trx?: TransactionClientContract): Promise<number[]> {
    return []
  }

  /**
   * Permissions owned (directly or via roles) whose role slug is in the given
   * list. Used to resolve inherited permissions across the role hierarchy.
   */
  async findByRoleSlugs(slugs: string[]): Promise<Permission[]> {
    return this.model
      .query()
      .whereHas('roles', (query) => {
        query.whereIn('slug', slugs)
      })
      .distinct()
  }

  /**
   * The user's granted, unexpired direct permissions with their pivot data,
   * ordered by resource then action.
   */
  async listGrantedDirectForUser(userId: number) {
    return db
      .from('user_permissions')
      .join('permissions', 'user_permissions.permission_id', 'permissions.id')
      .where('user_permissions.user_id', userId)
      .where('user_permissions.granted', true)
      .where(function (query) {
        query.whereNull('user_permissions.expires_at')
        query.orWhere('user_permissions.expires_at', '>', new Date())
      })
      .select(
        'permissions.id',
        'permissions.name',
        'permissions.resource',
        'permissions.action',
        'permissions.description',
        'user_permissions.expires_at',
        'user_permissions.granted'
      )
      .orderBy('permissions.resource')
      .orderBy('permissions.action')
  }

  /**
   * Insert the permission, or rename the existing resource/action/context tuple
   * to the given canonical name (and update its description when one is
   * given). Returns the stored row.
   */
  async upsertCanonical(
    permission: {
      name: string
      description?: string
      resource: string
      action: string
      context: string
    },
    client: TransactionClientContract
  ): Promise<Permission> {
    const now = new Date()
    const updateData: Record<string, unknown> = {
      name: permission.name,
      updated_at: now,
    }

    if (permission.description !== undefined) {
      updateData.description = permission.description
    }

    // The table also has a unique name index. Serializing by the derived name
    // keeps two different administrator roles from racing across the two
    // uniqueness constraints before PostgreSQL reaches the tuple arbiter.
    await client.rawQuery('SELECT pg_advisory_xact_lock(CAST(? AS integer), hashtext(?))', [
      PERMISSION_NAME_LOCK_NAMESPACE,
      permission.name,
    ])

    const [row] = await client
      .table('permissions')
      .insert({
        name: permission.name,
        description: permission.description ?? null,
        resource: permission.resource,
        action: permission.action,
        context: permission.context,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['resource', 'action', 'context'])
      .merge(updateData)
      .returning('id')

    return this.model.query({ client }).where('id', Number(row.id)).firstOrFail()
  }

  /** Which of the given ids exist, in ascending order. */
  async findExistingIds(permissionIds: number[], client: TransactionClientContract) {
    const rows = await this.model
      .query({ client })
      .whereIn('id', permissionIds)
      .orderBy('id', 'asc')
      .select('id')

    return rows.map((row) => row.id)
  }

  /** Whether the user holds the capability as a granted, unexpired direct permission. */
  async hasDirectGrant(
    userId: number,
    capability: PlatformCapability,
    client: TransactionClientContract
  ): Promise<boolean> {
    const directPermission = await client
      .from('user_permissions as user_permission')
      .innerJoin('permissions as permission', 'permission.id', 'user_permission.permission_id')
      .where('user_permission.user_id', userId)
      .where('user_permission.granted', true)
      .where((query) => {
        query
          .whereNull('user_permission.expires_at')
          .orWhere('user_permission.expires_at', '>', client.raw('CURRENT_TIMESTAMP'))
      })
      .where('permission.resource', capability.resource)
      .where('permission.action', capability.action)
      .where('permission.context', capability.context)
      .select('permission.id')
      .first()

    return Boolean(directPermission)
  }

  /** Whether any of the role slugs is granted the capability. */
  async hasRoleGrant(
    roleSlugs: string[],
    capability: PlatformCapability,
    client: TransactionClientContract
  ): Promise<boolean> {
    const rolePermission = await client
      .from('role_permissions as role_permission')
      .innerJoin('roles as role', 'role.id', 'role_permission.role_id')
      .innerJoin('permissions as permission', 'permission.id', 'role_permission.permission_id')
      .whereIn('role.slug', roleSlugs)
      .where('permission.resource', capability.resource)
      .where('permission.action', capability.action)
      .where('permission.context', capability.context)
      .select('permission.id')
      .first()

    return Boolean(rolePermission)
  }

  /** Permissions the user holds through their roles, ordered by resource then action. */
  async listThroughRolesForUser(userId: number) {
    return db
      .from('user_roles')
      .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('user_roles.user_id', userId)
      .select(
        'permissions.id',
        'permissions.name',
        'permissions.resource',
        'permissions.action',
        'permissions.description'
      )
      .orderBy('permissions.resource')
      .orderBy('permissions.action')
  }
}
