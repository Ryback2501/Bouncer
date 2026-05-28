import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../pages/Dashboard'

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}))

import client from '../api/client'

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Dashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading skeleton while data is fetching', () => {
    vi.mocked(client.get).mockReturnValue(new Promise(() => {}))
    const { container } = renderDashboard()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('renders stat cards with values after data loads', async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: { applications: 3, users: 12, assignments: 20, invitations: 5 },
    })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders API integration section', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { applications: 0, users: 0, assignments: 0, invitations: 0 } })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('API Integration')).toBeInTheDocument())
  })

  it('stat cards link to their corresponding sections', async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: { applications: 1, users: 2, assignments: 3, invitations: 4 },
    })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Applications')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Applications/i })).toHaveAttribute('href', '/applications')
    expect(screen.getByRole('link', { name: /Users/i })).toHaveAttribute('href', '/users')
    expect(screen.getByRole('link', { name: /Assignments/i })).toHaveAttribute('href', '/assignments')
    expect(screen.getByRole('link', { name: /Invitations/i })).toHaveAttribute('href', '/invitations')
  })
})
