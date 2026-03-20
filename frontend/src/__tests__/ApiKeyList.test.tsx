import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, mockToast } from './testUtils'
import { ApiKeyList } from '../pages/ApiKeys/ApiKeyList'

vi.mock('../api/apiKeys', () => ({
  getApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}))

vi.mock('../api/applications', () => ({
  getApplication: vi.fn(),
}))

import { getApiKeys, createApiKey, deleteApiKey } from '../api/apiKeys'
import { getApplication } from '../api/applications'

const mockApp = { id: 'app1', name: 'My App', customId: 'myapp', description: null, createdAt: '', updatedAt: '' }
const mockKey = { id: 'k1', label: 'production', lastUsedAt: null, createdAt: '2024-01-01T00:00:00Z' }

describe('ApiKeyList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApplication).mockResolvedValue(mockApp)
  })

  it('shows empty state when no keys', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([])
    renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => expect(screen.getByText('No API keys')).toBeInTheDocument())
  })

  it('renders key rows', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([mockKey])
    renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => expect(screen.getByText('production')).toBeInTheDocument())
  })

  it('shows unlabeled for keys with no label', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([{ ...mockKey, label: null }])
    renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => expect(screen.getByText('unlabeled')).toBeInTheDocument())
  })

  it('opens generate key modal when Generate Key is clicked', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([])
    renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => screen.getByText('No API keys'))
    fireEvent.click(screen.getAllByText('Generate Key')[0])
    expect(screen.getByText('Generate API Key')).toBeInTheDocument()
  })

  it('calls createApiKey and shows generated key modal', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([])
    vi.mocked(createApiKey).mockResolvedValue({ ...mockKey, rawKey: 'bncr_secret123' })
    renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => screen.getByText('No API keys'))
    fireEvent.click(screen.getAllByText('Generate Key')[0])
    fireEvent.click(screen.getByText('Generate'))
    await waitFor(() => expect(screen.getByText('API Key Generated')).toBeInTheDocument())
    expect(screen.getByText('bncr_secret123')).toBeInTheDocument()
  })

  it('opens revoke confirm dialog', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([mockKey])
    renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => screen.getByText('production'))
    fireEvent.click(screen.getByText('Revoke'))
    expect(screen.getByText('Revoke API Key')).toBeInTheDocument()
  })

  it('calls deleteApiKey on confirm and shows success toast', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([mockKey])
    vi.mocked(deleteApiKey).mockResolvedValue({} as never)
    const { container } = renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => screen.getByText('production'))
    fireEvent.click(screen.getByText('Revoke'))
    // Click the danger confirm button (bg-red-600)
    const confirmBtn = container.querySelector('button.bg-red-600') as HTMLElement
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(deleteApiKey).toHaveBeenCalledWith('app1', 'k1'))
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('API key revoked'))
  })

  it('shows app name in breadcrumb', async () => {
    vi.mocked(getApiKeys).mockResolvedValue([])
    renderWithProviders(<ApiKeyList />, { route: '/applications/app1/api-keys', path: '/applications/:appId/api-keys' })
    await waitFor(() => expect(screen.getByText('My App')).toBeInTheDocument())
  })
})
