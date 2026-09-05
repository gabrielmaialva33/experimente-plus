// Executed only by deploy.test.mjs in its temporary directory. Every Git,
// Docker and HTTP operation is simulated; unknown commands fail closed.
import { appendFile, readFile, rm, writeFile, access, mkdir, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const expectedOrigin = 'https://github.com/gabrielmaialva33/experimente-plus.git'

const [command, ...args] = process.argv.slice(2)
if (command === 'git' && process.env.GIT_NO_REPLACE_OBJECTS !== '1') {
  throw new Error('Every deploy Git invocation must disable replacement objects')
}
const root = process.env.DEPLOY_TEST_ROOT
if (!root) throw new Error('This fixture requires DEPLOY_TEST_ROOT')
const stateDir = join(root, '.git', 'experimente-plus-deploy')
const statePath = join(stateDir, 'mock-state.json')
const state = JSON.parse(await readFile(statePath, 'utf8'))
const composePath =
  command === 'docker' && args[0] === 'compose' ? args[args.indexOf('-f') + 1] : null
const composeRevision = composePath
  ? await readFile(join(dirname(composePath), 'revision.txt'), 'utf8').catch(() => null)
  : null
await appendFile(
  join(stateDir, 'commands.jsonl'),
  `${JSON.stringify({
    command,
    args,
    head: state.head,
    running: state.running,
    smokeRevision: process.env.DEPLOY_TEST_SMOKE_REVISION,
    composePath,
    composeRevision,
  })}\n`
)

const save = () => writeFile(statePath, JSON.stringify(state))
const output = (value) => process.stdout.write(`${value}\n`)
const treeId = (revision) => (revision === state.target ? '3'.repeat(40) : '4'.repeat(40))
const blobId = async (source, path) => {
  const content = await readFile(join(source, path))
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
}
async function treeEntries(revision, source, modeOverrides) {
  const entries = []
  const directories = []
  const modes = modeOverrides ?? (revision === state.target ? state.targetModes : state.goodModes)
  async function walk(directory) {
    for (const name of await readdir(directory, { withFileTypes: true })) {
      const path = relative(source, join(directory, name.name))
      if (name.isDirectory()) {
        directories.push(path)
        await walk(join(directory, name.name))
      } else if (name.isFile()) {
        const mode = modes?.[path] ?? '100644'
        entries.push(`${mode} blob ${await blobId(source, path)}\t${path}\0`)
      }
    }
  }
  await walk(source)
  return directories.map((path) => `040000 tree ${'0'.repeat(40)}\t${path}\0`).concat(entries)
}
async function treePaths(source) {
  const paths = []
  async function walk(directory) {
    for (const name of await readdir(directory, { withFileTypes: true })) {
      const path = relative(source, join(directory, name.name))
      if (name.isDirectory()) await walk(join(directory, name.name))
      else if (name.isFile()) paths.push(path)
    }
  }
  await walk(source)
  return paths.sort()
}
async function appear(timing) {
  for (const kind of ['untracked', 'ignored']) {
    const paths = state[kind + timing]
    if (!paths) continue
    state[kind === 'untracked' ? 'untracked' : 'ignoredUntracked'] = paths
    for (const path of paths) {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), 'SYNTHETIC_PRIVATE_UNTRACKED_CONTENT')
    }
  }
}
function fail(message) {
  process.stderr.write(`Simulated failure: ${message}\n`)
  process.exit(1)
}

if (command === 'git') {
  if (args[0] === 'config') {
    if (state.fail === 'sparse-config') fail('SYNTHETIC_PRIVATE_CONTENT config error')
    if (args.includes('--get-all') && args.at(-1) === 'remote.origin.url') {
      process.stdout.write(`${expectedOrigin}\0`)
      process.exit(0)
    }
    if (args.includes('--name-only') && args.includes('--get-regexp')) {
      process.stdout.write('remote.origin.url\0remote.origin.fetch\0')
      process.exit(0)
    }
    if (args.includes('--get-regexp')) process.exit(1)
    output(
      (args.at(-1) === 'core.sparseCheckout' ? state.sparseCheckout : state.sparseIndex)
        ? 'true'
        : 'false'
    )
  } else if (args[0] === 'init') {
    // The isolated network object store is created by the real deploy script.
  } else if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
    const checksApprovedMaster = process.env.GIT_DIR?.endsWith('/fetch.git')
    process.exit(checksApprovedMaster ? (state.rejectMaster ? 1 : 0) : state.rejectAncestor ? 1 : 0)
  } else if (args[0] === 'rev-parse') {
    if (args.includes('--show-toplevel')) output(root)
    else if (args.includes('--git-common-dir') || args.includes('--git-dir'))
      output(join(root, '.git'))
    else {
      const expression = args.at(-1)
      const wantsTree = expression.endsWith('^{tree}')
      const revision = expression.replace(/\^\{(?:commit|tree)\}$/, '')
      const resolved =
        revision === 'refs/heads/deploy-approved-master'
          ? (state.remoteTip ?? state.target)
          : revision === 'origin/master'
            ? (state.remoteTip ?? state.target)
            : revision === 'FETCH_HEAD'
              ? state.fetchedRevision
              : revision === 'HEAD'
                ? state.head
                : process.env.GIT_DIR?.endsWith('/fetch.git') &&
                    revision === state.target &&
                    state.fetchMismatch
                  ? state.fetchMismatch
                  : revision
      if (
        ![state.goodRevision, state.target, state.remoteTip, state.fetchMismatch].includes(resolved)
      )
        fail('unknown revision')
      output(wantsTree ? treeId(resolved) : resolved)
    }
  } else if (args[0] === 'write-tree') {
    if (state.fail === 'tracked-index-list') fail('SYNTHETIC_PRIVATE_CONTENT index tree failure')
    output(state.dirtyStaged ? '5'.repeat(40) : treeId(state.head))
  } else if (args[0] === 'show') {
    const revision = args.at(-1).split(':')[0]
    if (revision === state.goodRevision && state.legacyNoSmoke) fail('legacy revision has no smoke')
    process.stdout.write(
      await readFile(
        revision === state.goodRevision
          ? state.goodSmokeSource
          : join(state.archiveSource, 'scripts', 'smoke_catalog.sh')
      )
    )
  } else if (args[0] === 'fetch') {
    state.fetchedRevision = state.fetchMismatch ?? args.at(-1)
    if (state.dirtyDuringFetch === 'staged') state.dirtyStaged = true
    if (state.dirtyDuringFetch === 'worktree') state.dirtyWorktree = true
    await appear('DuringFetch')
    await save()
  } else if (args[0] === 'archive') {
    if (state.fail === 'archive' || ![state.target, state.goodRevision].includes(args.at(-1)))
      fail('archive target')
    const source = args.at(-1) === state.target ? state.archiveSource : state.goodArchiveSource
    await appear('DuringPreparation')
    await save()
    // Real tar only packages synthetic fixture files; Git/Docker remain mocked.
    process.stdout.write(execFileSync('tar', ['-cf', '-', '-C', source, '.']))
  } else if (args[0] === 'ls-tree') {
    if (
      state.fail === 'reserved-tree-list' &&
      args.includes('--name-only') &&
      args.at(-1) !== 'HEAD'
    )
      fail('tree enumeration')
    if (args.includes('--')) {
      if (state.fail === 'regular-entry-list') fail('SYNTHETIC_PRIVATE_CONTENT entry enumeration')
      const revision = args[2]
      const path = args.at(-1)
      const mode =
        (revision === state.target ? state.targetModes : state.goodModes)?.[path] ?? '100644'
      if (
        mode === 'missing' ||
        (revision === state.goodRevision &&
          state.legacyNoSmoke &&
          path === 'scripts/smoke_catalog.sh')
      )
        process.exit(0)
      const source = revision === state.target ? state.archiveSource : state.goodArchiveSource
      process.stdout.write(`${mode} blob ${await blobId(source, path)}\t${path}\0`)
      process.exit(0)
    }
    const rawHead = args.at(-1) === 'HEAD'
    const revision = rawHead ? state.head : args.at(-1)
    if (state.fail === 'tracked-worktree-list' && rawHead && !args.includes('--name-only'))
      fail('SYNTHETIC_PRIVATE_CONTENT worktree tree failure')
    const source = revision === state.target ? state.archiveSource : state.goodArchiveSource
    const paths = rawHead
      ? undefined
      : args.at(-1) === state.target
        ? state.targetPaths
        : state.goodPaths
    if (args.includes('--name-only') && paths) process.stdout.write(`${paths.join('\0')}\0`)
    else if (args.includes('--name-only'))
      process.stdout.write(`${(await treePaths(source)).join('\0')}\0`)
    else {
      // HEAD represents the real operational checkout. Synthetic invalid modes
      // apply only to the explicit revision whose snapshot is being validated.
      const entries = await treeEntries(
        revision,
        source,
        rawHead && !state.attempted ? {} : undefined
      )
      process.stdout.write(
        (args.includes('-t')
          ? entries
          : entries.filter((entry) => !entry.startsWith('040000 '))
        ).join('')
      )
    }
  } else if (args[0] === 'ls-files') {
    if (!args.includes('--others')) {
      if (state.fail === 'index-flags') fail('SYNTHETIC_PRIVATE_PATH index enumeration error')
      if (state.specialIndexFlag)
        process.stdout.write(`${state.specialIndexFlag} SYNTHETIC_PRIVATE_PATH\0`)
      else if (!args.includes('-v') && !args.includes('-f') && !args.includes('--stage')) {
        const source = state.head === state.target ? state.archiveSource : state.goodArchiveSource
        process.stdout.write(`${(await treePaths(source)).join('\0')}\0`)
      }
      process.exit(0)
    }
    if (state.fail === 'untracked-list') fail('untracked enumeration')
    const paths = [
      ...(state.untracked ?? []),
      ...(args.includes('--exclude-standard') ? [] : (state.ignoredUntracked ?? [])),
    ]
    if (paths.length) process.stdout.write(`${paths.join('\0')}\0`)
  } else if (args[0] === 'diff') {
    const staged = args.includes('--cached')
    if (state.fail === (staged ? 'tracked-index-list' : 'tracked-worktree-list')) {
      process.stderr.write('SYNTHETIC_PRIVATE_PATH SYNTHETIC_PRIVATE_CONTENT enumeration failure\n')
      process.exit(128)
    }
    if (staged ? state.dirtyStaged : state.dirtyWorktree) {
      fail('SYNTHETIC_PRIVATE_PATH SYNTHETIC_PRIVATE_CONTENT tracked changes')
    }
  } else if (args[0] === 'read-tree') {
    if (args.at(-1) === state.target && state.fail === 'reset') fail('reset')
  } else if (args[0] === 'update-ref' && args[1] === 'HEAD') {
    state.head = args[2]
    if (state.head === state.target) {
      state.attempted = true
      if (state.untrackedAfterReset) state.untracked = state.untrackedAfterReset
    } else if (state.attempted) {
      state.rollingBack = true
      // Older deployed revisions may not carry the new smoke file at all.
      await rm(join(root, 'scripts', 'smoke_catalog.sh'), { force: true })
    }
    await save()
  } else if (args[0] === 'update-ref') {
    if (state.fail === 'recording' && args.at(-1) === state.target) fail('update-ref')
  } else if (args[0] === 'cat-file' && args[1] === 'blob') {
    let found = false
    for (const [revision, source] of [
      [state.target, state.archiveSource],
      [state.goodRevision, state.goodArchiveSource],
    ]) {
      for (const path of [
        'docker-compose.vps.yml',
        '.dockerignore',
        'scripts/smoke_catalog.sh',
        'Dockerfile.dockerignore',
      ]) {
        if (
          !(await access(join(source, path)).then(
            () => true,
            () => false
          ))
        )
          continue
        if ((await blobId(source, path)) !== args[2]) continue
        process.stdout.write(await readFile(join(source, path)))
        found = true
        break
      }
      if (found) break
    }
    if (!found) fail('unknown blob')
  } else if (args[0] === 'hash-object') {
    const path = args.at(-1)
    if (
      args.includes('--no-filters') &&
      path.startsWith(root) &&
      !path.startsWith(stateDir) &&
      state.dirtyWorktree
    ) {
      output('6'.repeat(40))
      process.exit(0)
    }
    const content = await readFile(path)
    output(createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex'))
  } else if (args[0] !== 'cat-file') fail('unexpected git command')
} else if (command === 'docker') {
  if (args[0] === 'compose') {
    if (
      ![state.target, state.goodRevision].includes(composeRevision) ||
      composePath === join(root, 'docker-compose.vps.yml')
    )
      fail('live or unknown compose source')
    const projectDirectory = args[args.indexOf('--project-directory') + 1]
    if (projectDirectory !== dirname(composePath)) fail('snapshot project directory missing')
    if ((await readFile(join(projectDirectory, '.env'), 'utf8')) !== state.runtimeEnv)
      fail('runtime environment is not pinned')
    if (!(await readFile(composePath, 'utf8')).includes(composeRevision))
      fail('compose content outside pinned revision')
    const operation = args.slice(
      args.findIndex((arg) => ['config', 'ps', 'build', 'stop', 'run', 'up'].includes(arg))
    )
    if (operation[0] === 'config' && args.includes('--format')) {
      const effectiveBuild = {
        context: projectDirectory,
        dockerfile: 'Dockerfile',
        target: 'production',
        ...(state.buildContract ?? {}),
      }
      if (effectiveBuild.context === '__snapshot__') effectiveBuild.context = projectDirectory
      output(
        JSON.stringify({
          services: {
            app: {
              build: effectiveBuild,
            },
          },
        })
      )
    } else if (operation[0] === 'config') output('experimente-plus-app')
    else if (operation[0] === 'ps') {
      output(state.running ? 'app-container' : '')
    } else if (operation[0] === 'build') {
      const context = process.env.EXPERIMENTE_BUILD_CONTEXT
      if (!context || !args.some((arg) => arg.endsWith('/build-context.yml')))
        fail('unpinned build context')
      state.builtRevision = await readFile(join(context, 'revision.txt'), 'utf8')
      if (state.builtRevision !== state.target) fail('wrong context revision')
      if (state.dirtyDuringBuild) {
        if (state.dirtyDuringBuild === 'staged') state.dirtyStaged = true
        if (state.dirtyDuringBuild === 'worktree') state.dirtyWorktree = true
        await save()
      }
      if (state.mutateComposeDuringBuild) {
        await writeFile(join(root, 'docker-compose.vps.yml'), 'SYNTHETIC_PRIVATE_COMPOSE_CONTENT')
        state.dirtyWorktree = true
        await save()
      }
      if (state.mutateEnvDuringBuild) {
        await writeFile(join(root, '.env'), 'SYNTHETIC_PRIVATE_MUTATED_ENV=build\n')
        state.liveEnvMutated = 'build'
        await save()
      }
      if (state.lateUntracked) {
        await mkdir(dirname(join(root, state.lateUntracked)), { recursive: true })
        await writeFile(join(root, state.lateUntracked), 'synthetic stale migration')
        state.contextIncludedUntracked = await access(join(context, state.lateUntracked)).then(
          () => true,
          () => false
        )
      }
      if (process.env.DEPLOY_TEST_PAUSE_BUILD === '1') {
        for (let attempt = 0; ; attempt++) {
          if (
            await access(join(root, 'release-build')).then(
              () => true,
              () => false
            )
          )
            break
          if (attempt >= 1000) fail('fixture build was never released')
          await setTimeout(10)
        }
      }
      if (state.fail === 'build') fail('build')
      state.images['experimente-plus-app'] = state.newImage
      await save()
    } else if (operation[0] === 'stop') {
      if (state.fail === 'stop') fail('stop')
      state.running = ''
      await save()
      if (state.mutateEnvAfterStop) {
        await writeFile(join(root, '.env'), 'SYNTHETIC_PRIVATE_MUTATED_ENV=stop\n')
        state.liveEnvMutated = 'stop'
        await save()
      }
      if (state.signalAfterStop) process.kill(process.ppid, state.signalAfterStop)
    } else if (operation[0] === 'run') {
      if (state.running) fail('migration ran while app was not quiescent')
      const migrationName = `experimente-plus-migration-${state.target}`
      if (
        operation.join(' ') !==
          `run --detach --no-TTY --no-deps --name ${migrationName} --label com.experimente-plus.deploy.role=migration --label com.experimente-plus.deploy.revision=${state.target} app node ace.js migration:run --force` ||
        !args.some((arg) => arg.endsWith('/migration.yml'))
      )
        fail('unexpected migration command')
      state.migrationRuns = (state.migrationRuns ?? 0) + 1
      state.migrationContainerId = '7'.repeat(64)
      state.migrationContainerName = migrationName
      state.migrationExists = true
      state.migrationRunning = true
      await save()
      if (state.fail === 'migration-launch') fail('migration launch')
      output(state.migrationContainerId)
    } else if (operation[0] === 'up') {
      if (state.migrationExists || state.migrationRunning)
        fail('app started while migration container still existed')
      const recoveryUp = composeRevision === state.goodRevision
      if (recoveryUp && state.attempted) state.rollingBack = true
      if (recoveryUp && !state.attempted) state.idempotentRecovered = true
      if (state.rollingBack && state.rollbackFail === 'up') fail('rollback up')
      state.running = state.images['experimente-plus-app']
      if (!recoveryUp) {
        if (!state.migrationSucceeded || state.migrationRuns !== 1)
          fail('new app started without exactly one successful migration')
        await appear('DuringUp')
        if (state.dirtyDuringUp) {
          state[state.dirtyDuringUp === 'staged' ? 'dirtyStaged' : 'dirtyWorktree'] = true
          await writeFile(join(root, 'docker-compose.vps.yml'), 'SYNTHETIC_PRIVATE_COMPOSE_CONTENT')
        }
      }
      await save()
      if (!state.rollingBack && state.fail === 'up') fail('up after changing container')
    } else fail('unexpected compose command')
  } else if (args[0] === 'ps') {
    if (state.migrationExists) output(state.migrationContainerId)
  } else if (args[0] === 'wait') {
    if (!state.migrationExists || args.at(-1) !== state.migrationContainerId)
      fail('unknown migration wait target')
    if (state.fail === 'migration-timeout') fail('migration wait timeout')
    state.migrationRunning = false
    state.migrationSucceeded = state.fail !== 'migration'
    await save()
    output(state.migrationSucceeded ? '0' : '1')
  } else if (args[0] === 'rm' && args[1] === '--force') {
    if (state.migrationCleanupFails) fail('migration cleanup')
    if (args.at(-1) !== state.migrationContainerId) fail('unknown migration cleanup target')
    state.migrationExists = false
    state.migrationRunning = false
    await save()
    output(args.at(-1))
  } else if (args[0] === 'inspect') {
    const target = args.at(-1)
    if (target === state.migrationContainerName || target === state.migrationContainerId) {
      const format = args[args.indexOf('--format') + 1]
      if (format.includes('{{.Id}}|{{.Image}}')) {
        output(
          `${state.migrationContainerId}|${state.newImage}|no|/${state.migrationContainerName}|migration|experimente-plus|app|${state.target}`
        )
      } else {
        output(`/${state.migrationContainerName}|migration|experimente-plus|app`)
      }
    } else output(state.running)
  } else if (args[0] === 'image' && args[1] === 'inspect') {
    const image = args.at(-1)
    if (image === state.goodImage || image === state.newImage) output(image)
    else if (state.images[image]) output(state.images[image])
    else fail('image missing')
  } else if (args[0] === 'image' && args[1] === 'tag') {
    state.images[args[3]] = args[2]
    await save()
  } else fail('unexpected docker command')
} else if (command === 'mv') {
  execFileSync('/usr/bin/mv', args)
  if (
    args.at(-1) === join(root, '.git', 'experimente-plus-deploy', 'last-known-good') &&
    state.signalAfterRecord &&
    (await readFile(args.at(-1), 'utf8')).startsWith(state.target)
  ) {
    process.kill(process.ppid, state.signalAfterRecord)
    state.signalInjected = state.signalAfterRecord
    await save()
  }
} else if (command === 'curl') {
  const url = new URL(args.at(-1))
  const writeOut = args[args.indexOf('--write-out') + 1]
  const readiness = writeOut === '%{http_code}'
  const isInertia = args.includes('X-Inertia: true')
  const hasInertiaVersion = args.some((arg) => arg.startsWith('X-Inertia-Version: '))
  const isJson = url.pathname.startsWith('/api/') || isInertia
  const failedStage = state.rollingBack
    ? state.rollbackFail
    : state.running === state.newImage
      ? state.fail
      : state.running === state.goodImage && !state.idempotentRecovered
        ? state.goodFail
        : null
  let status =
    (readiness && failedStage === 'readiness') ||
    (!readiness && failedStage === 'smoke' && url.pathname.endsWith('/filters')) ||
    (state.running === state.goodImage && url.pathname === '/new-contract-only')
      ? '500'
      : '200'
  if (!readiness && isInertia && !hasInertiaVersion && status === '200') status = '409'
  if (readiness) output(status)
  else if (writeOut.includes('%header{x-inertia-version}')) {
    output(
      `${status}\napplication/json\n${status === '409' ? '0123456789abcdef0123456789abcdef' : ''}\n${
        status === '409' ? url.pathname : ''
      }`
    )
  } else output(`${status} ${isJson ? 'application/json' : 'text/html'}`)
} else fail('unexpected executable')
