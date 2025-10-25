import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8080/api/v1',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
    console.log('🔐 API Request with token:', config.method?.toUpperCase(), config.url)
  } else {
    console.warn('⚠️ API Request without token:', config.method?.toUpperCase(), config.url)
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    console.error('❌ API Error:', status, error.response?.data)
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
    if (status === 400) {
      console.error('Bad Request:', error.response?.data?.detail || error.response?.data)
    }
    return Promise.reject(error)
  }
)

export default api
