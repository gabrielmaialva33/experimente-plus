/**
 * Tiny store for the global Inertia visit-failure notice. Framework-free so it
 * can be bound in the app bootstrap and tested without rendering the app.
 */

export interface NetworkNoticeState {
  visible: boolean
  message: string
}

type NetworkNoticeListener = () => void

export const NETWORK_NOTICE_MESSAGES = {
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  server: 'Algo deu errado ao processar sua solicitação. Tente novamente em instantes.',
} as const

const HIDDEN_STATE: NetworkNoticeState = { visible: false, message: '' }

let state: NetworkNoticeState = HIDDEN_STATE
const listeners = new Set<NetworkNoticeListener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeToNetworkNotice(listener: NetworkNoticeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getNetworkNoticeState(): NetworkNoticeState {
  return state
}

export function getServerNetworkNoticeState(): NetworkNoticeState {
  return HIDDEN_STATE
}

export function showNetworkNotice(message: string): void {
  state = { visible: true, message }
  emit()
}

export function dismissNetworkNotice(): void {
  if (!state.visible) return
  state = HIDDEN_STATE
  emit()
}

interface InertiaFailureEvents {
  networkError: unknown
  httpException: unknown
}

interface RouterLike {
  on: <TEvent extends keyof InertiaFailureEvents>(event: TEvent, callback: () => boolean) => unknown
}

const BIND_FLAG = '__experimenteNetworkNoticeBound'

/**
 * Binds the Inertia failure events once per browser session. The flag lives on
 * `window` (not module state) so HMR re-evaluations never duplicate listeners.
 * Both callbacks return `false` to cancel Inertia's default handling — the raw
 * error modal / promise rejection — and surface a friendly notice instead.
 */
export function bindInertiaFailureNotice(router: RouterLike): void {
  if (typeof window === 'undefined') return

  const globalScope = window as typeof window & Record<string, unknown>
  if (globalScope[BIND_FLAG]) return
  globalScope[BIND_FLAG] = true

  router.on('networkError', () => {
    showNetworkNotice(NETWORK_NOTICE_MESSAGES.network)
    return false
  })

  router.on('httpException', () => {
    showNetworkNotice(NETWORK_NOTICE_MESSAGES.server)
    return false
  })
}
