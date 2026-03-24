import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { InviteAccept } from '../pages/InviteAccept'

function renderInviteAccept(token = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<InviteAccept />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('InviteAccept', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading spinner initially', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))
    const { container } = renderInviteAccept()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows invalid state when token is not valid', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ valid: false, expiresAt: null }),
    } as Response)
    renderInviteAccept()
    await waitFor(() => expect(screen.getByText('Invitation not found')).toBeInTheDocument())
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
  })

  it('shows invalid state when fetch rejects', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'))
    renderInviteAccept()
    await waitFor(() => expect(screen.getByText('Invitation not found')).toBeInTheDocument())
  })

  it('shows OAuth buttons when token is valid', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ valid: true, expiresAt: null }),
    } as Response)
    renderInviteAccept()
    await waitFor(() => expect(screen.getByText('Continue with Google')).toBeInTheDocument())
    expect(screen.getByText('Continue with Microsoft')).toBeInTheDocument()
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
    expect(screen.getByText('Continue with LinkedIn')).toBeInTheDocument()
  })

  it('OAuth links include invite token in query string', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ valid: true, expiresAt: null }),
    } as Response)
    renderInviteAccept('tok99')
    await waitFor(() => screen.getByText('Continue with Google'))
    const googleLink = screen.getByText('Continue with Google').closest('a')
    expect(googleLink).toHaveAttribute('href', '/auth/google?invite=tok99')
  })

  it('shows expiry date when provided', async () => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ valid: true, expiresAt }),
    } as Response)
    renderInviteAccept()
    await waitFor(() => screen.getByText('Continue with Google'))
    // The expiry paragraph has class text-gray-400 and starts with "Expires"
    expect(screen.getAllByText(/expires/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the Bouncer heading', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))
    renderInviteAccept()
    expect(screen.getByText('Bouncer')).toBeInTheDocument()
    expect(screen.getByText("You've been invited")).toBeInTheDocument()
  })
})
