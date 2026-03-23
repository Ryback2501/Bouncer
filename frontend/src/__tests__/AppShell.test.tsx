import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../context/authContext'
import { AppShell } from '../components/layout/AppShell'

const mockAdmin = { id: 'u1', name: 'Alice', email: 'alice@test.com', provider: 'google', isGlobalAdmin: true }

// Sidebar uses lucide-react icons — mock it to keep snapshots simple
vi.mock('../components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={{ admin: mockAdmin, isLoading: false, isGlobalAdmin: true }}>
        <Routes>
          <Route path="*" element={<AppShell />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('AppShell — page title', () => {
  it('/ → Dashboard', () => {
    renderAt('/')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('/users → Users', () => {
    renderAt('/users')
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('/users/:id → User Details', () => {
    renderAt('/users/abc123')
    expect(screen.getByText('User Details')).toBeInTheDocument()
  })

  it('/applications → Applications', () => {
    renderAt('/applications')
    expect(screen.getByText('Applications')).toBeInTheDocument()
  })

  it('/applications/:id/roles → Roles', () => {
    renderAt('/applications/abc/roles')
    expect(screen.getByText('Roles')).toBeInTheDocument()
  })

  it('/applications/:id/api-keys → API Keys', () => {
    renderAt('/applications/abc/api-keys')
    expect(screen.getByText('API Keys')).toBeInTheDocument()
  })

  it('/admins → Admin Access', () => {
    renderAt('/admins')
    expect(screen.getByText('Admin Access')).toBeInTheDocument()
  })

  it('unknown path → Bouncer', () => {
    renderAt('/unknown/path')
    expect(screen.getByText('Bouncer')).toBeInTheDocument()
  })
})
