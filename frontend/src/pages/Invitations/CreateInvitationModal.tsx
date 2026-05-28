import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApplications } from '../../api/applications'
import { getRoles } from '../../api/roles'
import { createInvitation } from '../../api/invitations'
import { Modal } from '../../components/shared/Modal'
import { Select } from '../../components/shared/Select'
import { Input } from '../../components/shared/Input'
import { Button } from '../../components/shared/Button'
import { CopyableCode } from '../../components/shared/CopyableCode'
import { useToast } from '../../components/shared/useToast'

interface FormData {
  roleId: string
  redirectUri: string
}

interface Props {
  open: boolean
  onClose: () => void
}

// The form is split out so the parent can re-mount it (via `key`) whenever the modal
// opens, guaranteeing a fresh form + selection state without setState-in-effect.
function CreateInvitationForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (inviteUrl: string) => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [selectedAppId, setSelectedAppId] = useState('')
  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    defaultValues: { roleId: '', redirectUri: '' },
  })

  const { data: apps = [] } = useQuery({ queryKey: ['applications'], queryFn: getApplications })

  // Same cascading pattern as AssignRoleModal: the roles query is enabled only once an
  // application is picked.
  const effectiveAppId = selectedAppId || apps[0]?.id || ''
  const selectedApp = apps.find(a => a.id === effectiveAppId)

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', effectiveAppId],
    queryFn: () => getRoles(effectiveAppId),
    enabled: !!effectiveAppId,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createInvitation({
        applicationId: effectiveAppId,
        roleId: data.roleId,
        redirectUri: data.redirectUri.trim() || undefined,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (data.inviteUrl) onCreated(data.inviteUrl)
    },
    onError: () => toast.error('Failed to create invitation'),
  })

  function onSubmit(data: FormData) {
    // Best-effort client-side redirectUri origin check against the chosen app's allowlist.
    // Backend remains the source of truth via 400 `redirect_uri_not_allowed`.
    if (data.redirectUri.trim() && selectedApp?.redirectUris?.length) {
      try {
        const candidate = new URL(data.redirectUri)
        const allowed = selectedApp.redirectUris.some(allowedUri => {
          try {
            return new URL(allowedUri).origin === candidate.origin
          } catch {
            return false
          }
        })
        if (!allowed) {
          setError('redirectUri', {
            message: `Origin not in this application's allowlist: ${selectedApp.redirectUris.join(', ')}`,
          })
          return
        }
      } catch {
        setError('redirectUri', { message: 'Must be a valid URL' })
        return
      }
    }
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Application"
        value={effectiveAppId}
        onChange={e => setSelectedAppId(e.target.value)}
      >
        <option value="">— Select an application —</option>
        {apps.map(app => (
          <option key={app.id} value={app.id}>{app.name}</option>
        ))}
      </Select>

      <Select
        label="Role"
        {...register('roleId', { required: 'Role is required' })}
        error={errors.roleId?.message}
        disabled={!effectiveAppId || roles.length === 0}
      >
        <option value="">— Select a role —</option>
        {roles.map(role => (
          <option key={role.id} value={role.id}>{role.name}</option>
        ))}
      </Select>

      <div className="space-y-1">
        <Input
          label="Redirect URI (optional)"
          type="url"
          placeholder="https://app.example.com/welcome"
          {...register('redirectUri')}
          error={errors.redirectUri?.message}
        />
        <p className="text-xs text-gray-500">
          {selectedApp?.redirectUris?.length
            ? `Must match one of the application's allowed origins.`
            : 'Where to send the invitee after acceptance. Leave blank for a confirmation page.'}
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending || !effectiveAppId}>
          {mutation.isPending ? 'Creating…' : 'Create Invitation'}
        </Button>
      </div>
    </form>
  )
}

export function CreateInvitationModal({ open, onClose }: Props) {
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  function close() {
    setInviteLink(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title={inviteLink ? 'Invitation Link' : 'Create Invitation'} size="md">
      {inviteLink ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            Share this link with the invitee. It expires in 24 hours and can only be used once.
          </div>
          <CopyableCode value={inviteLink} />
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        // Re-mount the form on every open so its state always starts clean.
        open && <CreateInvitationForm key={String(open)} onCancel={close} onCreated={setInviteLink} />
      )}
    </Modal>
  )
}
