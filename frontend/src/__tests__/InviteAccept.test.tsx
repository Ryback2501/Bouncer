import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { InviteAccept } from '../pages/InviteAccept'

// The token rides in the URL fragment, so the server never receives it; the component reads it
// from location.hash and posts it in a request body.
function renderInviteAccept(token: string | null = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[token === null ? '/invite' : `/invite#${token}`]}>
      <Routes>
        <Route path="/invite" element={<InviteAccept />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('InviteAccept', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading spinner initially', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    const { container } = renderInviteAccept()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows invalid state when token is not valid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ valid: false, expiresAt: null }),
    } as Response)
    renderInviteAccept()
    await waitFor(() => expect(screen.getByText('Invitation not found')).toBeInTheDocument())
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
  })

  it('shows invalid state when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
    renderInviteAccept()
    await waitFor(() => expect(screen.getByText('Invitation not found')).toBeInTheDocument())
  })

  it('shows OAuth buttons when token is valid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ valid: true, expiresAt: null }),
    } as Response)
    renderInviteAccept()
    await waitFor(() => expect(screen.getByText('Continue with Google')).toBeInTheDocument())
    expect(screen.getByText('Continue with Microsoft')).toBeInTheDocument()
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
    expect(screen.getByText('Continue with LinkedIn')).toBeInTheDocument()
  })

  // The token must not reappear in any URL — the provider controls are buttons, not links, and
  // the backend reads the token from the session that the stage call populated.
  it('provider controls carry no token and no href', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ valid: true, expiresAt: null }),
    } as Response)
    renderInviteAccept('tok99')
    await waitFor(() => screen.getByText('Continue with Google'))
    for (const name of ['Google', 'Microsoft', 'GitHub', 'LinkedIn']) {
      const control = screen.getByText(`Continue with ${name}`).closest('button')
      expect(control).toBeInTheDocument()
      expect(control!.getAttribute('href')).toBeNull()
    }
    expect(document.body.innerHTML).not.toContain('tok99')
  })

  // The load-time call must be preview only. If it staged the token, anyone who merely opened a
  // forwarded invite link would redeem that invitation on their next unrelated sign-in.
  it('does not stage the token on page load', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ valid: true, expiresAt: null }),
    } as Response)
    renderInviteAccept('tok99')
    await waitFor(() => screen.getByText('Continue with Google'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('/auth/invite')
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('stage'))).toBe(false)
  })

  it('stages the token only when a provider is chosen, then navigates', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ valid: true, expiresAt: null }),
    } as Response)
    renderInviteAccept('tok99')
    await waitFor(() => screen.getByText('Continue with Google'))

    await userEvent.click(screen.getByText('Continue with Google'))

    const stageCall = fetchSpy.mock.calls.find(([url]) => url === '/auth/invite/stage')
    expect(stageCall).toBeDefined()
    expect(stageCall![1]?.method).toBe('POST')
    expect(JSON.parse(String(stageCall![1]?.body))).toEqual({ token: 'tok99' })
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/auth/google'))
  })

  it('sends the token in a POST body, never in the URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ valid: true, expiresAt: null }),
    } as Response)
    renderInviteAccept('tok99')
    await waitFor(() => screen.getByText('Continue with Google'))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/auth/invite')
    expect(String(url)).not.toContain('tok99')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok99' })
  })

  it('shows the invalid state when there is no fragment at all', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderInviteAccept(null)
    await waitFor(() => expect(screen.getByText('Invitation not found')).toBeInTheDocument())
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows the application and role names when provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ valid: true, expiresAt: null, application: { name: 'My App' }, role: { name: 'Editor' } }),
    } as Response)
    renderInviteAccept()
    await waitFor(() => screen.getByText('Continue with Google'))
    expect(screen.getByText('My App')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('shows expiry date when provided', async () => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ valid: true, expiresAt }),
    } as Response)
    renderInviteAccept()
    await waitFor(() => screen.getByText('Continue with Google'))
    // The expiry paragraph has class text-gray-400 and starts with "Expires"
    expect(screen.getAllByText(/expires/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the Bouncer heading', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    renderInviteAccept()
    expect(screen.getByText('Bouncer')).toBeInTheDocument()
    expect(screen.getByText("You've been invited")).toBeInTheDocument()
  })
})
