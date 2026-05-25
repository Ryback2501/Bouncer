import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders, mockToast } from './testUtils'
import { ApplicationForm } from '../pages/Applications/ApplicationForm'

vi.mock('../api/applications', () => ({
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
}))

import { createApplication, updateApplication } from '../api/applications'

const mockApp = { id: 'app1', name: 'My App', customId: 'my-app', createdAt: '', updatedAt: '' }

describe('ApplicationForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders "New Application" title when creating', () => {
    renderWithProviders(<ApplicationForm open={true} onClose={vi.fn()} />)
    expect(screen.getByText('New Application')).toBeInTheDocument()
  })

  it('renders "Edit Application" title when editing', () => {
    renderWithProviders(<ApplicationForm open={true} onClose={vi.fn()} existing={mockApp} />)
    expect(screen.getByText('Edit Application')).toBeInTheDocument()
  })

  it('pre-fills form fields when editing', () => {
    renderWithProviders(<ApplicationForm open={true} onClose={vi.fn()} existing={mockApp} />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('My App')
    expect((screen.getByLabelText('ID') as HTMLInputElement).value).toBe('my-app')
  })

  it('calls createApplication on submit when creating', async () => {
    vi.mocked(createApplication).mockResolvedValue(mockApp)
    const onClose = vi.fn()
    renderWithProviders(<ApplicationForm open={true} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New App' } })
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'new-app' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(createApplication).toHaveBeenCalledWith({ name: 'New App', customId: 'new-app', redirectUris: [] }))
    expect(onClose).toHaveBeenCalled()
  })

  it('parses the redirect-URIs textarea into an array (one per line, trimmed)', async () => {
    vi.mocked(createApplication).mockResolvedValue(mockApp)
    renderWithProviders(<ApplicationForm open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New App' } })
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'new-app' } })
    fireEvent.change(screen.getByLabelText('Allowed redirect URIs'), {
      target: { value: '  https://a.example/welcome \n\nhttps://b.example/cb\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(createApplication).toHaveBeenCalledWith({
      name: 'New App', customId: 'new-app',
      redirectUris: ['https://a.example/welcome', 'https://b.example/cb'],
    }))
  })

  it('pre-fills redirect URIs (one per line) when editing', () => {
    renderWithProviders(<ApplicationForm open={true} onClose={vi.fn()}
      existing={{ ...mockApp, redirectUris: ['https://a.example/welcome', 'https://b.example/cb'] }} />)
    expect((screen.getByLabelText('Allowed redirect URIs') as HTMLTextAreaElement).value)
      .toBe('https://a.example/welcome\nhttps://b.example/cb')
  })

  it('blocks submit and shows an error when a redirect URI is not a valid URL', async () => {
    renderWithProviders(<ApplicationForm open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New App' } })
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'new-app' } })
    fireEvent.change(screen.getByLabelText('Allowed redirect URIs'), { target: { value: 'not a url' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(screen.getByText(/Not a valid URL/)).toBeInTheDocument())
    expect(createApplication).not.toHaveBeenCalled()
  })

  it('calls updateApplication on submit when editing', async () => {
    vi.mocked(updateApplication).mockResolvedValue({ ...mockApp, name: 'Updated' })
    const onClose = vi.fn()
    renderWithProviders(<ApplicationForm open={true} onClose={onClose} existing={mockApp} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateApplication).toHaveBeenCalledWith('app1', expect.objectContaining({ name: 'Updated' })))
  })

  it('shows error toast when creation fails with duplicate customId', async () => {
    vi.mocked(createApplication).mockRejectedValue({ response: { data: { error: 'already_exists' } } })
    renderWithProviders(<ApplicationForm open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'App' } })
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'app' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('That ID is already taken'))
  })
})
