import { FormEvent, useEffect, useState } from 'react'
import { useAppDispatch } from '../utils/hooks'
import { fetchMe, login } from '../store/slices/authSlice'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { Link, useNavigate } from 'react-router-dom'

export default function Login() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, token, me } = useSelector((s: RootState) => s.auth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (token && !me) {
      dispatch(fetchMe())
    }
  }, [token, me, dispatch])

  useEffect(() => {
    if (me) {
      navigate('/')
    }
  }, [me, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await dispatch(login({ email, password }))
  }

  return (
    <div className="max-w-sm mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">התחברות</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border rounded p-2" placeholder="אימייל" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="סיסמה" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="w-full bg-gray-900 text-white py-2 rounded" disabled={loading}>
          {loading ? 'טוען...' : 'כניסה'}
        </button>
      </form>
      <div className="text-sm mt-3">אין לך חשבון? <Link className="text-blue-600" to="/register">הרשמה</Link></div>
    </div>
  )
}
