import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parse } from 'yaml'

test('CI checks out and sends the same github.sha through the forced-command protocol', async () => {
  const source = await readFile(
    new URL('../../.github/workflows/ci-cd.yml', import.meta.url),
    'utf8'
  )
  const workflow = parse(source)
  const checkJobs = Object.keys(workflow.jobs).filter((name) => name !== 'deploy')
  const deploy = workflow.jobs.deploy.steps.find((step) => step.name === 'Deploy')

  // Every check validates the same commit the deploy sends, and the deploy
  // waits for every check: a job added later cannot be skipped by accident.
  assert.ok(checkJobs.length > 0)
  for (const name of checkJobs) {
    const checkout = workflow.jobs[name].steps.find((step) =>
      step.uses?.startsWith('actions/checkout@')
    )
    assert.equal(checkout?.with?.ref, '${{ github.sha }}', `${name} checks out github.sha`)
  }
  assert.deepEqual([...workflow.jobs.deploy.needs].sort(), [...checkJobs].sort())
  assert.equal(deploy.env.DEPLOY_REVISION, '${{ github.sha }}')
  // A deploy already started is never cancelled by a newer push.
  assert.equal(workflow.jobs.deploy.concurrency['cancel-in-progress'], false)
  assert.ok(deploy.run.includes('[[ "$DEPLOY_REVISION" =~ ^[0-9a-f]{40}$ ]] || exit 1'))
  assert.ok(deploy.run.includes('"deploy $DEPLOY_REVISION"'))
})

test('CI timeout retains a recovery margin over the bounded bootstrap and rollback path', async () => {
  const workflowSource = await readFile(
    new URL('../../.github/workflows/ci-cd.yml', import.meta.url),
    'utf8'
  )
  const deploySource = await readFile(new URL('../../deploy.sh', import.meta.url), 'utf8')
  const workflow = parse(workflowSource)
  const jobMinutes = workflow.jobs.deploy['timeout-minutes']
  const stepMinutes = workflow.jobs.deploy.steps.find((step) => step.name === 'Deploy')[
    'timeout-minutes'
  ]

  // Conservative sum of every configured timeout/kill grace on the first
  // bootstrap, a failure after NEW validation, and a complete GOOD rollback.
  const worstCaseSeconds = 3500
  const recoveryMarginSeconds = 10 * 60
  assert.ok(stepMinutes * 60 >= worstCaseSeconds + recoveryMarginSeconds)
  assert.ok(jobMinutes >= stepMinutes + 5)
  assert.match(deploySource, /build\)\s+limit=600/)
  assert.match(deploySource, /stop\) limit=60/)
  assert.match(deploySource, /config\|ps\) limit=30/)
  assert.match(deploySource, /timeout --kill-after=10s 600 docker wait/)
  assert.match(deploySource, /timeout --kill-after=5s 45 bash/)
  assert.match(deploySource, /\+refs\/heads\/master:refs\/heads\/deploy-approved-master/)
  assert.match(deploySource, /READY_TIMEOUT > 120/)
})

test('publishing LKG crosses the verified commit point before directory fsync can fail', async () => {
  const source = await readFile(new URL('../../deploy.sh', import.meta.url), 'utf8')
  const record = source.slice(
    source.indexOf('record_good_release() {'),
    source.indexOf('\nrollback() {')
  )
  const rename = record.indexOf('mv -f -- "$RUN_DIR/last-known-good" "$STATE_DIR/last-known-good"')
  const verified = record.indexOf('DEPLOY_VERIFIED=1')
  const directorySync = record.indexOf('/usr/bin/sync -f -- "$STATE_DIR"')
  assert.ok(rename >= 0 && rename < verified && verified < directorySync)
  assert.match(source, /record_good_release "\$NEW_REVISION" "\$NEW_IMAGE" "\$NEW_SMOKE" true/)
})

test('cleans stale deployment migration writers before repository preparation', async () => {
  const source = await readFile(new URL('../../deploy.sh', import.meta.url), 'utf8')
  const main = source.slice(source.indexOf('main() {'))
  const cleanup = main.indexOf('cleanup_migration_containers')
  const fetch = main.indexOf('fetch_approved_revision')
  assert.ok(cleanup >= 0 && cleanup < fetch)
})
