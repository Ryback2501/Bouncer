import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InvitationList } from '../pages/Invitations/InvitationList'
import type { Invitation } from '../api/invitations'

vi.mock('../api/invitations', async () => {
  const actual = await vi.importActual<typeof import('../api/invitations')>('../api/invitations')
  return { ...actual, getInvitations: vi.fn(), createInvitation: vi.fn(), deleteInvitation: vi.fn() }
})

vi.mock('../api/applications', () => ({ getApplications: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/roles', () => ({ getRoles: vi.fn().mockResolvedValue([]) }))

import { getInvitations } from '../api/invitations'

function inv(overrides: Partial<Invitation>): Invitation {
  return {
    id: 'i-id',
    applicationId: 'app-1',
    roleId: 'role-1',
    redirectUri: null,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
    createdBy: { name: 'Test Admin', email: 'admin@test.com' },
    application: { id: 'app-1', name: 'Bouncer', customId: 'bouncer' },
    role: { id: 'role-1', name: 'Admin', customId: 'admin' },
    ...overrides,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><InvitationList /></MemoryRouter>
    </QueryClientProvider>
  )
}

describe('InvitationList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders one section per application (groups by app)', async () => {
    vi.mocked(getInvitations).mockResolvedValue([
      inv({ id: 'i1' }),
      inv({ id: 'i2', applicationId: 'app-2', application: { id: 'app-2', name: 'CMS', customId: 'cms' } }),
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('Bouncer')).toBeInTheDocument())
    expect(screen.getByText('CMS')).toBeInTheDocument()
  })

  it('clicking "Create Invitation" opens the create modal', async () => {
    vi.mocked(getInvitations).mockResolvedValue([inv({})])
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /create invitation/i })[0]).toBeEnabled())
    fireEvent.click(screen.getAllByRole('button', { name: /create invitation/i })[0])
    await waitFor(() => expect(screen.getByText(/select an application/i)).toBeInTheDocument())
  })

  it('shows the empty state and a create button when there are no invitations', async () => {
    vi.mocked(getInvitations).mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no invitations yet/i)).toBeInTheDocument())
  })
})
