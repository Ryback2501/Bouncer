import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createRole, updateRole, type Role } from '../../api/roles'
import { Modal } from '../../components/shared/Modal'
import { Input } from '../../components/shared/Input'
import { Button } from '../../components/shared/Button'
import { useToast } from '../../components/shared/Toast'

interface FormData { name: string; customId: string }

interface Props {
  open: boolean
  onClose: () => void
  appId: string
  existing?: Role | null
}

export function RoleForm({ open, onClose, appId, existing }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (open) reset(existing ? { name: existing.name, customId: existing.customId } : { name: '', customId: '' })
  }, [open, existing, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      existing ? updateRole(appId, existing.id, data) : createRole(appId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles', appId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(existing ? 'Role updated' : 'Role created')
      onClose()
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.includes('customId')
        ? 'That ID is already used in this application'
        : 'Something went wrong'
      toast.error(msg)
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Role' : 'New Role'} size="sm">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Name"
          placeholder="Administrator"
          {...register('name', { required: 'Name is required' })}
          error={errors.name?.message}
        />
        <Input
          label="ID"
          placeholder="admin"
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
