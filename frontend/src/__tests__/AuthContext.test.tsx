import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../context/AuthContext'
import { useAuth } from '../context/useAuth'

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}))

import client from '../api/client'

function TestConsumer() {
  const { admin, isLoading, isGlobalAdmin } = useAuth()
  if (isLoading) return <div>loading</div>
  if (!admin) return <div>no admin</div>
  return <div>{admin.name} {isGlobalAdmin ? 'global' : 'regular'}</div>
}

function renderProvider() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider><TestConsumer /></AuthProvider>
    </QueryClientProvider>
  )
}

describe('AuthProvider', () => {
  it('shows loading state initially', () => {
    vi.mocked(client.get).mockReturnValue(new Promise(() => {}))
    renderProvider()
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('shows admin name when authenticated', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { id: 'u1', name: 'Alice', email: null, provider: 'google', isGlobalAdmin: true } })
    renderProvider()
    await waitFor(() => expect(screen.getByText('Alice global')).toBeInTheDocument())
  })

  it('shows no admin when request fails', async () => {
    vi.mocked(client.get).mockRejectedValue(new Error('401'))
    renderProvider()
    await waitFor(() => expect(screen.getByText('no admin')).toBeInTheDocument())
  })
})
