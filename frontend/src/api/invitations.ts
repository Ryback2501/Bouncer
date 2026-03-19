import client from './client'

export interface Invitation {
  id: string
  token: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
  createdBy: { name: string; email: string | null }
  inviteUrl: string
}

export interface BouncerAdmin {
  id: string
  name: string
  email: string | null
  provider: string
  isGlobalAdmin: boolean
  createdAt: string
}

export const getInvitations = () =>
  client.get<Invitation[]>('/invitations').then(r => r.data)

export const createInvitation = () =>
  client.post<Invitation>('/invitations').then(r => r.data)

export const deleteInvitation = (id: string) =>
  client.delete(`/invitations/${id}`)

export const getAdmins = () =>
  client.get<BouncerAdmin[]>('/admins').then(r => r.data)
