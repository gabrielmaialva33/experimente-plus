import { createHash } from 'node:crypto'

import { test } from '@japa/runner'

import { DEMO_EDITIONS } from '#database/support/demo/catalog/benefits'
import {
  DEMO_EVENTS,
  DEMO_EXPERIENCES,
  DEMO_SHOWCASE_ITEMS,
} from '#database/support/demo/catalog/content'
import { DEMO_CITIES, DEMO_REGIONS } from '#database/support/demo/catalog/geography'
import {
  DEMO_CONSUMERS,
  DEMO_ORGANIZATIONS,
  DEMO_PARTNERS,
  demoCnpj,
} from '#database/support/demo/catalog/people'
import { DEMO_HOURS, DEMO_PLACES } from '#database/support/demo/catalog/places'
import { demoReviewPlan } from '#database/support/demo/catalog/reviews'
import {
  DEMO_ATTRIBUTES,
  DEMO_CATEGORIES,
  DEMO_FAMILIES,
} from '#database/support/demo/catalog/taxonomy'
import {
  demoIllustration,
  DEMO_IMAGE_HEIGHT,
  DEMO_IMAGE_WIDTH,
  DEMO_MOTIFS,
} from '#database/support/demo/illustration/scenes'
import { DEMO_MOTIF_ALT } from '#database/support/demo/illustration/alt_text'
import CnpjService from '#modules/organizations/services/cnpj_service'
import { runDetectors } from '#modules/reviews/services/automatic_moderation_detectors'

const unique = (values: string[]) => new Set(values).size === values.length

test.group('Demo catalogue data', () => {
  test('keys and slugs are unique and every reference resolves', ({ assert }) => {
    assert.isTrue(unique(DEMO_CITIES.map((city) => city.slug)))
    assert.isTrue(unique(DEMO_CITIES.map((city) => city.ibge_code)))
    assert.isTrue(unique(DEMO_CATEGORIES.map((category) => category.slug)))
    assert.isTrue(unique(DEMO_PLACES.map((place) => place.key)))
    assert.isTrue(unique(DEMO_PLACES.map((place) => `${place.city}|${place.name}`)))
    assert.isTrue(unique(DEMO_ORGANIZATIONS.map((organization) => organization.slug)))
    assert.isTrue(unique([...DEMO_PARTNERS, ...DEMO_CONSUMERS].map((person) => person.email_local)))
    assert.isTrue(unique(DEMO_EXPERIENCES.map((item) => item.key)))
    assert.isTrue(unique(DEMO_SHOWCASE_ITEMS.map((item) => item.key)))
    assert.isTrue(unique(DEMO_EVENTS.map((item) => item.key)))

    const cities = new Set(DEMO_CITIES.map((city) => city.slug))
    const regions = new Set(DEMO_REGIONS.map((region) => region.slug))
    const categories = new Set(DEMO_CATEGORIES.map((category) => category.slug))
    const families = new Set(DEMO_FAMILIES.map((family) => family.slug))
    const organizations = new Set(DEMO_ORGANIZATIONS.map((organization) => organization.key))
    const partners = new Set(DEMO_PARTNERS.map((partner) => partner.key))
    for (const city of DEMO_CITIES) assert.isTrue(regions.has(city.region_slug), city.slug)
    for (const category of DEMO_CATEGORIES)
      assert.isTrue(families.has(category.family_slug), category.slug)
    for (const organization of DEMO_ORGANIZATIONS)
      assert.isTrue(partners.has(organization.owner), organization.key)
    for (const place of DEMO_PLACES) {
      assert.isTrue(cities.has(place.city), place.key)
      assert.isTrue(categories.has(place.category), place.key)
      assert.isTrue(organizations.has(place.organization), place.key)
      assert.include(
        DEMO_CITIES.find((city) => city.slug === place.city)!.districts,
        place.district,
        place.key
      )
    }
    const places = new Map(DEMO_PLACES.map((place) => [place.key, place]))
    for (const item of [...DEMO_EXPERIENCES, ...DEMO_SHOWCASE_ITEMS, ...DEMO_EVENTS]) {
      const place = places.get(item.place)
      assert.exists(place, item.key)
      assert.notEqual(place!.publication, 'pending_review', item.key)
    }
    for (const edition of DEMO_EDITIONS)
      for (const offer of edition.offers) {
        const place = places.get(offer.place)
        assert.exists(place, offer.place)
        // An offer and its edition must share the city (validated by the service).
        assert.equal(place!.city, edition.city, offer.place)
        assert.isUndefined(place!.business_status, offer.place)
      }
  })

  test('every city of the north of Paraná gets a sensible number of places', ({ assert }) => {
    assert.isAtLeast(DEMO_CITIES.length, 6)
    for (const city of DEMO_CITIES) {
      const count = DEMO_PLACES.filter(
        (place) => place.city === city.slug && place.publication !== 'pending_review'
      ).length
      if (city.slug === 'londrina' || city.slug === 'maringa')
        assert.isTrue(count >= 12 && count <= 20, `${city.slug}: ${count}`)
      else assert.isTrue(count >= 4 && count <= 8, `${city.slug}: ${count}`)
    }
    const families = new Set(
      DEMO_PLACES.map(
        (place) => DEMO_CATEGORIES.find((category) => category.slug === place.category)!.family_slug
      )
    )
    assert.equal(families.size, DEMO_FAMILIES.length)
    // Some organizations own places in more than one city.
    const multiCity = DEMO_ORGANIZATIONS.filter(
      (organization) =>
        new Set(
          DEMO_PLACES.filter((place) => place.organization === organization.key).map(
            (place) => place.city
          )
        ).size > 1
    )
    assert.isAtLeast(multiCity.length, 3)
  })

  test('required attributes of every category are satisfiable and hours never overlap', ({
    assert,
  }) => {
    for (const [slug, attributes] of Object.entries(DEMO_ATTRIBUTES)) {
      assert.isTrue(unique(attributes.map((attribute) => attribute.key)), slug)
      for (const attribute of attributes.filter((item) => item.data_type.endsWith('select')))
        assert.isNotEmpty(attribute.options, `${slug}.${attribute.key}`)
    }
    for (const [profile, hours] of Object.entries(DEMO_HOURS)) {
      const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
      const intervals = hours.map((hour) => {
        const start = hour.weekday * 1440 + minutes(hour.opens_at)
        const end = hour.weekday * 1440 + minutes(hour.closes_at) + (hour.spans_next_day ? 1440 : 0)
        assert.isAbove(end, start, profile)
        return [start, end] as const
      })
      intervals.sort((a, b) => a[0] - b[0])
      for (let index = 1; index < intervals.length; index++)
        assert.isAtMost(intervals[index - 1][1], intervals[index][0], profile)
    }
  })

  test('texts never trip the automatic moderation and never carry contacts', ({ assert }) => {
    const texts = [
      ...DEMO_EXPERIENCES.flatMap((item) => [item.title, item.description]),
      ...DEMO_SHOWCASE_ITEMS.flatMap((item) => [item.title, item.description]),
      ...DEMO_EVENTS.flatMap((item) => [item.title, item.description]),
      ...DEMO_PLACES.flatMap((place) =>
        demoReviewPlan(place).flatMap((plan) => [plan.comment, plan.reply ?? ''])
      ),
    ]
    for (const text of texts) assert.deepEqual(runDetectors([text], []), [], text)
  })

  test('review plans are deterministic, one per consumer and with realistic ratings', ({
    assert,
  }) => {
    let total = 0
    let sum = 0
    for (const place of DEMO_PLACES) {
      const plans = demoReviewPlan(place)
      assert.deepEqual(demoReviewPlan(place), plans)
      assert.isTrue(unique(plans.map((plan) => plan.consumer.key)), place.key)
      if (place.publication === 'pending_review') assert.lengthOf(plans, 0)
      total += plans.length
      sum += plans.reduce((acc, plan) => acc + plan.rating, 0)
    }
    assert.isAbove(total, DEMO_PLACES.length * 2)
    const average = sum / total
    assert.isTrue(average > 3.8 && average < 4.7, String(average))
  })

  test('organizations get valid, distinct CNPJs', ({ assert }) => {
    const service = new CnpjService()
    const numbers = DEMO_ORGANIZATIONS.map((organization) => demoCnpj(organization.cnpj_branch))
    assert.isTrue(unique(numbers))
    for (const number of numbers) assert.isTrue(service.isValid(number), number)
  })
})

test.group('Demo illustrations', () => {
  test('every motif renders a deterministic, original PNG of the published size', ({ assert }) => {
    const checksums = new Set<string>()
    for (const motif of DEMO_MOTIFS) {
      const png = demoIllustration({ motif, seed: `unit|${motif}` })
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
      assert.equal(png.toString('ascii', 12, 16), 'IHDR')
      assert.equal(png.readUInt32BE(16), DEMO_IMAGE_WIDTH)
      assert.equal(png.readUInt32BE(20), DEMO_IMAGE_HEIGHT)
      // No ancillary chunks: nothing for the metadata stripper to remove.
      assert.equal(png.toString('ascii', 37, 41), 'IDAT')
      assert.isBelow(png.length, 200_000, motif)
      assert.isTrue(png.equals(demoIllustration({ motif, seed: `unit|${motif}` })))
      checksums.add(createHash('sha256').update(png).digest('hex'))
      assert.isString(DEMO_MOTIF_ALT[motif])
    }
    assert.equal(checksums.size, DEMO_MOTIFS.length)
  }).timeout(60_000)

  test('seeds and framings vary the same motif', ({ assert }) => {
    const cover = demoIllustration({ motif: 'coffee', seed: 'a' })
    assert.isFalse(cover.equals(demoIllustration({ motif: 'coffee', seed: 'b' })))
    assert.isFalse(
      cover.equals(demoIllustration({ motif: 'coffee', seed: 'a', framing: 'detail' }))
    )
  }).timeout(20_000)
})
