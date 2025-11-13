import axios from 'axios'

// ההגדרה של baseURL - משתמשת ב-relative path ב-production (עבור nginx proxy)
// וב-localhost ב-development (או דרך vite proxy)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8000/api/v1" : "/api/v1"),
  timeout: 30000, // avoid ECONNABORTED on heavy endpoints during dev
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }

  // Log all API requests for debugging
  const fullUrl = `${config.baseURL}${config.url}`
  console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${fullUrl}`, {
    params: config.params,
    data: config.data,
    headers: {
      Authorization: config.headers?.Authorization ? 'Bearer ***' : 'None',
      'Content-Type': config.headers?.['Content-Type']
    }
  })

  return config
})
api.interceptors.response.use(
  (res) => {
    // Log successful API responses
    const fullUrl = `${res.config.baseURL}${res.config.url}`
    console.log(`✅ [API Response] ${res.config.method?.toUpperCase()} ${fullUrl}`, {
      status: res.status,
      statusText: res.statusText,
      dataSize: JSON.stringify(res.data).length,
      headers: res.headers
    })
    return res
  },
  (error) => {
    const status = error?.response?.status
    const fullUrl = error?.config ? `${error.config.baseURL}${error.config.url}` : 'Unknown URL'

    // Log all API errors
    console.error(`❌ [API Error] ${error?.config?.method?.toUpperCase() || 'UNKNOWN'} ${fullUrl}`, {
      status: status,
      statusText: error?.response?.statusText,
      message: error?.message,
      responseData: error?.response?.data,
      redirectLocation: error?.response?.headers?.location,
      isRedirect: status === 301 || status === 302 || status === 307 || status === 308
    })

    // FIX 2: הוחלף window.alert (אסור) בהודעה לקונסול
    if (status === 403) {
      console.error('Forbidden (403): אין לך הרשאה לבצע את הפעולה הזו.')
    }

    if (status === 401) {
      console.error('Unauthorized (401): מנסה הפנייה לדף ההתחברות...')
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

    // Log redirect errors specifically
    if (status === 307 || status === 308) {
      console.error(`⚠️ [307/308 Redirect Detected] ${fullUrl}`, {
        redirectLocation: error?.response?.headers?.location,
        currentUrl: window.location.href,
        suggestion: 'Check nginx proxy_redirect configuration'
      })
    }

    return Promise.reject(error)
  }
)

export default api
