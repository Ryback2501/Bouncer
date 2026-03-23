import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/shared/useToast'

interface Options<T> {
  mutationFn: (item: T) => Promise<unknown>
  queryKey: unknown[]
  successMessage: string
  errorMessage: string
  invalidateDashboard?: boolean
  onSuccess?: () => void
}

export function useDeleteMutation<T>({
  mutationFn,
  queryKey,
  successMessage,
  errorMessage,
  invalidateDashboard = true,
  onSuccess,
}: Options<T>) {
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      if (invalidateDashboard) qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(successMessage)
      onSuccess?.()
    },
    onError: () => toast.error(errorMessage),
  })
}
