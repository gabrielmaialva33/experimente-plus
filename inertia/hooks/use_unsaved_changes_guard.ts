import { router } from '@inertiajs/react'
import { useCallback, useEffect, useRef } from 'react'

type UnsavedChangesPredicate = boolean | (() => boolean)

interface UseUnsavedChangesGuardOptions {
  enabled: UnsavedChangesPredicate
  message?: string
}

interface UnsavedChangesGuard {
  allowNextVisit: () => void
  confirmDiscard: () => boolean
}

const DEFAULT_MESSAGE =
  'Existem alterações que ainda não foram salvas. Deseja sair e descartar essas mudanças?'

export function useUnsavedChangesGuard({
  enabled,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesGuardOptions): UnsavedChangesGuard {
  const enabledRef = useRef(enabled)
  const messageRef = useRef(message)
  const bypassNextVisitRef = useRef(false)

  enabledRef.current = enabled
  messageRef.current = message

  const allowNextVisit = useCallback(() => {
    // Inertia dispatches `before` synchronously at the beginning of a visit.
    // Consume one bypass for internal saves and targeted partial reloads. The
    // microtask reset avoids suppressing a later user visit when no visit starts.
    bypassNextVisitRef.current = true
    queueMicrotask(() => {
      bypassNextVisitRef.current = false
    })
  }, [])

  const shouldBlock = useCallback(() => {
    return typeof enabledRef.current === 'function' ? enabledRef.current() : enabledRef.current
  }, [])

  const confirmDiscard = useCallback(() => {
    return !shouldBlock() || window.confirm(messageRef.current)
  }, [shouldBlock])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldBlock()) return

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlock])

  useEffect(() => {
    return router.on('before', (event) => {
      if (!shouldBlock()) return

      if (bypassNextVisitRef.current) {
        bypassNextVisitRef.current = false
        return
      }

      if (!window.confirm(messageRef.current)) {
        event.preventDefault()
      }
    })
  }, [shouldBlock])

  return { allowNextVisit, confirmDiscard }
}
