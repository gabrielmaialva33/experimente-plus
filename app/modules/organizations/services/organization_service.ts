import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import CnpjService from '#modules/organizations/services/cnpj_service'
import OrganizationAuditService from '#modules/organizations/services/organization_audit_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import type User from '#modules/users/models/user'
import { normalizeSlug, resolveUniqueSlug } from '#shared/utils/slug'

@inject()
export default class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private memberRepository: OrganizationMemberRepository,
    private cnpjService: CnpjService,
    private policy: OrganizationPolicyService,
    private audit: OrganizationAuditService
  ) {}

  async list(tenantId: number, actor: User): Promise<Organization[]> {
    if (await this.policy.isPlatformStaff(actor)) {
      return this.organizationRepository.listForTenant(tenantId)
    }

    return this.organizationRepository.listForUser(tenantId, actor.id)
  }

  async listFromAccessSnapshot(
    tenantId: number,
    snapshot: IOrganization.ActorAccessSnapshot
  ): Promise<Organization[]> {
    if (snapshot.platform_access === 'platform_admin') {
      return this.organizationRepository.listForTenant(tenantId)
    }

    return this.organizationRepository.listByIdsForTenant(
      tenantId,
      snapshot.organization_accesses
        .filter((access) => access.capabilities.read)
        .map((access) => access.organization_id)
    )
  }

  /**
   * Loads the lightweight Portal organization from the request authorization
   * snapshot. It deliberately skips private relations that the detail page does
   * not render and fails closed before returning another organization's data.
   */
  async showFromAccessSnapshot(
    tenantId: number,
    id: number,
    snapshot: IOrganization.ActorAccessSnapshot
  ): Promise<Organization> {
    const canRead =
      snapshot.platform_access === 'platform_admin' ||
      snapshot.organization_accesses.some(
        (access) => access.organization_id === id && access.capabilities.read
      )
    if (!canRead) {
      throw new NotFoundException('Organization not found')
    }

    return this.getOrFail(tenantId, id)
  }

  async show(tenantId: number, id: number, actor: User): Promise<Organization> {
    const organization = await this.getOrFail(tenantId, id)
    await this.policy.authorizeRead(actor, tenantId, id)
    await this.loadPrivateRelations(organization)
    return organization
  }

  async create(
    tenantId: number,
    actor: User,
    payload: IOrganization.CreatePayload
  ): Promise<Organization> {
    const taxId = this.cnpjService.normalizeAndValidate(payload.tax_id)
    const email = payload.email.trim().toLowerCase()
    const phone = this.normalizePhone(payload.phone)
    const website = this.normalizeWebsite(payload.website)

    if (await this.organizationRepository.isTaxIdTaken(tenantId, taxId)) {
      throw new BadRequestException('CNPJ is already in use in this operation')
    }

    const slug = payload.slug
      ? await this.validateExplicitSlug(tenantId, payload.slug)
      : await resolveUniqueSlug(payload.trade_name, (candidate) =>
          this.organizationRepository.isSlugTaken(tenantId, candidate)
        )

    const organizationId = await db.transaction(async (client) => {
      const organization = await this.organizationRepository.create(
        {
          tenant_id: tenantId,
          legal_name: payload.legal_name.trim(),
          trade_name: payload.trade_name.trim(),
          slug,
          tax_id: taxId,
          email,
          phone,
          website,
          status: 'draft',
          created_by: actor.id,
        },
        client
      )

      await this.memberRepository.create(
        {
          tenant_id: tenantId,
          organization_id: organization.id,
          user_id: actor.id,
          role: 'owner',
          status: 'active',
          invited_by: null,
        },
        client
      )

      return organization.id
    })

    const organization = await this.getOrFail(tenantId, organizationId)
    await this.loadPrivateRelations(organization)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATIONS,
      action: IPermission.Actions.CREATE,
      resourceId: organization.id,
      metadata: { status: organization.status },
    })

    return organization
  }

  async update(
    tenantId: number,
    id: number,
    actor: User,
    payload: IOrganization.UpdatePayload
  ): Promise<Organization> {
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('At least one organization field must be provided')
    }

    await db.transaction(async (client) => {
      const organization = await this.organizationRepository.findByIdForTenant(
        tenantId,
        id,
        client,
        true
      )

      if (!organization) {
        throw new NotFoundException('Organization not found')
      }

      await this.policy.authorizeEditOrganization(actor, tenantId, id, client)
      this.ensureEditableState(organization, payload)

      if (payload.legal_name !== undefined) {
        organization.legal_name = payload.legal_name.trim()
      }
      if (payload.trade_name !== undefined) {
        organization.trade_name = payload.trade_name.trim()
      }
      if (payload.slug !== undefined) {
        organization.slug = await this.validateExplicitSlug(
          tenantId,
          payload.slug,
          organization.id,
          client
        )
      }
      if (payload.tax_id !== undefined) {
        const taxId = this.cnpjService.normalizeAndValidate(payload.tax_id)
        if (
          await this.organizationRepository.isTaxIdTaken(tenantId, taxId, organization.id, client)
        ) {
          throw new BadRequestException('CNPJ is already in use in this operation')
        }
        organization.tax_id = taxId
      }
      if (payload.email !== undefined) {
        organization.email = payload.email.trim().toLowerCase()
      }
      if (payload.phone !== undefined) {
        organization.phone = this.normalizePhone(payload.phone)
      }
      if (payload.website !== undefined) {
        organization.website = this.normalizeWebsite(payload.website)
      }

      await organization.save()
    })

    const organization = await this.getOrFail(tenantId, id)
    await this.loadPrivateRelations(organization)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATIONS,
      action: IPermission.Actions.UPDATE,
      resourceId: organization.id,
      metadata: { status: organization.status, fields: Object.keys(payload) },
    })

    return organization
  }

  private ensureEditableState(
    organization: Organization,
    payload: IOrganization.UpdatePayload
  ): void {
    if (!['draft', 'changes_requested', 'active'].includes(organization.status)) {
      throw new BadRequestException(`Organization cannot be edited while ${organization.status}`)
    }

    if (
      organization.status === 'active' &&
      (payload.legal_name !== undefined ||
        payload.tax_id !== undefined ||
        payload.slug !== undefined)
    ) {
      throw new BadRequestException(
        'Legal name, CNPJ and slug cannot be changed after organization approval'
      )
    }
  }

  private async getOrFail(tenantId: number, id: number): Promise<Organization> {
    const organization = await this.organizationRepository.findByIdForTenant(tenantId, id)
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }
    return organization
  }

  private async loadPrivateRelations(organization: Organization): Promise<void> {
    await organization.load('members', (query) => {
      query.preload('user').orderBy('id', 'asc')
    })
  }

  private async validateExplicitSlug(
    tenantId: number,
    value: string,
    excludeId?: number,
    client?: Parameters<OrganizationRepository['isSlugTaken']>[3]
  ): Promise<string> {
    const slug = normalizeSlug(value)
    if (!slug) {
      throw new BadRequestException('Organization slug is invalid')
    }
    if (await this.organizationRepository.isSlugTaken(tenantId, slug, excludeId, client)) {
      throw new BadRequestException('Organization slug is already in use')
    }
    return slug
  }

  private normalizePhone(value: string): string {
    const phone = value.replace(/\D/g, '')
    if (!/^\d{10,15}$/.test(phone)) {
      throw new BadRequestException('Phone must contain between 10 and 15 digits')
    }
    return phone
  }

  private normalizeWebsite(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    if (!normalized) {
      return null
    }

    try {
      const url = new URL(normalized)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Unsupported protocol')
      }
      return url.toString()
    } catch {
      throw new BadRequestException('Website must be a valid HTTP or HTTPS URL')
    }
  }
}
