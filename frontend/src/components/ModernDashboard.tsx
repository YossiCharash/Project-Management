import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchMe } from '../store/slices/authSlice'
import { DashboardAPI } from '../lib/apiClient'
import { DashboardSnapshot } from '../types/api'
import { LoadingDashboard } from './ui/Loading'
import { 
  AlertTriangle,
  Plus,
  RefreshCw
} from 'lucide-react'
import SystemFinancialPieChart from './charts/SystemFinancialPieChart'

// Removed all project-related components - simplified dashboard only shows central pie chart

interface ModernDashboardProps {
  onCreateProject?: () => void
}

export default function ModernDashboard({ onCreateProject }: ModernDashboardProps) {
  const dispatch = useAppDispatch()
  const me = useAppSelector(s => s.auth.me)
  const [dashboardData, setDashboardData] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Do not block on user; load dashboard in parallel for speed
    if (!me) dispatch(fetchMe())
  }, [dispatch, me])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await DashboardAPI.getDashboardSnapshot()
      setDashboardData(data)
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingDashboard count={1} />

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center"
      >
        <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">שגיאה בטעינת הנתונים</h3>
        <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
        <button 
          onClick={loadDashboardData}
          className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          נסה שוב
        </button>
      </motion.div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div className="text-center text-gray-500 dark:text-gray-400">אין נתוני דשבורד להצגה</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ברוכים הבאים, {me?.full_name || 'משתמש'}! 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            סקירה פיננסית כללית של כל הפרויקטים
          </p>
        </div>
        {onCreateProject && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCreateProject}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>צור פרויקט חדש</span>
          </motion.button>
        )}
      </motion.div>

      {/* Central Financial Overview Pie Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center"
      >
        <SystemFinancialPieChart
          totalIncome={dashboardData.summary.total_income}
          totalExpense={dashboardData.summary.total_expense}
          expenseCategories={dashboardData.expense_categories}
        />
      </motion.div>
    </div>
  )
}
