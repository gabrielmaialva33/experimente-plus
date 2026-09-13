import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Offline generator. The runbook downloads and verifies this exact upstream package.
const [packageDirectory, releaseUrl, output] = process.argv.slice(2)
if (!packageDirectory || !releaseUrl || !output) {
  throw new Error('Usage: node build_style.mjs PACKAGE_DIRECTORY HTTPS_RELEASE_URL OUTPUT_JSON')
}
const base = new URL(releaseUrl)
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
  throw new Error('Use a public HTTPS release prefix without credentials, query or fragment')
}
if (!base.pathname.endsWith('/')) base.pathname += '/'
const pkg = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'))
if (pkg.name !== '@protomaps/basemaps' || pkg.version !== '5.7.2') {
  throw new Error('Expected @protomaps/basemaps 5.7.2')
}
const { layers, namedFlavor } = await import(
  pathToFileURL(resolve(packageDirectory, 'dist/esm/index.js')).href
)

// Canonical UI colors: docs/design/catalog_tokens.md. Geographic fills are
// deliberately pale; primary and CTA are reserved for the application overlay.
const flavor = namedFlavor('light')
const groups = {
  '#f3f5f7': 'background earth pedestrian sand beach industrial military aerodrome',
  '#ffffff':
    'glacier pier other minor_service minor_a minor_b link major highway bridges_other bridges_minor bridges_link bridges_major bridges_highway',
  '#e5eee7': 'park_a park_b zoo scrub_a scrub_b',
  '#e2ebe5': 'wood_a wood_b',
  '#e8edf2': 'hospital school runway',
  '#dceaf0': 'water',
  '#dce1e7': 'buildings',
  '#c7cbd0':
    'minor_service_casing minor_casing link_casing major_casing_early major_casing_late highway_casing_early highway_casing_late bridges_other_casing bridges_minor_casing bridges_link_casing bridges_major_casing bridges_highway_casing tunnel_other_casing tunnel_minor_casing tunnel_link_casing tunnel_major_casing tunnel_highway_casing',
  '#e8ecf1': 'tunnel_other tunnel_minor tunnel_link tunnel_major tunnel_highway',
  '#73787f': 'railway boundaries',
  '#535961': 'roads_label_minor ocean_label subplace_label address_label',
  '#1e2227': 'roads_label_major city_label state_label country_label',
}
const assigned = new Set()
for (const [color, names] of Object.entries(groups)) {
  for (const name of names.split(' ')) {
    if (!(name in flavor) || assigned.has(name)) throw new Error(`Unexpected flavor key: ${name}`)
    flavor[name] = color
    assigned.add(name)
  }
}
for (const name of Object.keys(flavor)) {
  // Upstream requires halo colors, but all halo paint properties are removed below.
  if (name.endsWith('_halo')) flavor[name] = '#f3f5f7'
  else if (typeof flavor[name] === 'string' && !assigned.has(name)) {
    throw new Error(`Unmapped upstream color: ${name}`)
  }
}
flavor.landcover = {
  barren: '#f3f5f7',
  farmland: '#eef2ef',
  forest: '#e2ebe5',
  glacier: '#ffffff',
  grassland: '#e5eee7',
  scrub: '#e5eee7',
  urban_area: '#f3f5f7',
}
flavor.pois = Object.fromEntries(Object.keys(flavor.pois).map((key) => [key, '#535961']))
const mapLayers = layers('protomaps', flavor, { lang: 'pt' })
for (const layer of mapLayers) {
  for (const key of Object.keys(layer.paint ?? {})) {
    if (key.includes('halo') || key.includes('blur')) delete layer.paint[key]
  }
  // Grayscale sprites retain townspots, shields and direction arrows. OSM POIs
  // remain contextual text; the application's catalog pins retain visual priority.
  if (layer.id === 'pois') {
    delete layer.layout['icon-image']
    layer.layout['text-offset'] = [0, 0]
  }
}
const style = {
  version: 8,
  name: 'Experimente+ — Norte do Paraná — claro',
  metadata: {
    'experimente:basemap-version': '4.15.2',
    'experimente:build': '20260911',
    'experimente:style-package': '@protomaps/basemaps@5.7.2',
    'experimente:assets-commit': '028c18f713baecad011301ff7a69acc39bcc2ae7',
    'experimente:theme': 'neutro-frio-flat-2.0',
    'experimente:palette': 'docs/design/catalog_tokens.md',
    'experimente:language': 'pt',
  },
  center: [-51.1696, -23.3045],
  zoom: 11,
  glyphs: `${base.href}assets/fonts/{fontstack}/{range}.pbf`,
  sprite: `${base.href}assets/sprites/v4/grayscale`,
  sources: {
    protomaps: {
      type: 'vector',
      url: `pmtiles://${base.href}norte-parana.pmtiles`,
      minzoom: 0,
      maxzoom: 15,
      bounds: [-51.4, -23.55, -50.25, -22.95],
      attribution:
        '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: mapLayers,
}
await writeFile(output, `${JSON.stringify(style, null, 2)}\n`)
