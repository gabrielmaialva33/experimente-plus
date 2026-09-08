import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { parse } from 'yaml'

const root = new URL('../../', import.meta.url)

test('production lock graph excludes SQLite and Tailwind compiler, retaining PostgreSQL and Argon2', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
  const lock = parse(await readFile(new URL('pnpm-lock.yaml', root), 'utf8'))
  for (const name of [
    'better-sqlite3',
    '@tailwindcss/vite',
    'tailwindcss',
    'tailwindcss-animate',
  ]) {
    assert.ok(manifest.devDependencies[name])
    assert.equal(manifest.dependencies[name], undefined)
  }
  // Follow actual locked transitive/peer edges: moving only the root manifest
  // would still pull SQLite through Knex and must fail this regression.
  const seen = new Set()
  function visit(name, version) {
    assert.notEqual(name, 'better-sqlite3')
    assert.notEqual(name, '@tailwindcss/oxide')
    const key = lock.snapshots[`${name}@${version}`] ? `${name}@${version}` : version
    assert.ok(!key.startsWith('better-sqlite3@'))
    assert.ok(!key.startsWith('@tailwindcss/oxide@'))
    if (seen.has(key)) return
    seen.add(key)
    const snapshot = lock.snapshots[key]
    assert.ok(snapshot, `Missing snapshot: ${key}`)
    for (const [child, resolved] of Object.entries({
      ...snapshot.dependencies,
      ...snapshot.optionalDependencies,
    }))
      visit(child, resolved)
  }
  for (const [name, entry] of Object.entries(lock.importers['.'].dependencies))
    visit(name, entry.version)
  assert.ok([...seen].some((key) => key.startsWith('pg@')))
  assert.ok([...seen].some((key) => key.startsWith('argon2@')))
})

test('explicit development SQLite still works through the Lucid Knex dependency', async () => {
  const require = createRequire(import.meta.url)
  const lucidRequire = createRequire(require.resolve('@adonisjs/lucid'))
  const knex = lucidRequire('knex')({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  })
  try {
    assert.equal((await knex.raw('select 42 as answer'))[0].answer, 42)
  } finally {
    await knex.destroy()
  }
})

test('image caches production installation before source and keeps compilers out of runtime', async () => {
  const source = await readFile(new URL('Dockerfile', root), 'utf8')
  const deps = source
    .split('FROM toolchain AS production-deps')[1]
    .split('FROM base AS production')[0]
  assert.match(deps, /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml \.pnpmfile\.cjs/)
  assert.match(deps, /pnpm install --prod --frozen-lockfile --child-concurrency=1/)
  assert.doesNotMatch(deps, /COPY \. \.|COPY --from=build/)
  const runtime = source.split('FROM base AS production')[1]
  assert.match(runtime, /COPY --from=production-deps \/app\/node_modules/)
  assert.doesNotMatch(runtime, /RUN .*install|FROM toolchain/)
  assert.match(source, /ENV npm_config_nodedir=\/usr\/local/)
  assert.match(source, /ENV npm_config_jobs=2/)
  assert.match(source, /NODE_OPTIONS=--max-old-space-size=2048 pnpm build/)
  assert.match(source, /target=\/pnpm\/store,sharing=locked/)
})
