import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, mockToast } from './testUtils'
import { AdminList } from '../pages/Admins/AdminList'

vi.mock('../api/invitations', () => ({
  getAdmins: vi.fn(),
  getInvitations: vi.fn(),
  createInvitation: vi.fn(),
  deleteInvitation: vi.fn(),
}))

import { getAdmins, getInvitations, createInvitation, deleteInvitation } from '../api/invitations'

const mockAdmin = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@test.com',
  provider: 'google',
  isGlobalAdmin: true,
  createdAt: '2024-01-01T00:00:00Z',
}

const futureDate = new Date(Date.now() + 86_400_000).toISOString()
const pastDate = new Date(Date.now() - 86_400_000).toISOString()

const pendingInvitation = {
  id: 'inv1',
  token: 'tok1',
  expiresAt: futureDate,
  usedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  createdBy: { name: 'Alice', email: 'alice@test.com' },
  inviteUrl: 'http://localhost/invite/tok1',
}

const usedInvitation = {
  ...pendingInvitation,
  id: 'inv2',
  usedAt: '2024-01-02T00:00:00Z',
}

const expiredInvitation = {
  ...pendingInvitation,
  id: 'inv3',
  expiresAt: pastDate,
}

describe('AdminList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows admin name in table', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
  })

  it('shows Global Admin badge', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('Global Admin')).toBeInTheDocument())
  })

  it('shows Admin badge for non-global admin', async () => {
    vi.mocked(getAdmins).mockResolvedValue([{ ...mockAdmin, isGlobalAdmin: false }])
    vi.mocked(getInvitations).mockResolvedValue([])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument())
  })

  it('shows empty state when no admins', async () => {
    vi.mocked(getAdmins).mockResolvedValue([])
    vi.mocked(getInvitations).mockResolvedValue([])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('No admins')).toBeInTheDocument())
  })

  it('shows empty state when no invitations', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('No invitations yet')).toBeInTheDocument())
  })

  it('renders pending invitation with Pending badge', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([pendingInvitation])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument())
  })

  it('renders used invitation with Used badge', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([usedInvitation])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('Used')).toBeInTheDocument())
  })

  it('renders expired invitation with Expired badge', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([expiredInvitation])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('Expired')).toBeInTheDocument())
  })

  it('calls createInvitation when Create Invitation is clicked', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([])
    vi.mocked(createInvitation).mockResolvedValue({
      ...pendingInvitation,
      inviteUrl: 'http://localhost/invite/tok99',
    })
    renderWithProviders(<AdminList />)
    await waitFor(() => screen.getByText('Create Invitation'))
    fireEvent.click(screen.getAllByText('Create Invitation')[0])
    await waitFor(() => expect(createInvitation).toHaveBeenCalled())
    expect(screen.getByText('Invitation Link')).toBeInTheDocument()
    expect(screen.getByText('http://localhost/invite/tok99')).toBeInTheDocument()
  })

  it('shows Copy Link button for pending invitation', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([pendingInvitation])
    renderWithProviders(<AdminList />)
    await waitFor(() => expect(screen.getByText('Copy Link')).toBeInTheDocument())
  })

  it('does not show Copy Link for used invitation', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([usedInvitation])
    renderWithProviders(<AdminList />)
    await waitFor(() => screen.getByText('Used'))
    expect(screen.queryByText('Copy Link')).not.toBeInTheDocument()
  })

  it('opens revoke dialog when Revoke is clicked', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([pendingInvitation])
    renderWithProviders(<AdminList />)
    await waitFor(() => screen.getByText('Pending'))
    fireEvent.click(screen.getByText('Revoke'))
    expect(screen.getByText('Revoke Invitation')).toBeInTheDocument()
  })

  it('calls deleteInvitation on confirm', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([pendingInvitation])
    vi.mocked(deleteInvitation).mockResolvedValue({} as never)
    const { container } = renderWithProviders(<AdminList />)
    await waitFor(() => screen.getByText('Pending'))
    fireEvent.click(screen.getByText('Revoke'))
    // Click the danger confirm button (bg-red-600)
    const confirmBtn = container.querySelector('button.bg-red-600') as HTMLElement
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(deleteInvitation).toHaveBeenCalledWith('inv1'))
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Invitation revoked'))
  })

  it('shows error toast when createInvitation fails', async () => {
    vi.mocked(getAdmins).mockResolvedValue([mockAdmin])
    vi.mocked(getInvitations).mockResolvedValue([])
    vi.mocked(createInvitation).mockRejectedValue(new Error('fail'))
    renderWithProviders(<AdminList />)
    await waitFor(() => screen.getByText('Create Invitation'))
    fireEvent.click(screen.getAllByText('Create Invitation')[0])
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Failed to create invitation'))
  })
})
