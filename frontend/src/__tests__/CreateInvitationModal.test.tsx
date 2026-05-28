import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CreateInvitationModal } from '../pages/Invitations/CreateInvitationModal'

vi.mock('../api/applications', () => ({ getApplications: vi.fn() }))
vi.mock('../api/roles', () => ({ getRoles: vi.fn() }))
vi.mock('../api/invitations', () => ({ createInvitation: vi.fn() }))

import { getApplications } from '../api/applications'
import { getRoles } from '../api/roles'
import { createInvitation } from '../api/invitations'

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CreateInvitationModal open={true} onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CreateInvitationModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cascades: picking an application populates the roles dropdown', async () => {
    vi.mocked(getApplications).mockResolvedValue([
      { id: 'app-1', name: 'Bouncer', customId: 'bouncer', redirectUris: [], createdAt: '', updatedAt: '' },
      { id: 'app-2', name: 'CMS', customId: 'cms', redirectUris: [], createdAt: '', updatedAt: '' },
    ])
    vi.mocked(getRoles).mockResolvedValue([
      { id: 'role-1', name: 'Editor', customId: 'editor', applicationId: 'app-2', createdAt: '' },
    ])

    renderModal()
    await waitFor(() => expect(screen.getByText('CMS')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/application/i), { target: { value: 'app-2' } })

    await waitFor(() => expect(screen.getByText('Editor')).toBeInTheDocument())
  })

  it('submitting calls createInvitation with the chosen application + role', async () => {
    vi.mocked(getApplications).mockResolvedValue([
      { id: 'app-2', name: 'CMS', customId: 'cms', redirectUris: [], createdAt: '', updatedAt: '' },
    ])
    vi.mocked(getRoles).mockResolvedValue([
      { id: 'role-1', name: 'Editor', customId: 'editor', applicationId: 'app-2', createdAt: '' },
    ])
    vi.mocked(createInvitation).mockResolvedValue({
      id: 'i1', applicationId: 'app-2', roleId: 'role-1', redirectUri: null,
      expiresAt: '', usedAt: null, createdAt: '', createdBy: null,
      application: { id: 'app-2', name: 'CMS', customId: 'cms' },
      role: { id: 'role-1', name: 'Editor', customId: 'editor' },
      inviteUrl: 'http://localhost/invite/abc',
    })

    renderModal()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Editor' })).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'role-1' } })
    fireEvent.click(screen.getByRole('button', { name: /create invitation/i }))

    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith({
      applicationId: 'app-2',
      roleId: 'role-1',
      redirectUri: undefined,
    }))
  })

  it('shows the invite link after successful creation', async () => {
    vi.mocked(getApplications).mockResolvedValue([
      { id: 'app-2', name: 'CMS', customId: 'cms', redirectUris: [], createdAt: '', updatedAt: '' },
    ])
    vi.mocked(getRoles).mockResolvedValue([
      { id: 'role-1', name: 'Editor', customId: 'editor', applicationId: 'app-2', createdAt: '' },
    ])
    vi.mocked(createInvitation).mockResolvedValue({
      id: 'i1', applicationId: 'app-2', roleId: 'role-1', redirectUri: null,
      expiresAt: '', usedAt: null, createdAt: '', createdBy: null,
      application: { id: 'app-2', name: 'CMS', customId: 'cms' },
      role: { id: 'role-1', name: 'Editor', customId: 'editor' },
      inviteUrl: 'http://localhost/invite/abc',
    })

    renderModal()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Editor' })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'role-1' } })
    fireEvent.click(screen.getByRole('button', { name: /create invitation/i }))

    await waitFor(() => expect(screen.getByText('http://localhost/invite/abc')).toBeInTheDocument())
  })

  it('rejects a redirectUri whose origin is not in the application allowlist', async () => {
    vi.mocked(getApplications).mockResolvedValue([
      { id: 'app-2', name: 'CMS', customId: 'cms',
        redirectUris: ['https://app.example.com'], createdAt: '', updatedAt: '' },
    ])
    vi.mocked(getRoles).mockResolvedValue([
      { id: 'role-1', name: 'Editor', customId: 'editor', applicationId: 'app-2', createdAt: '' },
    ])

    renderModal()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Editor' })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'role-1' } })
    fireEvent.change(screen.getByLabelText(/redirect uri/i), {
      target: { value: 'https://evil.example.com/x' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create invitation/i }))

    await waitFor(() => expect(screen.getByText(/origin not in this application/i)).toBeInTheDocument())
    expect(createInvitation).not.toHaveBeenCalled()
  })
})
