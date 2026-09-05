import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), 'experimente-reserved-paths-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = join(root, 'repository')
  const runDir = join(root, 'run')
  await mkdir(repo)
  await mkdir(runDir)
  // No inherited Git configuration, repository, index, hooks, or credentials.
  const env = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
  const git = (args, options = {}) =>
    execFileSync('git', ['-C', repo, ...args], {
      env,
      encoding: 'utf8',
      ...options,
    }).trim()
  git(['init', '--quiet', '--object-format=sha1', '--template='])
  await writeFile(
    join(repo, '.gitignore'),
    '.env*\nnode_modules/\nbuild/\ndist/\ncoverage/\ntmp/\nstorage/uploads/\nstorage/seed-media/\n'
  )

  // Exercise the production function with REAL ls-tree, without running main,
  // resetting any checkout, starting Docker/HTTP, or creating even a test commit.
  const deploy = await readFile(new URL('../../deploy.sh', import.meta.url), 'utf8')
  const entrypoint = '\nmain "$@"\n'
  assert.ok(deploy.endsWith(entrypoint), 'the only omitted code must be the final main invocation')
  const harness = join(root, 'preflight.sh')
  await writeFile(
    harness,
    `${deploy.slice(0, -entrypoint.length)}\nRUN_DIR="$2"\npreflight_reserved_tree "$1"\n`
  )

  return {
    repo,
    git,
    check: (tree) =>
      spawnSync('bash', [harness, tree, runDir], {
        cwd: repo,
        env: { PATH: process.env.PATH },
        encoding: 'utf8',
      }),
    async forceTrackedFile(path) {
      await mkdir(dirname(join(repo, path)), { recursive: true })
      await writeFile(join(repo, path), 'synthetic tracked replacement\n')
      git(['add', '-f', '--', path])
      const tree = git(['write-tree'])
      git(['read-tree', '--empty'])
      return tree
    },
    trackedEntry(path, mode = '100644') {
      const blob = git(['hash-object', '-w', '--stdin'], { input: 'synthetic replacement\n' })
      git(['update-index', '--add', '--cacheinfo', mode, blob, path])
      const tree = git(['write-tree'])
      git(['read-tree', '--empty'])
      return tree
    },
  }
}

for (const path of [
  '.env',
  '.env.local',
  '.env.production.local',
  'node_modules/cache.js',
  'build/app.js',
  'dist/app.js',
  'coverage/report.html',
  'tmp/cache',
  'storage/uploads/tenant/image.jpg',
  'storage/seed-media/seed.jpg',
  'storage/uploads/tenant/line\nbreak.jpg',
]) {
  test(`real Git rejects forced tracking of reserved path ${JSON.stringify(path)}`, async (t) => {
    const f = await repository(t)
    const tree = await f.forceTrackedFile(path)
    const operational = 'synthetic operational state to preserve\n'
    await writeFile(join(f.repo, path), operational)

    const result = f.check(tree)

    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /rastreia caminho operacional reservado/)
    assert.equal(await readFile(join(f.repo, path), 'utf8'), operational)
    assert.equal(f.git(['ls-files']), '')
    assert.equal(f.git(['rev-list', '--all']), '', 'the temporary repository has no commits')
  })
}

for (const [path, mode] of [
  ['storage', '100644'],
  ['storage', '120000'],
  ['storage/uploads', '120000'],
  ['storage/seed-media', '100644'],
  ['node_modules', '120000'],
  ['build', '100644'],
  ['dist', '100644'],
  ['coverage', '100644'],
  ['tmp', '120000'],
  ['.env/child', '100644'],
  ['.env.local/child', '100644'],
  ['.env.production.local/child', '100644'],
]) {
  test(`real Git rejects ${mode} ${path} replacing operational state or its ancestor`, async (t) => {
    const f = await repository(t)
    const tree = f.trackedEntry(path, mode)
    await mkdir(join(f.repo, 'storage', 'uploads'), { recursive: true })
    await writeFile(join(f.repo, 'storage', 'uploads', 'keep.jpg'), 'synthetic live upload')
    await writeFile(join(f.repo, '.env'), 'SYNTHETIC_KEEP=1\n')

    const result = f.check(tree)

    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /rastreia caminho operacional reservado/)
    assert.equal(
      await readFile(join(f.repo, 'storage', 'uploads', 'keep.jpg'), 'utf8'),
      'synthetic live upload'
    )
    assert.equal(await readFile(join(f.repo, '.env'), 'utf8'), 'SYNTHETIC_KEEP=1\n')
  })
}

test('real Git accepts tracked source paths beside reserved operational paths', async (t) => {
  const f = await repository(t)
  for (const path of [
    '.env.example',
    '.env.test',
    'storage/seed/media/cover.png',
    'storage/uploads-readme.md',
    'build_notes.md',
    'app/service.ts',
  ]) {
    const tree = await f.forceTrackedFile(path)
    const result = f.check(tree)
    assert.equal(result.status, 0, `${path}: ${result.stderr}`)
  }
})

test('real Git failure to list a target tree fails closed', async (t) => {
  const f = await repository(t)
  const result = f.check('f'.repeat(40))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /não foi possível verificar caminhos reservados/)
})
