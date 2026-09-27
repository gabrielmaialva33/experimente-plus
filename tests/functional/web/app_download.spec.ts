import { test } from '@japa/runner'

import appDistribution from '#config/app_distribution'

test.group('App download page', () => {
  test('hands out the Android beta without an account', async ({ client, assert }) => {
    const response = await client.get('/app')

    response.assertStatus(200)
    const page = response.text()
    assert.include(page, 'app/download')
    // The fixed "latest" link, so the page never has to change it between releases.
    assert.include(page, appDistribution.android.downloadUrl)
    assert.match(appDistribution.android.downloadUrl, /\/releases\/latest\/download\/[\w-]+\.apk$/)
    assert.equal(appDistribution.android.channel, 'beta')
  })

  test('draws a QR code that opens the page itself on a phone', async ({ client, assert }) => {
    const response = await client.get('/app')

    const props = JSON.stringify(response.text())
    assert.include(props, '<svg')
    assert.match(response.text(), /pageUrl[^,]*\/app/)
  })
})
