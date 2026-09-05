import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('../../', import.meta.url))
const env = {
  PATH: process.env.PATH,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_TERMINAL_PROMPT: '0',
}

async function repository(t, { shallow = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'experimente-git-integrity-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = join(root, 'repository')
  const runDir = join(root, 'run')
  await mkdir(runDir)
  // Clone the existing approved commit locally, including shallow checkouts.
  // No network fetch, hooks, source-repository writes, Docker, app or database.
  const cloneOptions = shallow ? ['--depth=1', '--no-local'] : ['--shared']
  execFileSync(
    'git',
    ['clone', '--quiet', ...cloneOptions, '--no-checkout', '--template=', project, repo],
    { env }
  )
  const git = (args, options = {}) =>
    execFileSync('git', ['-C', repo, ...args], { env, encoding: 'utf8', ...options })
  const approved = git(['rev-parse', 'HEAD']).trim()
  git(['config', 'core.hooksPath', '/dev/null'])
  git(['config', 'core.fsmonitor', 'false'])
  git(['reset', '--hard', '--quiet', approved])
  await writeFile(join(repo, '.env'), 'SYNTHETIC_TEST_ENV=1\n', { mode: 0o600 })
  const localOrigin = git(['config', '--get', 'remote.origin.url']).trim()
  assert.equal(localOrigin.includes("'"), false)
  const stateDir = join(repo, '.git', 'experimente-plus-deploy')
  await mkdir(stateDir)
  const lkg = join(stateDir, 'last-known-good')
  const record = `${approved}\nsha256:${'1'.repeat(64)}\n${'2'.repeat(64)}\n`
  await writeFile(lkg, record)
  const trace = join(root, 'calls')
  await writeFile(trace, '')
  const deploy = await readFile(new URL('../../deploy.sh', import.meta.url), 'utf8')
  const entrypoint = '\nmain "$@"\n'
  assert.ok(deploy.endsWith(entrypoint))
  const productionOrigin =
    "DEPLOY_EXPECTED_ORIGIN_URL='https://github.com/gabrielmaialva33/experimente-plus.git'"
  assert.ok(deploy.includes(productionOrigin))
  assert.ok(deploy.includes('export GIT_ALLOW_PROTOCOL=https'))
  const harnessDeploy = deploy
    .replace(productionOrigin, `DEPLOY_EXPECTED_ORIGIN_URL='${localOrigin}'`)
    .replace('export GIT_ALLOW_PROTOCOL=https', 'export GIT_ALLOW_PROTOCOL=file')

  async function run(body, args = [], extraEnv = {}) {
    const harness = join(root, 'harness.sh')
    await writeFile(harness, harnessDeploy.slice(0, -entrypoint.length) + '\n' + body + '\n')
    return spawnSync('bash', [harness, ...args], {
      cwd: repo,
      // Production rejects inherited Git controls; the setup-only controls above
      // are deliberately absent. The entrypoint itself must disable replacements.
      env: {
        PATH: process.env.PATH,
        EXPERIMENTE_DEPLOY_ROOT: repo,
        DEPLOY_TEST_TRACE: trace,
        ...extraEnv,
      },
      encoding: 'utf8',
      timeout: 30000,
    })
  }
  function commitWithEntry(path, mode, contents) {
    git(['read-tree', approved])
    const blob = git(['hash-object', '-w', '--stdin'], { input: contents }).trim()
    git(['update-index', '--add', '--cacheinfo', mode, blob, path])
    const tree = git(['write-tree']).trim()
    const revision = git(
      [
        '-c',
        'user.name=Deploy fixture',
        '-c',
        'user.email=deploy@example.invalid',
        'commit-tree',
        tree,
        '-p',
        approved,
      ],
      { input: 'Synthetic deploy integrity fixture\n' }
    ).trim()
    git(['reset', '--hard', '--quiet', approved])
    return revision
  }
  return { root, repo, runDir, git, approved, lkg, record, trace, run, commitWithEntry }
}

async function assertReleaseStatePreserved(f) {
  assert.equal(await readFile(f.lkg, 'utf8'), f.record)
  assert.equal(f.git(['rev-parse', '--verify', 'HEAD']).trim(), f.approved)
}

function assertOutputOmits(result, values) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  for (const value of values) assert.equal(output.includes(value), false)
}

// Real preflights and local Git reads. Any attempted fetch, index/ref mutation or
// Docker operation fails and is recorded, so regressions cannot mutate local state.
const guardedMain = `
git() {
  printf '%s\\n' "$1" >> "$DEPLOY_TEST_TRACE"
  case "$1" in fetch|reset|read-tree|update-ref) return 88 ;; esac
  command git "$@"
}
timeout() {
  printf 'timeout\\n' >> "$DEPLOY_TEST_TRACE"
  return 88
}
main "$@"
`

for (const change of [
  'skip-worktree',
  'assume-unchanged',
  'sparse-checkout',
  'sparse-index',
  'staged',
  'worktree',
  'intent-to-add',
]) {
  test(`real Git refuses ${change} before fetch/materialization/build and preserves local state`, async (t) => {
    const f = await repository(t)
    const path = 'docker-compose.vps.yml'
    const file = join(f.repo, path)
    const original = await readFile(file, 'utf8')
    const privateContent = 'SYNTHETIC_PRIVATE_TRACKED_CONTENT\n'
    let expected = original
    if (change.startsWith('sparse-')) {
      f.git([
        'config',
        change === 'sparse-checkout' ? 'core.sparseCheckout' : 'index.sparse',
        'true',
      ])
    } else if (change === 'intent-to-add') {
      await writeFile(join(f.repo, 'intent-to-add.txt'), privateContent)
      f.git(['add', '-N', '--', 'intent-to-add.txt'])
    } else {
      await writeFile(file, privateContent)
      expected = privateContent
      if (change === 'staged') f.git(['add', '--', path])
      else if (change !== 'worktree') {
        f.git(['update-index', '--' + change, '--', path])
        // Demonstrate that an ordinary quiet diff is fooled before running the gate.
        assert.equal(f.git(['diff', '--quiet', 'HEAD', '--']), '')
      }
    }
    const result = await f.run(guardedMain, [f.approved])
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /FALHA:/)
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /docker-compose|intent-to-add.txt|SYNTHETIC_PRIVATE_TRACKED_CONTENT/
    )
    const calls = (await readFile(f.trace, 'utf8')).trim().split('\n')
    assert.equal(
      calls.some((call) => ['fetch', 'reset', 'read-tree', 'update-ref', 'timeout'].includes(call)),
      false
    )
    assert.equal(await readFile(file, 'utf8'), expected)
    assert.equal(await readFile(f.lkg, 'utf8'), f.record)
    if (change === 'intent-to-add')
      assert.equal(await readFile(join(f.repo, 'intent-to-add.txt'), 'utf8'), privateContent)
  })
}

test('real refs/replace cannot redirect the approved tree, archive or materialization', async (t) => {
  const f = await repository(t, { shallow: true })
  assert.equal(f.git(['rev-parse', '--is-shallow-repository']).trim(), 'true')
  const branches = f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/'])
  const approvedTree = f.git(['rev-parse', f.approved + '^{tree}']).trim()
  // Synthetic objects exist only in this disposable clone. No ancestor/history
  // dependency, parent commit, branch movement, or write to the shared source.
  const replacementBlob = f
    .git(['hash-object', '-w', '--stdin'], { input: 'synthetic replacement object\n' })
    .trim()
  const replacementTree = f
    .git(['mktree'], { input: `100644 blob ${replacementBlob}\treplacement.txt\n` })
    .trim()
  const replacement = f
    .git(
      [
        '-c',
        'user.name=Deploy fixture',
        '-c',
        'user.email=deploy@example.invalid',
        'commit-tree',
        replacementTree,
      ],
      { input: 'Synthetic replacement fixture\n' }
    )
    .trim()
  f.git(['update-ref', 'refs/replace/' + f.approved, replacement])
  const replaceEnv = { ...env }
  delete replaceEnv.GIT_NO_REPLACE_OBJECTS
  assert.equal(f.git(['rev-parse', f.approved], { env: replaceEnv }).trim(), f.approved)
  assert.equal(
    f.git(['rev-parse', f.approved + '^{tree}'], { env: replaceEnv }).trim(),
    replacementTree
  )
  const expectedArchive = join(f.root, 'expected.tar')
  const redirectedArchive = join(f.root, 'redirected.tar')
  f.git(['archive', '--format=tar', '--output', expectedArchive, f.approved])
  f.git(['archive', '--format=tar', '--output', redirectedArchive, f.approved], { env: replaceEnv })
  const archive = await readFile(expectedArchive)
  const replacedArchive = await readFile(redirectedArchive)
  assert.notDeepEqual(archive, replacedArchive)
  const result = await f.run(
    `
RUN_DIR="$2"
preflight_reserved_tree "$1"
git ls-tree -r -z "$1" > "$RUN_DIR/tree"
git archive --format=tar "$1" > "$RUN_DIR/archive.tar"
previous_revision=$(git rev-parse --verify HEAD)
git read-tree "$1"
git update-ref HEAD "$1" "$previous_revision"
git write-tree > "$RUN_DIR/materialized-tree"
`,
    [f.approved, f.runDir],
    { GIT_NO_REPLACE_OBJECTS: '0' }
  )
  assert.equal(result.status, 0, result.stderr)
  const hash = (value) => createHash('sha256').update(value).digest('hex')
  assert.equal(hash(await readFile(join(f.runDir, 'archive.tar'))), hash(archive))
  assert.deepEqual(
    await readFile(join(f.runDir, 'tree')),
    f.git(['ls-tree', '-r', '-z', f.approved], { encoding: 'buffer' })
  )
  assert.equal((await readFile(join(f.runDir, 'materialized-tree'), 'utf8')).trim(), approvedTree)
  assert.equal(f.git(['rev-parse', 'HEAD']).trim(), f.approved)
  assert.equal(f.git(['diff', '--quiet', 'HEAD', '--']), '')
  assert.equal(
    f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']),
    branches
  )
})

test('Git hooks cannot run during read-tree or update-ref', async (t) => {
  const f = await repository(t)
  const marker = join(f.root, 'hook-marker')
  const hook = join(f.repo, '.git', 'hooks', 'reference-transaction')
  await mkdir(join(f.repo, '.git', 'hooks'), { recursive: true })
  await writeFile(hook, `#!/bin/sh\nprintf hook-ran > ${marker}\n`, { mode: 0o755 })
  f.git(['config', 'core.hooksPath', join(f.repo, '.git', 'hooks')])
  const result = await f.run('git read-tree "$1"\ngit update-ref refs/deploy/test "$1"', [
    f.approved,
  ])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(
    await access(marker).then(
      () => true,
      () => false
    ),
    false
  )
})

test('snapshot preserves a Git symlink target newline and rejects either newline mutation', async (t) => {
  const f = await repository(t)
  const symlinkPath = 'release-integrity-link'
  const privateStem = 'SYNTHETIC_PRIVATE_SYMLINK_TARGET'
  const withNewline = `${privateStem}-with-newline\n`
  const withoutNewline = `${privateStem}-without-newline`
  const newlineRevision = f.commitWithEntry(symlinkPath, '120000', withNewline)
  const plainRevision = f.commitWithEntry(symlinkPath, '120000', withoutNewline)

  const validSnapshot = join(f.root, 'valid-newline-snapshot')
  const valid = await f.run('RUN_DIR="$2"\nprepare_snapshot "$1" "$3" false', [
    newlineRevision,
    f.runDir,
    validSnapshot,
  ])
  assert.equal(valid.status, 0, valid.stderr)
  assertOutputOmits(valid, [privateStem, symlinkPath])
  await assertReleaseStatePreserved(f)

  const removedNewlineSnapshot = join(f.root, 'removed-newline-snapshot')
  const removedNewline = await f.run(
    [
      'RUN_DIR="$2"',
      'prepare_snapshot "$1" "$3" false',
      'rm -- "$3/release-integrity-link"',
      'ln -s -- "$4" "$3/release-integrity-link"',
      'verify_snapshot_tree "$1" "$3"',
    ].join('\n'),
    [newlineRevision, f.runDir, removedNewlineSnapshot, withoutNewline]
  )
  assert.equal(removedNewline.status, 1, removedNewline.stderr)
  assert.match(removedNewline.stderr, /FALHA:/)
  assertOutputOmits(removedNewline, [privateStem, symlinkPath])
  await assertReleaseStatePreserved(f)

  const addedNewlineSnapshot = join(f.root, 'added-newline-snapshot')
  const addedNewline = await f.run(
    [
      'RUN_DIR="$2"',
      'prepare_snapshot "$1" "$3" false',
      'rm -- "$3/release-integrity-link"',
      'ln -s -- "$4" "$3/release-integrity-link"',
      'verify_snapshot_tree "$1" "$3"',
    ].join('\n'),
    [plainRevision, f.runDir, addedNewlineSnapshot, withNewline]
  )
  assert.equal(addedNewline.status, 1, addedNewline.stderr)
  assert.match(addedNewline.stderr, /FALHA:/)
  assertOutputOmits(addedNewline, [privateStem, symlinkPath])
  await assertReleaseStatePreserved(f)
})

test('snapshot verification rejects an extra empty directory', async (t) => {
  const f = await repository(t)
  const snapshot = join(f.root, 'empty-directory-snapshot')
  const privatePath = 'SYNTHETIC_PRIVATE_EMPTY_DIRECTORY'
  const result = await f.run(
    [
      'RUN_DIR="$2"',
      'prepare_snapshot "$1" "$3" false',
      'mkdir -- "$3/$4"',
      'verify_snapshot_tree "$1" "$3"',
    ].join('\n'),
    [f.approved, f.runDir, snapshot, privatePath]
  )
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA:/)
  assertOutputOmits(result, [privatePath, snapshot])
  await assertReleaseStatePreserved(f)
})

test('snapshot verification rejects an extra FIFO', async (t) => {
  const f = await repository(t)
  const snapshot = join(f.root, 'fifo-snapshot')
  const privatePath = 'SYNTHETIC_PRIVATE_FIFO'
  const result = await f.run(
    [
      'RUN_DIR="$2"',
      'prepare_snapshot "$1" "$3" false',
      'mkfifo -- "$3/$4"',
      'verify_snapshot_tree "$1" "$3"',
    ].join('\n'),
    [f.approved, f.runDir, snapshot, privatePath]
  )
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA: snapshot contém entrada não suportada/)
  assertOutputOmits(result, [privatePath, snapshot])
  await assertReleaseStatePreserved(f)
})

test('snapshot verification fails closed when find emits its manifest then returns rc 86', async (t) => {
  const f = await repository(t)
  const snapshot = join(f.root, 'find-failure-snapshot')
  const result = await f.run(
    [
      'find() {',
      '  command find "$@"',
      '  local rc=$?',
      '  if (( rc != 0 )); then return "$rc"; fi',
      '  return 86',
      '}',
      'RUN_DIR="$2"',
      'prepare_snapshot "$1" "$3" false',
    ].join('\n'),
    [f.approved, f.runDir, snapshot]
  )
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA: não foi possível enumerar o snapshot extraído/)
  assert.ok((await readFile(join(f.runDir, 'snapshot-paths'))).length > 0)
  assertOutputOmits(result, [snapshot, f.repo])
  await assertReleaseStatePreserved(f)
})

test('configured clean filter is refused before its marker command can execute', async (t) => {
  const f = await repository(t)
  const marker = join(f.root, 'SYNTHETIC_PRIVATE_CLEAN_FILTER_MARKER')
  await mkdir(join(f.repo, '.git', 'info'), { recursive: true })
  await writeFile(join(f.repo, '.git', 'info', 'attributes'), 'deploy.sh filter=marker\n')
  f.git([
    'config',
    'filter.marker.clean',
    'sh -c \'printf filter-ran > "$DEPLOY_FILTER_MARKER"; cat\'',
  ])
  const result = await f.run(guardedMain, [f.approved], { DEPLOY_FILTER_MARKER: marker })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA: filtros Git locais ou globais não são permitidos/)
  assert.equal(
    await access(marker).then(
      () => true,
      () => false
    ),
    false
  )
  assertOutputOmits(result, [marker, 'filter.marker.clean', 'deploy.sh'])
  const calls = await readFile(f.trace, 'utf8')
  assert.equal(calls.includes('fetch\n'), false)
  assert.equal(calls.includes('reset\n'), false)
  assert.equal(calls.includes('read-tree\n'), false)
  assert.equal(calls.includes('update-ref\n'), false)
  assert.equal(calls.includes('timeout\n'), false)
  await assertReleaseStatePreserved(f)
})

for (const injectionCommand of ['read-tree', 'update-ref']) {
  test(`late clean and smudge filters injected at ${injectionCommand} cannot execute`, async (t) => {
    const f = await repository(t)
    const marker = join(f.root, 'SYNTHETIC_PRIVATE_LATE_FILTER_MARKER')
    const snapshot = join(f.root, 'late-filter-snapshot')
    const filterCommand = 'sh -c \'printf filter-ran > "$DEPLOY_FILTER_MARKER"; cat\''
    const result = await f.run(
      [
        'RUN_DIR="$2"',
        'validate_repository_layout',
        'prepare_snapshot "$1" "$3" false',
        'git() {',
        '  case "$1" in',
        '    read-tree|update-ref)',
        '      printf \'%s\\n\' "$1" >> "$DEPLOY_TEST_TRACE"',
        '      if [[ "$1" == "$DEPLOY_FILTER_INJECTION_COMMAND" ]]; then',
        '        mkdir -p -- "$GIT_DIR/info"',
        '        printf \'docker-compose.vps.yml filter=late-filter\\n\' > "$GIT_DIR/info/attributes"',
        '        command git config filter.late-filter.clean "$DEPLOY_FILTER_COMMAND"',
        '        command git config filter.late-filter.smudge "$DEPLOY_FILTER_COMMAND"',
        '      fi',
        '      ;;',
        '  esac',
        '  command git "$@"',
        '}',
        'materialize_snapshot "$1" "$3"',
      ].join('\n'),
      [f.approved, f.runDir, snapshot],
      {
        DEPLOY_FILTER_COMMAND: filterCommand,
        DEPLOY_FILTER_INJECTION_COMMAND: injectionCommand,
        DEPLOY_FILTER_MARKER: marker,
      }
    )

    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /FALHA: filtros Git locais ou globais não são permitidos/)
    assert.equal(await readFile(f.trace, 'utf8'), 'read-tree\nupdate-ref\n')
    assert.equal(f.git(['config', '--get', 'filter.late-filter.clean']).trim(), filterCommand)
    assert.equal(f.git(['config', '--get', 'filter.late-filter.smudge']).trim(), filterCommand)
    assert.equal(
      await access(marker).then(
        () => true,
        () => false
      ),
      false
    )
    assertOutputOmits(result, [marker, 'filter-ran', 'docker-compose.vps.yml'])
    await assertReleaseStatePreserved(f)
  })
}

for (const setting of ['remote.origin.uploadpack', 'remote.backup.uploadpack', 'core.sshCommand']) {
  test(`command-bearing ${setting} is refused before fetch without executing its marker`, async (t) => {
    const f = await repository(t)
    const marker = join(f.root, 'SYNTHETIC_PRIVATE_TRANSPORT_COMMAND_MARKER')
    f.git([
      'config',
      setting,
      'sh -c \'printf transport-ran > "$DEPLOY_TRANSPORT_MARKER"; exit 86\'',
    ])
    const result = await f.run(guardedMain, [f.approved], {
      DEPLOY_TRANSPORT_MARKER: marker,
    })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /FALHA:/)
    assert.equal(
      await access(marker).then(
        () => true,
        () => false
      ),
      false
    )
    assertOutputOmits(result, [marker, 'transport-ran'])
    const calls = await readFile(f.trace, 'utf8')
    assert.equal(calls.includes('fetch\n'), false)
    assert.equal(calls.includes('reset\n'), false)
    assert.equal(calls.includes('read-tree\n'), false)
    assert.equal(calls.includes('update-ref\n'), false)
    assert.equal(calls.includes('timeout\n'), false)
    await assertReleaseStatePreserved(f)
  })
}

test('command-bearing URL rewrite is refused before fetch without executing its marker', async (t) => {
  const f = await repository(t)
  const marker = join(f.root, 'SYNTHETIC_PRIVATE_URL_REWRITE_MARKER')
  const localOrigin = f.git(['config', '--get', 'remote.origin.url']).trim()
  const rewrite = 'ext::sh -c \'printf transport-ran > "$DEPLOY_TRANSPORT_MARKER"; exit 86\''
  f.git(['config', `url.${rewrite}.insteadOf`, localOrigin])
  const result = await f.run(guardedMain, [f.approved], {
    DEPLOY_TRANSPORT_MARKER: marker,
  })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA:/)
  assert.equal(
    await access(marker).then(
      () => true,
      () => false
    ),
    false
  )
  assertOutputOmits(result, [marker, rewrite, 'transport-ran'])
  const calls = await readFile(f.trace, 'utf8')
  assert.equal(calls.includes('fetch\n'), false)
  assert.equal(calls.includes('reset\n'), false)
  assert.equal(calls.includes('read-tree\n'), false)
  assert.equal(calls.includes('update-ref\n'), false)
  assert.equal(calls.includes('timeout\n'), false)
  await assertReleaseStatePreserved(f)
})

test('external clean core.worktree is refused before fetch without writing outside the checkout', async (t) => {
  const f = await repository(t)
  const externalWorktree = join(f.root, 'SYNTHETIC_PRIVATE_EXTERNAL_WORKTREE')
  await mkdir(externalWorktree)
  f.git(['config', 'core.worktree', externalWorktree])
  f.git(['reset', '--hard', '--quiet', f.approved])
  assert.equal(f.git(['status', '--porcelain=v1', '--untracked-files=all']), '')

  const result = await f.run(guardedMain, [f.approved])

  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA: worktree ou diretório Git diverge da raiz operacional/)
  assertOutputOmits(result, [externalWorktree, 'SYNTHETIC_PRIVATE_EXTERNAL_WORKTREE'])
  const calls = await readFile(f.trace, 'utf8')
  assert.equal(calls.includes('fetch\n'), false)
  assert.equal(calls.includes('reset\n'), false)
  assert.equal(calls.includes('read-tree\n'), false)
  assert.equal(calls.includes('update-ref\n'), false)
  assert.equal(calls.includes('timeout\n'), false)
  assert.equal(f.git(['status', '--porcelain=v1', '--untracked-files=all']), '')
  await assertReleaseStatePreserved(f)
})

test('core.alternateRefsCommand is refused without executing its marker', async (t) => {
  const f = await repository(t)
  const marker = join(f.root, 'SYNTHETIC_PRIVATE_ALTERNATE_REFS_MARKER')
  f.git([
    'config',
    'core.alternateRefsCommand',
    'sh -c \'printf alternate-refs-ran > "$DEPLOY_ALTERNATE_REFS_MARKER"; exit 86\'',
  ])
  const result = await f.run(guardedMain, [f.approved], {
    DEPLOY_ALTERNATE_REFS_MARKER: marker,
  })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA: configuração Git de transporte não permitida/)
  assert.equal(
    await access(marker).then(
      () => true,
      () => false
    ),
    false
  )
  assertOutputOmits(result, [marker, 'alternate-refs-ran'])
  const calls = await readFile(f.trace, 'utf8')
  assert.equal(calls.includes('fetch\n'), false)
  assert.equal(calls.includes('reset\n'), false)
  assert.equal(calls.includes('read-tree\n'), false)
  assert.equal(calls.includes('update-ref\n'), false)
  assert.equal(calls.includes('timeout\n'), false)
  await assertReleaseStatePreserved(f)
})

for (const [kind, unsafeUrl] of [
  ['divergent HTTPS repository', 'https://example.invalid/SYNTHETIC_PRIVATE_REMOTE.git'],
  ['local file transport', 'file:///tmp/SYNTHETIC_PRIVATE_REMOTE.git'],
  [
    'external command transport',
    'ext::sh -c \'printf transport-ran > "$DEPLOY_TRANSPORT_MARKER"; exit 86\'',
  ],
]) {
  test(`origin refuses ${kind} before fetch`, async (t) => {
    const f = await repository(t)
    const marker = join(f.root, 'SYNTHETIC_PRIVATE_REMOTE_MARKER')
    f.git(['remote', 'set-url', 'origin', unsafeUrl])
    const result = await f.run(guardedMain, [f.approved], {
      DEPLOY_TRANSPORT_MARKER: marker,
    })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /FALHA:/)
    assert.equal(
      await access(marker).then(
        () => true,
        () => false
      ),
      false
    )
    assertOutputOmits(result, [marker, unsafeUrl, 'SYNTHETIC_PRIVATE_REMOTE', 'transport-ran'])
    const calls = await readFile(f.trace, 'utf8')
    assert.equal(calls.includes('fetch\n'), false)
    assert.equal(calls.includes('reset\n'), false)
    assert.equal(calls.includes('read-tree\n'), false)
    assert.equal(calls.includes('update-ref\n'), false)
    assert.equal(calls.includes('timeout\n'), false)
    await assertReleaseStatePreserved(f)
  })
}

test('Git filter enumeration rc 86 fails closed before fetch or materialization', async (t) => {
  const f = await repository(t)
  const result = await f.run(
    [
      'git() {',
      '  printf \'%s\\n\' "$1" >> "$DEPLOY_TEST_TRACE"',
      '  if [[ "$1" == config && "${2:-}" == --get-regexp ]]; then return 86; fi',
      '  case "$1" in fetch|reset|read-tree|update-ref) return 88 ;; esac',
      '  command git "$@"',
      '}',
      'timeout() {',
      '  printf \'timeout\\n\' >> "$DEPLOY_TEST_TRACE"',
      '  return 88',
      '}',
      'main "$@"',
    ].join('\n'),
    [f.approved]
  )
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /FALHA: filtros Git impossíveis de verificar/)
  const calls = await readFile(f.trace, 'utf8')
  assert.equal(calls.includes('fetch\n'), false)
  assert.equal(calls.includes('reset\n'), false)
  assert.equal(calls.includes('read-tree\n'), false)
  assert.equal(calls.includes('update-ref\n'), false)
  assert.equal(calls.includes('timeout\n'), false)
  assertOutputOmits(result, [f.repo, f.root])
  await assertReleaseStatePreserved(f)
})

test('configured fsmonitor hook cannot execute during integrated deploy preflight', async (t) => {
  const f = await repository(t)
  const marker = join(f.root, 'SYNTHETIC_PRIVATE_FSMONITOR_MARKER')
  const hook = join(f.root, 'fsmonitor-hook')
  await writeFile(hook, '#!/bin/sh\nprintf fsmonitor-ran > "$DEPLOY_FSMONITOR_MARKER"\nexit 0\n', {
    mode: 0o755,
  })
  f.git(['config', 'core.fsmonitor', hook])
  const result = await f.run(
    [
      'git() {',
      '  printf \'%s\\n\' "$1" >> "$DEPLOY_TEST_TRACE"',
      '  case "$1" in fetch|reset|read-tree|update-ref) return 88 ;; esac',
      '  command git "$@"',
      '}',
      'validate_repository_layout',
      'RUN_DIR="$1"',
      'preflight_filters',
      'preflight_transport',
      'preflight_tracked',
      'preflight_untracked',
    ].join('\n'),
    [f.runDir],
    { DEPLOY_FSMONITOR_MARKER: marker }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(
    await access(marker).then(
      () => true,
      () => false
    ),
    false
  )
  assertOutputOmits(result, [marker, hook, f.repo])
  const calls = await readFile(f.trace, 'utf8')
  assert.equal(calls.includes('fetch\n'), false)
  assert.equal(calls.includes('reset\n'), false)
  assert.equal(calls.includes('read-tree\n'), false)
  assert.equal(calls.includes('update-ref\n'), false)
  await assertReleaseStatePreserved(f)
})

for (const source of ['.gitattributes', '.git/info/attributes', 'core.attributesFile']) {
  for (const attribute of ['export-ignore', 'export-subst']) {
    test(`snapshot verification rejects ${source} ${attribute} filtering`, async (t) => {
      const f = await repository(t)
      const marker = 'app/integrity-export-marker.txt'
      const markerBlob = f
        .git(['hash-object', '-w', '--stdin'], {
          input: '$Format:%H$\n',
        })
        .trim()
      f.git(['read-tree', f.approved])
      f.git(['update-index', '--add', '--cacheinfo', '100644', markerBlob, marker])
      const attributes = `${marker} ${attribute}\n`
      let attributePath = source
      if (source === '.gitattributes') {
        const attrsBlob = f.git(['hash-object', '-w', '--stdin'], { input: attributes }).trim()
        f.git(['update-index', '--add', '--cacheinfo', '100644', attrsBlob, '.gitattributes'])
      } else {
        attributePath = join(
          f.root,
          source === 'core.attributesFile' ? 'attributes' : 'info-attributes'
        )
        await writeFile(attributePath, attributes)
        if (source === 'core.attributesFile')
          f.git(['config', 'core.attributesFile', attributePath])
        else {
          await mkdir(join(f.repo, '.git', 'info'), { recursive: true })
          await writeFile(join(f.repo, '.git', 'info', 'attributes'), attributes)
        }
      }
      const tree = f.git(['write-tree']).trim()
      const revision = f
        .git(
          [
            '-c',
            'user.name=Deploy fixture',
            '-c',
            'user.email=deploy@example.invalid',
            'commit-tree',
            tree,
            '-p',
            f.approved,
          ],
          { input: `Attribute fixture ${source}\n` }
        )
        .trim()
      const harness = `
RUN_DIR="$2"
prepare_snapshot "$1" "$3" false
`
      const result = await f.run(harness, [revision, f.runDir, join(f.root, 'snapshot')])
      assert.equal(result.status, 1, result.stderr)
      assert.match(result.stderr, /snapshot|conteúdo/)
      assert.doesNotMatch(result.stdout + result.stderr, /integrity-export-marker|%H|SYNTHETIC/)
      assert.equal(await readFile(f.lkg, 'utf8'), f.record)
      assert.equal(f.git(['rev-parse', 'HEAD']).trim(), f.approved)
    })
  }
}

test('normalizes Git modes after archive extraction under umask 077', async (t) => {
  const f = await repository(t)
  const snapshot = join(f.root, 'umask-snapshot')
  const result = await f.run('umask 077\nRUN_DIR="$2"\nprepare_snapshot "$1" "$3" false', [
    f.approved,
    f.runDir,
    snapshot,
  ])
  assert.equal(result.status, 0, result.stderr)
  const composeMode = (await import('node:fs/promises'))
    .stat(join(snapshot, 'docker-compose.vps.yml'))
    .then((s) => s.mode & 0o777)
  const deployMode = (await import('node:fs/promises'))
    .stat(join(snapshot, 'deploy.sh'))
    .then((s) => s.mode & 0o777)
  const appMode = (await import('node:fs/promises'))
    .stat(join(snapshot, 'app'))
    .then((s) => s.mode & 0o777)
  assert.equal(await composeMode, 0o644)
  assert.equal(await deployMode, 0o755)
  assert.equal(await appMode, 0o755)
})

for (const path of ['docker-compose.vps.yml', '.dockerignore', 'scripts/smoke_catalog.sh']) {
  for (const mode of ['100644', '100755', '120000', '160000']) {
    test(`real Git validates ${mode} entry for critical file ${path}`, async (t) => {
      const f = await repository(t)
      f.git(['read-tree', '--empty'])
      const blob =
        mode === '160000'
          ? f.approved
          : f.git(['hash-object', '-w', '--stdin'], { input: 'SYNTHETIC_PRIVATE_TARGET' }).trim()
      f.git(['update-index', '--add', '--cacheinfo', mode, blob, path])
      const tree = f.git(['write-tree']).trim()
      const result = await f.run('RUN_DIR="$3"\nregular_git_blob "$1" "$2"', [tree, path, f.runDir])
      assert.equal(result.status, mode.startsWith('100') ? 0 : 1, result.stderr)
      if (result.status === 0) assert.equal(result.stdout.trim(), blob)
      else assert.match(result.stderr, /blob regular/)
      assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_PRIVATE_TARGET/)
    })
  }
}
