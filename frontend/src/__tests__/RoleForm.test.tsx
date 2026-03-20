import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, mockToast } from './testUtils'
import { RoleForm } from '../pages/Roles/RoleForm'

vi.mock('../api/roles', () => ({
  createRole: vi.fn(),
  updateRole: vi.fn(),
}))

import { createRole, updateRole } from '../api/roles'

const mockRole = { id: 'r1', name: 'Editor', customId: 'editor', applicationId: 'app1', createdAt: '' }

describe('RoleForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders "New Role" title when creating', () => {
    renderWithProviders(<RoleForm open={true} onClose={vi.fn()} appId="app1" />)
    expect(screen.getByText('New Role')).toBeInTheDocument()
  })

  it('renders "Edit Role" title when editing', () => {
    renderWithProviders(<RoleForm open={true} onClose={vi.fn()} appId="app1" existing={mockRole} />)
    expect(screen.getByText('Edit Role')).toBeInTheDocument()
  })

  it('pre-fills form when editing', () => {
    renderWithProviders(<RoleForm open={true} onClose={vi.fn()} appId="app1" existing={mockRole} />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Editor')
    expect((screen.getByLabelText('ID') as HTMLInputElement).value).toBe('editor')
  })

  it('calls createRole on submit when creating', async () => {
    vi.mocked(createRole).mockResolvedValue(mockRole)
    const onClose = vi.fn()
    renderWithProviders(<RoleForm open={true} onClose={onClose} appId="app1" />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Viewer' } })
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'viewer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(createRole).toHaveBeenCalledWith('app1', { name: 'Viewer', customId: 'viewer' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls updateRole on submit when editing', async () => {
    vi.mocked(updateRole).mockResolvedValue({ ...mockRole, name: 'Senior Editor' })
    const onClose = vi.fn()
    renderWithProviders(<RoleForm open={true} onClose={onClose} appId="app1" existing={mockRole} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Senior Editor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateRole).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error toast on duplicate customId', async () => {
    vi.mocked(createRole).mockRejectedValue({ response: { data: { error: 'customId already exists in this application' } } })
    renderWithProviders(<RoleForm open={true} onClose={vi.fn()} appId="app1" />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Admin' } })
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('That ID is already used in this application'))
  })
})
