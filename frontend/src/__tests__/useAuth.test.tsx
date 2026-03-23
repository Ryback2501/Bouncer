import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '../context/authContext'
import { useAuth } from '../context/useAuth'

const mockAdmin = { id: 'u1', name: 'Alice', email: 'alice@test.com', provider: 'google', isGlobalAdmin: true }

function ConsumerComponent() {
  const { admin, isLoading, isGlobalAdmin } = useAuth()
  return (
    <div>
      <span data-testid="name">{admin?.name ?? 'none'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="global">{String(isGlobalAdmin)}</span>
    </div>
  )
}

describe('useAuth', () => {
  it('returns context values when inside AuthContext.Provider', () => {
    const value: AuthContextValue = { admin: mockAdmin, isLoading: false, isGlobalAdmin: true }
    render(
      <AuthContext.Provider value={value}>
        <ConsumerComponent />
      </AuthContext.Provider>
    )
    expect(screen.getByTestId('name').textContent).toBe('Alice')
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('global').textContent).toBe('true')
  })

  it('returns the context default (admin: null, isLoading: true) when used without a provider', () => {
    render(<ConsumerComponent />)
    expect(screen.getByTestId('name').textContent).toBe('none')
    expect(screen.getByTestId('loading').textContent).toBe('true')
    expect(screen.getByTestId('global').textContent).toBe('false')
  })
})
