import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import {
  createEstablishmentScenario,
  createPublishedEstablishment,
} from '#tests/functional/establishments/helpers'

const fixture = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'media', name)
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

test.group('Partner content media', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(async () => {
    await rm(app.makePath('storage', 'media'), { recursive: true, force: true })
  })

  test('stores an image of partner content without the metadata it arrived with', async ({
    client,
    assert,
  }) => {
    // The upload of partner content media had no functional test at all; this
    // is the first, and it pins what matters most about a phone photo: that its
    // position and device do not reach the public with it.
    const scenario = await createEstablishmentScenario('pc-media-strip')
    const establishment = await createPublishedEstablishment(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Oficina de moagem',
        description: 'Uma hora entre moedores e grãos.',
      })
    created.assertStatus(201)

    const uploaded = await client
      .post(`/api/v1/portal/content/experiences/${created.body().id}/media`)
      .headers(headers)
      .loginAs(scenario.owner)
      .field('alt_text', 'Moedor sobre a bancada')
      .file('file', fixture('with_metadata.jpg'))
    uploaded.assertStatus(201)

    const stored = await db
      .from('files')
      .join('media_assets', 'media_assets.file_id', 'files.id')
      .where('media_assets.id', uploaded.body().asset.id)
      .select('files.file_name', 'files.file_size')
      .first()
    const bytes = await readFile(app.makePath('storage', stored.file_name))
    assert.isFalse(bytes.includes(Buffer.from([0x25, 0x88])), 'GPS pointer survived')
    assert.isFalse(bytes.includes(Buffer.from('FixtureCam')), 'device survived')
    // The recorded size is of the file actually stored, not of the upload.
    assert.equal(Number(stored.file_size), bytes.length)
  })

  test('refuses an image whose structure cannot be walked', async ({ client }) => {
    const scenario = await createEstablishmentScenario('pc-media-malformed')
    const establishment = await createPublishedEstablishment(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Oficina', description: null })

    const refused = await client
      .post(`/api/v1/portal/content/experiences/${created.body().id}/media`)
      .headers(headers)
      .loginAs(scenario.owner)
      .field('alt_text', 'Arquivo quebrado')
      .file('file', fixture('corrupted.png'))
    // The same answer establishment media gives for a corrupted image.
    refused.assertStatus(422)
  })
})
