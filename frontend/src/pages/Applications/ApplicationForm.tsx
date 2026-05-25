import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createApplication, updateApplication, type Application } from '../../api/applications'
import { Modal } from '../../components/shared/Modal'
import { Input } from '../../components/shared/Input'
import { Button } from '../../components/shared/Button'
import { useToast } from '../../components/shared/useToast'

interface FormData { name: string; customId: string; redirectUris: string }

interface Props {
  open: boolean
  onClose: () => void
  existing?: Application | null
}

// One URI per line ⇄ string[]. Trims blanks so trailing newlines don't create empty entries.
const parseRedirectUris = (text: string): string[] =>
  text.split('\n').map(s => s.trim()).filter(Boolean)

export function ApplicationForm({ open, onClose, existing }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (open) reset(existing
      ? { name: existing.name, customId: existing.customId, redirectUris: (existing.redirectUris ?? []).join('\n') }
      : { name: '', customId: '', redirectUris: '' })
  }, [open, existing, reset])

  const mutation = useMutation({
    mutationFn: (data: { name: string; customId: string; redirectUris: string[] }) =>
      existing ? updateApplication(existing.id, data) : createApplication(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(existing ? 'Application updated' : 'Application created')
      onClose()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      const msg = err.response?.data?.error === 'already_exists'
        ? 'That ID is already taken'
        : 'Something went wrong'
      toast.error(msg)
    },
  })

  const onSubmit = (d: FormData) =>
    mutation.mutate({ name: d.name, customId: d.customId, redirectUris: parseRedirectUris(d.redirectUris) })

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Application' : 'New Application'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        <div className="space-y-1">
          <label htmlFor="redirectUris" className="block text-sm font-medium text-gray-700">
            Allowed redirect URIs
          </label>
          <textarea
            id="redirectUris"
            rows={3}
            placeholder={'https://app.example.com/welcome\nhttps://app.example.com/auth/callback'}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono aria-[invalid=true]:border-red-500"
            aria-invalid={errors.redirectUris ? 'true' : 'false'}
            {...register('redirectUris', {
              validate: (value: string) => {
                for (const uri of parseRedirectUris(value)) {
                  try { new URL(uri) } catch { return `Not a valid URL: ${uri}` }
                }
                return true
              },
            })}
          />
          {errors.redirectUris
            ? <p className="text-xs text-red-600">{errors.redirectUris.message}</p>
            : <p className="text-xs text-gray-500">One per line. Return URLs an invite may redirect to; matched by origin.</p>}
        </div>
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
