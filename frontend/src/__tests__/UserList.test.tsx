import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './testUtils'
import { UserList } from '../pages/Users/UserList'

vi.mock('../api/users', () => ({
  getUsers: vi.fn(),
  deleteUser: vi.fn(),
}))

import { getUsers } from '../api/users'

const mockUser = { id: 'u1', name: 'Alice', sub: '123', provider: 'google', isGlobalAdmin: false, createdAt: '', _count: { userRoles: 2 } }
const globalAdmin = { ...mockUser, id: 'u0', name: 'Bob', isGlobalAdmin: true }

const pageResult = (users: typeof mockUser[]) => ({ total: users.length, page: 1, limit: 20, users })

describe('UserList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty state when no users', async () => {
    vi.mocked(getUsers).mockResolvedValue(pageResult([]))
    renderWithProviders(<UserList />)
    await waitFor(() => expect(screen.getByText('No users yet')).toBeInTheDocument())
  })

  it('renders user rows', async () => {
    vi.mocked(getUsers).mockResolvedValue(pageResult([mockUser]))
    renderWithProviders(<UserList />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
  })

  it('hides delete button for global admin', async () => {
    vi.mocked(getUsers).mockResolvedValue(pageResult([globalAdmin]))
    renderWithProviders(<UserList />)
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('shows delete button for regular users', async () => {
    vi.mocked(getUsers).mockResolvedValue(pageResult([mockUser]))
    renderWithProviders(<UserList />)
    await waitFor(() => screen.getByTitle('Delete'))
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
  })

  it('opens delete confirmation when Delete is clicked', async () => {
    vi.mocked(getUsers).mockResolvedValue(pageResult([mockUser]))
    renderWithProviders(<UserList />)
    await waitFor(() => screen.getByTitle('Delete'))
    fireEvent.click(screen.getByTitle('Delete'))
    expect(screen.getByText('Delete User')).toBeInTheDocument()
  })

  it('shows pagination when total > limit', async () => {
    vi.mocked(getUsers).mockResolvedValue({ total: 25, page: 1, limit: 20, users: [mockUser] })
    renderWithProviders(<UserList />)
    await waitFor(() => expect(screen.getByText('25 users total')).toBeInTheDocument())
  })

  it('shows "No users found" when search returns empty results', async () => {
    vi.mocked(getUsers).mockResolvedValue(pageResult([]))
    renderWithProviders(<UserList />)
    // Simulate a search
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'xyz' } })
    await waitFor(() => expect(screen.getByText('No users found')).toBeInTheDocument())
  })

  it('passes search term to getUsers', async () => {
    vi.mocked(getUsers).mockResolvedValue(pageResult([mockUser]))
    renderWithProviders(<UserList />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'ali' } })
    await waitFor(() => expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'ali' })))
  })
})
