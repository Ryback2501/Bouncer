import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AssignmentList } from '../pages/Assignments/AssignmentList'
import type { Assignment } from '../api/assignments'

vi.mock('../api/assignments', async () => {
  const actual = await vi.importActual<typeof import('../api/assignments')>('../api/assignments')
  return { ...actual, getAssignments: vi.fn() }
})

import { getAssignments } from '../api/assignments'

function row(overrides: Partial<Assignment>): Assignment {
  return {
    id: 'a-id',
    userId: 'u-id',
    applicationId: 'app-1',
    roleId: 'role-1',
    active: true,
    expiredAt: null,
    assignedAt: new Date().toISOString(),
    user: {
      id: 'u-id',
      name: 'Alice',
      email: 'alice@test.com',
      sub: 'sub-1',
      provider: 'google',
      isGlobalAdmin: false,
      createdAt: new Date().toISOString(),
    },
    role: { id: 'role-1', name: 'Admin', customId: 'admin' },
    application: { id: 'app-1', name: 'Bouncer', customId: 'bouncer' },
    ...overrides,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><AssignmentList /></MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AssignmentList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders one section per application (groups by app)', async () => {
    vi.mocked(getAssignments).mockResolvedValue([
      row({ id: 'a1' }),
      row({ id: 'a2', applicationId: 'app-2', application: { id: 'app-2', name: 'CMS', customId: 'cms' } }),
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('Bouncer')).toBeInTheDocument())
    expect(screen.getByText('CMS')).toBeInTheDocument()
  })

  it('renders status badges: Active / Inactive / Expired', async () => {
    vi.mocked(getAssignments).mockResolvedValue([
      row({ id: 'a1', user: { ...row({}).user, name: 'Active User' } }),
      row({ id: 'a2', active: false, user: { ...row({}).user, name: 'Inactive User' } }),
      row({
        id: 'a3',
        expiredAt: new Date(Date.now() - 86400_000).toISOString(),
        user: { ...row({}).user, name: 'Expired User' },
      }),
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('Active User')).toBeInTheDocument())
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('shows the empty state when there are no assignments', async () => {
    vi.mocked(getAssignments).mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument())
  })
})
