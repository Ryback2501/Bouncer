import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, mockToast } from './testUtils'
import { UserForm } from '../pages/Users/UserForm'

vi.mock('../api/users', () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
}))

import { createUser, updateUser } from '../api/users'

const mockUser = {
  id: 'u1',
  name: 'Alice',
  sub: '123abc',
  provider: 'google',
  isGlobalAdmin: false,
  createdAt: '',
}

describe('UserForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders create mode title', () => {
    renderWithProviders(<UserForm open={true} onClose={vi.fn()} />)
    expect(screen.getByText('New User')).toBeInTheDocument()
  })

  it('renders edit mode title', () => {
    renderWithProviders(<UserForm open={true} onClose={vi.fn()} existing={mockUser} />)
    expect(screen.getByText('Edit User')).toBeInTheDocument()
  })

  it('pre-fills fields in edit mode', () => {
    renderWithProviders(<UserForm open={true} onClose={vi.fn()} existing={mockUser} />)
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('123abc')).toBeInTheDocument()
  })

  it('shows validation errors on empty submit', async () => {
    renderWithProviders(<UserForm open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument())
  })

  it('calls createUser and shows success toast', async () => {
    vi.mocked(createUser).mockResolvedValue({ ...mockUser, id: 'u2' })
    const onClose = vi.fn()
    renderWithProviders(<UserForm open={true} onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Bob' } })
    fireEvent.change(screen.getByPlaceholderText('112233445566778899'), { target: { value: 'sub456' } })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(createUser).toHaveBeenCalledWith({ name: 'Bob', sub: 'sub456', provider: 'google' }))
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('User created'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls updateUser in edit mode', async () => {
    vi.mocked(updateUser).mockResolvedValue({ ...mockUser, name: 'Alice Updated' })
    const onClose = vi.fn()
    renderWithProviders(<UserForm open={true} onClose={onClose} existing={mockUser} />)
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Alice Updated' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Alice Updated' })))
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('User updated'))
  })

  it('shows duplicate sub+provider error toast', async () => {
    vi.mocked(createUser).mockRejectedValue({ response: { data: { error: 'Unique constraint failed on sub+provider' } } })
    renderWithProviders(<UserForm open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Bob' } })
    fireEvent.change(screen.getByPlaceholderText('112233445566778899'), { target: { value: 'sub456' } })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('A user with this sub and provider already exists'))
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    renderWithProviders(<UserForm open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    renderWithProviders(<UserForm open={false} onClose={vi.fn()} />)
    expect(screen.queryByText('New User')).not.toBeInTheDocument()
  })
})
