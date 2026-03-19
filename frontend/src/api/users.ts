import client from './client'
import type { Application } from './applications'
import type { Role } from './roles'

export interface User {
  id: string
  name: string
  sub: string
  provider: string
  isGlobalAdmin: boolean
  createdAt: string
  _count?: { userRoles: number }
}

export interface UserRole {
  id: string
  userId: string
  applicationId: string
  roleId: string
  active: boolean
  expiredAt: string | null
  assignedAt: string
  application: Application
  role: Role
}

export interface UserDetail extends User {
  userRoles: UserRole[]
}

export interface UsersPage {
  total: number
  page: number
  limit: number
  users: User[]
}

export const getUsers = (params?: { search?: string; page?: number; limit?: number }) =>
  client.get<UsersPage>('/users', { params }).then(r => r.data)
export const getUser = (id: string) => client.get<UserDetail>(`/users/${id}`).then(r => r.data)
export const createUser = (data: { name: string; sub: string; provider: string }) =>
  client.post<User>('/users', data).then(r => r.data)
export const updateUser = (id: string, data: { name?: string; sub?: string; provider?: string }) =>
  client.patch<User>(`/users/${id}`, data).then(r => r.data)
export const deleteUser = (id: string) => client.delete(`/users/${id}`)
