import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const style = JSON.parse(
  await readFile(new URL('../../resources/maps/norte-parana/style.json', import.meta.url), 'utf8')
)

test('regional style uses the measured v4.15.2 schema and native PMTiles v3 source', () => {
  assert.equal(style.version, 8)
  assert.equal(style.metadata['experimente:basemap-version'], '4.15.2')
  assert.equal(style.metadata['experimente:language'], 'pt')
  assert.equal(style.sources.protomaps.maxzoom, 15)
  assert.deepEqual(style.sources.protomaps.bounds, [-51.4, -23.55, -50.25, -22.95])
  assert.match(style.sources.protomaps.url, /^pmtiles:\/\/https:\/\//)
  const schema = new Set([
    'boundaries',
    'buildings',
    'earth',
    'landcover',
    'landuse',
    'places',
    'pois',
    'roads',
    'water',
  ])
  assert.equal(new Set(style.layers.map((layer) => layer.id)).size, style.layers.length)
  for (const layer of style.layers) {
    if (layer.type === 'background') continue
    assert.equal(layer.source, 'protomaps')
    assert.ok(schema.has(layer['source-layer']), layer.id)
  }
  for (const name of ['roads', 'buildings', 'places', 'water']) {
    assert.ok(style.layers.some((layer) => layer['source-layer'] === name))
  }
})

test('all runtime assets share the immutable public release prefix without authentication', () => {
  const tileUrl = new URL(style.sources.protomaps.url.slice('pmtiles://'.length))
  const prefix = new URL('./', tileUrl).href
  for (const value of [tileUrl.href, style.glyphs, style.sprite]) {
    assert.ok(value.startsWith(prefix))
    const parsed = new URL(value)
    assert.equal(parsed.protocol, 'https:')
    assert.equal(parsed.username + parsed.password + parsed.search + parsed.hash, '')
  }
  assert.match(style.glyphs, /assets\/fonts\/\{fontstack\}\/\{range\}\.pbf$/)
  assert.match(style.sprite, /assets\/sprites\/v4\/grayscale$/)
})

test('flat cool base leaves institutional blue and conversion orange to the application', () => {
  const background = style.layers.find((layer) => layer.type === 'background')
  assert.equal(background.paint['background-color'], '#f3f5f7')
  for (const layer of style.layers) {
    assert.ok(!['hillshade', 'fill-extrusion', 'raster'].includes(layer.type))
    for (const key of Object.keys(layer.paint ?? {})) {
      assert.ok(!/halo|blur|gradient|pattern/.test(key), `${layer.id}: ${key}`)
    }
    const paint = JSON.stringify(layer.paint ?? {}).toLowerCase()
    assert.ok(!paint.includes('#13467c') && !paint.includes('#e2661a'))
  }
  const pois = style.layers.find((layer) => layer.id === 'pois')
  assert.ok(pois.layout['text-field'])
  assert.equal(pois.layout['icon-image'], undefined)
})

test('solid map surfaces keep the canonical text colors above 4.5:1', () => {
  const luminance = (hex) => {
    const linear = hex.match(/[a-f\d]{2}/gi).map((channel) => {
      const value = Number.parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const colors = new Set()
  for (const layer of style.layers) {
    const color = layer.paint?.['fill-color'] ?? layer.paint?.['background-color']
    for (const hex of JSON.stringify(color ?? '').match(/#[a-f\d]{6}/gi) ?? []) colors.add(hex)
  }
  assert.ok(colors.size >= 8)
  for (const foreground of ['#1e2227', '#535961']) {
    for (const surface of colors) {
      const ratio = (luminance(surface) + 0.05) / (luminance(foreground) + 0.05)
      assert.ok(ratio >= 4.5, `${foreground} on ${surface}: ${ratio}`)
    }
  }
})
