import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const deployPath = fileURLToPath(new URL('../../deploy.sh', import.meta.url))
const mockPath = fileURLToPath(new URL('./fixtures/deploy_command.mjs', import.meta.url))
const smokeSource = fileURLToPath(new URL('../../scripts/smoke_catalog.sh', import.meta.url))
const ignoreSource = new URL('../../.dockerignore', import.meta.url)
const goodRevision = 'a'.repeat(40)
const target = 'b'.repeat(40)
const goodImage = `sha256:${'1'.repeat(64)}`
const newImage = `sha256:${'2'.repeat(64)}`
const runtimeEnv = 'APP_KEY=synthetic-runtime-key\nPORT=3400\n'
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'experimente-deploy-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const stateDir = join(root, '.git', 'experimente-plus-deploy')
  const bin = join(root, 'node_modules', '.deploy-test-bin')
  await mkdir(stateDir, { recursive: true })
  await mkdir(bin, { recursive: true })
  await mkdir(join(root, 'scripts'))
  await writeFile(join(root, '.env'), runtimeEnv, { mode: 0o600 })
  await writeFile(join(root, 'scripts', 'smoke_catalog.sh'), 'fixture overwritten by reset')
  const archiveSource = join(stateDir, 'archive-source')
  const goodArchiveSource = join(stateDir, 'good-archive-source')
  await mkdir(join(archiveSource, 'scripts'), { recursive: true })
  await mkdir(join(goodArchiveSource, 'scripts'), { recursive: true })
  const baseSmoke = await readFile(smokeSource, 'utf8')
  const goodSmoke = `export DEPLOY_TEST_SMOKE_REVISION=${shellQuote(goodRevision)}\n${baseSmoke}`
  const newSmoke = `export DEPLOY_TEST_SMOKE_REVISION=${shellQuote(target)}\n${baseSmoke}${
    options.incompatibleNewSmoke ? '\ncheck_endpoint /new-contract-only text/html text/html\n' : ''
  }`
  const goodSmokeHash = createHash('sha256').update(goodSmoke).digest('hex')
  const newSmokeHash = createHash('sha256').update(newSmoke).digest('hex')
  const goodSmokeSource = join(root, 'good-smoke-source.sh')
  await writeFile(goodSmokeSource, goodSmoke)
  await writeFile(join(goodArchiveSource, 'scripts', 'smoke_catalog.sh'), goodSmoke)
  await writeFile(join(goodArchiveSource, '.dockerignore'), await readFile(ignoreSource))
  await writeFile(join(goodArchiveSource, 'revision.txt'), goodRevision)
  await writeFile(
    join(goodArchiveSource, 'docker-compose.vps.yml'),
    `name: experimente-plus\n# ${goodRevision}\n`
  )
  await writeFile(join(archiveSource, 'scripts', 'smoke_catalog.sh'), newSmoke)
  await writeFile(join(archiveSource, '.dockerignore'), await readFile(ignoreSource))
  await writeFile(join(archiveSource, 'revision.txt'), target)
  await writeFile(
    join(archiveSource, 'docker-compose.vps.yml'),
    `name: experimente-plus\n# ${target}\n`
  )
  // The operational checkout starts as the exact HEAD tree selected by the
  // scenario. Dirty-state controls mutate these files when required.
  const initialRevision = options.head ?? goodRevision
  const initialSource = initialRevision === target ? archiveSource : goodArchiveSource
  await writeFile(
    join(root, 'docker-compose.vps.yml'),
    await readFile(join(initialSource, 'docker-compose.vps.yml'))
  )
  await writeFile(join(root, '.dockerignore'), await readFile(join(initialSource, '.dockerignore')))
  await writeFile(join(root, 'revision.txt'), initialRevision)
  await writeFile(
    join(root, 'scripts', 'smoke_catalog.sh'),
    await readFile(join(initialSource, 'scripts', 'smoke_catalog.sh'))
  )
  for (const command of ['git', 'docker', 'curl', 'mv']) {
    await writeFile(
      join(bin, command),
      `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(mockPath)} ${command} "$@"\n`,
      { mode: 0o755 }
    )
  }
  await writeFile(join(stateDir, 'commands.jsonl'), '')
  await writeFile(
    join(stateDir, 'mock-state.json'),
    JSON.stringify({
      head: goodRevision,
      goodRevision,
      target,
      goodImage,
      newImage,
      smokeSource,
      archiveSource,
      goodArchiveSource,
      goodSmokeSource,
      running: goodImage,
      runtimeEnv,
      images: { 'experimente-plus-app': goodImage },
      ...options,
    })
  )
  const knownGoodPath = join(stateDir, 'last-known-good')
  const knownGoodRecord = `${goodRevision}\n${goodImage}\n${goodSmokeHash}\n`
  const newGoodRecord = `${target}\n${newImage}\n${newSmokeHash}\n`
  const goodSmokePath = join(stateDir, 'smokes', `${goodSmokeHash}.sh`)
  if (!options.bootstrap) {
    await mkdir(join(stateDir, 'smokes'))
    await writeFile(goodSmokePath, goodSmoke)
    await writeFile(knownGoodPath, knownGoodRecord)
  }

  function start(env = {}, args = Object.hasOwn(env, 'SSH_ORIGINAL_COMMAND') ? [] : [target]) {
    const requestedRevision = Object.hasOwn(env, 'SSH_ORIGINAL_COMMAND')
      ? env.SSH_ORIGINAL_COMMAND.match(/^deploy ([0-9a-f]{40})$/)?.[1]
      : args[0]
    const child = spawn('bash', [deployPath, ...args], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        EXPERIMENTE_DEPLOY_ROOT: root,
        DEPLOY_TEST_ROOT: root,
        DEPLOY_TEST_REQUESTED_REVISION: requestedRevision,
        DEPLOY_READY_TIMEOUT_SECONDS: '2',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => {
      stdout += data
    })
    child.stderr.on('data', (data) => {
      stderr += data
    })
    const result = new Promise((resolve, reject) => {
      child.on('error', reject)
      child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }))
    })
    return { child, result }
  }
  return {
    root,
    stateDir,
    knownGoodPath,
    knownGoodRecord,
    newGoodRecord,
    newSmokeHash,
    goodSmokePath,
    archiveSource,
    start,
    state: async () => JSON.parse(await readFile(join(stateDir, 'mock-state.json'), 'utf8')),
    knownGood: () => readFile(knownGoodPath, 'utf8'),
    commands: async () =>
      (await readFile(join(stateDir, 'commands.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
  }
}

const composeCalls = (commands, operation) =>
  commands.filter(
    ({ command, args }) => command === 'docker' && args[0] === 'compose' && args.includes(operation)
  )
const checkoutMutations = (commands) =>
  commands.filter(
    ({ command, args }) =>
      command === 'git' &&
      (args[0] === 'read-tree' || (args[0] === 'update-ref' && args[1] === 'HEAD'))
  )
const headUpdates = (commands) =>
  commands.filter(
    ({ command, args }) => command === 'git' && args[0] === 'update-ref' && args[1] === 'HEAD'
  )
const hasFetchOrCheckout = (commands) =>
  commands.some(({ command, args }) => command === 'git' && args[0] === 'fetch') ||
  checkoutMutations(commands).length > 0

async function waitForBuild(f) {
  // Snapshot verification and the effective Compose build-contract check run
  // before the build. Keep enough headroom for slower CI hosts while retaining
  // a bounded failure when a regression prevents the build from starting.
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (composeCalls(await f.commands(), 'build').length) return
    await setTimeout(10)
  }
  throw new Error('Deploy never reached the mocked build')
}

test('advances last-known-good only after the expected image and catalog pass', async (t) => {
  const f = await fixture(t)
  const result = await f.start().result
  assert.equal(result.code, 0, result.stderr)
  assert.equal(await f.knownGood(), f.newGoodRecord)
  const state = await f.state()
  assert.equal(state.running, newImage)
  assert.equal(state.images[`experimente-plus:deploy-good-${target}`], newImage)
  const commands = await f.commands()
  const pin = commands.findIndex(
    ({ command, args }) =>
      command === 'git' && args[0] === 'update-ref' && args[1]?.startsWith('refs/deploy/verified/')
  )
  const filters = commands.findIndex(
    ({ command, args }) => command === 'curl' && args.at(-1).endsWith('/filters')
  )
  assert.ok(pin > filters)
  const build = commands.findIndex(
    ({ command, args }) => command === 'docker' && args.includes('build')
  )
  const stop = commands.findIndex(
    ({ command, args }) => command === 'docker' && args.includes('stop')
  )
  const quietPs = commands.findIndex(
    ({ command, args }) => command === 'docker' && args.includes('ps') && args.includes('--status')
  )
  const migration = commands.findIndex(
    ({ command, args }) => command === 'docker' && args.includes('run')
  )
  const up = commands.findIndex(({ command, args }) => command === 'docker' && args.includes('up'))
  assert.ok(build < stop && stop < quietPs && quietPs < migration && migration < up)
  const bootstrapRotationChecks = commands.filter(
    ({ command, args }) =>
      command === 'docker' &&
      args[0] === 'ps' &&
      args.includes('label=com.experimente-plus.operation=bootstrap-rotation')
  )
  assert.equal(bootstrapRotationChecks.length, 2)
  const secondBootstrapCheck = commands.findLastIndex(
    ({ command, args }) =>
      command === 'docker' &&
      args[0] === 'ps' &&
      args.includes('label=com.experimente-plus.operation=bootstrap-rotation')
  )
  const firstCheckoutMutation = commands.findIndex(
    ({ command, args }) => command === 'git' && args[0] === 'read-tree'
  )
  assert.ok(secondBootstrapCheck >= 0 && secondBootstrapCheck < firstCheckoutMutation)
  assert.equal(state.migrationRuns, 1)
})

test('refuses deploy while a bootstrap rotation container awaits reconciliation', async (t) => {
  const rotationContainer = '9'.repeat(64)
  const f = await fixture(t, { bootstrapRotationContainer: rotationContainer })

  const result = await f.start().result

  assert.equal(result.code, 75, result.stderr)
  assert.match(result.stderr, /rotação de credenciais bootstrap exige reconciliação/)
  const commands = await f.commands()
  assert.equal(hasFetchOrCheckout(commands), false)
  assert.equal(composeCalls(commands, 'build').length, 0)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('removes a timed-out migration writer before restoring GOOD', async (t) => {
  const f = await fixture(t, { fail: 'migration-timeout' })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /migration falhou ou excedeu/)
  assert.match(result.stderr, /Rollback validado/)
  const state = await f.state()
  assert.equal(state.migrationExists, false)
  assert.equal(state.migrationRunning, false)
  assert.equal(state.running, goodImage)
  const commands = await f.commands()
  const wait = commands.findIndex(({ command, args }) => command === 'docker' && args[0] === 'wait')
  const remove = commands.findIndex(({ command, args }) => command === 'docker' && args[0] === 'rm')
  const goodUp = commands.findIndex(
    ({ command, args, composeRevision }) =>
      command === 'docker' &&
      args[0] === 'compose' &&
      args.includes('up') &&
      composeRevision === goodRevision
  )
  assert.ok(wait >= 0 && wait < remove && remove < goodUp)
})

test('fails closed without starting either app when migration cleanup cannot be proven', async (t) => {
  const f = await fixture(t, { fail: 'migration-timeout', migrationCleanupFails: true })
  const result = await f.start().result
  assert.equal(result.code, 2, result.stderr)
  assert.match(result.stderr, /FALHA CRÍTICA/)
  assert.equal(composeCalls(await f.commands(), 'up').length, 0)
  const state = await f.state()
  assert.equal(state.migrationRunning, true)
  assert.equal(state.running, '')
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('removes a stale deployment-owned migration writer before fetching the next release', async (t) => {
  const staleRevision = 'c'.repeat(40)
  const staleContainer = '8'.repeat(64)
  const f = await fixture(t, {
    migrationExists: true,
    migrationRunning: true,
    migrationContainerId: staleContainer,
    migrationContainerName: `experimente-plus-migration-${staleRevision}`,
  })
  const result = await f.start().result
  assert.equal(result.code, 0, result.stderr)
  const commands = await f.commands()
  const remove = commands.findIndex(
    ({ command, args }) => command === 'docker' && args[0] === 'rm' && args.includes(staleContainer)
  )
  const fetch = commands.findIndex(({ command, args }) => command === 'git' && args[0] === 'fetch')
  assert.ok(remove >= 0 && remove < fetch)
  assert.equal((await f.state()).migrationExists, false)
  assert.equal((await f.state()).running, newImage)
})

test('stop failure rolls back the retained service without starting NEW', async (t) => {
  const f = await fixture(t, { fail: 'stop' })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  const commands = await f.commands()
  assert.equal(composeCalls(commands, 'up').length, 1)
  assert.ok(composeCalls(commands, 'up')[0].args.includes('--no-build'))
  assert.equal((await f.state()).running, goodImage)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('signal immediately after stop restores GOOD with no-build', async (t) => {
  const f = await fixture(t, { signalAfterStop: 'SIGTERM' })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  const commands = await f.commands()
  assert.equal((await f.state()).running, goodImage)
  assert.ok(composeCalls(commands, 'up').some(({ args }) => args.includes('--no-build')))
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

for (const failure of ['reset', 'build', 'migration', 'up', 'readiness', 'smoke', 'recording']) {
  test(`restores the retained image and validates rollback after ${failure} failure`, async (t) => {
    const f = await fixture(t, { fail: failure })
    const result = await f.start().result
    assert.equal(result.code, 1, result.stderr)
    assert.match(result.stderr, /Rollback validado/)
    const state = await f.state()
    assert.equal(state.head, goodRevision)
    assert.equal(state.running, goodImage)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
    const commands = await f.commands()
    // Recovery must not rebuild the good revision or depend on the old smoke file.
    assert.equal(
      composeCalls(commands, 'build').some(({ head }) => head === goodRevision),
      false
    )
    assert.ok(
      commands.some(
        ({ command, args, running }) =>
          command === 'curl' && running === goodImage && args.at(-1).endsWith('/filters')
      )
    )
    assert.ok(
      composeCalls(commands, 'up').every(
        ({ args }) => args.includes('--no-build') && args.includes('never')
      )
    )
  })
}

test('uses persisted good state when HEAD already equals the failed target', async (t) => {
  const f = await fixture(t, { head: target, fail: 'build' })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  assert.equal((await f.state()).head, goodRevision)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

for (const failure of ['up', 'readiness', 'smoke']) {
  test(`reports a critical failure if rollback ${failure} cannot be validated`, async (t) => {
    const f = await fixture(t, { fail: 'smoke', rollbackFail: failure })
    const result = await f.start().result
    assert.equal(result.code, 2, result.stderr)
    assert.match(result.stderr, /FALHA CRÍTICA/)
    assert.doesNotMatch(result.stderr, /Rollback validado/)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('does not infer a good revision from HEAD on an uninitialized host', async (t) => {
  const f = await fixture(t, { bootstrap: true, head: target })
  const result = await f.start().result
  assert.equal(result.code, 1)
  assert.match(result.stderr, /DEPLOY_INITIAL_GOOD_REVISION/)
  assert.equal(checkoutMutations(await f.commands()).length, 0)
})

test('bootstraps the explicitly identified running revision after validating it', async (t) => {
  const f = await fixture(t, { bootstrap: true, fail: 'build' })
  const result = await f.start({ DEPLOY_INITIAL_GOOD_REVISION: goodRevision }).result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /Rollback validado/)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('rejects corrupt good state before resetting or building', async (t) => {
  const f = await fixture(t)
  await writeFile(f.knownGoodPath, 'invalid\n')
  const result = await f.start().result
  assert.equal(result.code, 1)
  assert.equal(checkoutMutations(await f.commands()).length, 0)
  assert.equal(await f.knownGood(), 'invalid\n')
})

for (const readiness of ['0', '121', '9999', 'invalid']) {
  test(`rejects readiness budget ${readiness} before fetch or deploy`, async (t) => {
    const f = await fixture(t)
    const result = await f.start({ DEPLOY_READY_TIMEOUT_SECONDS: readiness }).result
    assert.equal(result.code, 1, result.stderr)
    assert.match(result.stderr, /readiness deve estar entre 1 e 120 segundos/)
    const commands = await f.commands()
    assert.equal(hasFetchOrCheckout(commands), false)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('host flock rejects a concurrent manual deploy before fetch/reset', async (t) => {
  const f = await fixture(t)
  const first = f.start({ DEPLOY_TEST_PAUSE_BUILD: '1' })
  let second
  try {
    await waitForBuild(f)
    second = await f.start().result
    assert.equal(second.code, 75, second.stderr)
    const fetches = (await f.commands()).filter(
      ({ command, args }) => command === 'git' && args[0] === 'fetch'
    )
    assert.equal(fetches.length, 2)
  } finally {
    await writeFile(join(f.root, 'release-build'), '')
    const result = await first.result
    assert.equal(result.code, 0, result.stderr)
  }
})

test('a terminated deploy rolls back before releasing the host lock', async (t) => {
  const f = await fixture(t)
  const active = f.start({ DEPLOY_TEST_PAUSE_BUILD: '1' })
  try {
    await waitForBuild(f)
    active.child.kill('SIGTERM')
  } finally {
    await writeFile(join(f.root, 'release-build'), '')
  }
  const result = await active.result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /Rollback validado/)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('deploys approved commit A even when origin/master has advanced to commit B', async (t) => {
  const remoteTip = 'c'.repeat(40)
  const f = await fixture(t, { remoteTip })
  const result = await f.start({ SSH_ORIGINAL_COMMAND: `deploy ${target}` }).result
  assert.equal(result.code, 0, result.stderr)
  const state = await f.state()
  assert.equal(state.head, target)
  assert.equal(state.builtRevision, target)
  assert.equal(await f.knownGood(), f.newGoodRecord)
  const commands = await f.commands()
  const fetch = commands.find(({ command, args }) => command === 'git' && args[0] === 'fetch')
  assert.equal(fetch.args.at(-1), target)
  assert.equal(
    commands.some(({ args }) => args.some((arg) => arg.includes('origin/master'))),
    false
  )
  assert.ok(
    commands.some(
      ({ command, args }) =>
        command === 'git' &&
        args[0] === 'merge-base' &&
        args.includes(target) &&
        args.includes(remoteTip)
    )
  )
  assert.equal(
    headUpdates(commands).some(({ args }) => args[2] === remoteTip),
    false
  )
})

test('forced SSH refuses a fetchable SHA outside the approved remote master history', async (t) => {
  const f = await fixture(t, { rejectMaster: true })
  const result = await f.start({ SSH_ORIGINAL_COMMAND: `deploy ${target}` }).result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /não pertence ao histórico aprovado da master remota/)
  const commands = await f.commands()
  assert.ok(
    commands.some(
      ({ command, args }) =>
        command === 'git' &&
        args[0] === 'fetch' &&
        args.includes('+refs/heads/master:refs/heads/deploy-approved-master')
    )
  )
  assert.equal(checkoutMutations(commands).length, 0)
  assert.equal(composeCalls(commands, 'build').length, 0)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('rejects a stale candidate that does not descend from the persisted LKG', async (t) => {
  const f = await fixture(t, { rejectAncestor: true })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /não sucede a versão validada/)
  const commands = await f.commands()
  assert.equal(checkoutMutations(commands).length, 0)
  assert.equal(composeCalls(commands, 'build').length, 0)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('revalidates an already deployed SHA without rebuilding or restarting it', async (t) => {
  const f = await fixture(t)
  const result = await f.start({}, [goodRevision]).result
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /já validada e em execução/)
  const commands = await f.commands()
  const reconciliations = headUpdates(commands)
  assert.equal(reconciliations.length, 1)
  assert.equal(reconciliations[0].args[2], goodRevision)
  assert.ok(
    checkoutMutations(commands).some(
      ({ args }) => args[0] === 'read-tree' && args.at(-1) === goodRevision
    )
  )
  for (const operation of ['build', 'stop', 'run', 'up']) {
    assert.equal(composeCalls(commands, operation).length, 0)
  }
  assert.equal((await f.state()).running, goodImage)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

for (const [condition, options] of [
  ['missing container', { running: '' }],
  ['wrong image', { running: newImage }],
  ['unhealthy process', { goodFail: 'readiness' }],
]) {
  test(`same-SHA deploy force-recovers a ${condition} from the retained image`, async (t) => {
    const f = await fixture(t, options)
    const result = await f.start({}, [goodRevision]).result
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /validada recuperada e em execução/)
    const commands = await f.commands()
    for (const operation of ['build', 'stop', 'run']) {
      assert.equal(composeCalls(commands, operation).length, 0)
    }
    const ups = composeCalls(commands, 'up')
    assert.equal(ups.length, 1)
    assert.ok(ups[0].args.includes('--force-recreate'))
    assert.ok(ups[0].args.includes('--no-build'))
    assert.equal((await f.state()).running, goodImage)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

for (const original of [
  '',
  'deploy',
  `deploy ${target.slice(0, 7)}`,
  `deploy ${target.toUpperCase()}`,
  `deploy ${target} extra`,
  `deploy ${target}; echo injected`,
  `deploy ${target}\n`,
  `deploy  ${target}`,
  `bash -c deploy ${target}`,
]) {
  test(`rejects malformed SSH command ${JSON.stringify(original)} before touching the repo`, async (t) => {
    const f = await fixture(t)
    const result = await f.start({ SSH_ORIGINAL_COMMAND: original }).result
    assert.equal(result.code, 1)
    assert.equal((await f.commands()).length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('rejects a missing manual SHA and mixed manual/forced-command arguments', async (t) => {
  const f = await fixture(t)
  for (const args of [[], ['master'], [target.slice(0, 7)], [target, 'extra']]) {
    assert.equal((await f.start({}, args).result).code, 1)
  }
  assert.equal(
    (await f.start({ SSH_ORIGINAL_COMMAND: `deploy ${target}` }, [target]).result).code,
    1
  )
  assert.equal((await f.commands()).length, 0)
})

test('refuses a fetch resolving to a different commit before reset/build', async (t) => {
  const f = await fixture(t, { fetchMismatch: 'c'.repeat(40) })
  const result = await f.start().result
  assert.equal(result.code, 1)
  assert.match(result.stderr, /fetch não corresponde exatamente/)
  assert.equal(checkoutMutations(await f.commands()).length, 0)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

for (const variable of [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_KEY_0',
  'GIT_CONFIG_VALUE_0',
  'GIT_SSH_COMMAND',
  'GIT_REPLACE_REF_BASE',
]) {
  test(`rejects inherited ${variable} before Git, without printing the environment`, async (t) => {
    const f = await fixture(t)
    const result = await f.start({ [variable]: 'SYNTHETIC_PRIVATE_ENVIRONMENT' }).result
    assert.equal(result.code, 1)
    assert.match(result.stderr, /ambiente Git herdado não permitido/)
    assert.doesNotMatch(result.stderr + result.stdout, /SYNTHETIC_PRIVATE_ENVIRONMENT/)
    assert.equal((await f.commands()).length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('overrides an inherited request to enable replacement objects', async (t) => {
  const f = await fixture(t)
  const result = await f.start({ GIT_NO_REPLACE_OBJECTS: '0' }).result
  assert.equal(result.code, 0, result.stderr)
  assert.equal(await f.knownGood(), f.newGoodRecord)
})

for (const ignored of [false, true]) {
  test(`refuses a stale ${ignored ? 'ignored' : 'untracked'} migration without removing it`, async (t) => {
    const path = 'database/migrations/9999999999999_stale.ts'
    const f = await fixture(t, { [ignored ? 'ignoredUntracked' : 'untracked']: [path] })
    await mkdir(join(f.root, 'database', 'migrations'), { recursive: true })
    await writeFile(join(f.root, path), 'synthetic stale migration')
    const result = await f.start().result
    assert.equal(result.code, 1)
    assert.match(result.stderr, /arquivo não rastreado fora da allowlist/)
    assert.equal(await readFile(join(f.root, path), 'utf8'), 'synthetic stale migration')
    const commands = await f.commands()
    assert.equal(
      hasFetchOrCheckout(commands) || commands.some(({ args }) => args[0] === 'clean'),
      false
    )
    assert.equal(composeCalls(commands, 'build').length, 0)
    const listing = commands.find(({ args }) => args[0] === 'ls-files' && args.includes('--others'))
    assert.deepEqual(listing.args, ['ls-files', '--others', '-z'])
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('allows only excluded runtime paths, including nested uploads and local environment files', async (t) => {
  const f = await fixture(t, {
    untracked: [
      '.env',
      '.env.local',
      '.env.production.local',
      'storage/seed-media/demo.jpg',
      'node_modules/cache.js',
      'build/old.js',
      'dist/old.js',
      'coverage/report.html',
      'tmp/cache',
    ],
    ignoredUntracked: Array.from(
      { length: 2580 },
      (_, index) => `storage/uploads/tenant/${index}.jpg`
    ),
  })
  const result = await f.start().result
  assert.equal(result.code, 0, result.stderr)
  assert.equal((await f.state()).builtRevision, target)
})

test('does not treat a nested .env.*.local-looking path as an operational root env file', async (t) => {
  const path = '.env.production/secrets.local'
  const f = await fixture(t, { untracked: [path] })
  await mkdir(join(f.root, '.env.production'))
  await writeFile(join(f.root, path), 'SYNTHETIC_PRIVATE_NESTED_ENV=1\n')
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /arquivo não rastreado fora da allowlist/)
  assert.equal(await readFile(join(f.root, path), 'utf8'), 'SYNTHETIC_PRIVATE_NESTED_ENV=1\n')
  assert.equal(checkoutMutations(await f.commands()).length, 0)
})

test('refuses and preserves an empty untracked directory outside the operational allowlist', async (t) => {
  const f = await fixture(t)
  const directory = join(f.root, 'app', 'private-empty-directory')
  await mkdir(directory, { recursive: true })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /diretório vazio não rastreado fora da allowlist/)
  assert.equal(
    await access(directory).then(
      () => true,
      () => false
    ),
    true
  )
  assert.equal(checkoutMutations(await f.commands()).length, 0)
})

test('rejects an allowed runtime path if the approved Docker ignore contract is weakened', async (t) => {
  const f = await fixture(t, { untracked: ['storage/uploads/private.jpg'] })
  const ignorePath = join(f.archiveSource, '.dockerignore')
  await writeFile(
    ignorePath,
    (await readFile(ignorePath, 'utf8')).replace('storage/uploads/**\n', '')
  )
  const result = await f.start().result
  assert.equal(result.code, 1)
  assert.match(result.stderr, /exclusões obrigatórias/)
  assert.equal(checkoutMutations(await f.commands()).length, 0)
})

for (const [name, buildContract] of [
  [
    'a Dockerfile-specific ignore path',
    { context: '__snapshot__', dockerfile: 'ops/production.Dockerfile', target: 'production' },
  ],
  [
    'an additional build context',
    {
      context: '__snapshot__',
      dockerfile: 'Dockerfile',
      target: 'production',
      additional_contexts: { private: '/srv/private' },
    },
  ],
  [
    'a build context outside the verified snapshot',
    { context: '/srv/unverified', dockerfile: 'Dockerfile', target: 'production' },
  ],
  [
    'a different Docker target',
    { context: '__snapshot__', dockerfile: 'Dockerfile', target: 'development' },
  ],
]) {
  test(`rejects ${name} in the effective Compose build contract`, async (t) => {
    const f = await fixture(t, { buildContract })
    const result = await f.start().result
    assert.equal(result.code, 1, result.stderr)
    assert.match(result.stderr, /build deve usar somente o snapshot/)
    const commands = await f.commands()
    assert.equal(checkoutMutations(commands).length, 0)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('refuses an incomplete untracked listing instead of treating it as a clean tree', async (t) => {
  const f = await fixture(t, { fail: 'untracked-list' })
  const result = await f.start().result
  assert.equal(result.code, 1)
  assert.equal(hasFetchOrCheckout(await f.commands()), false)
})

for (const revision of ['target', 'good']) {
  test(`rejects operational paths tracked by the ${revision} revision before any reset`, async (t) => {
    const privateRuntimeEnv = 'SYNTHETIC_OPERATIONAL_KEEP=1\n'
    const f = await fixture(t, {
      untracked: ['.env'],
      [`${revision}Paths`]: ['.env'],
      runtimeEnv: privateRuntimeEnv,
    })
    await writeFile(join(f.root, '.env'), privateRuntimeEnv)
    const result = await f.start().result
    assert.equal(result.code, 1, result.stderr)
    assert.match(result.stderr, /rastreia caminho operacional reservado/)
    const commands = await f.commands()
    assert.equal(
      checkoutMutations(commands).length > 0 || commands.some(({ args }) => args[0] === 'clean'),
      false
    )
    assert.equal(composeCalls(commands, 'build').length, 0)
    if (revision === 'target') {
      assert.equal(
        commands.some(({ args }) => args[0] === 'archive'),
        false
      )
    }
    const listing = commands.find(
      ({ args }) =>
        args[0] === 'ls-tree' && args.at(-1) === (revision === 'target' ? target : goodRevision)
    )
    assert.deepEqual(listing.args.slice(0, -1), [
      'ls-tree',
      '-r',
      '--full-tree',
      '--name-only',
      '-z',
    ])
    assert.equal(await readFile(join(f.root, '.env'), 'utf8'), privateRuntimeEnv)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('refuses an incomplete target tree listing before archive or reset', async (t) => {
  const f = await fixture(t, { fail: 'reserved-tree-list' })
  const result = await f.start().result
  assert.equal(result.code, 1)
  assert.match(result.stderr, /não foi possível verificar caminhos reservados/)
  assert.equal(
    (await f.commands()).some(({ args }) => ['archive', 'reset'].includes(args[0])),
    false
  )
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

for (const timing of [
  'untrackedDuringFetch',
  'ignoredDuringFetch',
  'untrackedDuringPreparation',
  'ignoredDuringPreparation',
]) {
  test(`preserves a new-release path appearing as ${timing} before reset`, async (t) => {
    const path = 'app/new_release_file.ts'
    const f = await fixture(t, { [timing]: [path], targetPaths: [path] })
    const result = await f.start().result
    assert.equal(result.code, 2, result.stderr)
    assert.match(result.stderr, /arquivo não rastreado fora da allowlist/)
    assert.doesNotMatch(result.stderr + result.stdout, /SYNTHETIC_PRIVATE_UNTRACKED_CONTENT/)
    assert.equal(await readFile(join(f.root, path), 'utf8'), 'SYNTHETIC_PRIVATE_UNTRACKED_CONTENT')
    const commands = await f.commands()
    assert.equal(checkoutMutations(commands).length, 0)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

for (const options of [
  { specialIndexFlag: 'S' },
  { specialIndexFlag: 'h' },
  { sparseCheckout: true },
  { sparseIndex: true },
  { fail: 'index-flags' },
  { fail: 'sparse-config' },
]) {
  test(`fails closed on incompatible index/configuration ${JSON.stringify(options)}`, async (t) => {
    const f = await fixture(t, options)
    const result = await f.start().result
    assert.equal(result.code, 1, result.stderr)
    assert.doesNotMatch(
      result.stderr + result.stdout,
      /SYNTHETIC_PRIVATE_PATH|SYNTHETIC_PRIVATE_CONTENT/
    )
    const commands = await f.commands()
    assert.equal(hasFetchOrCheckout(commands), false)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

for (const change of ['staged', 'worktree']) {
  test(`refuses initially dirty ${change} before fetch/reset/build without exposing local data`, async (t) => {
    const f = await fixture(t, { [change === 'staged' ? 'dirtyStaged' : 'dirtyWorktree']: true })
    const result = await f.start().result
    assert.equal(result.code, 1, result.stderr)
    assert.match(result.stderr, /estado rastreado local alterado ou impossível de verificar/)
    assert.doesNotMatch(
      result.stderr + result.stdout,
      /SYNTHETIC_PRIVATE_PATH|SYNTHETIC_PRIVATE_CONTENT/
    )
    const commands = await f.commands()
    assert.equal(hasFetchOrCheckout(commands), false)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })

  test(`refuses ${change} changes during preparation immediately before the NEW reset`, async (t) => {
    const f = await fixture(t, { dirtyDuringFetch: change })
    const result = await f.start().result
    assert.equal(result.code, 2, result.stderr)
    assert.match(result.stderr, /FALHA CRÍTICA/)
    assert.doesNotMatch(
      result.stderr + result.stdout,
      /SYNTHETIC_PRIVATE_PATH|SYNTHETIC_PRIVATE_CONTENT/
    )
    const commands = await f.commands()
    assert.equal(checkoutMutations(commands).length, 0)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })

  test(`preserves ${change} changes made during a failed build by refusing the GOOD reset`, async (t) => {
    const f = await fixture(t, { dirtyDuringBuild: change, fail: 'build' })
    const result = await f.start().result
    assert.equal(result.code, 2, result.stderr)
    assert.match(result.stderr, /FALHA CRÍTICA/)
    assert.doesNotMatch(result.stderr, /Rollback validado/)
    assert.doesNotMatch(
      result.stderr + result.stdout,
      /SYNTHETIC_PRIVATE_PATH|SYNTHETIC_PRIVATE_CONTENT/
    )
    const updates = headUpdates(await f.commands())
    assert.equal(updates.length, 1)
    assert.equal(updates[0].args[2], target)
    const state = await f.state()
    assert.equal(state.head, target)
    assert.equal(state[change === 'staged' ? 'dirtyStaged' : 'dirtyWorktree'], true)
    assert.equal(state.running, goodImage)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

for (const failure of ['tracked-index-list', 'tracked-worktree-list']) {
  test(`fails closed on ${failure} errors without leaking diagnostics or attempting deploy`, async (t) => {
    const f = await fixture(t, { fail: failure })
    const result = await f.start().result
    assert.equal(result.code, 1, result.stderr)
    assert.match(result.stderr, /estado rastreado local alterado ou impossível de verificar/)
    assert.doesNotMatch(
      result.stderr + result.stdout,
      /SYNTHETIC_PRIVATE_PATH|SYNTHETIC_PRIVATE_CONTENT/
    )
    const commands = await f.commands()
    assert.equal(hasFetchOrCheckout(commands), false)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

test('checks untracked files again after reset and leaves newly discovered files for review', async (t) => {
  const f = await fixture(t, { untrackedAfterReset: ['database/migrations/late.ts'] })
  const result = await f.start().result
  assert.equal(result.code, 2)
  assert.match(result.stderr, /arquivo não rastreado fora da allowlist/)
  assert.equal(composeCalls(await f.commands(), 'build').length, 0)
  assert.equal((await f.state()).running, goodImage)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

test('builds the pinned archive even if an untracked migration appears after the last preflight', async (t) => {
  const path = 'database/migrations/late.ts'
  const f = await fixture(t, { lateUntracked: path })
  const result = await f.start().result
  assert.equal(result.code, 0, result.stderr)
  const state = await f.state()
  assert.equal(state.builtRevision, target)
  assert.equal(state.contextIncludedUntracked, false)
  assert.equal(await readFile(join(f.root, path), 'utf8'), 'synthetic stale migration')
})

test('rollback uses the stored LKG smoke when NEW requires an endpoint absent from LKG', async (t) => {
  const f = await fixture(t, { fail: 'recording', incompatibleNewSmoke: true })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /Rollback validado/)
  const calls = (await f.commands()).filter(({ command }) => command === 'curl')
  assert.ok(
    calls.some(({ args, head }) => head === target && args.at(-1).endsWith('/new-contract-only'))
  )
  assert.equal(
    calls.some(
      ({ args, running }) => running === goodImage && args.at(-1).endsWith('/new-contract-only')
    ),
    false
  )
  assert.ok(
    calls.some(
      ({ args, running, smokeRevision }) =>
        running === goodImage && smokeRevision === goodRevision && args.at(-1).endsWith('/filters')
    )
  )
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

for (const corruption of ['missing', 'changed', 'old-two-line-record']) {
  test(`refuses ${corruption} LKG smoke state before deploying`, async (t) => {
    const f = await fixture(t)
    if (corruption === 'missing') await rm(f.goodSmokePath)
    else if (corruption === 'changed') await writeFile(f.goodSmokePath, 'exit 0\n')
    else await writeFile(f.knownGoodPath, `${goodRevision}\n${goodImage}\n`)
    const before = await f.knownGood()
    const result = await f.start().result
    assert.equal(result.code, 1)
    assert.equal(checkoutMutations(await f.commands()).length, 0)
    assert.equal(await f.knownGood(), before)
  })
}

test('legacy bootstrap requires an explicit compatible smoke revision and stores its exact contract', async (t) => {
  const f = await fixture(t, { bootstrap: true, legacyNoSmoke: true, fail: 'build' })
  const rejected = await f.start({ DEPLOY_INITIAL_GOOD_REVISION: goodRevision }).result
  assert.equal(rejected.code, 1)
  assert.match(rejected.stderr, /DEPLOY_INITIAL_GOOD_SMOKE_REVISION/)
  assert.equal(checkoutMutations(await f.commands()).length, 0)

  const result = await f.start({
    DEPLOY_INITIAL_GOOD_REVISION: goodRevision,
    DEPLOY_INITIAL_GOOD_SMOKE_REVISION: target,
  }).result
  assert.equal(result.code, 1, result.stderr)
  assert.match(result.stderr, /Rollback validado/)
  assert.equal(await f.knownGood(), `${goodRevision}\n${goodImage}\n${f.newSmokeHash}\n`)
})

test('all NEW Compose operations use the approved snapshot after the live compose changes during build', async (t) => {
  const f = await fixture(t, { mutateComposeDuringBuild: true })
  const result = await f.start().result
  assert.equal(result.code, 0, result.stderr)
  assert.equal(
    await readFile(join(f.root, 'docker-compose.vps.yml'), 'utf8'),
    'SYNTHETIC_PRIVATE_COMPOSE_CONTENT'
  )
  assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_PRIVATE_COMPOSE_CONTENT/)
  const commands = await f.commands()
  for (const operation of ['build', 'config', 'ps', 'up']) {
    const calls = composeCalls(commands, operation).filter(
      ({ composeRevision }) => composeRevision === target
    )
    assert.ok(calls.length)
    assert.ok(
      calls.every(
        ({ composeRevision, composePath, args }) =>
          composeRevision === target &&
          composePath.includes('/source/') &&
          args[args.indexOf('--project-directory') + 1] ===
            composePath.replace('/docker-compose.vps.yml', '')
      )
    )
  }
  assert.equal(await f.knownGood(), f.newGoodRecord)
  assert.equal((await f.state()).running, newImage)
})

for (const timing of ['mutateEnvDuringBuild', 'mutateEnvAfterStop']) {
  test(`pins one runtime environment snapshot when .env changes at ${timing}`, async (t) => {
    const f = await fixture(t, { [timing]: true })
    const result = await f.start().result
    assert.equal(result.code, 0, result.stderr)
    const state = await f.state()
    assert.equal(state.migrationRuns, 1)
    assert.equal(state.running, newImage)
    assert.equal(await f.knownGood(), f.newGoodRecord)
    assert.match(await readFile(join(f.root, '.env'), 'utf8'), /SYNTHETIC_PRIVATE_MUTATED_ENV/)
  })
}

for (const change of ['staged', 'worktree', 'untracked', 'ignored']) {
  test(`restores and validates the GOOD service before refusing checkout reconciliation for late ${change}`, async (t) => {
    const path = 'app/late_private.ts'
    const tracked = change === 'staged' || change === 'worktree'
    const f = await fixture(t, {
      fail: 'smoke',
      ...(tracked ? { dirtyDuringUp: change } : { [change + 'DuringUp']: [path] }),
    })
    const result = await f.start().result
    assert.equal(result.code, 2, result.stderr)
    assert.match(result.stderr, /Serviço GOOD restaurado e validado/)
    assert.match(result.stderr, /checkout não reconciliado/)
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /SYNTHETIC_PRIVATE_(COMPOSE|UNTRACKED)_CONTENT/
    )
    assert.equal(
      await readFile(join(f.root, tracked ? 'docker-compose.vps.yml' : path), 'utf8'),
      tracked ? 'SYNTHETIC_PRIVATE_COMPOSE_CONTENT' : 'SYNTHETIC_PRIVATE_UNTRACKED_CONTENT'
    )
    const commands = await f.commands()
    const updates = headUpdates(commands)
    assert.deepEqual(
      updates.map(({ args }) => args[2]),
      [target]
    )
    const ups = composeCalls(commands, 'up')
    assert.deepEqual(
      ups.map(({ composeRevision }) => composeRevision),
      [target, goodRevision]
    )
    assert.ok(ups.at(-1).composePath.includes('/good-source/'))
    assert.ok(
      commands.some(
        ({ command, args, running, smokeRevision, head }) =>
          command === 'curl' &&
          running === goodImage &&
          head === target &&
          smokeRevision === goodRevision &&
          args.at(-1).endsWith('/filters')
      )
    )
    assert.equal((await f.state()).head, target)
    assert.equal((await f.state()).running, goodImage)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

for (const revision of ['target', 'good']) {
  for (const path of [
    'docker-compose.vps.yml',
    '.dockerignore',
    ...(revision === 'target' ? ['scripts/smoke_catalog.sh'] : []),
  ]) {
    for (const mode of ['120000', '160000', '040000', 'missing']) {
      test(`rejects ${mode} ${revision} Git entry for ${path} before reading or using it`, async (t) => {
        const f = await fixture(t, { [revision + 'Modes']: { [path]: mode } })
        const result = await f.start().result
        assert.equal(result.code, 1, result.stderr)
        assert.match(result.stderr, /entrada Git obrigatória/)
        const commands = await f.commands()
        assert.equal(checkoutMutations(commands).length, 0)
        assert.equal(composeCalls(commands, 'up').length, 0)
        assert.equal(composeCalls(commands, 'build').length, 0)
        assert.equal(await f.knownGood(), f.knownGoodRecord)
      })
    }
  }
}

test('accepts a regular executable Git smoke entry', async (t) => {
  const f = await fixture(t, { targetModes: { 'scripts/smoke_catalog.sh': '100755' } })
  const result = await f.start().result
  assert.equal(result.code, 0, result.stderr)
})

test('fails closed when the required Git entry enumeration fails', async (t) => {
  const f = await fixture(t, { fail: 'regular-entry-list' })
  const result = await f.start().result
  assert.equal(result.code, 1, result.stderr)
  assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_PRIVATE_CONTENT/)
  assert.equal(checkoutMutations(await f.commands()).length, 0)
  assert.equal(await f.knownGood(), f.knownGoodRecord)
})

for (const path of ['.dockerignore', 'Dockerfile.dockerignore']) {
  test(`rejects ${path} missing the nested local environment exclusion`, async (t) => {
    const f = await fixture(t)
    const ignore = (await readFile(ignoreSource, 'utf8')).replace('**/.env.*.local\n', '')
    await writeFile(join(f.archiveSource, path), ignore)
    const result = await f.start().result
    assert.equal(result.code, 1, result.stderr)
    assert.match(result.stderr, /exclusões obrigatórias/)
    const commands = await f.commands()
    assert.equal(checkoutMutations(commands).length, 0)
    assert.equal(composeCalls(commands, 'build').length, 0)
    assert.equal(await f.knownGood(), f.knownGoodRecord)
  })
}

for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  test(`keeps container, checkout and LKG coherent when ${signal} arrives immediately after publishing LKG`, async (t) => {
    const f = await fixture(t, { signalAfterRecord: signal })
    const result = await f.start().result
    assert.equal(result.code, 0, result.stderr)
    const state = await f.state()
    assert.equal(state.signalInjected, signal)
    assert.equal(state.head, target)
    assert.equal(state.running, newImage)
    assert.equal(await f.knownGood(), f.newGoodRecord)
    assert.equal(composeCalls(await f.commands(), 'up').length, 1)
    assert.doesNotMatch(result.stderr, /iniciando rollback/)
  })
}
