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
  onProjectClick?: (project: any) => void
  onProjectEdit?: (project: any) => void
}

export default function ModernDashboard({ onProjectClick, onProjectEdit }: ModernDashboardProps) {
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
      {/* Summary Cards - Total Income, Expense, Profit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">סה"כ הכנסות</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {dashboardData.summary.total_income.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">₪</p>
            </div>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">סה"כ הוצאות</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {dashboardData.summary.total_expense.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">₪</p>
            </div>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">💸</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${
            dashboardData.summary.total_profit >= 0 
              ? 'border-green-200 dark:border-green-800' 
              : 'border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">סה"כ רווח/הפסד</p>
              <p className={`text-3xl font-bold ${
                dashboardData.summary.total_profit >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {dashboardData.summary.total_profit >= 0 ? '+' : ''}
                {dashboardData.summary.total_profit.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">₪</p>
            </div>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              dashboardData.summary.total_profit >= 0 
                ? 'bg-green-100 dark:bg-green-900/20' 
                : 'bg-red-100 dark:bg-red-900/20'
            }`}>
              <span className="text-2xl">{dashboardData.summary.total_profit >= 0 ? '📈' : '📉'}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Central Financial Overview Pie Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
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
