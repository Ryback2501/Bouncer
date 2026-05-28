import client from './client'
import type { UserRole } from './users'

export interface AssignmentApplication {
  id: string
  name: string
  customId: string
}

export interface AssignmentRole {
  id: string
  name: string
  customId: string
}

export interface AssignmentUser {
  id: string
  name: string
  email: string | null
  sub: string
  provider: string
  isGlobalAdmin: boolean
  createdAt: string
}

export interface Assignment {
  id: string
  userId: string
  applicationId: string
  roleId: string
  active: boolean
  expiredAt: string | null
  assignedAt: string
  user: AssignmentUser
  role: AssignmentRole
  application: AssignmentApplication
}

export const getAssignments = () =>
  client.get<Assignment[]>('/assignments').then(r => r.data)

export const assignRole = (
  userId: string,
  appId: string,
  data: { roleId: string; active?: boolean; expiredAt?: string | null }
) => client.put<UserRole>(`/users/${userId}/roles/${appId}`, data).then(r => r.data)

export const removeRole = (userId: string, appId: string) =>
  client.delete(`/users/${userId}/roles/${appId}`)
