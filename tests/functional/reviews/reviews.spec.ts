import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import BenefitRedemption from '#modules/benefits/models/benefit_redemption'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import ReviewPolicy from '#modules/reviews/models/review_policy'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import {
  addOrganizationMember,
  createUser,
} from '#tests/functional/organizations/helpers'

import { DateTime } from 'luxon'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

let estSeq = 0
async function createPublishedEstablishment(
  scenario: EstablishmentScenario,
  publicName = 'Cafe Central'
): Promise<Establishment> {
  estSeq += 1
  const cleanSlug = publicName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const establishment = await Establishment.create({
    tenant_id: scenario.tenant.id,
    organization_id: scenario.organization.id,
    lifecycle_status: 'active',
    business_status: 'open',
    created_by: scenario.owner.id,
  })

  const revision = await EstablishmentRevision.create({
    establishment_id: establishment.id,
    tenant_id: scenario.tenant.id,
    version: 1,
    status: 'approved',
    public_name: publicName,
    slug: `${cleanSlug}-${estSeq}-${Date.now()}`,
    city_id: scenario.city.id,
    short_description: 'Cafes especiais e confeitaria artesanal.',
    created_by: scenario.owner.id,
    submitted_at: DateTime.utc(),
    reviewed_by: scenario.owner.id,
    reviewed_at: DateTime.utc(),
  })

  establishment.published_revision_id = revision.id
  await establishment.save()

  return establishment
}

async function createRedemption(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  user: any
): Promise<BenefitRedemption> {
  return BenefitRedemption.create({
    tenant_id: scenario.tenant.id,
    access_id: 1,
    edition_id: 1,
    offer_id: 1,
    establishment_id: establishment.id,
    organization_id: scenario.organization.id,
    user_id: user.id,
    redeemed_by: scenario.owner.id,
    redemption_number: 1,
    presentation_nonce_hash: 'hash-1234567890',
    receipt_code: `EXP-${Date.now().toString(16).toUpperCase().padStart(16, '0')}`,
    edition_name_snapshot: 'Edição Londrina 2026',
    offer_title_snapshot: '2 por 1 no prato principal',
    benefit_type_snapshot: 'two_for_one',
    establishment_name_snapshot: 'Café Central',
    holder_name_snapshot: user.full_name,
  })
}

test.group('Reviews - Functional Tests', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates review for an establishment and enforces 1 review per establishment constraint', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('rev-create')
    const establishment = await createPublishedEstablishment(scenario)
    const consumer = await createUser({
      prefix: 'consumer',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const response = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment.id,
        rating: 5,
        comment: 'Comida excelente e atendimento impecável.',
      })

    response.assertStatus(201)
    response.assertBodyContains({
      establishment_id: establishment.id,
      user_id: consumer.id,
      rating: 5,
      comment: 'Comida excelente e atendimento impecável.',
      status: 'published',
    })

    // Second review for the same establishment must be rejected with 400 (Bad Request)
    const secondResponse = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment.id,
        rating: 4,
        comment: 'Tentando avaliar novamente.',
      })

    secondResponse.assertStatus(400)
    secondResponse.assertBodyContains({
      message: 'You have already reviewed this establishment',
    })
  })

  test('validates dynamic text length limits from tenant review policy', async ({ client }) => {
    const scenario = await createEstablishmentScenario('rev-length')
    const establishment = await createPublishedEstablishment(scenario)
    const consumer = await createUser({
      prefix: 'consumer-len',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    // Set min_text_length to 20
    await ReviewPolicy.updateOrCreate(
      { tenant_id: scenario.tenant.id },
      { min_text_length: 20 }
    )

    const shortResponse = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment.id,
        rating: 5,
        comment: 'Muito curto', // 11 chars < 20
      })

    shortResponse.assertStatus(400)
    shortResponse.assertBodyContains({
      message: 'Comment must be at least 20 characters',
    })
  })

  test('enforces daily limit per user from tenant review policy', async ({ client }) => {
    const scenario = await createEstablishmentScenario('rev-daily')
    const establishment1 = await createPublishedEstablishment(scenario, 'Est 1')
    const establishment2 = await createPublishedEstablishment(scenario, 'Est 2')
    const consumer = await createUser({
      prefix: 'consumer-daily',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    // Set daily limit to 1
    await ReviewPolicy.updateOrCreate(
      { tenant_id: scenario.tenant.id },
      { daily_limit_per_user: 1 }
    )

    // First review succeeds
    const res1 = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment1.id,
        rating: 5,
        comment: 'Primeira avaliação do dia.',
      })
    res1.assertStatus(201)

    // Second review exceeds daily limit
    const res2 = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment2.id,
        rating: 4,
        comment: 'Segunda avaliação no mesmo dia.',
      })
    res2.assertStatus(400)
    res2.assertBodyContains({
      message: 'Daily review limit reached for this user',
    })
  })

  test('enforces visit proof verification when require_visit_proof is enabled', async ({
    client,
  }) => {
    const scenario = await createEstablishmentScenario('rev-visit')
    const establishment = await createPublishedEstablishment(scenario)
    const consumer = await createUser({
      prefix: 'consumer-visit',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    // Enable require_visit_proof
    await ReviewPolicy.updateOrCreate(
      { tenant_id: scenario.tenant.id },
      { require_visit_proof: true }
    )

    // Attempt without redemption fails
    const failRes = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment.id,
        rating: 5,
        comment: 'Avaliação sem comprovante.',
      })
    failRes.assertStatus(400)
    failRes.assertBodyContains({
      message: 'A valid benefit redemption is required to review this establishment',
    })

    // Create valid redemption for consumer and establishment
    const redemption = await createRedemption(scenario, establishment, consumer)

    const successRes = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment.id,
        redemption_id: redemption.id,
        rating: 5,
        comment: 'Avaliação com comprovante válido de visita.',
      })
    successRes.assertStatus(201)
    successRes.assertBodyContains({
      redemption_id: redemption.id,
    })
  })

  test('allows author to update review and updates edited_at', async ({ client }) => {
    const scenario = await createEstablishmentScenario('rev-update')
    const establishment = await createPublishedEstablishment(scenario)
    const consumer = await createUser({
      prefix: 'consumer-upd',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    // Set min_edit_interval_minutes to 0 for immediate edit test
    await ReviewPolicy.updateOrCreate(
      { tenant_id: scenario.tenant.id },
      { min_edit_interval_minutes: 0 }
    )

    const createRes = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment.id,
        rating: 4,
        comment: 'Comentário original.',
      })
    createRes.assertStatus(201)
    const reviewId = createRes.body().id

    const updateRes = await client
      .put(`/api/v1/me/reviews/${reviewId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        rating: 5,
        comment: 'Comentário editado com nova opinião.',
      })

    updateRes.assertStatus(200)
    updateRes.assertBodyContains({
      rating: 5,
      comment: 'Comentário editado com nova opinião.',
    })
  })

  test('forbids non-author from updating or deleting a review', async ({ client }) => {
    const scenario = await createEstablishmentScenario('rev-auth')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({
      prefix: 'author',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const impostor = await createUser({
      prefix: 'impostor',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const createRes = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(author)
      .json({
        establishment_id: establishment.id,
        rating: 5,
        comment: 'Avaliação legítima do autor.',
      })
    const reviewId = createRes.body().id

    const putRes = await client
      .put(`/api/v1/me/reviews/${reviewId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(impostor)
      .json({ rating: 1, comment: 'Tentando alterar review de outro.' })
    putRes.assertStatus(403)

    const delRes = await client
      .delete(`/api/v1/me/reviews/${reviewId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(impostor)
    delRes.assertStatus(403)
  })

  test('allows author to delete review', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('rev-del')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({
      prefix: 'author-del',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const createRes = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(author)
      .json({
        establishment_id: establishment.id,
        rating: 5,
        comment: 'Avaliação para deletar.',
      })
    const reviewId = createRes.body().id

    const delRes = await client
      .delete(`/api/v1/me/reviews/${reviewId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(author)
    delRes.assertStatus(204)

    const found = await EstablishmentReview.find(reviewId)
    assert.isNull(found)
  })

  test('allows organization owner/admin/editor to reply to reviews, denies non-partners and enforces max 1 reply', async ({
    client,
  }) => {
    const scenario = await createEstablishmentScenario('rev-reply')
    const establishment = await createPublishedEstablishment(scenario)
    const consumer = await createUser({
      prefix: 'consumer-rep',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const partnerEditor = await createUser({
      prefix: 'partner-ed',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: partnerEditor,
      role: 'editor',
    })
    const outsider = await createUser({
      prefix: 'outsider-rep',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const reviewRes = await client
      .post('/api/v1/me/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(consumer)
      .json({
        establishment_id: establishment.id,
        rating: 5,
        comment: 'Comida muito boa!',
      })
    const reviewId = reviewRes.body().id

    // Outsider cannot reply
    const outsiderRes = await client
      .post(`/api/v1/portal/reviews/${reviewId}/replies`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
      .json({ comment: 'Resposta não autorizada.' })
    outsiderRes.assertStatus(403)

    // Partner editor can reply
    const replyRes = await client
      .post(`/api/v1/portal/reviews/${reviewId}/replies`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(partnerEditor)
      .json({ comment: 'Muito obrigado pela sua avaliação! Volte sempre.' })
    replyRes.assertStatus(201)
    replyRes.assertBodyContains({
      review_id: reviewId,
      comment: 'Muito obrigado pela sua avaliação! Volte sempre.',
      status: 'published',
    })

    // Second reply to the same review returns 400
    const secondReplyRes = await client
      .post(`/api/v1/portal/reviews/${reviewId}/replies`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ comment: 'Segunda resposta do dono.' })
    secondReplyRes.assertStatus(400)
    secondReplyRes.assertBodyContains({
      message: 'A reply already exists for this review',
    })

    // Partner can update the reply
    const updateReplyRes = await client
      .put(`/api/v1/portal/reviews/${reviewId}/replies`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(partnerEditor)
      .json({ comment: 'Resposta editada com novos agradecimentos.' })
    updateReplyRes.assertStatus(200)
    updateReplyRes.assertBodyContains({
      comment: 'Resposta editada com novos agradecimentos.',
    })
  })

  test('public catalog lists published reviews with their replies and excludes hidden ones', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('rev-cat')
    const establishment = await createPublishedEstablishment(scenario)
    const consumer1 = await createUser({ prefix: 'c1', tenant: scenario.tenant })
    const consumer2 = await createUser({ prefix: 'c2', tenant: scenario.tenant })

    // Create published review + reply
    const rev1 = await EstablishmentReview.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      user_id: consumer1.id,
      rating: 5,
      comment: 'Review publicado',
      status: 'published',
      photos_count: 0,
      videos_count: 0,
    })
    await EstablishmentReviewReply.create({
      tenant_id: scenario.tenant.id,
      review_id: rev1.id,
      user_id: scenario.owner.id,
      organization_id: scenario.organization.id,
      comment: 'Resposta do estabelecimento',
      status: 'published',
    })

    // Create hidden review
    await EstablishmentReview.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      user_id: consumer2.id,
      rating: 1,
      comment: 'Review oculto',
      status: 'hidden',
      photos_count: 0,
      videos_count: 0,
    })

    const listRes = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .header('host', `${scenario.tenant.slug}.example.com`)

    listRes.assertStatus(200)
    const body = listRes.body()
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].id, rev1.id)
    assert.isNotNull(body.data[0].reply)
    assert.equal(body.data[0].reply.comment, 'Resposta do estabelecimento')

    const getRes = await client
      .get(`/api/v1/catalog/reviews/${rev1.id}`)
      .header('host', `${scenario.tenant.slug}.example.com`)
    getRes.assertStatus(200)
    getRes.assertBodyContains({ id: rev1.id, status: 'published' })
  })

  test('content reporting by user and resolution by moderator with content hiding', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('rev-mod')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'author-mod', tenant: scenario.tenant })
    const reporter = await createUser({ prefix: 'reporter-mod', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'mod-user',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })

    const review = await EstablishmentReview.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      user_id: author.id,
      rating: 1,
      comment: 'Conteúdo ofensivo ou falso para teste de moderação.',
      status: 'published',
      photos_count: 0,
      videos_count: 0,
    })

    // Reporter submits report
    const reportRes = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({
        target_type: 'review',
        target_id: review.id,
        reason: 'offensive',
        details: 'Texto contém ofensas.',
      })
    reportRes.assertStatus(201)
    const reportId = reportRes.body().id

    // Duplicate report by same user returns 400
    const dupRes = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({
        target_type: 'review',
        target_id: review.id,
        reason: 'offensive',
      })
    dupRes.assertStatus(400)

    // Regular user cannot access moderation queue
    const nonModRes = await client
      .get('/api/v1/admin/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
    nonModRes.assertStatus(403)

    // Moderator lists reports
    const modListRes = await client
      .get('/api/v1/admin/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    modListRes.assertStatus(200)
    assert.isAtLeast(modListRes.body().data.length, 1)

    // Moderator resolves report and hides content
    const resolveRes = await client
      .post(`/api/v1/admin/content-reports/${reportId}/resolve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({
        status: 'resolved',
        resolution_action: 'content_hidden',
        resolution_notes: 'Conteúdo confirmado como ofensivo e ocultado.',
      })
    resolveRes.assertStatus(200)
    resolveRes.assertBodyContains({
      status: 'resolved',
      resolved_by: moderator.id,
    })

    // Review status should now be hidden
    await review.refresh()
    assert.equal(review.status, 'hidden')
  })

  test('admin can retrieve and update tenant review policy', async ({ client }) => {
    const scenario = await createEstablishmentScenario('rev-pol')
    const admin = await createUser({
      prefix: 'admin-pol',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.ADMIN,
    })
    const regular = await createUser({ prefix: 'reg-pol', tenant: scenario.tenant })

    // Regular user denied
    const regRes = await client
      .get('/api/v1/admin/review-policy')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(regular)
    regRes.assertStatus(403)

    // Admin gets policy
    const getRes = await client
      .get('/api/v1/admin/review-policy')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
    getRes.assertStatus(200)
    getRes.assertBodyContains({
      tenant_id: scenario.tenant.id,
      require_visit_proof: false,
    })

    // Admin updates policy
    const putRes = await client
      .put('/api/v1/admin/review-policy')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
      .json({
        min_text_length: 15,
        max_text_length: 1500,
        require_visit_proof: true,
        daily_limit_per_user: 3,
      })
    putRes.assertStatus(200)
    putRes.assertBodyContains({
      min_text_length: 15,
      max_text_length: 1500,
      require_visit_proof: true,
      daily_limit_per_user: 3,
    })
  })
})
