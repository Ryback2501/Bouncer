import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createApplication, updateApplication, type Application } from '../../api/applications'
import { Modal } from '../../components/shared/Modal'
import { Input } from '../../components/shared/Input'
import { Button } from '../../components/shared/Button'
import { useToast } from '../../components/shared/useToast'

interface FormData { name: string; customId: string }

interface Props {
  open: boolean
  onClose: () => void
  existing?: Application | null
}

export function ApplicationForm({ open, onClose, existing }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (open) reset(existing ? { name: existing.name, customId: existing.customId } : { name: '', customId: '' })
  }, [open, existing, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      existing ? updateApplication(existing.id, data) : createApplication(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(existing ? 'Application updated' : 'Application created')
      onClose()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      const msg = err.response?.data?.error === 'customId already exists'
        ? 'That ID is already taken'
        : 'Something went wrong'
      toast.error(msg)
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Application' : 'New Application'} size="sm">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Name"
          placeholder="My App"
          {...register('name', { required: 'Name is required' })}
          error={errors.name?.message}
        />
        <Input
          label="ID"
          placeholder="my-app"
          {...register('customId', {
            required: 'ID is required',
            pattern: { value: /^[a-z0-9-_]+$/, message: 'Only lowercase letters, numbers, hyphens and underscores' },
          })}
          error={errors.customId?.message}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : existing ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
