import client from './client'
import type { UserRole } from './users'

export const getUserRoles = (userId: string) =>
  client.get<UserRole[]>(`/users/${userId}/roles`).then(r => r.data)

export const assignRole = (
  userId: string,
  appId: string,
  data: { roleId: string; active?: boolean; expiredAt?: string | null }
) => client.put<UserRole>(`/users/${userId}/roles/${appId}`, data).then(r => r.data)

export const removeRole = (userId: string, appId: string) =>
  client.delete(`/users/${userId}/roles/${appId}`)
