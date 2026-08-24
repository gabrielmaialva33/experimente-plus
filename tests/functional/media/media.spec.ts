import { access, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import StoredFile from '#modules/files/models/file'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaAsset from '#modules/media/models/media_asset'
import MediaModerationEvent from '#modules/media/models/media_moderation_event'
import IRoles from '#modules/roles/interfaces/role_interface'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'
import type { EstablishmentScenario } from '#tests/functional/establishments/helpers'
import { addOrganizationMember, createUser } from '#tests/functional/organizations/helpers'

const fixture = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'media', name)
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function listStoredMediaFiles(): Promise<string[]> {
  try {
    const entries = await readdir(app.makePath('storage', 'media'), {
      recursive: true,
      withFileTypes: true,
    })

    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function createDraftEstablishment(
  client: ApiClient,
  scenario: EstablishmentScenario,
  publicName = 'Unidade de Mídia'
): Promise<number> {
  const response = await client
    .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      public_name: publicName,
      city_id: scenario.city.id,
      short_description: 'Perfil usado para validar a galeria da unidade',
      public_phone: '(43) 99999-0000',
      availability_type: 'regular_hours',
    })

  response.assertStatus(201)
  return Number(response.body().id)
}

async function findDraft(establishmentId: number): Promise<EstablishmentRevision> {
  return EstablishmentRevision.query()
    .where('establishment_id', establishmentId)
    .where('status', 'draft')
    .firstOrFail()
}

async function uploadImage(
  client: ApiClient,
  scenario: EstablishmentScenario,
  establishmentId: number,
  fileName: string,
  altText = 'Imagem descritiva da unidade'
) {
  return client
    .post(`/api/v1/establishments/${establishmentId}/media`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .field('alt_text', altText)
    .file('file', fixture(fileName))
}

async function createModerator(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'media-moderator',
    tenant: scenario.tenant,
    tenantRole: 'member',
    globalRole: IRoles.Slugs.MODERATOR,
  })
}

test.group('Establishment media', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(async () => {
    await rm(app.makePath('storage', 'media'), { recursive: true, force: true })
  })

  test('accepts real JPEG, PNG and WebP images and stores normalized metadata', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-formats')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const cases = [
      ['valid.png', 'image/png', 'png'],
      ['valid.jpg', 'image/jpeg', 'jpg'],
      ['valid.webp', 'image/webp', 'webp'],
    ] as const

    const responseBodies: Array<Record<string, unknown>> = []

    for (const [fileName, mimeType, extension] of cases) {
      const response = await uploadImage(client, scenario, establishmentId, fileName)
      response.assertStatus(201)
      response.assertBodyContains({
        moderation_status: 'pending',
        asset: {
          media_type: 'image',
          mime_type: mimeType,
          file_extension: extension,
          width: 2,
          height: 3,
        },
      })
      responseBodies.push(response.body())
    }

    assert.isTrue(Boolean(responseBodies[0].is_cover))
    assert.isFalse(Boolean(responseBodies[1].is_cover))
    assert.isFalse(Boolean(responseBodies[2].is_cover))

    const assets = await MediaAsset.query()
      .where('tenant_id', scenario.tenant.id)
      .where('establishment_id', establishmentId)
      .preload('file')
      .orderBy('id', 'asc')

    assert.lengthOf(assets, 3)
    assert.equal(assets.filter((asset) => asset.checksum_sha256.length === 64).length, 3)

    for (const asset of assets) {
      assert.equal(asset.width, 2)
      assert.equal(asset.height, 3)
      await access(app.makePath('storage', asset.file.file_name))
    }

    const listed = await client
      .get(`/api/v1/establishments/${establishmentId}/media`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    listed.assertStatus(200)
    assert.lengthOf(listed.body(), 3)
    assert.notInclude(Object.keys(listed.body()[0].asset), 'file_name')
    assert.notInclude(Object.keys(listed.body()[0].asset), 'owner_id')
  })

  test('rejects corrupted images and extension, MIME or signature disagreement before storage', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-validation')
    const establishmentId = await createDraftEstablishment(client, scenario)

    const disguised = await client
      .post(`/api/v1/establishments/${establishmentId}/media`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .field('alt_text', 'Imagem com metadados falsificados')
      .file('file', fixture('valid.png'), {
        filename: 'disguised.jpg',
        contentType: 'image/jpeg',
      })
    disguised.assertStatus(400)

    const corrupted = await uploadImage(client, scenario, establishmentId, 'corrupted.png')
    corrupted.assertStatus(422)

    assert.equal(
      await MediaAsset.query()
        .where('establishment_id', establishmentId)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      0
    )
    assert.equal(
      await EstablishmentRevisionMedia.query()
        .where('establishment_id', establishmentId)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      0
    )
    assert.equal(
      await StoredFile.query()
        .where('tenant_id', scenario.tenant.id)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      0
    )
  })

  test('compensates the storage object when database persistence fails after upload', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-compensation')
    const establishmentId = await createDraftEstablishment(client, scenario)

    await db.rawQuery(`
      CREATE FUNCTION reject_media_asset_insert_for_test()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'forced media asset persistence failure';
      END;
      $$
    `)
    await db.rawQuery(`
      CREATE TRIGGER reject_media_asset_insert_for_test_trigger
      BEFORE INSERT ON media_assets
      FOR EACH ROW
      EXECUTE FUNCTION reject_media_asset_insert_for_test()
    `)

    try {
      const response = await client
        .post(`/api/v1/establishments/${establishmentId}/media`)
        .headers({ ...tenantHeader(scenario.tenant.id), accept: 'application/json' })
        .loginAs(scenario.owner)
        .field('alt_text', 'Imagem que falhará após a escrita física')
        .file('file', fixture('valid.png'))

      response.assertStatus(500)
      assert.lengthOf(await listStoredMediaFiles(), 0)
      assert.equal(
        await StoredFile.query()
          .where('tenant_id', scenario.tenant.id)
          .count('* as total')
          .then((rows) => Number(rows[0].$extras.total)),
        0
      )
      assert.equal(
        await MediaAsset.query()
          .where('establishment_id', establishmentId)
          .count('* as total')
          .then((rows) => Number(rows[0].$extras.total)),
        0
      )
    } finally {
      await db.rawQuery(
        'DROP TRIGGER IF EXISTS reject_media_asset_insert_for_test_trigger ON media_assets'
      )
      await db.rawQuery('DROP FUNCTION IF EXISTS reject_media_asset_insert_for_test()')
    }
  })

  test('enforces organization capabilities and hides media across tenant and membership boundaries', async ({
    client,
  }) => {
    const scenario = await createEstablishmentScenario('media-access')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const uploaded = await uploadImage(client, scenario, establishmentId, 'valid.png')
    uploaded.assertStatus(201)
    const mediaId = Number(uploaded.body().id)

    const analyst = await createUser({
      prefix: 'media-analyst',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: analyst,
      role: 'analyst',
    })

    const analystRead = await client
      .get(`/api/v1/establishments/${establishmentId}/media`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(analyst)
    analystRead.assertStatus(200)

    const analystMutation = await client
      .patch(`/api/v1/establishments/${establishmentId}/media/${mediaId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(analyst)
      .json({ caption: 'Tentativa sem capacidade' })
    analystMutation.assertStatus(403)

    const editor = await createUser({
      prefix: 'media-editor',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: editor,
      role: 'editor',
    })

    const editorMutation = await client
      .patch(`/api/v1/establishments/${establishmentId}/media/${mediaId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(editor)
      .json({ caption: 'Atualização permitida' })
    editorMutation.assertStatus(200)

    const outsider = await createUser({
      prefix: 'media-outsider',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const hidden = await client
      .get(`/api/v1/establishments/${establishmentId}/media`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
    hidden.assertStatus(404)

    const foreign = await createEstablishmentScenario('media-foreign')
    const crossTenant = await client
      .get(`/api/v1/establishments/${establishmentId}/media`)
      .headers(tenantHeader(foreign.tenant.id))
      .loginAs(foreign.owner)
    crossTenant.assertStatus(404)
  })

  test('scopes the moderation queue to the active tenant selected by middleware', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-queue')
    const foreign = await createEstablishmentScenario('media-queue-foreign')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const foreignEstablishmentId = await createDraftEstablishment(client, foreign)
    const localMedia = await uploadImage(client, scenario, establishmentId, 'valid.png')
    const foreignMedia = await uploadImage(client, foreign, foreignEstablishmentId, 'valid.jpg')
    localMedia.assertStatus(201)
    foreignMedia.assertStatus(201)

    const moderator = await createModerator(scenario)
    const queue = await client
      .get(`/api/v1/admin/media?status=pending&tenant_id=${foreign.tenant.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    queue.assertStatus(200)
    const ids = queue.body().data.map((item: { id: number }) => item.id)
    assert.include(ids, Number(localMedia.body().id))
    assert.notInclude(ids, Number(foreignMedia.body().id))

    const inaccessibleTenant = await client
      .get('/api/v1/admin/media?status=pending')
      .headers(tenantHeader(foreign.tenant.id))
      .loginAs(moderator)
    inaccessibleTenant.assertStatus(403)
  })

  test('keeps cover and order atomic and returns moderated metadata changes to pending', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-order')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const first = await uploadImage(
      client,
      scenario,
      establishmentId,
      'valid.png',
      'Primeira imagem'
    )
    const second = await uploadImage(
      client,
      scenario,
      establishmentId,
      'valid.jpg',
      'Segunda imagem'
    )
    first.assertStatus(201)
    second.assertStatus(201)

    const firstId = Number(first.body().id)
    const secondId = Number(second.body().id)

    const cover = await client
      .patch(`/api/v1/establishments/${establishmentId}/media/${secondId}/cover`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    cover.assertStatus(200)
    cover.assertBodyContains({ id: secondId, is_cover: true })

    const reorder = await client
      .put(`/api/v1/establishments/${establishmentId}/media/order`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        media: [
          { id: secondId, sort_order: 0 },
          { id: firstId, sort_order: 1 },
        ],
      })
    reorder.assertStatus(200)
    assert.deepEqual(
      reorder.body().map((item: { id: number; sort_order: number }) => [item.id, item.sort_order]),
      [
        [secondId, 0],
        [firstId, 1],
      ]
    )

    const incompleteOrder = await client
      .put(`/api/v1/establishments/${establishmentId}/media/order`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ media: [{ id: secondId, sort_order: 0 }] })
    incompleteOrder.assertStatus(400)

    const partnerApproval = await client
      .post(`/api/v1/admin/media/${secondId}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({})
    partnerApproval.assertStatus(403)

    const moderator = await createModerator(scenario)
    const approved = await client
      .post(`/api/v1/admin/media/${secondId}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({})
    approved.assertStatus(200)
    approved.assertBodyContains({ moderation_status: 'approved' })

    const edited = await client
      .patch(`/api/v1/establishments/${establishmentId}/media/${secondId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ caption: 'Legenda alterada após aprovação' })
    edited.assertStatus(200)
    edited.assertBodyContains({
      moderation_status: 'pending',
      review_notes: null,
      reviewed_at: null,
    })

    const events = await MediaModerationEvent.query()
      .where('revision_media_id', secondId)
      .orderBy('id', 'asc')
    assert.isAtLeast(events.length, 4)
    assert.equal(events.at(-1)?.to_status, 'pending')
  })

  test('requires moderation reason, clears an ineligible cover and exposes only approved published media', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-public')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const approvedCandidate = await uploadImage(
      client,
      scenario,
      establishmentId,
      'valid.png',
      'Fachada da unidade'
    )
    const pendingCandidate = await uploadImage(
      client,
      scenario,
      establishmentId,
      'valid.jpg',
      'Interior da unidade'
    )
    approvedCandidate.assertStatus(201)
    pendingCandidate.assertStatus(201)

    const approvedId = Number(approvedCandidate.body().id)
    const pendingId = Number(pendingCandidate.body().id)
    const moderator = await createModerator(scenario)

    const approved = await client
      .post(`/api/v1/admin/media/${approvedId}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({})
    approved.assertStatus(200)

    const draft = await findDraft(establishmentId)
    const establishment = await Establishment.findOrFail(establishmentId)
    establishment.published_revision_id = draft.id
    await establishment.save()

    const unpublishedProjection = await client.get(
      `/api/v1/public/establishments/${establishmentId}/media`
    )
    unpublishedProjection.assertStatus(404)

    draft.status = 'approved'
    draft.submitted_at = DateTime.now()
    draft.reviewed_by = moderator.id
    draft.reviewed_at = DateTime.now()
    draft.review_notes = null
    await draft.save()

    const publicProjection = await client.get(
      `/api/v1/public/establishments/${establishmentId}/media`
    )
    publicProjection.assertStatus(200)
    assert.lengthOf(publicProjection.body().media, 1)
    assert.equal(publicProjection.body().media[0].id, approvedId)
    assert.notInclude(Object.keys(publicProjection.body().media[0].asset), 'checksum_sha256')
    assert.notInclude(Object.keys(publicProjection.body().media[0]), 'review_notes')

    const missingReason = await client
      .post(`/api/v1/admin/media/${approvedId}/quarantine`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: '' })
    missingReason.assertStatus(422)

    const quarantined = await client
      .post(`/api/v1/admin/media/${approvedId}/quarantine`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Conteúdo incompatível com a ficha' })
    quarantined.assertStatus(200)
    quarantined.assertBodyContains({ moderation_status: 'quarantined', is_cover: false })

    const afterQuarantine = await client.get(
      `/api/v1/public/establishments/${establishmentId}/media`
    )
    afterQuarantine.assertStatus(200)
    assert.lengthOf(afterQuarantine.body().media, 0)

    const pending = await EstablishmentRevisionMedia.findOrFail(pendingId)
    assert.equal(pending.moderation_status, 'pending')
  })

  test('enforces composite tenant, establishment, cover and order invariants in PostgreSQL', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-db')
    const foreign = await createEstablishmentScenario('media-db-foreign')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const foreignEstablishmentId = await createDraftEstablishment(client, foreign)
    const first = await uploadImage(client, scenario, establishmentId, 'valid.png')
    const second = await uploadImage(client, scenario, establishmentId, 'valid.jpg')
    first.assertStatus(201)
    second.assertStatus(201)

    const firstMedia = await EstablishmentRevisionMedia.findOrFail(Number(first.body().id))
    const secondMedia = await EstablishmentRevisionMedia.findOrFail(Number(second.body().id))
    const firstAsset = await MediaAsset.findOrFail(firstMedia.media_asset_id)
    const firstFile = await StoredFile.findOrFail(firstAsset.file_id)
    const foreignRevision = await findDraft(foreignEstablishmentId)

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.table('media_assets').insert({
          tenant_id: foreign.tenant.id,
          establishment_id: foreignEstablishmentId,
          file_id: firstFile.id,
          media_type: 'image',
          file_extension: 'png',
          mime_type: 'image/png',
          checksum_sha256: 'a'.repeat(64),
          width: 2,
          height: 3,
          created_by: foreign.owner.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.table('establishment_revision_media').insert({
          tenant_id: foreign.tenant.id,
          establishment_id: foreignEstablishmentId,
          revision_id: foreignRevision.id,
          media_asset_id: firstAsset.id,
          purpose: 'gallery',
          is_cover: false,
          sort_order: 0,
          moderation_status: 'pending',
          created_by: foreign.owner.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction
          .from('establishment_revision_media')
          .where('id', secondMedia.id)
          .update({ is_cover: true })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction
          .from('establishment_revision_media')
          .where('id', secondMedia.id)
          .update({ sort_order: firstMedia.sort_order })
      })
    )

    const event = await MediaModerationEvent.query()
      .where('revision_media_id', firstMedia.id)
      .firstOrFail()

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.from('media_moderation_events').where('id', event.id).update({
          reason: 'Mutation must be rejected',
        })
      })
    )
    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.from('media_moderation_events').where('id', event.id).delete()
      })
    )
  })

  test('protects a referenced generic file and deletes storage after the last media reference', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-file-lifecycle')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const uploaded = await uploadImage(client, scenario, establishmentId, 'valid.png')
    uploaded.assertStatus(201)

    const media = await EstablishmentRevisionMedia.query()
      .where('id', Number(uploaded.body().id))
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .firstOrFail()
    const fileId = media.asset.file.id
    const assetId = media.asset.id
    const storagePath = app.makePath('storage', media.asset.file.file_name)
    await access(storagePath)

    const genericDelete = await client
      .delete(`/api/v1/files/${fileId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    genericDelete.assertStatus(400)
    assert.isNotNull(await StoredFile.find(fileId))
    assert.isNotNull(await MediaAsset.find(assetId))
    await access(storagePath)

    const mediaDelete = await client
      .delete(`/api/v1/establishments/${establishmentId}/media/${media.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    mediaDelete.assertStatus(204)

    assert.isNull(await EstablishmentRevisionMedia.find(media.id))
    assert.isNull(await MediaAsset.find(assetId))
    assert.isNull(await StoredFile.find(fileId))
    await assert.rejects(() => access(storagePath))
  })

  test('keeps a shared asset and physical object while another revision still references it', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-shared')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const uploaded = await uploadImage(client, scenario, establishmentId, 'valid.png')
    uploaded.assertStatus(201)

    const originalMedia = await EstablishmentRevisionMedia.findOrFail(Number(uploaded.body().id))
    const originalRevision = await findDraft(establishmentId)
    const moderator = await createModerator(scenario)
    originalRevision.status = 'approved'
    originalRevision.submitted_at = DateTime.now()
    originalRevision.reviewed_by = moderator.id
    originalRevision.reviewed_at = DateTime.now()
    originalRevision.review_notes = null
    await originalRevision.save()

    const establishment = await Establishment.findOrFail(establishmentId)
    establishment.published_revision_id = originalRevision.id
    await establishment.save()

    const draft = await EstablishmentRevision.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishmentId,
      version: 2,
      status: 'draft',
      city_id: scenario.city.id,
      public_name: originalRevision.public_name,
      slug: `${originalRevision.slug}-edit`,
      short_description: originalRevision.short_description,
      availability_type: 'regular_hours',
      based_on_revision_id: originalRevision.id,
      created_by: scenario.owner.id,
      rules_version: originalRevision.rules_version,
    })

    const shared = await EstablishmentRevisionMedia.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishmentId,
      revision_id: draft.id,
      media_asset_id: originalMedia.media_asset_id,
      purpose: originalMedia.purpose,
      is_cover: true,
      sort_order: 0,
      alt_text: originalMedia.alt_text,
      caption: originalMedia.caption,
      moderation_status: 'pending',
      created_by: scenario.owner.id,
    })

    const asset = await MediaAsset.query()
      .where('id', originalMedia.media_asset_id)
      .preload('file')
      .firstOrFail()
    const storagePath = app.makePath('storage', asset.file.file_name)
    await access(storagePath)

    const removed = await client
      .delete(`/api/v1/establishments/${establishmentId}/media/${shared.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    removed.assertStatus(204)

    assert.isNull(await EstablishmentRevisionMedia.find(shared.id))
    assert.isNotNull(await EstablishmentRevisionMedia.find(originalMedia.id))
    assert.isNotNull(await MediaAsset.find(asset.id))
    assert.isNotNull(await StoredFile.find(asset.file_id))
    await access(storagePath)
  })

  test('adds the reserved media points and allows submission completeness with pending media', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('media-completeness')
    const establishmentId = await createDraftEstablishment(
      client,
      scenario,
      'Café Completo com Mídia'
    )

    const requests = [
      client
        .put(`/api/v1/establishments/${establishmentId}/address`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(scenario.owner)
        .json({
          postal_code: '86300000',
          street: 'Rua das Flores',
          number: '120',
          without_number: false,
          district: 'Centro',
          latitude: -23.18,
          longitude: -50.65,
          coordinate_source: 'manual',
        }),
      client
        .put(`/api/v1/establishments/${establishmentId}/categories`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(scenario.owner)
        .json({
          categories: [{ category_id: scenario.primaryCategory.id, is_primary: true }],
        }),
      client
        .put(`/api/v1/establishments/${establishmentId}/attributes`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(scenario.owner)
        .json({
          attributes: [
            { attribute_definition_id: scenario.inheritedBoolean.id, value: true },
            {
              attribute_definition_id: scenario.selectDefinition.id,
              option_ids: [scenario.standardOption.id],
            },
          ],
        }),
      client
        .put(`/api/v1/establishments/${establishmentId}/hours`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(scenario.owner)
        .json({ hours: [{ weekday: 1, opens_at: '08:00', closes_at: '18:00' }] }),
    ]

    for (const request of requests) {
      const response = await request
      response.assertStatus(200)
    }

    const beforeMedia = await client
      .get(`/api/v1/establishments/${establishmentId}/completeness`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    beforeMedia.assertStatus(200)
    assert.equal(beforeMedia.body().score, 90)
    assert.include(
      beforeMedia.body().blocking_issues.map((issue: { code: string }) => issue.code),
      'media_missing'
    )

    const uploaded = await uploadImage(
      client,
      scenario,
      establishmentId,
      'valid.webp',
      'Imagem de capa do estabelecimento'
    )
    uploaded.assertStatus(201)
    uploaded.assertBodyContains({ moderation_status: 'pending', is_cover: true })

    const complete = await client
      .get(`/api/v1/establishments/${establishmentId}/completeness`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    complete.assertStatus(200)
    assert.isTrue(complete.body().eligible)
    assert.equal(complete.body().score, 100)
    assert.deepEqual(complete.body().blocking_issues, [])
  })
})
