import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Topbar } from '../components/layout/Topbar'
import { AuthContext } from '../context/authContext'
import { MemoryRouter } from 'react-router-dom'
import type { Admin } from '../context/authContext'

const mockAdmin: Admin = { id: 'u1', name: 'Alice', email: 'alice@test.com', provider: 'google', isGlobalAdmin: true }

function renderTopbar(admin: Admin | null = mockAdmin) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ admin, isLoading: false, isGlobalAdmin: admin?.isGlobalAdmin ?? false }}>
        <Topbar onMenuClick={vi.fn()} title="Dashboard" />
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('Topbar', () => {
  it('renders the page title', () => {
    renderTopbar()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders admin name initial in avatar', () => {
    renderTopbar()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders "?" in avatar when no admin', () => {
    renderTopbar(null)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('shows user dropdown when avatar is clicked', () => {
    renderTopbar()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('hides dropdown when clicking outside', () => {
    renderTopbar()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('alice@test.com')).not.toBeInTheDocument()
  })
})
