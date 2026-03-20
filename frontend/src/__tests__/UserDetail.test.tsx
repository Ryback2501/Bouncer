import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './testUtils'
import { UserDetail } from '../pages/Users/UserDetail'

vi.mock('../api/users', () => ({
  getUser: vi.fn(),
}))

vi.mock('../api/assignments', () => ({
  removeRole: vi.fn(),
  assignRole: vi.fn(),
}))

vi.mock('../api/applications', () => ({
  getApplications: vi.fn(),
}))

vi.mock('../api/roles', () => ({
  getRoles: vi.fn(),
}))

import { getUser } from '../api/users'
import { getApplications } from '../api/applications'

const mockUserRole = {
  id: 'ur1',
  userId: 'u1',
  applicationId: 'app1',
  roleId: 'r1',
  active: true,
  expiredAt: null,
  assignedAt: '',
  application: { id: 'app1', name: 'My App', customId: 'myapp', description: null, createdAt: '' },
  role: { id: 'r1', name: 'Editor', customId: 'editor', description: null, applicationId: 'app1', createdAt: '' },
}

const mockUser = {
  id: 'u1',
  name: 'Alice',
  sub: '123',
  provider: 'google',
  isGlobalAdmin: false,
  createdAt: '',
  userRoles: [mockUserRole],
}

const mockUserNoRoles = { ...mockUser, userRoles: [] }

describe('UserDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApplications).mockResolvedValue([])
  })

  it('shows loading skeleton while fetching', () => {
    vi.mocked(getUser).mockReturnValue(new Promise(() => {}))
    const { container } = renderWithProviders(<UserDetail />, { route: '/users/u1', path: '/users/:userId' })
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows user not found when user is missing', async () => {
    vi.mocked(getUser).mockResolvedValue(undefined as never)
    renderWithProviders(<UserDetail />, { route: '/users/u1', path: '/users/:userId' })
    await waitFor(() => expect(screen.getByText('User not found.')).toBeInTheDocument())
  })

  it('renders user name and provider', async () => {
    vi.mocked(getUser).mockResolvedValue(mockUser)
    renderWithProviders(<UserDetail />, { route: '/users/u1', path: '/users/:userId' })
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByText('google')).toBeInTheDocument()
  })

  it('renders role assignments table', async () => {
    vi.mocked(getUser).mockResolvedValue(mockUser)
    renderWithProviders(<UserDetail />, { route: '/users/u1', path: '/users/:userId' })
    await waitFor(() => expect(screen.getByText('My App')).toBeInTheDocument())
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('shows empty state when no roles', async () => {
    vi.mocked(getUser).mockResolvedValue(mockUserNoRoles)
    renderWithProviders(<UserDetail />, { route: '/users/u1', path: '/users/:userId' })
    await waitFor(() => expect(screen.getByText('No roles assigned')).toBeInTheDocument())
  })

  it('opens assign role modal when Assign Role is clicked', async () => {
    vi.mocked(getUser).mockResolvedValue(mockUserNoRoles)
    renderWithProviders(<UserDetail />, { route: '/users/u1', path: '/users/:userId' })
    await waitFor(() => screen.getByText('No roles assigned'))
    fireEvent.click(screen.getAllByText('Assign Role')[0])
    // Modal opens — Cancel button confirms it
    await waitFor(() => expect(screen.getByText('Cancel')).toBeInTheDocument())
  })

  it('opens remove role dialog when trash button is clicked', async () => {
    vi.mocked(getUser).mockResolvedValue(mockUser)
    const { container } = renderWithProviders(<UserDetail />, { route: '/users/u1', path: '/users/:userId' })
    await waitFor(() => screen.getByText('Editor'))
    // The trash button in the role row has class text-red-500
    const trashBtn = container.querySelector('button.text-red-500') as HTMLElement
    fireEvent.click(trashBtn)
    await waitFor(() => expect(screen.getByText('Remove Role')).toBeInTheDocument())
  })
})
