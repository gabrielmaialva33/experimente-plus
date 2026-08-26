import { WifiOff, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import {
  dismissNetworkNotice,
  getNetworkNoticeState,
  getServerNetworkNoticeState,
  subscribeToNetworkNotice,
} from '~/lib/network_notice'

/**
 * Global banner for failed Inertia visits (network down, server exception).
 * Hidden by default, so it hydrates as an empty node and never mismatches SSR.
 */
export function NetworkNotice() {
  const state = useSyncExternalStore(
    subscribeToNetworkNotice,
    getNetworkNoticeState,
    getServerNetworkNoticeState
  )

  if (!state.visible) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-destructive/25 bg-background px-4 py-3 text-sm shadow-lg"
    >
      <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span className="flex-1 leading-5 text-foreground">{state.message}</span>
      <button
        type="button"
        onClick={dismissNetworkNotice}
        aria-label="Dispensar aviso"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
