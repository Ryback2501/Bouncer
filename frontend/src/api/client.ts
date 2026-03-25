import axios from 'axios'

const client = axios.create({
  baseURL: '/admin',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete']
let csrfToken: string | null = null

async function fetchCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const res = await axios.get('/auth/csrf-token', { withCredentials: true })
    csrfToken = res.data.csrfToken
  }
  return csrfToken!
}

client.interceptors.request.use(async (config) => {
  if (MUTATING_METHODS.includes(config.method?.toLowerCase() ?? '')) {
    config.headers['x-csrf-token'] = await fetchCsrfToken()
  }
  return config
})

const PUBLIC_PATHS = ['/login', '/invite']

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const isPublic = PUBLIC_PATHS.some(p => window.location.pathname.startsWith(p))
    if (err.response?.status === 401 && !isPublic) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
