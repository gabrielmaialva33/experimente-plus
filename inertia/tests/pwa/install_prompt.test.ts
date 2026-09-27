import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  captureInstallPrompt,
  getInstallAvailability,
  promptInstall,
  resetInstallPrompt,
} from '~/pwa/install_prompt'

function installOffer(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = vi.fn(async () => {})
  event.userChoice = Promise.resolve({ outcome })
  return event
}

afterEach(() => {
  resetInstallPrompt()
})

describe('install prompt', () => {
  it('keeps the browser offer for later and holds back the automatic banner', () => {
    const target = new EventTarget()
    captureInstallPrompt(target)
    const offer = installOffer('accepted')

    target.dispatchEvent(offer)

    expect(offer.defaultPrevented).toBe(true)
    expect(getInstallAvailability()).toBe('available')
  })

  it('shows the browser dialog once and remembers an accepted install', async () => {
    const target = new EventTarget()
    captureInstallPrompt(target)
    const offer = installOffer('accepted')
    target.dispatchEvent(offer)

    await expect(promptInstall()).resolves.toBe('accepted')
    expect(offer.prompt).toHaveBeenCalledTimes(1)
    expect(getInstallAvailability()).toBe('installed')
    // The captured offer is spent.
    await expect(promptInstall()).resolves.toBe('unavailable')
  })

  it('drops a dismissed offer, since the browser will not show it twice', async () => {
    const target = new EventTarget()
    captureInstallPrompt(target)
    target.dispatchEvent(installOffer('dismissed'))

    await expect(promptInstall()).resolves.toBe('dismissed')
    expect(getInstallAvailability()).toBe('unavailable')
  })

  it('knows when the site was installed from the browser menu', () => {
    const target = new EventTarget()
    captureInstallPrompt(target)
    target.dispatchEvent(installOffer('accepted'))

    target.dispatchEvent(new Event('appinstalled'))
    expect(getInstallAvailability()).toBe('installed')
  })

  it('has nothing to offer where the browser never made an offer (Safari, Firefox)', async () => {
    expect(getInstallAvailability()).toBe('unavailable')
    await expect(promptInstall()).resolves.toBe('unavailable')
  })
})
