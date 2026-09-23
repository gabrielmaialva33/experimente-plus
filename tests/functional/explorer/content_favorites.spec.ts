import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function experience(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  state: 'published' | 'draft' | 'archived' = 'published'
) {
  const published = state !== 'draft'
  return EstablishmentExperience.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: scenario.owner.id,
    title: 'Degustação guiada',
    description: 'Uma hora de cafés especiais.',
    status: state,
    published_snapshot: published
      ? { title: 'Degustação guiada', description: 'Uma hora de cafés especiais.' }
      : null,
    published_at: published ? DateTime.utc() : null,
    archived_by: state === 'archived' ? scenario.owner.id : null,
    archived_at: state === 'archived' ? DateTime.utc() : null,
  })
}

async function event(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  hoursFromNow: { start: number; end: number }
) {
  const starts = DateTime.utc().plus({ hours: hoursFromNow.start })
  const ends = DateTime.utc().plus({ hours: hoursFromNow.end })
  return EstablishmentEvent.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: scenario.owner.id,
    title: 'Noite de jazz',
    description: null,
    status: 'published',
    starts_at: starts,
    ends_at: ends,
    published_snapshot: {
      title: 'Noite de jazz',
      description: null,
      starts_at: starts.toISO(),
      ends_at: ends.toISO(),
    },
    published_at: DateTime.utc(),
  })
}

test.group('Explorer — content favourites (ADR-0030, 23/09/2026)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('favouriting an experience twice is one favourite, listed from the snapshot', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cfav-twice')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await createUser({ prefix: 'cfav-explorer', tenant: scenario.tenant })
    const content = await experience(scenario, establishment)
    const headers = tenantHeader(scenario.tenant.id)

    for (let attempt = 0; attempt < 2; attempt++) {
      const saved = await client
        .put(`/api/v1/me/favorites/content/experiences/${content.id}`)
        .headers(headers)
        .loginAs(explorer)
      saved.assertStatus(200)
      saved.assertBodyContains({ favorited: true })
    }

    const rows = await db.from('explorer_content_favorites').where('user_id', explorer.id)
    assert.lengthOf(rows, 1)

    // An edit awaiting moderation lives in the live columns; the list must not show it.
    content.title = 'Título ainda não aprovado'
    await content.save()

    const list = await client.get('/api/v1/me/favorites/content').headers(headers).loginAs(explorer)
    list.assertStatus(200)
    assert.equal(list.header('cache-control'), 'private, no-store')
    assert.lengthOf(list.body().data, 1)
    assert.equal(list.body().data[0].content.kind, 'experience')
    assert.equal(list.body().data[0].content.title, 'Degustação guiada')
    assert.equal(list.body().data[0].content.establishment.id, establishment.id)
    assert.equal(list.body().unavailable, 0)
  })

  test('only what the public sees now can be favourited', async ({ client }) => {
    const scenario = await createEstablishmentScenario('cfav-visible')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await createUser({ prefix: 'cfav-visible-explorer', tenant: scenario.tenant })
    const headers = tenantHeader(scenario.tenant.id)

    const draft = await experience(scenario, establishment, 'draft')
    const archived = await experience(scenario, establishment, 'archived')
    const ended = await event(scenario, establishment, { start: -5, end: -1 })

    for (const [kind, id] of [
      ['experiences', draft.id],
      ['experiences', archived.id],
      ['events', ended.id],
      ['experiences', 2147480000],
    ] as const) {
      const response = await client
        .put(`/api/v1/me/favorites/content/${kind}/${id}`)
        .headers(headers)
        .loginAs(explorer)
      response.assertStatus(404)
    }

    // A showcase item is not a kind this route knows.
    const showcase = await client
      .put('/api/v1/me/favorites/content/showcase-items/1')
      .headers(headers)
      .loginAs(explorer)
    showcase.assertStatus(404)
  })

  test('an ended event stays saved, is counted as unavailable and can still be removed', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cfav-ended')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await createUser({ prefix: 'cfav-ended-explorer', tenant: scenario.tenant })
    const upcoming = await event(scenario, establishment, { start: 2, end: 4 })
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .put(`/api/v1/me/favorites/content/events/${upcoming.id}`)
      .headers(headers)
      .loginAs(explorer)

    // The window passes: the approved snapshot now says it ended.
    upcoming.published_snapshot = {
      ...upcoming.published_snapshot,
      starts_at: DateTime.utc().minus({ hours: 5 }).toISO(),
      ends_at: DateTime.utc().minus({ hours: 1 }).toISO(),
    }
    await upcoming.save()

    const list = await client.get('/api/v1/me/favorites/content').headers(headers).loginAs(explorer)
    assert.lengthOf(list.body().data, 0)
    assert.equal(list.body().unavailable, 1)

    const removed = await client
      .delete(`/api/v1/me/favorites/content/events/${upcoming.id}`)
      .headers(headers)
      .loginAs(explorer)
    removed.assertBodyContains({ favorited: false })
    const after = await client
      .get('/api/v1/me/favorites/content')
      .headers(headers)
      .loginAs(explorer)
    assert.equal(after.body().unavailable, 0)
  })

  test('content of a withdrawn establishment leaves the list and is counted', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cfav-withdrawn')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await createUser({
      prefix: 'cfav-withdrawn-explorer',
      tenant: scenario.tenant,
    })
    const content = await experience(scenario, establishment)
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .put(`/api/v1/me/favorites/content/experiences/${content.id}`)
      .headers(headers)
      .loginAs(explorer)

    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
    await establishment.save()

    const list = await client.get('/api/v1/me/favorites/content').headers(headers).loginAs(explorer)
    assert.lengthOf(list.body().data, 0)
    assert.equal(list.body().unavailable, 1)
  })

  test('one explorer never reads another explorer’s content favourites', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cfav-idor')
    const establishment = await createPublishedEstablishment(scenario)
    const owner = await createUser({ prefix: 'cfav-owner', tenant: scenario.tenant })
    const other = await createUser({ prefix: 'cfav-other', tenant: scenario.tenant })
    const content = await experience(scenario, establishment)
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .put(`/api/v1/me/favorites/content/experiences/${content.id}`)
      .headers(headers)
      .loginAs(owner)

    const list = await client.get('/api/v1/me/favorites/content').headers(headers).loginAs(other)
    assert.lengthOf(list.body().data, 0)
    assert.equal(list.body().unavailable, 0)

    const anonymous = await client.get('/api/v1/me/favorites/content')
    anonymous.assertStatus(401)
  })

  test('deleting the account erases content favourites too', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('cfav-delete')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await createUser({ prefix: 'cfav-delete-explorer', tenant: scenario.tenant })
    const content = await experience(scenario, establishment)
    const upcoming = await event(scenario, establishment, { start: 2, end: 4 })
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .put(`/api/v1/me/favorites/content/experiences/${content.id}`)
      .headers(headers)
      .loginAs(explorer)
    await client
      .put(`/api/v1/me/favorites/content/events/${upcoming.id}`)
      .headers(headers)
      .loginAs(explorer)

    const deleted = await client.delete('/api/v1/me').loginAs(explorer).json({
      current_password: 'password123',
      confirmation: 'EXCLUIR MINHA CONTA',
    })
    deleted.assertStatus(204)

    const rows = await db.from('explorer_content_favorites').where('user_id', explorer.id)
    assert.lengthOf(rows, 0)
  })
})
