import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../components/shared/Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies green variant styles', () => {
    render(<Badge variant="green">Active</Badge>)
    expect(screen.getByText('Active').className).toContain('bg-green-100')
  })

  it('applies red variant styles', () => {
    render(<Badge variant="red">Expired</Badge>)
    expect(screen.getByText('Expired').className).toContain('bg-red-100')
  })

  it('applies blue variant styles', () => {
    render(<Badge variant="blue">Info</Badge>)
    expect(screen.getByText('Info').className).toContain('bg-blue-100')
  })

  it('applies gray variant by default', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default').className).toContain('bg-gray-100')
  })
})
