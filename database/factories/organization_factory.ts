import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

export const OrganizationFactory = factory
  .define(Organization, ({ faker }) => {
    const tradeName = faker.company.name()
    const unique = faker.string.alphanumeric(8).toLowerCase()

    return {
      tenant_id: 1,
      legal_name: `${tradeName} Comércio e Serviços Ltda.`,
      trade_name: tradeName,
      slug: `${faker.helpers.slugify(tradeName).toLowerCase()}-${unique}`,
      tax_id: digits(faker.string.numeric(14)),
      email: faker.internet.email({ provider: 'example.test' }).toLowerCase(),
      phone: `43${faker.string.numeric(8)}`,
      website: `https://${unique}.example.test`,
      status: 'draft' as const,
      created_by: null,
      submitted_at: null,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      suspended_at: null,
      archived_at: null,
    }
  })
  .state('pendingReview', (organization) => {
    organization.status = 'pending_review'
    organization.submitted_at = DateTime.utc()
  })
  .state('active', (organization) => {
    const reviewedAt = DateTime.utc()
    organization.status = 'active'
    organization.submitted_at ??= reviewedAt
    organization.reviewed_by = organization.created_by
    organization.reviewed_at = reviewedAt
    organization.review_notes = null
  })
  .state('suspended', (organization) => {
    const reviewedAt = DateTime.utc()
    organization.status = 'suspended'
    organization.submitted_at ??= reviewedAt
    organization.reviewed_by = organization.created_by
    organization.reviewed_at ??= reviewedAt
    organization.suspended_at = reviewedAt
  })
  .state('archived', (organization) => {
    const archivedAt = DateTime.utc()
    organization.status = 'archived'
    organization.archived_at = archivedAt
  })
  .build()

export const OrganizationMemberFactory = factory
  .define(OrganizationMember, () => ({
    tenant_id: 1,
    organization_id: 1,
    user_id: 1,
    role: 'editor' as const,
    status: 'active' as const,
    invited_by: null,
    joined_at: DateTime.utc(),
    suspended_at: null,
    removed_at: null,
  }))
  .state('owner', (member) => {
    member.role = 'owner'
  })
  .state('admin', (member) => {
    member.role = 'admin'
  })
  .state('analyst', (member) => {
    member.role = 'analyst'
  })
  .state('suspended', (member) => {
    member.status = 'suspended'
    member.suspended_at = DateTime.utc()
  })
  .state('removed', (member) => {
    member.status = 'removed'
    member.removed_at = DateTime.utc()
  })
  .build()
