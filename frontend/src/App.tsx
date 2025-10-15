import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState } from './store'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Reports from './pages/Reports'
import { logout } from './store/slices/authSlice'

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useSelector((s: RootState) => s.auth.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const token = useSelector((s: RootState) => s.auth.token)
  const me = useSelector((s: RootState) => s.auth.me)

  const onLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-4 items-center">
          <Link to="/" className="font-semibold">BMS</Link>
          <Link to="/" className="text-sm">לוח בקרה</Link>
          <Link to="/reports" className="text-sm">דוחות</Link>
          <div className="ml-auto flex gap-3 items-center">
            {!token ? (
              <>
                <Link to="/login" className="text-sm">התחברות</Link>
                <Link to="/register" className="text-sm">הרשמה</Link>
              </>
            ) : (
              <>
                {me?.email && <span className="text-sm text-gray-700">{me.email}</span>}
                <button className="text-sm bg-gray-200 px-3 py-1 rounded" onClick={onLogout}>התנתקות</button>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/projects/:id" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
        </Routes>
      </main>
    </div>
  )
}
