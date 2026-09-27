import { describe, expect, it } from 'vitest'

import {
  editorIssueFieldLabel,
  editorSectionForField,
  getRevisionStatusMeta,
  groupEditorIssues,
  hasAttributeInputValue,
  localizeCompletenessIssue,
  revisionPresentationStatus,
  type EditorIssue,
} from '~/lib/establishment_editor'

const issue = (code: string, field: string, message = 'Original message'): EditorIssue => ({
  code,
  field,
  message,
  severity: 'blocking',
})

describe('establishment editor utilities', () => {
  it('routes gate fields to the section that can solve them', () => {
    expect(editorSectionForField('public_name')).toBe('identity')
    expect(editorSectionForField('slug')).toBe('identity')
    expect(editorSectionForField('address.coordinates')).toBe('address')
    expect(editorSectionForField('categories')).toBe('categories')
    expect(editorSectionForField('attributes.wifi')).toBe('attributes')
    expect(editorSectionForField('hours')).toBe('hours')
    expect(editorSectionForField('media.cover')).toBe('media')
    expect(editorSectionForField('organization_id')).toBe('readiness')
  })

  it('presents technical issue fields with the shared human catalog and a section fallback', () => {
    expect(editorIssueFieldLabel('public_name')).toBe('Nome público')
    expect(editorIssueFieldLabel('slug')).toBe('URL pública')
    expect(editorIssueFieldLabel('address.coordinates')).toBe('Coordenadas no mapa')
    expect(editorIssueFieldLabel('attributes.wifi')).toBe('Características')
    expect(editorIssueFieldLabel('unknown_backend_field')).toBe('Dados do lugar')
  })

  it('groups issues without losing their original payload', () => {
    const issues = [
      issue('public_identity_missing', 'public_name'),
      issue('coordinates_missing', 'address.coordinates'),
      issue('media_missing', 'media'),
    ]

    const grouped = groupEditorIssues(issues)

    expect(grouped.identity).toEqual([issues[0]])
    expect(grouped.address).toEqual([issues[1]])
    expect(grouped.media).toEqual([issues[2]])
    expect(grouped.readiness).toEqual([])
  })

  it('localizes known and dynamic completeness messages', () => {
    expect(localizeCompletenessIssue(issue('media_missing', 'media'))).toBe(
      'Adicione ao menos uma imagem do lugar.'
    )
    expect(localizeCompletenessIssue(issue('slug_already_published', 'slug'))).toBe(
      'O endereço público já é usado por outro lugar desta cidade. Altere o nome público para gerar outro endereço.'
    )
    expect(
      localizeCompletenessIssue(
        issue('required_attribute_missing', 'attributes.wifi', 'Wi-Fi is required')
      )
    ).toBe('Wi-Fi é obrigatório.')
    expect(localizeCompletenessIssue(issue('custom', 'custom', 'Mensagem do servidor'))).toBe(
      'Mensagem do servidor'
    )
  })

  it('speaks Portuguese for every publication gate blocker on the moderation review', () => {
    for (const [code, field] of [
      ['coordinates_missing', 'address.coordinates'],
      ['approved_cover_missing', 'media.cover'],
      ['media_pending', 'media'],
      ['media_quarantined', 'media'],
      ['review_issues_open', 'review_issues'],
    ] as const) {
      const english = 'Exactly one approved cover image is required before publication'
      const message = localizeCompletenessIssue(issue(code, field, english))
      expect(message).not.toBe(english)
      expect(message).not.toMatch(/\b(required|must|before publication)\b/i)
    }
    expect(localizeCompletenessIssue(issue('approved_cover_missing', 'media.cover'))).toBe(
      'A publicação exige exatamente uma imagem de capa aprovada.'
    )
    expect(localizeCompletenessIssue(issue('media_pending', 'media'))).toBe(
      'Todas as imagens do lugar precisam ser analisadas antes da publicação.'
    )
  })

  it('describes the revision workflow in Portuguese', () => {
    expect(getRevisionStatusMeta('draft').label).toBe('Rascunho')
    expect(getRevisionStatusMeta('changes_requested').label).toBe('Correções pedidas')
    expect(getRevisionStatusMeta('pending_review').label).toBe('Em moderação')
  })

  it('presents the current publication without changing its approved technical status', () => {
    const technicalStatus = 'approved'
    const presentationStatus = revisionPresentationStatus(technicalStatus, 31, 31)

    expect(technicalStatus).toBe('approved')
    expect(getRevisionStatusMeta(presentationStatus)).toMatchObject({
      label: 'Publicada',
      description: 'Estes dados estão publicados no app e no site.',
    })
    expect(revisionPresentationStatus(technicalStatus, 31, 18)).toBe('approved')
  })

  it('treats false, zero and selected options as legitimate attribute values', () => {
    expect(hasAttributeInputValue(false, [])).toBe(true)
    expect(hasAttributeInputValue(0, [])).toBe(true)
    expect(hasAttributeInputValue('', [3])).toBe(true)
    expect(hasAttributeInputValue('   ', [])).toBe(false)
    expect(hasAttributeInputValue(null, [])).toBe(false)
  })
})

describe('revision status badges', () => {
  // Web audit W6: white `-foreground` text on the soft tint measured 1.13:1.
  it('writes a soft status background with its accent text, never its foreground', () => {
    for (const status of [
      'draft',
      'changes_requested',
      'pending_review',
      'approved',
      'rejected',
      'published',
    ]) {
      const { className } = getRevisionStatusMeta(status)
      expect(className).not.toMatch(/foreground,|-foreground\)/)
      const tone = className.match(/bg-(\w+)-soft/)?.[1]
      if (tone) expect(className).toContain('text-' + tone + '-accent')
    }
  })
})
