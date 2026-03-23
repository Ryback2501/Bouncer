import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import client from '../api/client'
import { getApplications, getApplication, createApplication, updateApplication, deleteApplication } from '../api/applications'
import { getRoles, createRole, updateRole, deleteRole } from '../api/roles'
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../api/users'
import { getApiKeys, createApiKey, deleteApiKey } from '../api/apiKeys'
import { getInvitations, createInvitation, deleteInvitation, getAdmins } from '../api/invitations'
import { assignRole, removeRole } from '../api/assignments'

const c = client as unknown as { get: Mock; post: Mock; patch: Mock; put: Mock; delete: Mock }

describe('Applications API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getApplications calls GET /applications', async () => {
    c.get.mockResolvedValue({ data: [] })
    const result = await getApplications()
    expect(c.get).toHaveBeenCalledWith('/applications')
    expect(result).toEqual([])
  })

  it('getApplication calls GET /applications/:id', async () => {
    c.get.mockResolvedValue({ data: { id: 'a1' } })
    const result = await getApplication('a1')
    expect(c.get).toHaveBeenCalledWith('/applications/a1')
    expect(result).toEqual({ id: 'a1' })
  })

  it('createApplication calls POST /applications', async () => {
    c.post.mockResolvedValue({ data: { id: 'a1', name: 'App', customId: 'app' } })
    await createApplication({ name: 'App', customId: 'app' })
    expect(c.post).toHaveBeenCalledWith('/applications', { name: 'App', customId: 'app' })
  })

  it('updateApplication calls PATCH /applications/:id', async () => {
    c.patch.mockResolvedValue({ data: {} })
    await updateApplication('a1', { name: 'New' })
    expect(c.patch).toHaveBeenCalledWith('/applications/a1', { name: 'New' })
  })

  it('deleteApplication calls DELETE /applications/:id', async () => {
    c.delete.mockResolvedValue({})
    await deleteApplication('a1')
    expect(c.delete).toHaveBeenCalledWith('/applications/a1')
  })
})

describe('Roles API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getRoles calls GET /applications/:appId/roles', async () => {
    c.get.mockResolvedValue({ data: [] })
    await getRoles('app1')
    expect(c.get).toHaveBeenCalledWith('/applications/app1/roles')
  })

  it('createRole calls POST /applications/:appId/roles', async () => {
    c.post.mockResolvedValue({ data: {} })
    await createRole('app1', { name: 'Admin', customId: 'admin' })
    expect(c.post).toHaveBeenCalledWith('/applications/app1/roles', { name: 'Admin', customId: 'admin' })
  })

  it('updateRole calls PATCH /applications/:appId/roles/:roleId', async () => {
    c.patch.mockResolvedValue({ data: {} })
    await updateRole('app1', 'r1', { name: 'Updated' })
    expect(c.patch).toHaveBeenCalledWith('/applications/app1/roles/r1', { name: 'Updated' })
  })

  it('deleteRole calls DELETE /applications/:appId/roles/:roleId', async () => {
    c.delete.mockResolvedValue({})
    await deleteRole('app1', 'r1')
    expect(c.delete).toHaveBeenCalledWith('/applications/app1/roles/r1')
  })
})

describe('Users API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getUsers calls GET /users with params', async () => {
    c.get.mockResolvedValue({ data: { users: [], total: 0, page: 1, limit: 20 } })
    await getUsers({ search: 'alice', page: 2 })
    expect(c.get).toHaveBeenCalledWith('/users', { params: { search: 'alice', page: 2 } })
  })

  it('getUser calls GET /users/:id', async () => {
    c.get.mockResolvedValue({ data: {} })
    await getUser('u1')
    expect(c.get).toHaveBeenCalledWith('/users/u1')
  })

  it('createUser calls POST /users', async () => {
    c.post.mockResolvedValue({ data: {} })
    await createUser({ name: 'Bob', sub: '123', provider: 'google' })
    expect(c.post).toHaveBeenCalledWith('/users', { name: 'Bob', sub: '123', provider: 'google' })
  })

  it('updateUser calls PATCH /users/:id', async () => {
    c.patch.mockResolvedValue({ data: {} })
    await updateUser('u1', { name: 'Bob Updated' })
    expect(c.patch).toHaveBeenCalledWith('/users/u1', { name: 'Bob Updated' })
  })

  it('deleteUser calls DELETE /users/:id', async () => {
    c.delete.mockResolvedValue({})
    await deleteUser('u1')
    expect(c.delete).toHaveBeenCalledWith('/users/u1')
  })
})

describe('ApiKeys API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getApiKeys calls GET /applications/:appId/api-keys', async () => {
    c.get.mockResolvedValue({ data: [] })
    await getApiKeys('app1')
    expect(c.get).toHaveBeenCalledWith('/applications/app1/api-keys')
  })

  it('createApiKey calls POST with label', async () => {
    c.post.mockResolvedValue({ data: {} })
    await createApiKey('app1', 'prod')
    expect(c.post).toHaveBeenCalledWith('/applications/app1/api-keys', { label: 'prod' })
  })

  it('createApiKey calls POST without label when omitted', async () => {
    c.post.mockResolvedValue({ data: {} })
    await createApiKey('app1')
    expect(c.post).toHaveBeenCalledWith('/applications/app1/api-keys', { label: undefined })
  })

  it('deleteApiKey calls DELETE', async () => {
    c.delete.mockResolvedValue({})
    await deleteApiKey('app1', 'k1')
    expect(c.delete).toHaveBeenCalledWith('/applications/app1/api-keys/k1')
  })
})

describe('Invitations API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getInvitations calls GET /invitations', async () => {
    c.get.mockResolvedValue({ data: [] })
    await getInvitations()
    expect(c.get).toHaveBeenCalledWith('/invitations')
  })

  it('createInvitation calls POST /invitations', async () => {
    c.post.mockResolvedValue({ data: {} })
    await createInvitation()
    expect(c.post).toHaveBeenCalledWith('/invitations')
  })

  it('deleteInvitation calls DELETE /invitations/:id', async () => {
    c.delete.mockResolvedValue({})
    await deleteInvitation('inv1')
    expect(c.delete).toHaveBeenCalledWith('/invitations/inv1')
  })

  it('getAdmins calls GET /admins', async () => {
    c.get.mockResolvedValue({ data: [] })
    await getAdmins()
    expect(c.get).toHaveBeenCalledWith('/admins')
  })
})

describe('Assignments API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assignRole calls PUT /users/:userId/roles/:appId', async () => {
    c.put.mockResolvedValue({ data: {} })
    await assignRole('u1', 'app1', { roleId: 'r1', active: true, expiredAt: null })
    expect(c.put).toHaveBeenCalledWith('/users/u1/roles/app1', { roleId: 'r1', active: true, expiredAt: null })
  })

  it('removeRole calls DELETE /users/:userId/roles/:appId', async () => {
    c.delete.mockResolvedValue({})
    await removeRole('u1', 'app1')
    expect(c.delete).toHaveBeenCalledWith('/users/u1/roles/app1')
  })
})
