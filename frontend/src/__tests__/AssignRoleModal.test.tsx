import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, mockToast } from './testUtils'
import { AssignRoleModal } from '../pages/Users/AssignRoleModal'

vi.mock('../api/applications', () => ({
  getApplications: vi.fn(),
}))

vi.mock('../api/roles', () => ({
  getRoles: vi.fn(),
}))

vi.mock('../api/assignments', () => ({
  assignRole: vi.fn(),
}))

import { getApplications } from '../api/applications'
import { getRoles } from '../api/roles'
import { assignRole } from '../api/assignments'

const mockApp = { id: 'app1', name: 'My App', customId: 'myapp', description: null, createdAt: '' }
const mockRole = { id: 'r1', name: 'Editor', customId: 'editor', description: null, applicationId: 'app1', createdAt: '' }

describe('AssignRoleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApplications).mockResolvedValue([mockApp])
    vi.mocked(getRoles).mockResolvedValue([mockRole])
  })

  it('renders "Assign Role" title in create mode', async () => {
    renderWithProviders(
      <AssignRoleModal open={true} onClose={vi.fn()} userId="u1" existingAppIds={[]} />
    )
    expect(screen.getByText('Assign Role')).toBeInTheDocument()
  })

  it('renders "Edit Role Assignment" title in edit mode', async () => {
    const existing = {
      id: 'ur1', userId: 'u1', applicationId: 'app1', roleId: 'r1',
      active: true, expiredAt: null, assignedAt: '',
      application: mockApp, role: mockRole,
    }
    renderWithProviders(
      <AssignRoleModal open={true} onClose={vi.fn()} userId="u1" existingAppIds={[]} existing={existing} />
    )
    expect(screen.getByText('Edit Role Assignment')).toBeInTheDocument()
  })

  it('loads and shows applications in select', async () => {
    renderWithProviders(
      <AssignRoleModal open={true} onClose={vi.fn()} userId="u1" existingAppIds={[]} />
    )
    await waitFor(() => expect(screen.getByDisplayValue('My App')).toBeInTheDocument())
  })

  it('calls assignRole on submit', async () => {
    vi.mocked(assignRole).mockResolvedValue({} as never)
    const onClose = vi.fn()
    renderWithProviders(
      <AssignRoleModal open={true} onClose={onClose} userId="u1" existingAppIds={[]} />
    )
    // Wait for apps and roles to load
    await waitFor(() => screen.getByDisplayValue('My App'))
    await waitFor(() => expect(screen.getByText('Editor')).toBeInTheDocument())
    // Select role
    const roleSelect = screen.getByLabelText('Role')
    fireEvent.change(roleSelect, { target: { value: 'r1' } })
    fireEvent.click(screen.getByText('Assign'))
    await waitFor(() => expect(assignRole).toHaveBeenCalledWith('u1', 'app1', expect.objectContaining({ roleId: 'r1' })))
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Role assigned'))
  })

  it('shows error toast on assignRole failure', async () => {
    vi.mocked(assignRole).mockRejectedValue(new Error('fail'))
    renderWithProviders(
      <AssignRoleModal open={true} onClose={vi.fn()} userId="u1" existingAppIds={[]} />
    )
    await waitFor(() => screen.getByDisplayValue('My App'))
    await waitFor(() => expect(screen.getByText('Editor')).toBeInTheDocument())
    const roleSelect = screen.getByLabelText('Role')
    fireEvent.change(roleSelect, { target: { value: 'r1' } })
    fireEvent.click(screen.getByText('Assign'))
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Failed to assign role'))
  })

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <AssignRoleModal open={true} onClose={onClose} userId="u1" existingAppIds={[]} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    renderWithProviders(
      <AssignRoleModal open={false} onClose={vi.fn()} userId="u1" existingAppIds={[]} />
    )
    expect(screen.queryByText('Assign Role')).not.toBeInTheDocument()
  })
})
