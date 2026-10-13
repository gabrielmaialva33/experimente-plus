import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Establishment from '#modules/establishments/models/establishment'
import StoredFile from '#modules/files/models/file'
import MediaAsset from '#modules/media/models/media_asset'
import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'
import type User from '#modules/users/models/user'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

/** Published `minutesAgo` before now, so the order of a list is the order of the fixture. */
async function experience(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  title: string,
  minutesAgo: number,
  state: 'published' | 'draft' | 'archived' = 'published'
) {
  const published = state !== 'draft'
  return EstablishmentExperience.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: scenario.owner.id,
    title,
    description: 'Uma hora de cafés especiais.',
    status: state,
    published_snapshot: published ? { title, description: 'Uma hora de cafés especiais.' } : null,
    published_at: published ? DateTime.utc().minus({ minutes: minutesAgo }) : null,
    archived_by: state === 'archived' ? scenario.owner.id : null,
    archived_at: state === 'archived' ? DateTime.utc() : null,
  })
}

async function event(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  title: string,
  minutesAgo: number,
  hoursFromNow: { start: number; end: number }
) {
  const starts = DateTime.utc().plus({ hours: hoursFromNow.start })
  const ends = DateTime.utc().plus({ hours: hoursFromNow.end })
  return EstablishmentEvent.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: scenario.owner.id,
    title,
    description: null,
    status: 'published',
    starts_at: starts,
    ends_at: ends,
    published_snapshot: {
      title,
      description: null,
      starts_at: starts.toISO(),
      ends_at: ends.toISO(),
    },
    published_at: DateTime.utc().minus({ minutes: minutesAgo }),
  })
}

async function showcase(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  title: string,
  minutesAgo: number
) {
  return EstablishmentShowcaseItem.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: scenario.owner.id,
    title,
    description: null,
    status: 'published',
    informational_price_cents: 2500,
    published_snapshot: { title, description: null, informational_price_cents: 2500 },
    published_at: DateTime.utc().minus({ minutes: minutesAgo }),
  })
}

/** An image of the item, approved or still waiting for moderation. */
async function image(
  scenario: EstablishmentScenario,
  content: EstablishmentExperience,
  options: { altText: string; approved: boolean; isCover: boolean; sortOrder: number }
) {
  const file = await StoredFile.create({
    owner_id: scenario.owner.id,
    tenant_id: scenario.tenant.id,
    client_name: 'foto.png',
    file_name: `content-${content.id}-${options.sortOrder}.png`,
    file_size: 128,
    file_type: 'image/png',
    file_category: 'image',
    url: `/storage/content-${content.id}-${options.sortOrder}.png`,
  })
  const asset = await MediaAsset.create({
    tenant_id: scenario.tenant.id,
    establishment_id: content.establishment_id,
    file_id: file.id,
    media_type: 'image',
    file_extension: 'png',
    mime_type: 'image/png',
    checksum_sha256: 'b'.repeat(64),
    width: 800,
    height: 600,
    created_by: scenario.owner.id,
  })
  await db.table('partner_content_media').insert({
    tenant_id: scenario.tenant.id,
    establishment_id: content.establishment_id,
    experience_id: content.id,
    media_asset_id: asset.id,
    is_cover: options.isCover,
    sort_order: options.sortOrder,
    alt_text: options.altText,
    moderation_status: options.approved ? 'approved' : 'pending',
    reviewed_by: options.approved ? scenario.owner.id : null,
    reviewed_at: options.approved ? new Date() : null,
    created_by: scenario.owner.id,
  })
  return file.url
}

async function follow(
  client: ApiClient,
  scenario: EstablishmentScenario,
  explorer: User,
  establishment: Establishment
) {
  const response = await client
    .put(`/api/v1/me/follows/${establishment.id}`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(explorer)
  response.assertStatus(200)
}

function updates(
  client: ApiClient,
  scenario: EstablishmentScenario,
  explorer: User,
  query: Record<string, number> = {}
) {
  return client
    .get('/api/v1/me/following/updates')
    .qs(query)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(explorer)
}

const titlesOf = (response: { body(): { data: Array<{ title: string }> } }) =>
  response.body().data.map((item) => item.title)

test.group('Explorer — updates of followed places', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('needs a session', async ({ client }) => {
    const scenario = await createEstablishmentScenario('fu-anon')

    const response = await client
      .get('/api/v1/me/following/updates')
      .headers(tenantHeader(scenario.tenant.id))
    response.assertStatus(401)
  })

  test('says when nothing is followed, privately', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fu-none')
    const cafe = await createPublishedEstablishment(scenario, 'Café Ninguém')
    await experience(scenario, cafe, 'Oficina aberta', 5)
    const explorer = await createUser({ prefix: 'fu-none', tenant: scenario.tenant })

    const response = await updates(client, scenario, explorer)
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.deepEqual(response.body(), {
      data: [],
      has_follows: false,
      meta: { total: 0, per_page: 20, current_page: 1, last_page: 1 },
    })
  })

  test('lists what the followed places published, newest first, from the snapshot', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fu-list')
    const cafe = await createPublishedEstablishment(scenario, 'Café Seguido')
    const bar = await createPublishedEstablishment(scenario, 'Bar Seguido')
    const ignored = await createPublishedEstablishment(scenario, 'Bistrô Não Seguido')
    const explorer = await createUser({ prefix: 'fu-list', tenant: scenario.tenant })
    await follow(client, scenario, explorer, cafe)
    await follow(client, scenario, explorer, bar)

    const tasting = await experience(scenario, cafe, 'Degustação', 30)
    // An edit waiting for moderation was never published.
    tasting.title = 'Rascunho da degustação'
    await tasting.save()
    await event(scenario, bar, 'Noite de jazz', 10, { start: 24, end: 27 })
    await showcase(scenario, cafe, 'Bolo de cenoura', 20)
    await event(scenario, bar, 'Show que acabou', 5, { start: -5, end: -2 })
    await experience(scenario, cafe, 'Ainda em rascunho', 1, 'draft')
    await experience(scenario, cafe, 'Arquivada', 2, 'archived')
    await experience(scenario, ignored, 'De quem não sigo', 3)

    const response = await updates(client, scenario, explorer)
    response.assertStatus(200)
    assert.isTrue(response.body().has_follows)
    assert.deepEqual(titlesOf(response), ['Noite de jazz', 'Bolo de cenoura', 'Degustação'])
    assert.deepEqual(
      response.body().data.map((item: any) => item.kind),
      ['event', 'showcase_item', 'experience']
    )
    const [jazz, cake, tastingItem] = response.body().data
    assert.isString(jazz.starts_at)
    assert.isString(jazz.ends_at)
    assert.isNull(jazz.informational_price_cents)
    assert.equal(cake.informational_price_cents, 2500)
    assert.isNull(cake.starts_at)
    assert.equal(tastingItem.description, 'Uma hora de cafés especiais.')
    assert.equal(tastingItem.establishment.id, cafe.id)
    assert.isString(tastingItem.establishment.slug)
    assert.isString(tastingItem.establishment.city_slug)
    assert.deepEqual(response.body().meta, {
      total: 3,
      per_page: 20,
      current_page: 1,
      last_page: 1,
    })
  })

  test('the cover is the approved image, cover first', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fu-cover')
    const cafe = await createPublishedEstablishment(scenario, 'Café Fotos')
    const explorer = await createUser({ prefix: 'fu-cover', tenant: scenario.tenant })
    await follow(client, scenario, explorer, cafe)
    const withCover = await experience(scenario, cafe, 'Com capa', 5)
    const pendingOnly = await experience(scenario, cafe, 'Só pendente', 10)
    await image(scenario, withCover, {
      altText: 'Outra foto',
      approved: true,
      isCover: false,
      sortOrder: 0,
    })
    const coverUrl = await image(scenario, withCover, {
      altText: 'Mesa posta para a degustação',
      approved: true,
      isCover: true,
      sortOrder: 1,
    })
    await image(scenario, pendingOnly, {
      altText: 'Ainda não aprovada',
      approved: false,
      isCover: true,
      sortOrder: 0,
    })

    const response = await updates(client, scenario, explorer)
    response.assertStatus(200)
    const [first, second] = response.body().data
    assert.deepEqual(first.cover, { url: coverUrl, alt_text: 'Mesa posta para a degustação' })
    assert.isNull(second.cover)
  })

  test('a withdrawn place stops contributing, and its follow is kept', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fu-withdrawn')
    const cafe = await createPublishedEstablishment(scenario, 'Café Suspenso')
    const explorer = await createUser({ prefix: 'fu-withdrawn', tenant: scenario.tenant })
    await follow(client, scenario, explorer, cafe)
    await experience(scenario, cafe, 'Oficina', 5)

    const establishment = await Establishment.findOrFail(cafe.id)
    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
    await establishment.save()

    const response = await updates(client, scenario, explorer)
    response.assertStatus(200)
    assert.deepEqual(response.body().data, [])
    assert.isFalse(response.body().has_follows)
    const rows = await db.from('explorer_follows').where('user_id', explorer.id)
    assert.lengthOf(rows, 1)
  })

  test('pages through the updates', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fu-pages')
    const cafe = await createPublishedEstablishment(scenario, 'Café Paginado')
    const explorer = await createUser({ prefix: 'fu-pages', tenant: scenario.tenant })
    await follow(client, scenario, explorer, cafe)
    await experience(scenario, cafe, 'Primeira', 1)
    await experience(scenario, cafe, 'Segunda', 2)
    await experience(scenario, cafe, 'Terceira', 3)

    const first = await updates(client, scenario, explorer, { per_page: 2 })
    assert.deepEqual(titlesOf(first), ['Primeira', 'Segunda'])
    assert.deepEqual(first.body().meta, { total: 3, per_page: 2, current_page: 1, last_page: 2 })

    const second = await updates(client, scenario, explorer, { per_page: 2, page: 2 })
    assert.deepEqual(titlesOf(second), ['Terceira'])

    const beyond = await updates(client, scenario, explorer, { per_page: 2, page: 3 })
    beyond.assertStatus(200)
    assert.deepEqual(beyond.body().data, [])
    assert.equal(beyond.body().meta.total, 3)

    const tooMany = await updates(client, scenario, explorer, { per_page: 51 })
    tooMany.assertStatus(422)
  })

  test('one explorer never reads another explorer’s follows', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fu-idor')
    const cafe = await createPublishedEstablishment(scenario, 'Café Privado')
    const owner = await createUser({ prefix: 'fu-idor-owner', tenant: scenario.tenant })
    const other = await createUser({ prefix: 'fu-idor-other', tenant: scenario.tenant })
    await follow(client, scenario, owner, cafe)
    await experience(scenario, cafe, 'Só para quem segue', 5)

    const own = await updates(client, scenario, owner)
    assert.deepEqual(titlesOf(own), ['Só para quem segue'])

    const response = await updates(client, scenario, other)
    assert.deepEqual(response.body().data, [])
    assert.isFalse(response.body().has_follows)
    const serialized = JSON.stringify(own.body())
    assert.notInclude(serialized, owner.email)
    assert.notInclude(serialized, owner.full_name)
  })
})
