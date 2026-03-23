import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../components/shared/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick handler when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('variant="secondary" applies secondary classes', () => {
    render(<Button variant="secondary">Sec</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-white')
    expect(btn.className).toContain('border-gray-300')
  })

  it('variant="ghost" applies ghost classes', () => {
    render(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button').className).toContain('hover:bg-gray-100')
  })

  it('variant="danger" applies danger classes', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button').className).toContain('bg-red-600')
  })

  it('size="sm" applies small padding classes', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button').className).toContain('px-3')
  })
})
