import { describe, it, expect, vi, afterEach } from 'vitest'

// Access the axios interceptor's rejected handler directly from the client instance
import client from '../api/client'

type InterceptorHandler = {
  fulfilled: ((res: unknown) => unknown) | null
  rejected: ((err: unknown) => unknown) | null
}

const interceptorManager = client.interceptors.response as unknown as {
  handlers: InterceptorHandler[]
}

const rejectedHandler = interceptorManager.handlers.find(h => h?.rejected)?.rejected

if (!rejectedHandler) {
  throw new Error('Could not find response interceptor rejected handler on api client')
}

function makeError(status: number) {
  return { response: { status } }
}

describe('api/client 401 interceptor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to /login on 401 when not already on /login', async () => {
    vi.stubGlobal('location', { pathname: '/users', href: '' })

    await expect(rejectedHandler(makeError(401))).rejects.toBeDefined()
    expect(window.location.href).toBe('/login')
  })

  it('does NOT redirect when already on /login (avoids redirect loop)', async () => {
    vi.stubGlobal('location', { pathname: '/login', href: '' })

    await expect(rejectedHandler(makeError(401))).rejects.toBeDefined()
    expect(window.location.href).toBe('')
  })

  it('does not redirect for non-401 errors', async () => {
    vi.stubGlobal('location', { pathname: '/users', href: '' })

    await expect(rejectedHandler(makeError(403))).rejects.toBeDefined()
    expect(window.location.href).toBe('')
  })

  it('does not redirect when error has no response', async () => {
    vi.stubGlobal('location', { pathname: '/dashboard', href: '' })

    await expect(rejectedHandler(new Error('network error'))).rejects.toBeDefined()
    expect(window.location.href).toBe('')
  })
})
