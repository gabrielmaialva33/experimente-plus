import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parse } from 'yaml'

const bootstrapHostDirectory = '/var/lib/experimente-plus/bootstrap-credentials'

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

test('only the one-shot bootstrap override can read the persistent credential directory', async () => {
  const production = parse(
    await readFile(new URL('../../docker-compose.vps.yml', import.meta.url), 'utf8')
  )
  const bootstrap = parse(
    await readFile(new URL('../../docker-compose.bootstrap.yml', import.meta.url), 'utf8')
  )

  assert.equal(
    JSON.stringify(production.services.app.volumes).includes(bootstrapHostDirectory),
    false
  )
  assert.deepEqual(production.services.app.environment, {
    NODE_ENV: 'production',
    PORT: 3333,
    HOST: '0.0.0.0',
    TRUST_PROXY: 'uniquelocal',
  })
  assert.deepEqual(bootstrap.services.app.volumes, [
    {
      type: 'bind',
      source: bootstrapHostDirectory,
      target: bootstrapHostDirectory,
      bind: { create_host_path: false },
    },
  ])
  assert.equal('build' in bootstrap.services.app, false)
  assert.match(bootstrap.services.app.image, /^\$\{EXPERIMENTE_BOOTSTRAP_IMAGE:\?/)
  assert.deepEqual(bootstrap.services.app.env_file, [
    '${EXPERIMENTE_BOOTSTRAP_ENV_FILE:?Set EXPERIMENTE_BOOTSTRAP_ENV_FILE to the frozen production environment snapshot}',
  ])
  assert.equal(bootstrap.name, 'experimente-plus-bootstrap')
})

test('bootstrap rotation procedure remains pinned, serialized, and environment-safe', async () => {
  const runbook = await readFile(
    new URL('../../docs/runbooks/persistent_schema_reconciliation.md', import.meta.url),
    'utf8'
  )
  const bashBlocks = [...runbook.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1])
  const procedure = bashBlocks.find(
    (block) =>
      block.startsWith('(\n  set -euo pipefail') && block.includes('security:rotate-bootstrap')
  )

  assert.ok(procedure, 'the executable bootstrap procedure must remain in the runbook')
  const syntaxCheck = spawnSync('bash', ['-n'], {
    encoding: 'utf8',
    input: procedure,
  })
  assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr)
  assert.match(procedure, /env -i PATH=\/usr\/bin:\/bin LANG=C/)
  assert.match(procedure, /safe_docker\(\)/)
  assert.match(procedure, /safe_compose\(\)/)
  assert.match(procedure, /GIT_NO_REPLACE_OBJECTS=1/)
  assert.match(procedure, /GIT_CONFIG_GLOBAL=\/dev\/null/)
  assert.match(procedure, /flock -n 9/)
  assert.match(procedure, /safe_git cat-file blob "\$compose_blob"/)
  assert.doesNotMatch(procedure, /test -(?:d|f) [^\n]+ && test ! -L/)
  assert.match(procedure, /environment_snapshot=\$\(mktemp \/run\//)
  assert.match(procedure, /cmp -s -- "\$environment_source" "\$environment_snapshot"/)
  assert.match(procedure, /expected_environment_fingerprint=/)
  assert.match(procedure, /running_environment_fingerprint=/)
  assert.match(procedure, /\.DB_CONNECTION == "postgres"/)
  assert.match(procedure, /\.DB_PASSWORD, \.DB_DATABASE/)
  assert.match(
    procedure,
    /test "\$expected_environment_fingerprint" = "\$running_environment_fingerprint"/
  )
  assert.match(procedure, /EXPERIMENTE_BOOTSTRAP_ENV_FILE="\$environment_snapshot"/)
  assert.match(procedure, /\/usr\/bin\/docker compose --env-file "\$environment_snapshot"/)
  assert.match(procedure, /--project-name experimente-plus-bootstrap/)
  assert.match(procedure, /--filter label=com\.docker\.compose\.service=app/)
  assert.match(procedure, /--filter label=com\.experimente-plus\.operation=bootstrap-rotation/)
  assert.match(procedure, /--pull never/)
  assert.match(procedure, /--label com\.experimente-plus\.operation=bootstrap-rotation/)

  const rotationOffset = procedure.lastIndexOf('app node ace.js security:rotate-bootstrap')
  assert.ok(rotationOffset > 0)
  for (const prerequisite of [
    'flock -n 9',
    'safe_git cat-file blob "$compose_blob"',
    'cmp -s -- "$environment_source" "$environment_snapshot"',
    'test "$expected_environment_fingerprint" = "$running_environment_fingerprint"',
    'config --images',
  ]) {
    const prerequisiteOffset = procedure.indexOf(prerequisite)
    assert.ok(prerequisiteOffset >= 0, `missing prerequisite: ${prerequisite}`)
    assert.ok(prerequisiteOffset < rotationOffset, `${prerequisite} must precede the rotation`)
  }
})

test('external deploy entrypoint update is atomic and sourced from verified LKG', async () => {
  const runbook = await readFile(
    new URL('../../docs/runbooks/persistent_schema_reconciliation.md', import.meta.url),
    'utf8'
  )
  const procedure = [...runbook.matchAll(/```bash\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((block) => block.includes('entrypoint_candidate=$(mktemp /usr/local/libexec/'))

  assert.ok(procedure, 'the external entrypoint update procedure must remain in the runbook')
  const syntaxCheck = spawnSync('bash', ['-n'], { encoding: 'utf8', input: procedure })
  assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr)
  assert.match(procedure, /flock -n 9/)
  assert.match(procedure, /trap 'exit 129' HUP/)
  assert.match(procedure, /trap '' HUP INT TERM/)
  assert.match(procedure, /--filter label=com\.experimente-plus\.operation=bootstrap-rotation/)
  assert.match(procedure, /safe_git cat-file blob "\$entrypoint_blob"/)
  assert.match(procedure, /\$'100755 blob '/)
  assert.match(procedure, /\/usr\/bin\/bash -n "\$entrypoint_candidate"/)
  assert.match(procedure, /grep -Fq 'assert_no_bootstrap_rotation\(\) \{'/)
  assert.match(procedure, /experimente-plus-deploy-\$current_sha\.sh/)
  assert.match(procedure, /mv -f -- "\$entrypoint_previous" "\$deploy_entrypoint"/)
  assert.match(procedure, /"\$current_sha  \$deploy_entrypoint"/)
  assert.match(procedure, /mv -f -- "\$entrypoint_candidate" "\$deploy_entrypoint"/)

  const renameOffset = procedure.indexOf('mv -f -- "$entrypoint_candidate" "$deploy_entrypoint"')
  for (const prerequisite of [
    'flock -n 9',
    'test -z "$rotation_containers"',
    'safe_git cat-file blob "$entrypoint_blob"',
    '/usr/bin/bash -n "$entrypoint_candidate"',
    `grep -Fq 'assert_no_bootstrap_rotation() {' "$entrypoint_candidate"`,
    'install -o root -g root -m 0500 "$deploy_entrypoint" "$entrypoint_backup"',
    'test "$(sha256sum "$entrypoint_candidate")" = "$target_sha  $entrypoint_candidate"',
  ]) {
    const prerequisiteOffset = procedure.indexOf(prerequisite)
    assert.ok(prerequisiteOffset >= 0, `missing prerequisite: ${prerequisite}`)
    assert.ok(prerequisiteOffset < renameOffset, `${prerequisite} must precede replacement`)
  }
  const replacementStartedOffset = procedure.indexOf('replacement_started=1')
  const replacementVerifiedOffset = procedure.indexOf('replacement_verified=1')
  assert.ok(replacementStartedOffset >= 0 && replacementStartedOffset < renameOffset)
  assert.ok(replacementVerifiedOffset > renameOffset)
})
