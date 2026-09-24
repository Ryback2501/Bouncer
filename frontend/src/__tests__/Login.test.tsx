import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Login } from '../pages/Login'

// Login reads window.location.search directly — no Router wrapper needed

describe('Login page', () => {
  it('renders the Bouncer heading', () => {
    render(<Login />)
    expect(screen.getByText('Bouncer')).toBeInTheDocument()
  })

  it('renders all four OAuth provider buttons', () => {
    render(<Login />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    expect(screen.getByText('Continue with Microsoft')).toBeInTheDocument()
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
    expect(screen.getByText('Continue with LinkedIn')).toBeInTheDocument()
  })

  it('Google button links to /auth/google', () => {
    render(<Login />)
    const link = screen.getByText('Continue with Google').closest('a')
    expect(link).toHaveAttribute('href', '/auth/google')
  })

  // The page used to append an ?invite= query parameter it read from its own URL. Nothing ever
  // generated that link, and a token in a URL is a token in an access log — the branch is gone and
  // must not come back.
  it('provider links never carry a query string, even with ?invite= in the address', () => {
    window.history.replaceState({}, '', '/login?invite=sometoken')
    render(<Login />)
    for (const name of ['Google', 'Microsoft', 'GitHub', 'LinkedIn']) {
      const href = screen.getByText(`Continue with ${name}`).closest('a')!.getAttribute('href')!
      expect(href).not.toContain('?')
      expect(href).not.toContain('sometoken')
    }
  })
})
