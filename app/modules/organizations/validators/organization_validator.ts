import vine from '@vinejs/vine'

import {
  MUTABLE_ORGANIZATION_MEMBER_STATUSES,
  ORGANIZATION_CLAIM_STATUSES,
  ORGANIZATION_ROLES,
  ORGANIZATION_STATUSES,
} from '#modules/organizations/interfaces/organization_interface'

const organizationFields = {
  legal_name: vine.string().trim().minLength(2).maxLength(180),
  trade_name: vine.string().trim().minLength(2).maxLength(160),
  slug: vine.string().trim().minLength(2).maxLength(180).optional(),
  tax_id: vine.string().trim().minLength(14).maxLength(18),
  email: vine.string().email().trim().maxLength(254),
  phone: vine.string().trim().minLength(10).maxLength(20),
  website: vine.string().trim().maxLength(2048).nullable().optional(),
}

export const createOrganizationValidator = vine.compile(vine.object(organizationFields))

export const updateOrganizationValidator = vine.compile(
  vine.object({
    legal_name: organizationFields.legal_name.optional(),
    trade_name: organizationFields.trade_name.optional(),
    slug: organizationFields.slug,
    tax_id: organizationFields.tax_id.optional(),
    email: organizationFields.email.optional(),
    phone: organizationFields.phone.optional(),
    website: organizationFields.website,
  })
)

export const listOrganizationsValidator = vine.compile(
  vine.object({
    status: vine.enum(ORGANIZATION_STATUSES).optional(),
  })
)

export const updateOrganizationMemberValidator = vine.compile(
  vine.object({
    role: vine.enum(ORGANIZATION_ROLES).optional(),
    status: vine.enum(MUTABLE_ORGANIZATION_MEMBER_STATUSES).optional(),
  })
)

export const createOrganizationInvitationValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim().maxLength(254),
    role: vine.enum(ORGANIZATION_ROLES),
  })
)

export const acceptOrganizationInvitationValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(32).maxLength(256),
  })
)

export const createOrganizationClaimValidator = vine.compile(
  vine.object({
    message: vine.string().trim().maxLength(2000).nullable().optional(),
    evidence: vine
      .object({
        description: vine.string().trim().maxLength(2000).optional(),
        document_file_ids: vine.array(vine.number().min(1)).maxLength(10).optional(),
      })
      .nullable()
      .optional(),
  })
)

export const listOrganizationClaimsValidator = vine.compile(
  vine.object({
    status: vine.enum(ORGANIZATION_CLAIM_STATUSES).optional(),
  })
)

export const reviewDecisionValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(3).maxLength(4000),
  })
)
