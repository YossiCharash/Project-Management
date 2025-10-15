import { FormEvent, useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { clearAuthState, register } from '../store/slices/authSlice'
import { Link, useNavigate } from 'react-router-dom'

export default function Register() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, registered } = useAppSelector(s => s.auth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (registered) {
      dispatch(clearAuthState())
      navigate('/login')
    }
  }, [registered, dispatch, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await dispatch(register({ email, password }))
  }

  return (
    <div className="max-w-sm mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">הרשמה</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border rounded p-2" placeholder="אימייל" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="סיסמה" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="w-full bg-gray-900 text-white py-2 rounded" disabled={loading}>
          {loading ? 'טוען...' : 'צור חשבון'}
        </button>
      </form>
      <div className="text-sm mt-3">כבר יש לך חשבון? <Link className="text-blue-600" to="/login">התחברות</Link></div>
    </div>
  )
}
