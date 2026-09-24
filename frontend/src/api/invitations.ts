import client from './client'

export interface InvitationApplication {
  id: string
  name: string
  customId: string
}

export interface InvitationRole {
  id: string
  name: string
  customId: string
}

export interface Invitation {
  id: string
  applicationId: string
  roleId: string
  redirectUri: string | null
  expiresAt: string
  usedAt: string | null
  createdAt: string
  createdBy: { name: string; email: string | null } | null
  // Set when an API key minted the invitation (via /api/v1/invitations). A snapshot, so the label
  // is still here after the key itself has been revoked.
  createdByApiKeyId: string | null
  createdByApiKeyLabel: string | null
  application: InvitationApplication
  role: InvitationRole
  // Returned only by the create endpoint (the single-use URL).
  inviteUrl?: string
}

export interface CreateInvitationPayload {
  applicationId: string
  roleId: string
  redirectUri?: string
}

export const getInvitations = () =>
  client.get<Invitation[]>('/invitations').then(r => r.data)

export const createInvitation = (payload: CreateInvitationPayload) =>
  client.post<Invitation>('/invitations', payload).then(r => r.data)

export const deleteInvitation = (id: string) =>
  client.delete(`/invitations/${id}`)
