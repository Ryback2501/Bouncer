import client from './client'

export interface Role {
  id: string
  name: string
  customId: string
  applicationId: string
  createdAt: string
  _count?: { userRoles: number }
}

export const getRoles = (appId: string) =>
  client.get<Role[]>(`/applications/${appId}/roles`).then(r => r.data)
export const createRole = (appId: string, data: { name: string; customId: string }) =>
  client.post<Role>(`/applications/${appId}/roles`, data).then(r => r.data)
export const updateRole = (appId: string, roleId: string, data: { name?: string; customId?: string }) =>
  client.patch<Role>(`/applications/${appId}/roles/${roleId}`, data).then(r => r.data)
export const deleteRole = (appId: string, roleId: string) =>
  client.delete(`/applications/${appId}/roles/${roleId}`)
