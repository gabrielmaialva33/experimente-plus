import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const mapsUrl = new URL('../../infra/nginx/experimente-plus-header-maps.conf', import.meta.url)
const virtualHostUrl = new URL('../../infra/nginx/experimente-plus.conf', import.meta.url)
const installerUrl = new URL(
  '../../infra/nginx/install_experimente_plus_config.sh',
  import.meta.url
)
const runbookUrl = new URL('../../docs/runbooks/nginx_security_headers.md', import.meta.url)

const HEADER_CONTRACTS = [
  ['X-Frame-Options', '$experimente_plus_x_frame_options'],
  ['X-Content-Type-Options', '$experimente_plus_x_content_type_options'],
  ['Strict-Transport-Security', '$experimente_plus_hsts'],
  ['Referrer-Policy', '$experimente_plus_referrer_policy'],
]

test('Nginx canonicalizes upstream security headers without weakening private responses', async () => {
  const maps = await readFile(mapsUrl, 'utf8')
  const virtualHost = await readFile(virtualHostUrl, 'utf8')

  for (const [header, variable] of HEADER_CONTRACTS) {
    const upstreamVariable = `$upstream_http_${header.toLowerCase().replaceAll('-', '_')}`
    assert.match(maps, new RegExp(`map \\${upstreamVariable} \\${variable} \\{`))
    assert.match(maps, new RegExp(`default \\${upstreamVariable};`))
    assert.equal(
      virtualHost.match(new RegExp(`proxy_hide_header ${header};`, 'g'))?.length,
      1,
      `${header} must be hidden exactly once`
    )
    assert.equal(
      virtualHost.match(new RegExp(`add_header ${header} \\${variable} always;`, 'g'))?.length,
      1,
      `${header} must be re-emitted exactly once`
    )
  }

  assert.match(maps, /""\s+"DENY";/)
  assert.match(maps, /""\s+"nosniff";/)
  assert.match(maps, /""\s+"max-age=15552000";/)
  assert.match(maps, /""\s+"strict-origin-when-cross-origin";/)
  assert.equal(virtualHost.match(/proxy_hide_header X-XSS-Protection;/g)?.length, 1)
  assert.equal(virtualHost.match(/add_header X-XSS-Protection "0" always;/g)?.length, 1)
  assert.equal(virtualHost.match(/location \/ \{/g)?.length, 1)
})

test('Nginx installer validates before reload and retains an automatic rollback path', async () => {
  const [installer, runbook] = await Promise.all([
    readFile(installerUrl, 'utf8'),
    readFile(runbookUrl, 'utf8'),
  ])

  assert.match(installer, /^#!\/usr\/bin\/env bash\nset -Eeuo pipefail/)
  assert.match(installer, /PATH=\/usr\/sbin:\/usr\/bin:\/sbin:\/bin\nexport PATH/)
  assert.match(installer, /stat -c '%U:%G:%a' "\$SCRIPT_SOURCE"\) == root:root:500/)
  assert.match(installer, /flock -n 9/)
  assert.match(installer, /\[\[ -d "\$BACKUP_DIRECTORY" && ! -L "\$BACKUP_DIRECTORY" \]\]/)
  assert.match(runbook, /stage_dir=\$\(mktemp -d \/run\/experimente-plus-nginx\.XXXXXX\)/)
  assert.match(runbook, /trap cleanup EXIT/)
  assert.match(
    runbook,
    /install -o root -g root -m 0500 infra\/nginx\/install_experimente_plus_config\.sh/
  )
  assert.match(runbook, /\/usr\/bin\/bash -n "\$staged_installer"/)
  assert.match(runbook, /\/usr\/bin\/bash "\$staged_installer" "\$staged_maps" "\$staged_site"/)
  assert.match(installer, /site_backup=.*\$site_sha\.conf/)
  assert.match(installer, /map_backup=.*\$map_sha\.conf/)
  assert.match(installer, /replacement_started=1/)
  assert.match(installer, /replacement_verified=1/)
  assert.match(installer, /if ! restore_previous_config/)

  assert.match(installer, /^[ \t]*nginx -t \|\| return 1$/m)
  assert.match(installer, /^[ \t]*systemctl reload nginx \|\| return 1$/m)

  const testOffsets = [...installer.matchAll(/^[ \t]*nginx -t(?: \|\| return 1)?$/gm)].map(
    (match) => match.index ?? -1
  )
  const reloadOffsets = [
    ...installer.matchAll(/^[ \t]*systemctl reload nginx(?: \|\| return 1)?$/gm),
  ].map((match) => match.index ?? -1)
  assert.equal(testOffsets.length, 3)
  assert.equal(reloadOffsets.length, 2)
  assert.ok(testOffsets[0] < reloadOffsets[0], 'rollback must validate before reload')
  assert.ok(
    testOffsets[1] < installer.indexOf('replacement_started=1'),
    'current configuration must validate before replacement'
  )
  assert.ok(
    testOffsets[2] < reloadOffsets[1],
    'candidate configuration must validate before reload'
  )
  assert.ok(
    reloadOffsets[1] < installer.lastIndexOf('replacement_verified=1'),
    'reload must complete before verification'
  )
})
