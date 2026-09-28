import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from './testUtils'
import { AuditLog } from '../pages/Audit/AuditLog'

vi.mock('../api/audit', () => ({
  getAuditEvents: vi.fn(),
}))

import { getAuditEvents, type AuditEvent } from '../api/audit'

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'e1',
  createdAt: '2026-09-28T10:00:00.000Z',
  action: 'application.delete',
  outcome: 'success',
  actorType: 'user',
  actorId: 'u1',
  actorLabel: 'Alice',
  targetType: 'application',
  targetId: 'a1',
  targetLabel: 'Shop',
  ip: '10.0.0.5',
  details: null,
  ...over,
})

const page = (events: AuditEvent[], total = events.length, p = 1) => ({ total, page: p, limit: 25, events })

// B-16. Admins can review the security audit log: who did what to what, from where, and whether it
// was allowed.
describe('AuditLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows an empty state', async () => {
    vi.mocked(getAuditEvents).mockResolvedValue(page([]))
    renderWithProviders(<AuditLog />)
    await waitFor(() => expect(screen.getByText('No audit events yet')).toBeInTheDocument())
  })

  it('renders an event: action, outcome, actor, target and IP', async () => {
    vi.mocked(getAuditEvents).mockResolvedValue(page([event({ outcome: 'denied' })]))
    renderWithProviders(<AuditLog />)
    await waitFor(() => expect(screen.getByText('application.delete')).toBeInTheDocument())
    // Scoped to the table: "Denied" is also an option of the Outcome filter.
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Denied')).toBeInTheDocument()
    expect(table.getByText('Alice')).toBeInTheDocument()
    expect(table.getByText('Shop')).toBeInTheDocument()
    expect(table.getByText('10.0.0.5')).toBeInTheDocument()
  })

  it('labels an API key actor and an anonymous one', async () => {
    vi.mocked(getAuditEvents).mockResolvedValue(page([
      event({ id: 'e1', actorType: 'api_key', actorId: 'k1', actorLabel: 'ci' }),
      event({ id: 'e2', action: 'auth.login_rejected', actorType: 'anonymous', actorId: null, actorLabel: null, targetType: null, targetId: null, targetLabel: null }),
    ]))
    renderWithProviders(<AuditLog />)
    await waitFor(() => expect(screen.getByText('API key: ci')).toBeInTheDocument())
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
  })

  it('filters by category and outcome, starting again from page 1', async () => {
    vi.mocked(getAuditEvents).mockResolvedValue(page([event()]))
    renderWithProviders(<AuditLog />)
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalledWith({ page: 1, limit: 25 }))

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'auth.' } })
    await waitFor(() => expect(getAuditEvents).toHaveBeenLastCalledWith({ page: 1, limit: 25, action: 'auth.' }))

    fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'denied' } })
    await waitFor(() => expect(getAuditEvents).toHaveBeenLastCalledWith({ page: 1, limit: 25, action: 'auth.', outcome: 'denied' }))
  })

  it('pages through the log', async () => {
    vi.mocked(getAuditEvents).mockImplementation(async (params) => page([event({ id: `e${params.page}` })], 60, params.page))
    renderWithProviders(<AuditLog />)
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Next page'))
    await waitFor(() => expect(getAuditEvents).toHaveBeenLastCalledWith({ page: 2, limit: 25 }))
    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument())
  })
})
