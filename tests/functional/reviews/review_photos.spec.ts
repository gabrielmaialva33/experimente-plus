import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import ReviewPolicy from '#modules/reviews/models/review_policy'
import IRoles from '#modules/roles/interfaces/role_interface'
import type User from '#modules/users/models/user'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const fixture = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'media', name)
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
})

async function reviewBy(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  author: User
) {
  return EstablishmentReview.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    user_id: author.id,
    rating: 5,
    comment: 'Com fotos.',
    status: 'published',
    photos_count: 0,
    videos_count: 0,
  })
}

async function setMaxPhotos(scenario: EstablishmentScenario, value: number) {
  await ReviewPolicy.updateOrCreate({ tenant_id: scenario.tenant.id }, { max_photos: value })
}

test.group('Review photos (ADR-0027, Anexo I item 8)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a photo is stored without its location and served as an address and a shape', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('photo-strip')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'photo-author', tenant: scenario.tenant })
    const review = await reviewBy(scenario, establishment, author)

    const uploaded = await client
      .post(`/api/v1/me/reviews/${review.id}/photos`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(author)
      .field('alt_text', 'Prato do dia na mesa')
      .file('photo', fixture('with_metadata.jpg'))
    uploaded.assertStatus(201)
    assert.sameMembers(Object.keys(uploaded.body()), ['id', 'url', 'width', 'height', 'alt_text'])
    assert.equal(uploaded.body().width, 8)
    assert.equal(uploaded.body().alt_text, 'Prato do dia na mesa')

    // What is on disk is what the public downloads: it must not carry GPS.
    const stored = await db
      .from('files')
      .join('media_assets', 'media_assets.file_id', 'files.id')
      .join(
        'establishment_review_photos',
        'establishment_review_photos.media_asset_id',
        'media_assets.id'
      )
      .where('establishment_review_photos.id', uploaded.body().id)
      .select('files.file_name', 'media_assets.checksum_sha256')
      .first()
    const bytes = await readFile(app.makePath('storage', stored.file_name))
    assert.isFalse(bytes.includes(Buffer.from([0x25, 0x88])), 'GPS pointer survived')
    assert.isFalse(bytes.includes(Buffer.from('FixtureCam')), 'device survived')
    assert.isFalse(bytes.includes(Buffer.from('shot at home')), 'comment survived')

    const listed = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers(publicHeaders(scenario))
    const photos = listed.body().data[0].photos
    assert.lengthOf(photos, 1)
    assert.sameMembers(Object.keys(photos[0]), ['id', 'url', 'width', 'height', 'alt_text'])
    // None of the internals behind the photo reach a public, cacheable response.
    // The URL necessarily addresses the stored object; the fields behind it —
    // checksum, storage key as a field, file and asset identifiers, owner — do
    // not travel.
    const body = listed.text()
    for (const internal of [
      stored.checksum_sha256,
      '"checksum_sha256"',
      '"file_name"',
      '"media_asset_id"',
      '"file_id"',
      '"owner_id"',
    ]) {
      assert.notInclude(body, internal)
    }

    await review.refresh()
    assert.equal(review.photos_count, 1)
  })

  test('the photo count is the server’s, not the client’s', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('photo-count')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'photo-count-author', tenant: scenario.tenant })

    const created = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(author)
      .json({ establishment_id: establishment.id, rating: 4, comment: 'Bom.', photos_count: 4 })
    created.assertStatus(201)
    assert.equal(created.body().photos_count, 0)
  })

  test('the operation’s policy limits how many photos a review carries', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('photo-limit')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'photo-limit-author', tenant: scenario.tenant })
    const review = await reviewBy(scenario, establishment, author)
    const upload = () =>
      client
        .post(`/api/v1/me/reviews/${review.id}/photos`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(author)
        .file('photo', fixture('valid.png'))

    await setMaxPhotos(scenario, 1)
    const first = await upload()
    first.assertStatus(201)
    const second = await upload()
    second.assertStatus(400)
    assert.include(second.body().message, 'allowed: 1')

    await setMaxPhotos(scenario, 0)
    const disabled = await upload()
    disabled.assertStatus(400)

    await review.refresh()
    assert.equal(review.photos_count, 1)
  })

  test('only the author attaches or removes photos of a review', async ({ client }) => {
    const scenario = await createEstablishmentScenario('photo-idor')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'photo-idor-author', tenant: scenario.tenant })
    const intruder = await createUser({ prefix: 'photo-idor-intruder', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'photo-idor-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const review = await reviewBy(scenario, establishment, author)
    const intruderReview = await reviewBy(scenario, establishment, intruder)
    const headers = tenantHeader(scenario.tenant.id)

    const uploaded = await client
      .post(`/api/v1/me/reviews/${review.id}/photos`)
      .headers(headers)
      .loginAs(author)
      .file('photo', fixture('valid.webp'))
    uploaded.assertStatus(201)
    const photoId = uploaded.body().id

    const foreignUpload = await client
      .post(`/api/v1/me/reviews/${review.id}/photos`)
      .headers(headers)
      .loginAs(intruder)
      .file('photo', fixture('valid.png'))
    foreignUpload.assertStatus(403)

    const foreignDelete = await client
      .delete(`/api/v1/me/reviews/${review.id}/photos/${photoId}`)
      .headers(headers)
      .loginAs(intruder)
    foreignDelete.assertStatus(403)

    // A photo addressed through a review it does not belong to is a miss.
    const crossed = await client
      .delete(`/api/v1/me/reviews/${intruderReview.id}/photos/${photoId}`)
      .headers(headers)
      .loginAs(intruder)
    crossed.assertStatus(404)

    // Moderation acts on the review, by report; it does not reach into photos here.
    const byModerator = await client
      .delete(`/api/v1/me/reviews/${review.id}/photos/${photoId}`)
      .headers(headers)
      .loginAs(moderator)
    byModerator.assertStatus(403)
  })

  test('formats outside the pipeline are refused', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('photo-format')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'photo-format-author', tenant: scenario.tenant })
    const review = await reviewBy(scenario, establishment, author)
    const headers = tenantHeader(scenario.tenant.id)

    const corrupted = await client
      .post(`/api/v1/me/reviews/${review.id}/photos`)
      .headers(headers)
      .loginAs(author)
      .file('photo', fixture('corrupted.png'))
    // Refused by the request's file validation, as establishment media is.
    corrupted.assertStatus(422)

    const missing = await client
      .post(`/api/v1/me/reviews/${review.id}/photos`)
      .headers(headers)
      .loginAs(author)
      .field('alt_text', 'sem arquivo')
    missing.assertStatus(422)

    const unchanged = await EstablishmentReview.findOrFail(review.id)
    assert.equal(unchanged.photos_count, 0)
  })

  test('removing a photo removes its rows and its file', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('photo-remove')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'photo-remove-author', tenant: scenario.tenant })
    const review = await reviewBy(scenario, establishment, author)
    const headers = tenantHeader(scenario.tenant.id)

    const uploaded = await client
      .post(`/api/v1/me/reviews/${review.id}/photos`)
      .headers(headers)
      .loginAs(author)
      .file('photo', fixture('valid.jpg'))
    const photoId = uploaded.body().id
    const stored = await db
      .from('establishment_review_photos')
      .join('media_assets', 'media_assets.id', 'establishment_review_photos.media_asset_id')
      .join('files', 'files.id', 'media_assets.file_id')
      .where('establishment_review_photos.id', photoId)
      .select('files.id as file_id', 'files.file_name', 'media_assets.id as asset_id')
      .first()

    const removed = await client
      .delete(`/api/v1/me/reviews/${review.id}/photos/${photoId}`)
      .headers(headers)
      .loginAs(author)
    removed.assertStatus(204)

    assert.isNull(await db.from('establishment_review_photos').where('id', photoId).first())
    assert.isNull(await db.from('media_assets').where('id', stored.asset_id).first())
    assert.isNull(await db.from('files').where('id', stored.file_id).first())
    await assert.rejects(() => readFile(app.makePath('storage', stored.file_name)))

    await review.refresh()
    assert.equal(review.photos_count, 0)
  })

  test('the moderator sees the photos of a reported review', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('photo-queue')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'photo-queue-author', tenant: scenario.tenant })
    const reporter = await createUser({ prefix: 'photo-queue-reporter', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'photo-queue-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const review = await reviewBy(scenario, establishment, author)
    const headers = tenantHeader(scenario.tenant.id)

    const uploaded = await client
      .post(`/api/v1/me/reviews/${review.id}/photos`)
      .headers(headers)
      .loginAs(author)
      .file('photo', fixture('valid.png'))
    await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: review.id, reason: 'inappropriate' })

    const queue = await client.get('/backoffice/reports').headers(headers).loginAs(moderator)
    queue.assertStatus(200)
    assert.include(queue.text(), JSON.stringify(uploaded.body().url).slice(1, -1))
  })
})
