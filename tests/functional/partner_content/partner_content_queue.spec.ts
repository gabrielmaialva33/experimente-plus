import { test } from '@japa/runner'

import testUtils from '@adonisjs/core/services/test_utils'

import IRoles from '#modules/roles/interfaces/role_interface'
import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

function parseInertiaPage(response: { text(): string }) {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  return JSON.parse(match[1]) as { component: string; props: Record<string, any> }
}

/**
 * The moderation queue opens on every kind — web audit W4.
 *
 * It used to open on events only: with one experience waiting and no event, the
 * screen said "0 itens" and the experience waited unseen.
 */
test.group('Partner content moderation queue', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('opens on every kind with a count for each, never hiding another kind', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('queue-all')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await createUser({
      prefix: 'queue-all-mod',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const headers = tenantHeader(scenario.tenant.id)
    await PartnerContentPolicy.create({
      tenant_id: scenario.tenant.id,
      require_experience_approval: true,
    })

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Oficina de preparo' })
    await client
      .post(`/api/v1/portal/content/experiences/${created.body().id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)

    const queue = await client
      .get('/backoffice/content')
      .headers(headers)
      .loginAs(moderator)
      .accept('html')
    queue.assertStatus(200)
    const page = parseInertiaPage(queue)

    assert.equal(page.props.filters.kind, 'all')
    assert.deepEqual(page.props.counts, { 'experiences': 1, 'events': 0, 'showcase-items': 0 })
    assert.deepEqual(
      page.props.sections.map((section: { kind: string }) => section.kind),
      ['experiences', 'events', 'showcase-items']
    )
    assert.equal(page.props.sections[0].data[0].title, 'Oficina de preparo')

    const events = await client
      .get('/backoffice/content?kind=events')
      .headers(headers)
      .loginAs(moderator)
      .accept('html')
    const eventsPage = parseInertiaPage(events)
    assert.equal(eventsPage.props.filters.kind, 'events')
    assert.lengthOf(eventsPage.props.sections, 1)
    assert.equal(eventsPage.props.counts.experiences, 1)
  })
})
