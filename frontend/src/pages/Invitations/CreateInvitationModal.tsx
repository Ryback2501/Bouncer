import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApplications } from '../../api/applications'
import { getRoles } from '../../api/roles'
import { createInvitation } from '../../api/invitations'
import { Modal } from '../../components/shared/Modal'
import { Select } from '../../components/shared/Select'
import { Button } from '../../components/shared/Button'
import { CopyableCode } from '../../components/shared/CopyableCode'
import { useToast } from '../../components/shared/useToast'

interface FormData {
  roleId: string
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
  // null = "use derived default"; '' = user explicitly chose (none); other = chosen URI.
  // Reset to null when the application changes so the new app's default reapplies.
  const [redirectUriChoice, setRedirectUriChoice] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { roleId: '' },
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

  // Redirect URI is chosen from the application's `redirectUris` allowlist (or `(none)`),
  // so the backend's origin-match validation can't fail at submit time. If the app has
  // exactly one URI, preselect it; otherwise default to `(none)`.
  const redirectUriOptions = selectedApp?.redirectUris ?? []
  const defaultRedirectUri = redirectUriOptions.length === 1 ? redirectUriOptions[0] : ''
  const effectiveRedirectUri = redirectUriChoice ?? defaultRedirectUri

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createInvitation({
        applicationId: effectiveAppId,
        roleId: data.roleId,
        redirectUri: effectiveRedirectUri || undefined,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (data.inviteUrl) onCreated(data.inviteUrl)
    },
    onError: () => toast.error('Failed to create invitation'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <Select
        label="Application"
        value={effectiveAppId}
        onChange={e => {
          setSelectedAppId(e.target.value)
          setRedirectUriChoice(null) // reapply the new app's default
        }}
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
        <Select
          label="Redirect URI (optional)"
          value={effectiveRedirectUri}
          onChange={e => setRedirectUriChoice(e.target.value)}
          disabled={!effectiveAppId}
        >
          <option value="">(none — show confirmation page)</option>
          {redirectUriOptions.map(uri => (
            <option key={uri} value={uri}>{uri}</option>
          ))}
        </Select>
        <p className="text-xs text-gray-500">
          {redirectUriOptions.length > 0
            ? 'Where to send the invitee after they accept — pick one of the application’s registered redirect URIs.'
            : 'This application has no redirect URIs configured. Add some on its Applications page to enable redirecting; for now invitations land on a confirmation page.'}
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
