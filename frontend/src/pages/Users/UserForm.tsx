import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createUser, updateUser, type User } from '../../api/users'
import { Modal } from '../../components/shared/Modal'
import { Input } from '../../components/shared/Input'
import { Select } from '../../components/shared/Select'
import { Button } from '../../components/shared/Button'
import { useToast } from '../../components/shared/Toast'

interface FormData { name: string; sub: string; provider: string }

interface Props {
  open: boolean
  onClose: () => void
  existing?: User | null
}

const PROVIDERS = ['google', 'microsoft', 'apple', 'other']

export function UserForm({ open, onClose, existing }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (open) reset(existing
      ? { name: existing.name, sub: existing.sub, provider: existing.provider }
      : { name: '', sub: '', provider: 'google' }
    )
  }, [open, existing, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      existing ? updateUser(existing.id, data) : createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(existing ? 'User updated' : 'User created')
      onClose()
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.includes('sub+provider')
        ? 'A user with this sub and provider already exists'
        : 'Something went wrong'
      toast.error(msg)
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit User' : 'New User'} size="sm">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Name"
          placeholder="Jane Doe"
          {...register('name', { required: 'Name is required' })}
          error={errors.name?.message}
        />
        <Input
          label="Sub (OAuth subject)"
          placeholder="112233445566778899"
          {...register('sub', { required: 'Sub is required' })}
          error={errors.sub?.message}
        />
        <Select
          label="Provider"
          {...register('provider', { required: 'Provider is required' })}
          error={errors.provider?.message}
        >
          {PROVIDERS.map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </Select>
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
