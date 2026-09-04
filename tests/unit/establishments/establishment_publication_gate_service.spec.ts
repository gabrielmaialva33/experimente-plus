import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { test } from '@japa/runner'

import type EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import type EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import type EstablishmentRevisionReviewIssueRepository from '#modules/establishments/repositories/establishment_revision_review_issue_repository'
import type EstablishmentCompletenessService from '#modules/establishments/services/establishment_completeness_service'
import EstablishmentPublicationGateService from '#modules/establishments/services/establishment_publication_gate_service'

const establishment = { id: 41 }
const revision = {
  id: 83,
  establishment_id: establishment.id,
  city_id: 17,
  slug: 'cafe-central',
  rules_version: 2,
  address: { latitude: -23.18, longitude: -50.65 },
  media: [{ id: 91, is_cover: true, moderation_status: 'approved' }],
}
const complete = {
  eligible: true,
  score: 100,
  blocking_issues: [],
  warnings: [],
  checked_at: '2026-09-04T00:00:00.000Z',
  rules_version: 2,
}

test.group('Establishment publication slug gate', () => {
  test('takes the transaction advisory lock before rechecking the published slug', async ({
    assert,
  }) => {
    const calls: string[] = []
    const transaction = {} as TransactionClientContract
    const service = new EstablishmentPublicationGateService(
      {
        async findLocked(_tenantId: number, _establishmentId: number, client: unknown) {
          assert.strictEqual(client, transaction)
          calls.push('establishment:lock')
          return establishment
        },
      } as unknown as EstablishmentRepository,
      {
        async findAggregate(_tenantId: number, _revisionId: number, client: unknown) {
          assert.strictEqual(client, transaction)
          calls.push('revision:aggregate')
          return revision
        },
        async lockSlugForPublication(
          tenantId: number,
          cityId: number | null,
          slug: string,
          client: unknown
        ) {
          assert.deepEqual([tenantId, cityId, slug], [5, revision.city_id, revision.slug])
          assert.strictEqual(client, transaction)
          calls.push('slug:lock')
        },
        async isPublishedSlugTaken(
          tenantId: number,
          cityId: number | null,
          slug: string,
          excludeEstablishmentId: number,
          client: unknown
        ) {
          assert.deepEqual(
            [tenantId, cityId, slug, excludeEstablishmentId],
            [5, revision.city_id, revision.slug, establishment.id]
          )
          assert.strictEqual(client, transaction)
          calls.push('slug:recheck')
          return true
        },
      } as unknown as EstablishmentRevisionRepository,
      {
        async countOpenBlocking() {
          calls.push('issues:count')
          return 0
        },
      } as unknown as EstablishmentRevisionReviewIssueRepository,
      {
        async check() {
          calls.push('completeness:check')
          return complete
        },
      } as unknown as EstablishmentCompletenessService
    )

    const result = await service.check(5, establishment.id, revision.id, {} as never, transaction)

    assert.deepEqual(calls, [
      'establishment:lock',
      'revision:aggregate',
      'completeness:check',
      'slug:lock',
      'slug:recheck',
      'issues:count',
    ])
    assert.isFalse(result.eligible)
    assert.deepInclude(result.blocking_issues[0], {
      code: 'slug_already_published',
      field: 'slug',
      severity: 'blocking',
      metadata: { city_id: revision.city_id, slug: revision.slug },
    })
  })

  test('checks the preview without attempting an advisory lock outside a transaction', async ({
    assert,
  }) => {
    let lockCalled = false
    let checkedWithoutClient = false
    const service = new EstablishmentPublicationGateService(
      {
        async findByIdForTenant() {
          return establishment
        },
      } as unknown as EstablishmentRepository,
      {
        async findAggregate() {
          return revision
        },
        async lockSlugForPublication() {
          lockCalled = true
        },
        async isPublishedSlugTaken(
          _tenantId: number,
          _cityId: number | null,
          _slug: string,
          _excludeEstablishmentId: number,
          client: unknown
        ) {
          checkedWithoutClient = client === undefined
          return false
        },
      } as unknown as EstablishmentRevisionRepository,
      {
        async countOpenBlocking() {
          return 0
        },
      } as unknown as EstablishmentRevisionReviewIssueRepository,
      {
        async check() {
          return complete
        },
      } as unknown as EstablishmentCompletenessService
    )

    const result = await service.check(5, establishment.id, revision.id, {} as never)

    assert.isTrue(result.eligible)
    assert.isTrue(checkedWithoutClient)
    assert.isFalse(lockCalled)
  })

  test('uses the post-lock recheck instead of a stale completeness conflict', async ({
    assert,
  }) => {
    const transaction = {} as TransactionClientContract
    let lockCalled = false
    let recheckCalled = false
    const service = new EstablishmentPublicationGateService(
      {
        async findLocked() {
          return establishment
        },
      } as unknown as EstablishmentRepository,
      {
        async findAggregate() {
          return revision
        },
        async lockSlugForPublication() {
          lockCalled = true
        },
        async isPublishedSlugTaken() {
          recheckCalled = true
          return false
        },
      } as unknown as EstablishmentRevisionRepository,
      {
        async countOpenBlocking() {
          return 0
        },
      } as unknown as EstablishmentRevisionReviewIssueRepository,
      {
        async check() {
          return {
            ...complete,
            eligible: false,
            score: 99,
            blocking_issues: [
              {
                code: 'slug_already_published',
                field: 'slug',
                message: 'Conflito detectado antes do lock',
                severity: 'blocking' as const,
              },
            ],
          }
        },
      } as unknown as EstablishmentCompletenessService
    )

    const result = await service.check(5, establishment.id, revision.id, {} as never, transaction)

    assert.isTrue(lockCalled)
    assert.isTrue(recheckCalled)
    assert.isTrue(result.eligible)
    assert.equal(result.score, 100)
    assert.notInclude(
      result.blocking_issues.map((issue) => issue.code),
      'slug_already_published'
    )
  })
})
