import client from './client'

export type AuditOutcome = 'success' | 'denied' | 'failure'

export interface AuditEvent {
  id: string
  createdAt: string
  action: string
  outcome: AuditOutcome
  actorType: 'user' | 'api_key' | 'anonymous'
  actorId: string | null
  actorLabel: string | null
  targetType: string | null
  targetId: string | null
  targetLabel: string | null
  ip: string | null
  details: Record<string, unknown> | null
}

export interface AuditPage {
  total: number
  page: number
  limit: number
  events: AuditEvent[]
}

export interface AuditQuery {
  page: number
  limit: number
  /** Action prefix, e.g. "auth." */
  action?: string
  outcome?: AuditOutcome
}

export const getAuditEvents = (params: AuditQuery) =>
  client.get<AuditPage>('/audit', { params }).then(r => r.data)
