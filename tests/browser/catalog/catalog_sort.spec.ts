import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import type { BrowserContext, Page } from 'playwright'

import { BenefitEditionFactory, BenefitOfferFactory } from '#database/factories/index'
import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import { gotoAppPage } from '#tests/browser/helpers/navigation'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'

/** Londrina's cathedral: where the browser says the visitor is. */
const POSITION = { latitude: -23.3105, longitude: -51.1628 }

async function place(
  scenario: EstablishmentScenario,
  name: string,
  at: { latitude: number; longitude: number }
): Promise<Establishment> {
  const establishment = await createPublishedEstablishment(scenario, name)
  await EstablishmentRevisionAddress.create({
    tenant_id: scenario.tenant.id,
    revision_id: establishment.published_revision_id!,
    postal_code: '86010000',
    street: 'Rua de teste',
    number: '10',
    without_number: false,
    complement: null,
    district: 'Centro',
    reference: null,
    latitude: at.latitude,
    longitude: at.longitude,
    coordinate_source: 'manual',
    geocoded_at: null,
  })
  await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [
    scenario.tenant.id,
    establishment.id,
  ])
  return establishment
}

/** This suite commits its rows: every run names its operations apart from the last one. */
const RUN = Date.now().toString(36)

/** Two places: the alphabetical first is the farther one, so the orders differ. */
async function city(prefix: string) {
  const scenario = await createEstablishmentScenario(`${prefix}-${RUN}`)
  const far = await place(scenario, 'Alfa Longe', { latitude: -23.33, longitude: -51.2 })
  const near = await place(scenario, 'Bravo Perto', { latitude: -23.311, longitude: -51.163 })
  return { scenario, far, near }
}

/** The public catalogue answers by hostname; the browser reaches it on localhost. */
async function openCity(context: BrowserContext, scenario: EstablishmentScenario): Promise<Page> {
  const page = await context.newPage()
  await page.setExtraHTTPHeaders({ 'x-forwarded-host': `${scenario.tenant.slug}.experimente.test` })
  await gotoAppPage(page, `/cidades/${scenario.city.slug}`)
  await page.getByRole('heading', { name: 'Todos os lugares' }).waitFor()
  return page
}

const placeNames = (page: Page) =>
  page
    .getByRole('region', { name: 'Todos os lugares' })
    .getByRole('heading', { level: 3 })
    .allTextContents()

test.group('Catalogue orders in the browser', () => {
  test('orders nearest first with the browser position, never in a page URL', async ({
    assert,
    browserContext,
  }) => {
    const { scenario } = await city('browser-sort-nearby')
    await browserContext.grantPermissions(['geolocation'])
    await browserContext.setGeolocation(POSITION)
    const page = await openCity(browserContext, scenario)
    const requested: string[] = []
    page.on('request', (request) => requested.push(request.url()))

    assert.deepEqual(await placeNames(page), ['Alfa Longe', 'Bravo Perto'])

    await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('distance')
    await page.getByRole('status').getByText('Localização pronta').waitFor()
    await page.getByRole('button', { name: 'Buscar' }).click()
    await page.getByRole('status').getByText('Ordenado pelos mais perto de você').waitFor()

    assert.deepEqual(await placeNames(page), ['Bravo Perto', 'Alfa Longe'])
    await page.getByText('Ordenação: mais perto').waitFor()

    // The position went to the API once, and never into the address bar or a page request.
    const withPosition = requested.filter((url) => url.includes('lat='))
    assert.lengthOf(withPosition, 1)
    assert.include(withPosition[0], `/api/v1/catalog/cities/${scenario.city.slug}/establishments?`)
    assert.include(withPosition[0], 'sort=distance')
    assert.notInclude(page.url(), 'lat=')
    assert.notInclude(page.url(), String(POSITION.latitude))
    assert.isTrue(
      requested.filter((url) => url.includes('/cidades/')).every((url) => !url.includes('lat='))
    )
  })

  test('falls back to relevance and says why when the location is refused', async ({
    assert,
    browserContext,
  }) => {
    const { scenario } = await city('browser-sort-denied')
    await browserContext.clearPermissions()
    const page = await openCity(browserContext, scenario)

    await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('distance')

    await page
      .getByRole('status')
      .getByText('Sem permissão para usar sua localização. Mostrando por relevância.')
      .waitFor()
    assert.equal(
      await page.getByRole('combobox', { name: 'Ordenar por' }).inputValue(),
      'relevance'
    )
    assert.deepEqual(await placeNames(page), ['Alfa Longe', 'Bravo Perto'])
  })

  test('keeps "Vale hoje" and the rating order in a shareable URL and badges the card', async ({
    assert,
    browserContext,
  }) => {
    const { scenario, near } = await city('browser-sort-benefit')
    const edition = await BenefitEditionFactory.apply('published')
      .merge({ tenant_id: scenario.tenant.id, city_id: scenario.city.id })
      .create()
    await BenefitOfferFactory.apply('active')
      .merge({ tenant_id: scenario.tenant.id, edition_id: edition.id, establishment_id: near.id })
      .create()
    const page = await openCity(browserContext, scenario)
    await page.setViewportSize({ width: 390, height: 844 })

    // The input is visually hidden behind its chip: a person clicks the chip.
    await page.locator('label').filter({ hasText: 'Vale hoje' }).click()
    assert.isTrue(await page.getByRole('checkbox', { name: 'Vale hoje' }).isChecked())
    await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('rating')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await page.waitForURL(/benefit_today=true/)

    assert.include(page.url(), 'sort=rating')
    assert.deepEqual(await placeNames(page), ['Bravo Perto'])
    const card = page.getByRole('link', { name: 'Bravo Perto' })
    assert.include(await card.getAttribute('aria-describedby'), 'benefit')
    await card.getByText('Vale hoje').waitFor()

    const width = await page.evaluate(() => ({
      page: (globalThis as any).document.documentElement.scrollWidth as number,
      viewport: (globalThis as any).innerWidth as number,
    }))
    assert.isAtMost(width.page, width.viewport)
  })
})
