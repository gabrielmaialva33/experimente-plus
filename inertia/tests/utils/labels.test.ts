import { describe, expect, it } from 'vitest'

import {
  AVAILABILITY_TYPE_LABELS,
  GLOBAL_ROLE_LABELS,
  MEDIA_MODERATION_STATUS_LABELS,
  OPERATION_ROLE_LABELS,
  ORGANIZATION_ROLE_LABELS,
  ORGANIZATION_STATUS_LABELS,
  PILOT_FEEDBACK_CONTEXT_LABELS,
  PILOT_FEEDBACK_STATUS_LABELS,
  REVIEW_ISSUE_SEVERITY_LABELS,
  REVISION_EVENT_TYPE_LABELS,
  availabilityTypeLabel,
  formatDate,
  formatDateTime,
  globalRoleDescription,
  globalRoleLabel,
  mediaModerationStatusLabel,
  organizationRoleLabel,
  organizationStatusLabel,
  operationRoleLabel,
  permissionActionLabel,
  permissionContextLabel,
  permissionResourceLabel,
  pilotFeedbackContextLabel,
  pilotFeedbackStatusLabel,
  reviewIssueSeverityLabel,
  revisionEventTypeLabel,
  revisionStatusLabel,
} from '~/lib/labels'
import { getRevisionStatusMeta } from '~/lib/establishment_editor'

// Mirrors of the backend enums (app/modules/*/interfaces). If one of these
// asserts fails, a new domain value shipped without a pt-BR label.
const ORGANIZATION_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'active',
  'rejected',
  'suspended',
  'archived',
]

const ORGANIZATION_ROLES = ['owner', 'admin', 'editor', 'analyst']

const PILOT_FEEDBACK_CONTEXTS = [
  'general',
  'onboarding',
  'organization',
  'establishment',
  'catalog',
  'analytics',
  'moderation',
]

const PILOT_FEEDBACK_STATUSES = ['new', 'in_review', 'resolved', 'dismissed']

const REVISION_STATUSES = [
  'draft',
  'changes_requested',
  'pending_review',
  'approved',
  'rejected',
  'published',
]

const AVAILABILITY_TYPES = ['regular_hours', 'appointment_only', 'always_open']

const MEDIA_MODERATION_STATUSES = ['pending', 'approved', 'rejected', 'quarantined', 'removed']

const REVISION_EVENT_TYPES = [
  'created',
  'submitted',
  'changes_requested',
  'resubmitted',
  'approved',
  'rejected',
  'published',
  'draft_cloned',
]

const REVIEW_ISSUE_SEVERITIES = ['blocking', 'warning']

describe('labels', () => {
  it('covers every organization status with a pt-BR label', () => {
    for (const status of ORGANIZATION_STATUSES) {
      expect(ORGANIZATION_STATUS_LABELS[status], status).toBeTruthy()
      expect(organizationStatusLabel(status)).not.toBe(status)
    }
  })

  it('covers every organization role and falls back to Membro', () => {
    for (const role of ORGANIZATION_ROLES) {
      expect(ORGANIZATION_ROLE_LABELS[role], role).toBeTruthy()
      expect(organizationRoleLabel(role)).not.toBe(role)
    }

    expect(organizationRoleLabel(null)).toBe('Membro')
    expect(organizationRoleLabel(undefined)).toBe('Membro')
    expect(organizationRoleLabel('member')).toBe('Membro')
  })

  it('keeps operation memberships separate from global roles', () => {
    expect(OPERATION_ROLE_LABELS).toMatchObject({
      owner: 'Responsável pela operação',
      member: 'Membro da operação',
    })
    expect(operationRoleLabel('owner')).toBe('Responsável pela operação')
    expect(operationRoleLabel(null)).toBe('Membro da operação')

    expect(GLOBAL_ROLE_LABELS.user).toBe('Explorador')
    expect(globalRoleLabel('moderator')).toBe('Moderador')
    expect(globalRoleDescription('user')).toContain('vínculo com uma organização')
  })

  it('presents permission identifiers as readable pt-BR labels', () => {
    expect(permissionResourceLabel('benefit_accesses')).toBe('Acessos a edições')
    expect(permissionActionLabel('request_changes')).toBe('Solicitar correções')
    expect(permissionContextLabel('own')).toBe('Próprios')
    expect(permissionResourceLabel('custom_resource')).toBe('Custom resource')
  })

  it('covers every pilot feedback context, including general and organization', () => {
    for (const context of PILOT_FEEDBACK_CONTEXTS) {
      expect(PILOT_FEEDBACK_CONTEXT_LABELS[context], context).toBeTruthy()
    }

    expect(pilotFeedbackContextLabel('general')).toBe('Geral')
    expect(pilotFeedbackContextLabel('organization')).toBe('Organização')
  })

  it('covers every pilot feedback status', () => {
    for (const status of PILOT_FEEDBACK_STATUSES) {
      expect(PILOT_FEEDBACK_STATUS_LABELS[status], status).toBeTruthy()
      expect(pilotFeedbackStatusLabel(status)).not.toBe(status)
    }
  })

  it('covers every availability type', () => {
    for (const type of AVAILABILITY_TYPES) {
      expect(AVAILABILITY_TYPE_LABELS[type], type).toBeTruthy()
      expect(availabilityTypeLabel(type)).not.toBe(type)
    }
  })

  it('covers every media moderation status, including removed', () => {
    for (const status of MEDIA_MODERATION_STATUSES) {
      expect(MEDIA_MODERATION_STATUS_LABELS[status], status).toBeTruthy()
      expect(mediaModerationStatusLabel(status)).not.toBe(status)
    }
  })

  it('covers every revision event type', () => {
    for (const eventType of REVISION_EVENT_TYPES) {
      expect(REVISION_EVENT_TYPE_LABELS[eventType], eventType).toBeTruthy()
      expect(revisionEventTypeLabel(eventType)).not.toBe(eventType)
    }
  })

  it('covers every review issue severity', () => {
    for (const severity of REVIEW_ISSUE_SEVERITIES) {
      expect(REVIEW_ISSUE_SEVERITY_LABELS[severity], severity).toBeTruthy()
    }

    expect(reviewIssueSeverityLabel('blocking')).toBe('Bloqueio')
    expect(reviewIssueSeverityLabel('warning')).toBe('Aviso')
  })

  it('keeps unknown values readable instead of throwing', () => {
    expect(organizationStatusLabel('unknown_status')).toBe('unknown_status')
    expect(pilotFeedbackContextLabel('unknown_context')).toBe('unknown_context')
    expect(pilotFeedbackStatusLabel('unknown_status')).toBe('unknown_status')
    expect(availabilityTypeLabel('unknown_type')).toBe('unknown_type')
    expect(mediaModerationStatusLabel('unknown_status')).toBe('unknown_status')
    expect(revisionEventTypeLabel('unknown_event')).toBe('unknown_event')
    expect(reviewIssueSeverityLabel('unknown_severity')).toBe('unknown_severity')
  })

  it('delegates revision status labels to getRevisionStatusMeta', () => {
    for (const status of REVISION_STATUSES) {
      expect(revisionStatusLabel(status)).toBe(getRevisionStatusMeta(status).label)
      expect(revisionStatusLabel(status)).not.toBe(status)
    }
  })

  it('formats dates in pt-BR and degrades to an empty string', () => {
    const date = new Date(2026, 7, 26, 14, 5)

    expect(formatDate(date)).toBe('26/08/2026')
    expect(formatDateTime(date)).toMatch(/^26\/08\/2026,? 14:05$/)

    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime('')).toBe('')
    expect(formatDateTime('not-a-date')).toBe('')
  })
})
