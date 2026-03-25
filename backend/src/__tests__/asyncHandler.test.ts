import { describe, it, expect, vi } from 'vitest'
import { asyncHandler } from '../lib/asyncHandler'
import type { Request, Response, NextFunction } from 'express'

const req = {} as Request
const res = {} as Response

describe('asyncHandler', () => {
  it('does not call next with error when handler resolves', async () => {
    const next = vi.fn() as unknown as NextFunction
    const handler = asyncHandler(async (_req, _res) => { /* resolves */ })
    await handler(req, res, next)
    expect(next).not.toHaveBeenCalledWith(expect.any(Error))
  })

  it('calls next with error when handler rejects', async () => {
    const next = vi.fn() as unknown as NextFunction
    const err = new Error('boom')
    const handler = asyncHandler(async () => { throw err })
    await handler(req, res, next)
    expect(next).toHaveBeenCalledWith(err)
  })

  it('calls next with error when handler throws synchronously inside async', async () => {
    const next = vi.fn() as unknown as NextFunction
    const err = new Error('sync throw')
    const handler = asyncHandler(async () => {
      throw err
    })
    await handler(req, res, next)
    expect(next).toHaveBeenCalledWith(err)
  })
})
