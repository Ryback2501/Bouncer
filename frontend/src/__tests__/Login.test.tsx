import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Login } from '../pages/Login'

// Login reads window.location.search directly — no Router wrapper needed

describe('Login page', () => {
  it('renders the Bouncer heading', () => {
    render(<Login />)
    expect(screen.getByText('Bouncer')).toBeInTheDocument()
  })

  it('renders all three OAuth provider buttons', () => {
    render(<Login />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    expect(screen.getByText('Continue with Microsoft')).toBeInTheDocument()
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument()
  })

  it('Google button links to /auth/google', () => {
    render(<Login />)
    const link = screen.getByText('Continue with Google').closest('a')
    expect(link).toHaveAttribute('href', '/auth/google')
  })
})
