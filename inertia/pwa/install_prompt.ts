import { useSyncExternalStore } from 'react'

/**
 * Chromium's install offer (`beforeinstallprompt`), kept until a page asks for
 * it. The event fires once, early, on whichever page the visit starts, so it
 * is captured at boot and not by the page that shows the button.
 *
 * Capturing it also holds back Chrome's automatic install banner on Android:
 * there the downloadable app is the main path, and the site is offered where
 * the choice is explained, on /app. Chrome's own menu keeps its install item.
 */

export type InstallAvailability = 'unavailable' | 'available' | 'installed'
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Listener = () => void

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<Listener>()
const captured = new WeakSet<EventTarget>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getInstallAvailability(): InstallAvailability {
  if (installed) return 'installed'
  return deferred ? 'available' : 'unavailable'
}

const getServerAvailability = (): InstallAvailability => 'unavailable'

export function captureInstallPrompt(target: EventTarget) {
  if (captured.has(target)) return
  captured.add(target)

  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    emit()
  })

  target.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

/** Opens the browser's own install dialog. Each captured offer can be used once. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred
  if (!event) return 'unavailable'

  deferred = null
  emit()
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === 'accepted') {
    installed = true
    emit()
  }
  return outcome
}

export function useInstallAvailability(): InstallAvailability {
  return useSyncExternalStore(subscribe, getInstallAvailability, getServerAvailability)
}

/** Test seam: forget any captured offer between cases. */
export function resetInstallPrompt() {
  deferred = null
  installed = false
  emit()
}
