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
    expect(editorIssueFieldLabel('unknown_backend_field')).toBe('Ficha')
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
      'Adicione ao menos uma imagem para representar a unidade.'
    )
    expect(localizeCompletenessIssue(issue('slug_already_published', 'slug'))).toBe(
      'A URL pública já está em uso por outra unidade desta cidade. Altere o nome público para gerar um endereço diferente.'
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

  it('describes the revision workflow in Portuguese', () => {
    expect(getRevisionStatusMeta('draft').label).toBe('Rascunho')
    expect(getRevisionStatusMeta('changes_requested').label).toBe('Correções solicitadas')
    expect(getRevisionStatusMeta('pending_review').label).toBe('Em moderação')
  })

  it('presents the current publication without changing its approved technical status', () => {
    const technicalStatus = 'approved'
    const presentationStatus = revisionPresentationStatus(technicalStatus, 31, 31)

    expect(technicalStatus).toBe('approved')
    expect(getRevisionStatusMeta(presentationStatus)).toMatchObject({
      label: 'Publicada',
      description: 'Esta revisão está disponível no catálogo público.',
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
