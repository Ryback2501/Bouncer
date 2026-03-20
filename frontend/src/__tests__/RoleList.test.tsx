import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './testUtils'
import { RoleList } from '../pages/Roles/RoleList'

vi.mock('../api/roles', () => ({
  getRoles: vi.fn(),
  deleteRole: vi.fn(),
}))

vi.mock('../api/applications', () => ({
  getApplication: vi.fn(),
}))

import { getRoles } from '../api/roles'
import { getApplication } from '../api/applications'

const mockApp = { id: 'app1', name: 'My App', customId: 'my-app', createdAt: '', updatedAt: '' }
const bouncerApp = { ...mockApp, customId: 'bouncer', name: 'Bouncer' }
const adminRole = { id: 'r1', name: 'Admin', customId: 'admin', applicationId: 'app1', createdAt: '' }
const editorRole = { id: 'r2', name: 'Editor', customId: 'editor', applicationId: 'app1', createdAt: '' }

describe('RoleList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders roles for an application', async () => {
    vi.mocked(getApplication).mockResolvedValue(mockApp)
    vi.mocked(getRoles).mockResolvedValue([editorRole])
    renderWithProviders(<RoleList />, { route: '/applications/app1/roles', path: '/applications/:appId/roles' })
    await waitFor(() => expect(screen.getByText('Editor')).toBeInTheDocument())
  })

  it('shows empty state when no roles', async () => {
    vi.mocked(getApplication).mockResolvedValue(mockApp)
    vi.mocked(getRoles).mockResolvedValue([])
    renderWithProviders(<RoleList />, { route: '/applications/app1/roles', path: '/applications/:appId/roles' })
    await waitFor(() => expect(screen.getByText('No roles yet')).toBeInTheDocument())
  })

  it('hides edit/delete for bouncer admin role', async () => {
    vi.mocked(getApplication).mockResolvedValue(bouncerApp)
    vi.mocked(getRoles).mockResolvedValue([adminRole])
    renderWithProviders(<RoleList />, { route: '/applications/app1/roles', path: '/applications/:appId/roles' })
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument())
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('shows edit/delete for non-protected roles', async () => {
    vi.mocked(getApplication).mockResolvedValue(mockApp)
    vi.mocked(getRoles).mockResolvedValue([editorRole])
    renderWithProviders(<RoleList />, { route: '/applications/app1/roles', path: '/applications/:appId/roles' })
    await waitFor(() => screen.getByTitle('Edit'))
    expect(screen.getByTitle('Edit')).toBeInTheDocument()
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
  })

  it('opens delete confirmation when Delete is clicked', async () => {
    vi.mocked(getApplication).mockResolvedValue(mockApp)
    vi.mocked(getRoles).mockResolvedValue([editorRole])
    renderWithProviders(<RoleList />, { route: '/applications/app1/roles', path: '/applications/:appId/roles' })
    await waitFor(() => screen.getByTitle('Delete'))
    fireEvent.click(screen.getByTitle('Delete'))
    expect(screen.getByText('Delete Role')).toBeInTheDocument()
  })
})
