import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

function assertSensitivePathsExcluded(source, filename) {
  const rules = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  // Pin Docker-supported root and recursive exclusions. Do not approximate
  // Docker matching or enumerate/read operational files to test this contract.
  for (const rule of [
    '.bootstrap-credentials',
    '**/.bootstrap-credentials*',
    'build.log',
    '**/*.log',
    '.env',
    '.env.local',
    '.env.*.local',
    '**/.env.*.local',
    'node_modules',
    'build',
    'dist',
    'coverage',
    'tmp',
    'storage/uploads/**',
    'storage/seed-media/**',
  ]) {
    assert.ok(rules.includes(rule), `${filename} must exclude ${rule}`)
  }
  assert.ok(
    rules.every((rule) => !rule.startsWith('!')),
    `${filename}: re-inclusion rules require a review of the sensitive-path contract`
  )
}

test('Docker build context explicitly excludes bootstrap credentials and operational logs', async () => {
  // Source-only gate: no Docker, subprocess, build, context traversal or secret reads.
  const rootIgnore = await readFile(new URL('../../.dockerignore', import.meta.url), 'utf8')
  assertSensitivePathsExcluded(rootIgnore, '.dockerignore')

  // Dockerfile-specific ignores take precedence over the root ignore file.
  // If introduced later, they must carry the same protections.
  let override
  try {
    override = await readFile(new URL('../../Dockerfile.dockerignore', import.meta.url), 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (override !== undefined) {
    assertSensitivePathsExcluded(override, 'Dockerfile.dockerignore')
  }
})

test('production image starts only HTTP; migrations belong to the one-shot deploy phase', async () => {
  const dockerfile = await readFile(new URL('../../Dockerfile', import.meta.url), 'utf8')
  assert.match(dockerfile, /^CMD \["node", "bin\/server\.js"\]$/m)
  assert.doesNotMatch(dockerfile, /^CMD .*migration:run/m)
})

test('local complete stack migrates a fresh database while VPS startup never does', async () => {
  const localCompose = await readFile(new URL('../../docker-compose.yml', import.meta.url), 'utf8')
  const productionCompose = await readFile(
    new URL('../../docker-compose.vps.yml', import.meta.url),
    'utf8'
  )

  assert.match(
    localCompose,
    /command: \['sh', '-c', 'node ace\.js migration:run --force && exec node bin\/server\.js'\]/
  )
  assert.doesNotMatch(productionCompose, /migration:run/)
})
