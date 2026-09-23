import '@testing-library/jest-dom/vitest'
import { server } from './mocks/server'
import { QueryClient } from '@tanstack/react-query'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// Mock InertiaJS
//
// `Link` has to render a real anchor. The mock used to return only the
// children, which dropped the destination from the markup entirely: an
// assertion about where a link points could not fail, and a component that
// forgot to link at all still looked correct. Inertia's own props are removed
// so React does not receive unknown DOM attributes; everything else, `href`
// included, reaches the anchor exactly as the component passed it.
vi.mock('@inertiajs/react', async () => {
  const { createElement } = await import('react')
  const inertiaOnlyProps = new Set([
    'method',
    'as',
    'data',
    'headers',
    'replace',
    'preserveScroll',
    'preserveState',
    'only',
    'except',
    'queryStringArrayFormat',
    'async',
    'prefetch',
    'cacheFor',
    'onCancelToken',
    'onBefore',
    'onStart',
    'onProgress',
    'onFinish',
    'onCancel',
    'onSuccess',
    'onError',
  ])

  return {
    usePage: vi.fn(() => ({
      props: {},
    })),
    Link: vi.fn(({ children, ...props }: Record<string, unknown>) =>
      createElement(
        'a',
        Object.fromEntries(Object.entries(props).filter(([name]) => !inertiaOnlyProps.has(name))),
        children as never
      )
    ),
    router: {
      visit: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Reset React Query client
afterEach(() => {
  queryClient.clear()
})

// Create a new QueryClient for each test
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
  },
})
