import { afterEach, describe, expect, it, vi } from 'vitest'

import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { render, screen } from '~/tests/test_utils'

const inertiaEvents = vi.hoisted(() => ({
  before: undefined as ((event: CustomEvent) => void) | undefined,
  unsubscribe: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  router: {
    on: (name: string, listener: (event: CustomEvent) => void) => {
      if (name === 'before') inertiaEvents.before = listener
      return inertiaEvents.unsubscribe
    },
  },
}))

function GuardHarness({ enabled, onAllow }: { enabled: boolean; onAllow?: () => void }) {
  const { allowNextVisit } = useUnsavedChangesGuard({ enabled })
  return (
    <button
      type="button"
      onClick={() => {
        allowNextVisit()
        onAllow?.()
      }}
    >
      Permitir próxima navegação
    </button>
  )
}

describe('useUnsavedChangesGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    inertiaEvents.before = undefined
    inertiaEvents.unsubscribe.mockClear()
  })

  it('cancels an Inertia visit when the user keeps unsaved changes', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<GuardHarness enabled />)

    const event = new CustomEvent('inertia:before', { cancelable: true })
    inertiaEvents.before?.(event)

    expect(confirm).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('allows one internal visit without suppressing the next user warning', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const internalVisit = new CustomEvent('inertia:before', { cancelable: true })
    const { user } = render(
      <GuardHarness
        enabled
        onAllow={() => {
          inertiaEvents.before?.(internalVisit)
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: /permitir próxima navegação/i }))
    expect(internalVisit.defaultPrevented).toBe(false)
    expect(confirm).not.toHaveBeenCalled()

    const userVisit = new CustomEvent('inertia:before', { cancelable: true })
    inertiaEvents.before?.(userVisit)
    expect(userVisit.defaultPrevented).toBe(true)
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('registers a native unload warning only while blocking is enabled', () => {
    const { rerender } = render(<GuardHarness enabled />)

    const blockedEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(blockedEvent)
    expect(blockedEvent.defaultPrevented).toBe(true)

    rerender(<GuardHarness enabled={false} />)
    const allowedEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(allowedEvent)
    expect(allowedEvent.defaultPrevented).toBe(false)
  })
})
