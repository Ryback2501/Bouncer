import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../components/shared/EmptyState'
import { Users } from 'lucide-react'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState icon={Users} title="No users yet" />)
    expect(screen.getByText('No users yet')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState icon={Users} title="No users yet" description="Add your first user." />)
    expect(screen.getByText('Add your first user.')).toBeInTheDocument()
  })

  it('does not render description when omitted', () => {
    render(<EmptyState icon={Users} title="No users yet" />)
    expect(screen.queryByText('Add your first user.')).not.toBeInTheDocument()
  })

  it('renders action slot when provided', () => {
    render(<EmptyState icon={Users} title="No users" action={<button>Add User</button>} />)
    expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument()
  })
})
