import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { ToastContext } from '../components/shared/toastContext'
import { useDeleteMutation } from '../hooks/useDeleteMutation'

const mockToast = { success: vi.fn(), error: vi.fn() }

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

interface WrapperProps {
  mutationFn: () => Promise<unknown>
  queryKey?: unknown[]
  invalidateDashboard?: boolean
  onSuccess?: () => void
}

function Fixture({ mutationFn, queryKey = ['items'], invalidateDashboard, onSuccess }: WrapperProps) {
  const mutation = useDeleteMutation({
    mutationFn,
    queryKey,
    successMessage: 'Deleted!',
    errorMessage: 'Failed!',
    invalidateDashboard,
    onSuccess,
  })
  return (
    <button onClick={() => mutation.mutate(undefined as unknown as never)}>
      delete
    </button>
  )
}

function renderFixture(props: WrapperProps) {
  const qc = makeQueryClient()
  vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <ToastContext.Provider value={mockToast}>
        <Fixture {...props} />
      </ToastContext.Provider>
    </QueryClientProvider>
  )
  return { qc }
}

describe('useDeleteMutation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('on success: shows success toast, invalidates queryKey and dashboard', async () => {
    const mutationFn = vi.fn().mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const { qc } = renderFixture({ mutationFn, onSuccess })

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Deleted!'))
    expect(onSuccess).toHaveBeenCalled()
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['items'] })
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('on success with invalidateDashboard=false: does not invalidate dashboard', async () => {
    const mutationFn = vi.fn().mockResolvedValue(undefined)
    const { qc } = renderFixture({ mutationFn, invalidateDashboard: false })

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(mockToast.success).toHaveBeenCalled())
    expect(qc.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('on error: shows error toast', async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error('boom'))
    renderFixture({ mutationFn })

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Failed!'))
    expect(mockToast.success).not.toHaveBeenCalled()
  })
})
