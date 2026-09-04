import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

function section(contents: string, start: string, end: string): string {
  const startIndex = contents.indexOf(start)
  const endIndex = contents.indexOf(end, startIndex + start.length)

  expect(startIndex, `Missing section start: ${start}`).toBeGreaterThanOrEqual(0)
  expect(endIndex, `Missing section end: ${end}`).toBeGreaterThan(startIndex)
  return contents.slice(startIndex, endIndex)
}

function occurrences(contents: string, needle: string): number {
  return contents.split(needle).length - 1
}

describe('Portal overview request contract', () => {
  it('derives feedback targets from the overview already loaded by the controller', () => {
    const controllerIndex = section(
      source('app/modules/portal/controllers/partner_portal_controller.ts'),
      'async index(',
      'async newOrganization('
    )
    expect(occurrences(controllerIndex, 'portalService.overview(')).toBe(1)
    expect(occurrences(controllerIndex, 'resourceAuthorization.forActorContext(')).toBe(1)
    expect(controllerIndex).toContain('feedbackTargetsFromOverview(overview)')
    expect(controllerIndex).not.toContain('portalService.feedbackTargets(')
  })

  it('loads establishments and completeness once per authorized organization batch', () => {
    const portalService = source('app/modules/portal/services/partner_portal_service.ts')
    const overview = section(portalService, 'async overview(', 'async organization(')
    const batchLoader = section(
      portalService,
      'private async establishmentSummariesForOrganizations(',
      'private organizationSummary('
    )
    const completenessService = source(
      'app/modules/establishments/services/establishment_completeness_service.ts'
    )
    const completenessBatch = section(
      completenessService,
      'async checkManyForAuthorizedOrganizations(',
      'private loadedCompletenessRevision('
    )

    expect(occurrences(overview, 'organizationService.listFromAccessSnapshot(')).toBe(1)
    expect(overview).not.toContain('organizationService.list(')
    expect(portalService).not.toContain('OrganizationMember.query()')
    expect(occurrences(batchLoader, 'listForAuthorizedOrganizations(')).toBe(1)
    expect(occurrences(batchLoader, 'checkManyForAuthorizedOrganizations(')).toBe(1)
    expect(batchLoader).not.toContain('Promise.all')
    expect(completenessBatch).not.toContain('this.check(')
    expect(occurrences(completenessBatch, 'effectiveAttributesService.resolveMany(')).toBe(1)
    expect(completenessBatch).not.toContain('Promise.all')
  })

  it('uses the same canonical evaluator for individual and batched completeness', () => {
    const service = source(
      'app/modules/establishments/services/establishment_completeness_service.ts'
    )
    const individual = section(
      service,
      'async check(',
      'async checkManyForAuthorizedOrganizations('
    )
    const batch = section(
      service,
      'async checkManyForAuthorizedOrganizations(',
      'private loadedCompletenessRevision('
    )
    expect(individual).toContain('evaluateEstablishmentCompleteness({')
    expect(batch).toContain('evaluateEstablishmentCompleteness({')
  })

  it('keeps the overview neutral and consumes resource-scoped actions only as flags', () => {
    const page = source('inertia/pages/portal/index.tsx')
    const portalService = source('app/modules/portal/services/partner_portal_service.ts')

    expect(page).toContain('Organizações disponíveis')
    expect(page).not.toContain('Suas organizações')
    expect(page).not.toContain('participação ativa')
    expect(page).toContain('organization.allowed_actions.organizations.read')
    expect(page).toContain('organization.allowed_actions.establishments.read')
    expect(page).toContain('step.available')
    expect(page).not.toContain('resolveRouteMetadata(step.href)')
    expect(portalService).toContain('forOrganizationFromContext(')
  })
})
