import client from './client'

export interface ApiKey {
  id: string
  label: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface NewApiKey extends ApiKey {
  rawKey: string
}

export const getApiKeys = (appId: string) =>
  client.get<ApiKey[]>(`/applications/${appId}/api-keys`).then(r => r.data)
export const createApiKey = (appId: string, label?: string) =>
  client.post<NewApiKey>(`/applications/${appId}/api-keys`, { label }).then(r => r.data)
export const deleteApiKey = (appId: string, keyId: string) =>
  client.delete(`/applications/${appId}/api-keys/${keyId}`)
