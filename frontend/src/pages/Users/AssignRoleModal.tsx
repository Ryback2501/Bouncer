import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApplications } from '../../api/applications'
import { getRoles } from '../../api/roles'
import { assignRole } from '../../api/assignments'
import { Modal } from '../../components/shared/Modal'
import { Select } from '../../components/shared/Select'
import { Input } from '../../components/shared/Input'
import { Button } from '../../components/shared/Button'
import { useToast } from '../../components/shared/Toast'
import type { UserRole } from '../../api/users'

interface FormData {
  applicationId: string
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
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>()

  const selectedAppId = watch('applicationId')

  const { data: apps = [] } = useQuery({ queryKey: ['applications'], queryFn: getApplications })
  const { data: roles = [] } = useQuery({
    queryKey: ['roles', selectedAppId],
    queryFn: () => getRoles(selectedAppId),
    enabled: !!selectedAppId,
  })

  // Available apps: all apps, but when creating, exclude ones already assigned
  const availableApps = existing
    ? apps
    : apps.filter(a => !existingAppIds.includes(a.id))

  useEffect(() => {
    if (open) {
      reset(existing
        ? {
            applicationId: existing.applicationId,
            roleId: existing.roleId,
            active: existing.active ? 'true' : 'false',
            expiredAt: existing.expiredAt ? existing.expiredAt.slice(0, 10) : '',
          }
        : {
            applicationId: availableApps[0]?.id ?? '',
            roleId: '',
            active: 'true',
            expiredAt: '',
          }
      )
    }
  }, [open, existing, availableApps.length])

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      assignRole(userId, data.applicationId, {
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
          {...register('applicationId', { required: 'Application is required' })}
          error={errors.applicationId?.message}
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
