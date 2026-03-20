import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './testUtils'
import { ApplicationList } from '../pages/Applications/ApplicationList'

vi.mock('../api/applications', () => ({
  getApplications: vi.fn(),
  deleteApplication: vi.fn(),
}))

import { getApplications, deleteApplication } from '../api/applications'

const mockApp = { id: 'app1', name: 'My App', customId: 'my-app', createdAt: '', updatedAt: '', _count: { roles: 2, userRoles: 5, apiKeys: 1 } }
const bouncerApp = { id: 'bouncer', name: 'Bouncer', customId: 'bouncer', createdAt: '', updatedAt: '', _count: { roles: 1, userRoles: 1, apiKeys: 0 } }

describe('ApplicationList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading skeletons while fetching', () => {
    vi.mocked(getApplications).mockReturnValue(new Promise(() => {}))
    const { container } = renderWithProviders(<ApplicationList />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })

  it('shows empty state when no applications', async () => {
    vi.mocked(getApplications).mockResolvedValue([])
    renderWithProviders(<ApplicationList />)
    await waitFor(() => expect(screen.getByText('No applications yet')).toBeInTheDocument())
  })

  it('renders application rows', async () => {
    vi.mocked(getApplications).mockResolvedValue([mockApp])
    renderWithProviders(<ApplicationList />)
    await waitFor(() => expect(screen.getByText('My App')).toBeInTheDocument())
    // customId appears in both the mobile-hidden cell and the sm:hidden paragraph
    expect(screen.getAllByText('my-app').length).toBeGreaterThanOrEqual(1)
  })

  it('hides edit/delete buttons for bouncer app', async () => {
    vi.mocked(getApplications).mockResolvedValue([bouncerApp])
    renderWithProviders(<ApplicationList />)
    await waitFor(() => expect(screen.getByText('Bouncer')).toBeInTheDocument())
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('shows edit/delete buttons for regular apps', async () => {
    vi.mocked(getApplications).mockResolvedValue([mockApp])
    renderWithProviders(<ApplicationList />)
    await waitFor(() => expect(screen.getByText('My App')).toBeInTheDocument())
    expect(screen.getByTitle('Edit')).toBeInTheDocument()
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
  })

  it('opens delete confirmation when Delete is clicked', async () => {
    vi.mocked(getApplications).mockResolvedValue([mockApp])
    renderWithProviders(<ApplicationList />)
    await waitFor(() => screen.getByTitle('Delete'))
    fireEvent.click(screen.getByTitle('Delete'))
    expect(screen.getByText(/Delete Application/i)).toBeInTheDocument()
  })
})
