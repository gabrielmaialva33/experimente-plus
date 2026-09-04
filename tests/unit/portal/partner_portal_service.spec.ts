import { test } from '@japa/runner'

import PartnerPortalService from '#modules/portal/services/partner_portal_service'

test.group('Partner Portal overview batching', () => {
  test('loads multiple organizations and establishments through one behavioral batch', async ({
    assert,
  }) => {
    const organizations = [
      organizationModel(10, 'Rede Aurora'),
      organizationModel(11, 'Rede Horizonte'),
    ]
    const establishments = [
      establishmentModel(21, 10, 'Aurora Centro', 'draft'),
      establishmentModel(22, 10, 'Aurora Norte', 'pending_review'),
      establishmentModel(23, 11, 'Horizonte Sul', 'draft'),
    ]
    let organizationLoads = 0
    let establishmentLoads = 0
    let completenessLoads = 0
    let actionProjections = 0
    let loadedOrganizationIds: readonly number[] = []

    const organizationService = {
      async listFromAccessSnapshot() {
        organizationLoads += 1
        return organizations
      },
    }
    const establishmentRepository = {
      async listForAuthorizedOrganizations(_tenantId: number, organizationIds: readonly number[]) {
        establishmentLoads += 1
        loadedOrganizationIds = organizationIds
        return establishments
      },
    }
    const completenessService = {
      async checkManyForAuthorizedOrganizations() {
        completenessLoads += 1
        return new Map(
          establishments.map((establishment) => [
            establishment.id,
            {
              eligible: true,
              score: 100,
              blocking_issues: [],
              warnings: [],
              checked_at: '2026-09-04T00:00:00.000Z',
              rules_version: 2,
            },
          ])
        )
      },
    }
    const allowedActions = organizationActions()
    const resourceAuthorization = {
      forOrganizationFromContext() {
        actionProjections += 1
        return allowedActions
      },
    }
    const service = new PartnerPortalService(
      organizationService as never,
      establishmentRepository as never,
      completenessService as never,
      {} as never,
      resourceAuthorization as never,
      {} as never
    )
    const authorization = {
      access_snapshot: {
        platform_access: null,
        has_active_organization_membership: true,
        organization_accesses: [
          { organization_id: 10, capabilities: { role: 'analyst' } },
          { organization_id: 11, capabilities: { role: 'editor' } },
        ],
      },
      permission_names: new Set<string>(),
      allowed_actions: allowedActions,
    }

    const overview = await service.overview(7, {} as never, authorization as never)

    assert.equal(organizationLoads, 1)
    assert.equal(establishmentLoads, 1)
    assert.deepEqual(loadedOrganizationIds, [10, 11])
    assert.equal(completenessLoads, 1)
    assert.equal(actionProjections, 2)
    assert.deepInclude(overview.totals, { organizations: 2, establishments: 3 })
    assert.equal(overview.organizations[0].establishments[0].public_name, 'Aurora Centro')
  })
})

function organizationModel(id: number, tradeName: string) {
  return {
    id,
    tenant_id: 7,
    status: 'active',
    serialize: () => ({
      id,
      legal_name: `${tradeName} Ltda.`,
      trade_name: tradeName,
      slug: tradeName.toLowerCase().replace(' ', '-'),
      tax_id: String(id),
      email: `${id}@example.test`,
      phone: '43999999999',
      website: null,
      status: 'active',
    }),
  }
}

function establishmentModel(
  id: number,
  organizationId: number,
  publicName: string,
  status: string
) {
  return {
    id,
    tenant_id: 7,
    organization_id: organizationId,
    lifecycle_status: 'active',
    business_status: 'open',
    published_revision_id: null,
    published_revision: null,
    revisions: [{ id: id * 10, status, public_name: publicName, slug: null, city_id: null }],
  }
}

function organizationActions() {
  return {
    organizations: { read: true, update: false, submit: false },
    establishments: {
      read: true,
      list: true,
      create: false,
      create_revision: false,
      update: false,
      submit: false,
      archive: false,
    },
    benefit_offers: {
      read: true,
      list: true,
      create: false,
      update: false,
      activate: false,
      pause: false,
      archive: false,
    },
    redemptions: { read: true, validate: false },
    analytics: { read: true },
    pilot_feedback: { create: true },
  }
}
