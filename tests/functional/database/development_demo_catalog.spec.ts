import { rm } from 'node:fs/promises'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import DevelopmentSeeder from '#database/seeders/development_seeder'
import { DEMO_EDITIONS } from '#database/support/demo/catalog/benefits'
import { DEMO_EXPERIENCES, DEMO_SHOWCASE_ITEMS } from '#database/support/demo/catalog/content'
import { DEMO_CITIES, demoCity } from '#database/support/demo/catalog/geography'
import { DEMO_FAMILIES } from '#database/support/demo/catalog/taxonomy'
import { DEMO_MARKER, DEMO_PLACE_NOTICE, DEMO_PLACES } from '#database/support/demo/catalog/places'
import { demoReviewPlan } from '#database/support/demo/catalog/reviews'
import { DEVELOPMENT_DEMO_CATALOG_ACTION } from '#database/support/development_demo_catalog'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import Tenant from '#modules/tenants/models/tenant'
import { useFakePayments } from '#tests/helpers/fake_payments'

/** Rows of the tables the catalogue writes, to prove a rerun adds nothing. */
async function tableCounts(tenantId: number) {
  const counts: Record<string, number> = {}
  for (const table of [
    'establishments',
    'establishment_revisions',
    'establishment_revision_media',
    'media_assets',
    'files',
    'organizations',
    'establishment_experiences',
    'establishment_events',
    'establishment_showcase_items',
    'partner_content_media',
    'establishment_reviews',
    'establishment_review_replies',
    'establishment_review_photos',
    'benefit_editions',
    'benefit_offers',
    'benefit_accesses',
    'cities',
    'categories',
    'category_attribute_definitions',
  ]) {
    const row = await db.from(table).where('tenant_id', tenantId).count('* as total').first()
    counts[table] = Number(row.total)
  }
  const markers = await db
    .from('audit_logs')
    .where('resource_id', tenantId)
    .where('action', DEVELOPMENT_DEMO_CATALOG_ACTION)
    .count('* as total')
    .first()
  counts.markers = Number(markers.total)
  return counts
}

/** The projection columns a visitor reads, to compare before and after a rebuild. */
async function projection(tenantId: number) {
  const result = await db.rawQuery(
    `SELECT establishment_id, published_revision_id, is_discoverable, city_slug, public_name,
            category_slugs, business_status, availability_type, latitude, longitude,
            weekly_hours, special_days, public_attributes, cover_media, media,
            reviews_count, reviews_average
       FROM catalog_establishments WHERE tenant_id = ? ORDER BY establishment_id`,
    [tenantId]
  )
  return JSON.stringify(result.rows)
}

function kilometresBetween(a: [number, number], b: [number, number]) {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(b[0] - a[0])
  const dLng = toRadians(b[1] - a[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

test.group('Development demo catalogue', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('seeds a rich fictitious catalogue that is published, projected and rerun without duplicates', async ({
    assert,
    client,
    cleanup,
  }) => {
    const outcome = await DevelopmentSeeder.prototype.seed()
    const tenant = await Tenant.findByOrFail('slug', 'development')
    // Only this run's objects: other seeds keep their own files under storage/seed.
    for (const prefix of ['seed/demo/v1/fs', 'seed/media/v2/fs'])
      cleanup(() =>
        rm(app.makePath('storage', prefix, String(tenant.id)), { recursive: true, force: true })
      )
    assert.deepEqual(outcome.notCreated, [])
    assert.isAbove(outcome.created.length, 400)

    // Discoverable places per city: the two large cities carry more.
    const perCity = await db
      .from('catalog_establishments')
      .where('tenant_id', tenant.id)
      .where('is_discoverable', true)
      .select('city_slug')
      .count('* as total')
      .groupBy('city_slug')
    const discoverable = Object.fromEntries(
      perCity.map((row) => [row.city_slug, Number(row.total)])
    )
    assert.sameMembers(
      Object.keys(discoverable),
      DEMO_CITIES.map((city) => city.slug)
    )
    for (const city of DEMO_CITIES) {
      const count = discoverable[city.slug]
      if (city.slug === 'londrina' || city.slug === 'maringa')
        assert.isTrue(count >= 12 && count <= 20, `${city.slug}: ${count}`)
      else assert.isTrue(count >= 4 && count <= 8, `${city.slug}: ${count}`)
    }
    const families = await db
      .from('catalog_establishment_categories')
      .where('tenant_id', tenant.id)
      .distinct('family_slug')
    assert.includeMembers(
      families.map((row) => row.family_slug),
      DEMO_FAMILIES.map((family) => family.slug)
    )

    // Every demo place is published, fictitious by its own words and inside its city.
    for (const place of DEMO_PLACES) {
      const revision = await EstablishmentRevision.query()
        .where('tenant_id', tenant.id)
        .where('public_name', place.name + DEMO_MARKER)
        .whereHas('city', (query) => query.where('slug', place.city))
        .preload('address')
        .orderBy('version', 'desc')
        .firstOrFail()
      const establishment = await Establishment.findOrFail(revision.establishment_id)
      assert.include(revision.description!, DEMO_PLACE_NOTICE)
      assert.equal(revision.address.street, 'Endereço demonstrativo')
      assert.match(revision.public_email!, /@experimente\.local$/)
      assert.isNull(revision.public_phone)
      const city = demoCity(place.city)
      const distance = kilometresBetween(
        [city.latitude, city.longitude],
        [Number(revision.address.latitude), Number(revision.address.longitude)]
      )
      assert.isAtMost(distance, city.spread_km * 1.8, place.key)

      if (place.publication === 'pending_review') {
        assert.equal(revision.status, 'pending_review')
        assert.isNull(establishment.published_revision_id)
        continue
      }
      assert.equal(establishment.published_revision_id, revision.id, place.key)
      assert.equal(establishment.business_status, place.business_status ?? 'open', place.key)
      const media = await db
        .from('establishment_revision_media')
        .where('revision_id', revision.id)
        .select('is_cover', 'moderation_status', 'alt_text')
      assert.lengthOf(media, 1 + (place.gallery?.length ?? 0), place.key)
      assert.lengthOf(
        media.filter((item) => item.is_cover),
        1
      )
      for (const item of media) {
        assert.equal(item.moderation_status, 'approved')
        assert.include(item.alt_text, 'Ilustração original')
      }
    }

    // Partner content, packages and reviews, all published.
    const published = async (table: string) => {
      const row = await db
        .from(table)
        .where('tenant_id', tenant.id)
        .where('status', 'published')
        .count('* as total')
        .first()
      return Number(row.total)
    }
    assert.equal(await published('establishment_experiences'), DEMO_EXPERIENCES.length)
    assert.equal(await published('establishment_showcase_items'), DEMO_SHOWCASE_ITEMS.length)
    assert.isAtLeast(await published('establishment_events'), 40)
    const plans = DEMO_PLACES.flatMap((place) => demoReviewPlan(place))
    assert.equal(await published('establishment_reviews'), plans.length)
    const replies = await db
      .from('establishment_review_replies')
      .where('tenant_id', tenant.id)
      .count('* as total')
      .first()
    assert.equal(Number(replies.total), plans.filter((plan) => plan.reply).length)
    const reports = await db.from('content_reports').where('tenant_id', tenant.id)
    assert.lengthOf(reports, 0, 'no demo text may trip an automatic rule')
    for (const edition of DEMO_EDITIONS) {
      const row = await db
        .from('benefit_editions')
        .where('tenant_id', tenant.id)
        .where('slug', edition.slug)
        .firstOrFail()
      assert.equal(row.status, 'published')
      const offers = await db
        .from('benefit_offers')
        .where('edition_id', row.id)
        .where('status', 'active')
      assert.lengthOf(offers, edition.offers.length)
    }

    // The public surfaces show it.
    const host = 'development.experimente.test'
    const cities = await client.get('/api/v1/catalog/cities').header('host', host)
    cities.assertStatus(200)
    const agenda = await client.get('/api/v1/catalog/cities/londrina/agenda').header('host', host)
    agenda.assertStatus(200)
    assert.isAtLeast(agenda.body().happening_today.length, 1)
    assert.isAtLeast(agenda.body().upcoming.length, 3)
    assert.isAtLeast(agenda.body().new_experiences.length, 3)
    const search = await client
      .get('/api/v1/catalog/cities/maringa/establishments')
      .qs({ q: 'pizza' })
      .header('host', host)
    search.assertStatus(200)
    assert.isAtLeast(search.body().organic_results.length, 1)

    // The projection is exactly what a rebuild from the sources produces.
    const before = await projection(tenant.id)
    const ids = await db.from('establishments').where('tenant_id', tenant.id).select('id')
    for (const { id } of ids)
      await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [tenant.id, id])
    assert.equal(await projection(tenant.id), before)

    // A rerun finds everything and writes nothing.
    const counts = await tableCounts(tenant.id)
    const again = await DevelopmentSeeder.prototype.seed()
    assert.lengthOf(again.created, 0)
    assert.deepEqual(again.notCreated, [])
    assert.deepEqual(await tableCounts(tenant.id), counts)
    assert.equal(await projection(tenant.id), before)
  }).timeout(900_000)
})
