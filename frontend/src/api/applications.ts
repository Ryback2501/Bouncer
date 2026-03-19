import client from './client'

export interface Application {
  id: string
  name: string
  customId: string
  createdAt: string
  updatedAt: string
  _count?: { roles: number; userRoles: number; apiKeys: number }
}

export const getApplications = () => client.get<Application[]>('/applications').then(r => r.data)
export const getApplication = (id: string) => client.get<Application>(`/applications/${id}`).then(r => r.data)
export const createApplication = (data: { name: string; customId: string }) =>
  client.post<Application>('/applications', data).then(r => r.data)
export const updateApplication = (id: string, data: { name?: string; customId?: string }) =>
  client.patch<Application>(`/applications/${id}`, data).then(r => r.data)
export const deleteApplication = (id: string) => client.delete(`/applications/${id}`)
