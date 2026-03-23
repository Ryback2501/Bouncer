import { describe, it, expect } from 'vitest'
import { cn } from '../components/shared/cn'

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('resolves Tailwind conflicts — last class wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('ignores falsy values', () => {
    expect(cn('px-4', undefined, false, null, 'py-2')).toBe('px-4 py-2')
  })

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles conditional class objects', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })
})
