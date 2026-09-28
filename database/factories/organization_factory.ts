import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import {
  asciiSlug,
  brazilianPhone,
  businessName,
  cnpj,
  emailFor,
  personName,
} from '#database/factories/support/pt_br'
import Organization from '#modules/organizations/models/organization'
import OrganizationClaim from '#modules/organizations/models/organization_claim'
import OrganizationInvitation from '#modules/organizations/models/organization_invitation'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationInvitationTokenService from '#modules/organizations/services/organization_invitation_token_service'

export const OrganizationFactory = factory
  .define(Organization, ({ faker }) => {
    const tradeName = businessName(faker)
    const unique = faker.string.alphanumeric(8).toLowerCase()

    return {
      tenant_id: 1,
      legal_name: `${tradeName} Comércio e Serviços Ltda.`,
      trade_name: tradeName,
      slug: `${asciiSlug(tradeName)}-${unique}`,
      // Valid check digits, so the fixture also passes the domain's CNPJ validation.
      tax_id: cnpj(faker),
      email: `contato.${unique}@example.test`,
      phone: brazilianPhone(faker),
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

/**
 * A pending claim over an organization of the same tenant, with the pitch
 * and evidence a claimant sends. The claimant must not be a member already;
 * only one claim per person stays pending. Approving or rejecting records a
 * reviewer — the claimant stands in so the row stays valid; merge
 * `reviewed_by` with a moderator.
 */
export const OrganizationClaimFactory = factory
  .define(OrganizationClaim, () => ({
    tenant_id: 1,
    organization_id: 1,
    claimant_id: 1,
    status: 'pending' as const,
    message: 'Sou sócio-administrador da empresa e quero assumir a gestão desta página.',
    evidence: { description: 'Contrato social e cartão CNPJ fictícios, do cenário de teste.' },
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
  }))
  .state('approved', (claim) => {
    claim.status = 'approved'
    claim.reviewed_by ??= claim.claimant_id
    claim.reviewed_at = DateTime.utc()
    claim.review_notes = 'Documentação conferida.'
  })
  .state('rejected', (claim) => {
    claim.status = 'rejected'
    claim.reviewed_by ??= claim.claimant_id
    claim.reviewed_at = DateTime.utc()
    claim.review_notes = 'O documento enviado não comprova vínculo com a empresa.'
  })
  .state('cancelled', (claim) => {
    claim.status = 'cancelled'
  })
  .build()

/**
 * A pending invitation to a fresh `example.test` address, stored the way
 * `OrganizationInvitationService` stores it: the keyed digest of a token and
 * the configured expiry. The token itself is thrown away; to accept one in a
 * test, merge `token_hash: new OrganizationInvitationTokenService().hash(token)`
 * for a token of your own. Merge `invited_by` with a member of the
 * organization.
 */
export const OrganizationInvitationFactory = factory
  .define(OrganizationInvitation, ({ faker }) => {
    const { tokenHash, expiresAt } = new OrganizationInvitationTokenService().generate()
    return {
      tenant_id: 1,
      organization_id: 1,
      email: emailFor(faker, personName(faker)),
      role: 'editor' as const,
      token_hash: tokenHash,
      invited_by: 1,
      expires_at: expiresAt,
      accepted_by: null,
      accepted_at: null,
      revoked_by: null,
      revoked_at: null,
    }
  })
  .state('owner', (invitation) => {
    invitation.role = 'owner'
  })
  .state('admin', (invitation) => {
    invitation.role = 'admin'
  })
  .state('analyst', (invitation) => {
    invitation.role = 'analyst'
  })
  .state('accepted', (invitation) => {
    // Merge `accepted_by` with the invitee's account; the inviter only keeps the pair valid.
    invitation.accepted_by ??= invitation.invited_by
    invitation.accepted_at = DateTime.utc()
  })
  .state('revoked', (invitation) => {
    invitation.revoked_by ??= invitation.invited_by
    invitation.revoked_at = DateTime.utc()
  })
  .state('expired', (invitation) => {
    invitation.expires_at = DateTime.utc().minus({ hours: 1 })
  })
  .build()
