import axios from 'axios'

// Support runtime configuration via window.ENV (for Docker/K8s)
declare global {
  interface Window {
    ENV?: {
      API_URL?: string;
    }
  }
}

const api = axios.create({
  // Order of precedence:
  // 1. Runtime config (window.ENV.API_URL)
  // 2. Build-time env var (VITE_API_URL)
  // 3. Fallback to localhost
  baseURL: window.ENV?.API_URL || import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  timeout: 30000, // avoid ECONNABORTED on heavy endpoints during dev
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})
api.interceptors.response.use(
  (res) => {
    return res
  },
  (error) => {
    const status = error?.response?.status

    if (status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token')

      // Save current location to redirect back after login
      const currentPath = window.location.pathname + window.location.search
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.setItem('redirectAfterLogin', currentPath)
      }

      // Redirect to login page
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api
