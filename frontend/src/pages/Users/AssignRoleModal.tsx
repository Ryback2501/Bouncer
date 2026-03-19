import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApplications } from '../../api/applications'
import { getRoles } from '../../api/roles'
import { assignRole } from '../../api/assignments'
import { Modal } from '../../components/shared/Modal'
import { Select } from '../../components/shared/Select'
import { Input } from '../../components/shared/Input'
import { Button } from '../../components/shared/Button'
import { useToast } from '../../components/shared/useToast'
import type { UserRole } from '../../api/users'

interface FormData {
  roleId: string
  active: string
  expiredAt: string
}

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  existing?: UserRole | null
  existingAppIds: string[]
}

export function AssignRoleModal({ open, onClose, userId, existing, existingAppIds }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          roleId: existing.roleId,
          active: existing.active ? 'true' : 'false',
          expiredAt: existing.expiredAt ? existing.expiredAt.slice(0, 10) : '',
        }
      : { roleId: '', active: 'true', expiredAt: '' },
  })

  const [selectedAppId, setSelectedAppId] = useState(existing?.applicationId ?? '')

  const { data: apps = [] } = useQuery({ queryKey: ['applications'], queryFn: getApplications })

  const availableApps = existing
    ? apps
    : apps.filter(a => !existingAppIds.includes(a.id))

  // Derive the effective app ID — falls back to first available when nothing is selected yet
  const effectiveAppId = selectedAppId || availableApps[0]?.id || ''

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', effectiveAppId],
    queryFn: () => getRoles(effectiveAppId),
    enabled: !!effectiveAppId,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      assignRole(userId, effectiveAppId, {
        roleId: data.roleId,
        active: data.active === 'true',
        expiredAt: data.expiredAt || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', userId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(existing ? 'Role assignment updated' : 'Role assigned')
      onClose()
    },
    onError: () => toast.error('Failed to assign role'),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit Role Assignment' : 'Assign Role'}
      size="sm"
    >
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Select
          label="Application"
          value={effectiveAppId}
          onChange={e => setSelectedAppId(e.target.value)}
          disabled={!!existing}
        >
          {availableApps.map(app => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </Select>

        <Select
          label="Role"
          {...register('roleId', { required: 'Role is required' })}
          error={errors.roleId?.message}
        >
          <option value="">— Select a role —</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </Select>

        <Select label="Status" {...register('active')}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>

        <Input
          label="Expires at (optional)"
          type="date"
          {...register('expiredAt')}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : existing ? 'Update' : 'Assign'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
