import { vi, describe, it, expect } from 'vitest'

// Pins the wiring, not the logic. The serializers are unit-tested in httpLogSerializers.test.ts,
// but deleting them from the pinoHttp() call would leave every one of those tests green while
// quietly reinstating the leak — nothing else would notice.
const pinoHttpMock = vi.hoisted(() => vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()))
vi.mock('pino-http', () => ({ default: pinoHttpMock }))
vi.mock('../prisma', () => ({ prisma: { $queryRaw: vi.fn() } }))

import { createApp } from '../app'
import { redactReq, redactRes } from '../lib/httpLogSerializers'

describe('request logging wiring', () => {
  it('installs the redacting serializers on pino-http', () => {
    createApp()

    expect(pinoHttpMock).toHaveBeenCalledOnce()
    const [options] = pinoHttpMock.mock.calls[0] as unknown as [
      { serializers?: { req?: unknown; res?: unknown } },
    ]
    expect(options.serializers?.req).toBe(redactReq)
    expect(options.serializers?.res).toBe(redactRes)
  })

  // The container HEALTHCHECK (B-22) probes /health every 30 s; those probes are not logged, so they
  // do not bury real traffic. Everything else still is.
  it('skips only the health probe', () => {
    pinoHttpMock.mockClear()
    createApp()
    const [options] = pinoHttpMock.mock.calls[0] as unknown as [
      { autoLogging?: { ignore?: (req: { url?: string }) => boolean } },
    ]
    const ignore = options.autoLogging?.ignore
    expect(ignore).toBeTypeOf('function')
    expect(ignore!({ url: '/health' })).toBe(true)
    for (const url of ['/admin/users', '/healthcheck', '/health?x=1', '/api/v1/health', '/']) {
      expect(ignore!({ url })).toBe(false)
    }
  })
})
