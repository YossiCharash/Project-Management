import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8080/api/v1',
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
      // optional: keep user informed
      try { window.alert('ההתחברות פגה או לא תקפה. יש להתחבר מחדש.') } catch {}
    }
    return Promise.reject(error)
  }
)

export default api
