import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NetworkNotice } from '~/components/network_notice'
import {
  NETWORK_NOTICE_MESSAGES,
  bindInertiaFailureNotice,
  dismissNetworkNotice,
  getNetworkNoticeState,
  showNetworkNotice,
} from '~/lib/network_notice'
import { render } from '~/tests/test_utils'

describe('NetworkNotice', () => {
  beforeEach(() => {
    dismissNetworkNotice()
  })

  it('stays hidden until a failure is reported', () => {
    render(<NetworkNotice />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces the failure and can be dismissed', async () => {
    const { user } = render(<NetworkNotice />)

    act(() => showNetworkNotice(NETWORK_NOTICE_MESSAGES.network))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(NETWORK_NOTICE_MESSAGES.network)

    await user.click(screen.getByRole('button', { name: 'Dispensar aviso' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getNetworkNoticeState().visible).toBe(false)
  })
})

describe('bindInertiaFailureNotice', () => {
  beforeEach(() => {
    dismissNetworkNotice()
  })

  it('binds each failure event once and suppresses the raw default handling', () => {
    const on = vi.fn()

    bindInertiaFailureNotice({ on })
    bindInertiaFailureNotice({ on }) // HMR re-evaluation must not duplicate listeners

    expect(on).toHaveBeenCalledTimes(2)
    expect(on).toHaveBeenCalledWith('networkError', expect.any(Function))
    expect(on).toHaveBeenCalledWith('httpException', expect.any(Function))

    const networkErrorCallback = on.mock.calls.find(([event]) => event === 'networkError')?.[1]
    const httpExceptionCallback = on.mock.calls.find(([event]) => event === 'httpException')?.[1]

    // Returning false cancels Inertia's default (raw modal / rejected promise).
    expect(networkErrorCallback()).toBe(false)
    expect(getNetworkNoticeState()).toEqual({
      visible: true,
      message: NETWORK_NOTICE_MESSAGES.network,
    })

    expect(httpExceptionCallback()).toBe(false)
    expect(getNetworkNoticeState()).toEqual({
      visible: true,
      message: NETWORK_NOTICE_MESSAGES.server,
    })
  })
})
