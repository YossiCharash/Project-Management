import axios from 'axios'

const api = axios.create({
  baseURL: "https://project-manager-bms-backend-at-yossi-dev.apps.rm1.0a51.p1.openshiftapps.com/api/v1/",
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
  (res) => res,
  (error) => {
    const status = error?.response?.status
    if (status === 403) {
      try { window.alert('אין לך הרשאה לבצע את הפעולה הזו') } catch {}
    }
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
