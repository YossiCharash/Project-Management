import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppDispatch } from '../utils/hooks'
import { fetchMe, login, clearPasswordChangeRequirement } from '../store/slices/authSlice'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Building2, Mail, Lock, ArrowRight } from 'lucide-react'
import { LoadingSpinner } from '../components/ui/Loading'
import { cn } from '../lib/utils'
import api from '../lib/api'
import ChangePasswordModal from '../components/ChangePasswordModal'

export default function Login() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, token, me, requiresPasswordChange } = useSelector((s: RootState) => s.auth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)

  // Handle successful login
  useEffect(() => {
    if (token && !loading && !requiresPasswordChange) {
      // Navigate immediately after getting token (unless password change is required)
      const redirectPath = localStorage.getItem('redirectAfterLogin')
      if (redirectPath) {
        localStorage.removeItem('redirectAfterLogin')
        navigate(redirectPath)
      } else {
        navigate('/')
      }
      // Fetch user data in background
      if (!me) dispatch(fetchMe())
    } else if (token && requiresPasswordChange) {
      // Show password change modal if required - DO NOT navigate until password is changed
      setShowChangePasswordModal(true)
      // Prevent navigation - user must change password first
    }
  }, [token, loading, requiresPasswordChange, dispatch, navigate, me])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await dispatch(login({ email, password }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = () => {
    // Redirect to backend OAuth endpoint
    const apiBaseUrl = '/api/v1'
    const redirectUrl = window.location.origin + '/auth/callback'
    window.location.href = `${apiBaseUrl}/auth/google?redirect_url=${encodeURIComponent(redirectUrl)}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo and Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ברוכים הבאים
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            התחברו למערכת ניהול הנכסים שלכם
          </p>
        </motion.div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8"
        >
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                כתובת אימייל
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="הזינו את כתובת האימייל שלכם"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                סיסמה
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="הזינו את הסיסמה שלכם"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
              >
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                {error.includes('Invalid credentials') && (
                  <p className="text-red-500 dark:text-red-400 text-xs mt-2">
                    אם אין לכם חשבון, אנא הירשמו תחילה
                  </p>
                )}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isSubmitting || loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2",
                (isSubmitting || loading) && "opacity-50 cursor-not-allowed"
              )}
            >
              {(isSubmitting || loading) ? (
                <>
                  <LoadingSpinner size="sm" className="text-white" />
                  <span>מתחבר...</span>
                </>
              ) : (
                <>
                  <span>התחברות</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>

            {/* Google OAuth Login Button */}
            <motion.button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full py-3 px-6 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading ? (
                <LoadingSpinner size="sm" className="text-gray-900 dark:text-white" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.2 7.72c-.56 1.14-.88 2.4-.88 3.78 0 1.38.32 2.64.88 3.78l3.64-2.19z"
                    />
                    <path
                      fill="#4285F4"
                      d="M12 5.54c1.77 0 3.36.61 4.62 1.83l3.43-3.43C17.56 2.32 14.92 1 12 1 7.4 1 3.35 3.48 1.32 7.07l3.52 2.76c.99-3.01 3.93-5.29 7.16-5.29z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M12 19.36c-3.23 0-6.17-2.28-7.16-5.29L1.32 16.83C3.35 20.42 7.4 22.9 12 22.9c2.92 0 5.56-1.32 7.05-3.94l-3.43-3.43c-1.26 1.22-2.85 1.83-4.62 1.83z"
                    />
                    <path
                      fill="#34A853"
                      d="M21.04 12.13c0-.75-.07-1.47-.2-2.18H12v4.1h5.05c-.28 1.48-1.12 2.73-2.39 3.57l3.43 3.43c2.08-1.92 3.35-4.75 3.35-8.92z"
                    />
                  </svg>
                  <span>התחבר עם Google</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Register Links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 text-center space-y-3"
          >
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              אין לכם חשבון?{' '}
              <Link
                to="/register"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
              >
                הירשמו כאן
              </Link>
            </p>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
                רוצים להירשם עם אימות אימייל?
              </p>
              <Link
                to="/email-register"
                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium text-sm transition-colors block"
              >
                רישום עם אימות אימייל
              </Link>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
                קיבלתם קוד הזמנה למנהל מערכת?
              </p>
              <Link
                to="/admin-invite"
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium text-sm transition-colors block"
              >
                רישום עם קוד הזמנה
              </Link>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            © 2024 מערכת ניהול נכסים. כל הזכויות שמורות.
          </p>
        </motion.div>
      </motion.div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => {
          // Only allow closing if password change is not required
          if (!requiresPasswordChange) {
            setShowChangePasswordModal(false)
            dispatch(clearPasswordChangeRequirement())
          }
          // If required, do nothing - user cannot close without changing password
        }}
        onSuccess={() => {
          setShowChangePasswordModal(false)
          dispatch(clearPasswordChangeRequirement())
          dispatch(fetchMe())
          const redirectPath = localStorage.getItem('redirectAfterLogin')
          if (redirectPath) {
            localStorage.removeItem('redirectAfterLogin')
            navigate(redirectPath)
          } else {
            navigate('/')
          }
        }}
        isRequired={requiresPasswordChange}
      />
    </div>
  )
}