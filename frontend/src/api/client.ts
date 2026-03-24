import axios from 'axios'

const client = axios.create({
  baseURL: '/admin',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
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
