import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SkeletonList } from '../components/shared/SkeletonList'

describe('SkeletonList', () => {
  it('renders 3 skeleton elements by default', () => {
    const { container } = render(<SkeletonList />)
    const items = container.querySelectorAll('.animate-pulse')
    expect(items).toHaveLength(3)
  })

  it('applies the default height class h-16', () => {
    const { container } = render(<SkeletonList />)
    const items = container.querySelectorAll('.h-16')
    expect(items).toHaveLength(3)
  })

  it('renders the requested number of elements', () => {
    const { container } = render(<SkeletonList count={5} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
  })

  it('applies a custom height class', () => {
    const { container } = render(<SkeletonList height="h-24" />)
    const items = container.querySelectorAll('.h-24')
    expect(items).toHaveLength(3)
  })
})
