import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchMe } from '../store/slices/authSlice'
import { DashboardAPI, ProjectAPI } from '../lib/apiClient'
import { DashboardSnapshot } from '../types/api'
import { LoadingDashboard } from './ui/Loading'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle,
  Plus,
  RefreshCw,
  X,
  ExternalLink
} from 'lucide-react'
import SystemFinancialPieChart from './charts/SystemFinancialPieChart'

// Removed all project-related components - simplified dashboard only shows central pie chart

interface ModernDashboardProps {
  onProjectClick?: (project: any) => void
  onProjectEdit?: (project: any) => void
}

export default function ModernDashboard({ onProjectClick, onProjectEdit }: ModernDashboardProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const me = useAppSelector(s => s.auth.me)
  const [dashboardData, setDashboardData] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profitabilityAlerts, setProfitabilityAlerts] = useState<Array<{
    id: number
    name: string
    profit_margin: number
    income: number
    expense: number
    profit: number
    is_subproject: boolean
    parent_project_id: number | null
  }>>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set())
  const [selectedAlerts, setSelectedAlerts] = useState<Set<number>>(new Set())
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(false)

  useEffect(() => {
    // Do not block on user; load dashboard in parallel for speed
    if (!me) dispatch(fetchMe())
  }, [dispatch, me])

  useEffect(() => {
    loadDashboardData()
    loadProfitabilityAlerts()
    // Load dismissed alerts from localStorage
    const dismissed = localStorage.getItem('dismissedProfitabilityAlerts')
    if (dismissed) {
      try {
        setDismissedAlerts(new Set(JSON.parse(dismissed)))
      } catch (e) {
        console.error('Failed to load dismissed alerts:', e)
      }
    }
  }, [])

  // Auto-refresh alerts every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        loadProfitabilityAlerts()
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [loading])

  const loadProfitabilityAlerts = async () => {
    setAlertsLoading(true)
    try {
      console.log('Loading profitability alerts...')
      const data = await ProjectAPI.getProfitabilityAlerts()
      console.log('Profitability alerts loaded:', data)
      console.log('Number of alerts:', data.alerts?.length || 0)
      setProfitabilityAlerts(data.alerts || [])
    } catch (err: any) {
      console.error('Failed to load profitability alerts:', err)
      console.error('Error details:', err.response?.data || err.message)
      console.error('Error status:', err.response?.status)
      console.error('Error statusText:', err.response?.statusText)
      console.error('Full error:', JSON.stringify(err, null, 2))
      setProfitabilityAlerts([])
    } finally {
      setAlertsLoading(false)
    }
  }

  const dismissAlert = (alertId: number) => {
    if (window.confirm('האם אתה בטוח שברצונך להסתיר את ההתראה הזו?\n\nההתראה תחזור אוטומטית אם הפרויקט ימשיך להיות בעייתי בבדיקה הבאה.')) {
      const newDismissed = new Set(dismissedAlerts)
      newDismissed.add(alertId)
      setDismissedAlerts(newDismissed)
      // Save to localStorage
      localStorage.setItem('dismissedProfitabilityAlerts', JSON.stringify(Array.from(newDismissed)))
    }
  }

  const toggleAlertSelection = (alertId: number) => {
    const newSelected = new Set(selectedAlerts)
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId)
    } else {
      newSelected.add(alertId)
    }
    setSelectedAlerts(newSelected)
  }

  const dismissSelectedAlerts = () => {
    if (selectedAlerts.size === 0) return
    
    const alertNames = profitabilityAlerts
      .filter(a => selectedAlerts.has(a.id))
      .map(a => a.name)
      .join(', ')
    
    if (window.confirm(`האם אתה בטוח שברצונך להסתיר את ההתראות הבאות?\n\n${alertNames}\n\nההתראות יחזרו אוטומטית אם הפרויקטים ימשיכו להיות בעייתיים בבדיקה הבאה.`)) {
      const newDismissed = new Set(dismissedAlerts)
      selectedAlerts.forEach(id => newDismissed.add(id))
      setDismissedAlerts(newDismissed)
      setSelectedAlerts(new Set())
      // Save to localStorage
      localStorage.setItem('dismissedProfitabilityAlerts', JSON.stringify(Array.from(newDismissed)))
    }
  }

  const restoreDismissedAlerts = () => {
    if (window.confirm('האם אתה בטוח שברצונך להציג מחדש את כל ההתראות שהוסתרו?')) {
      setDismissedAlerts(new Set())
      localStorage.removeItem('dismissedProfitabilityAlerts')
      setShowRestoreDialog(false)
    }
  }

  const handleAlertClick = (alert: typeof profitabilityAlerts[0]) => {
    if (alert.is_subproject && alert.parent_project_id) {
      // Navigate to parent project detail page
      navigate(`/projects/${alert.parent_project_id}/parent`)
    } else {
      // Navigate to project detail page
      navigate(`/projects/${alert.id}`)
    }
  }

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

  // Filter out dismissed alerts
  const visibleAlerts = profitabilityAlerts.filter(alert => !dismissedAlerts.has(alert.id))

  // Debug logging
  console.log('=== PROFITABILITY ALERTS DEBUG ===')
  console.log('Total alerts from API:', profitabilityAlerts.length)
  console.log('Dismissed alerts:', Array.from(dismissedAlerts))
  console.log('Visible alerts (after filtering):', visibleAlerts.length)
  console.log('Alerts loading:', alertsLoading)
  console.log('Profitability alerts data:', profitabilityAlerts)
  console.log('Visible alerts data:', visibleAlerts)
  console.log('=================================')

  return (
    <div className="space-y-8">
      {/* Profitability Alerts - Always show section for debugging */}
      {!alertsLoading && (
        <>
          {/* Debug info - show even if no alerts */}
          {profitabilityAlerts.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ℹ️ אין התראות מהשרת (0 התראות). בדוק את הלוגים בקונסול.
              </p>
            </div>
          )}
          
          {visibleAlerts.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-red-50 via-red-50/50 to-orange-50 dark:from-red-900/30 dark:via-red-900/20 dark:to-orange-900/20 border-2 border-red-300 dark:border-red-700 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-xl shadow-md">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-900 dark:text-red-100">
                  התראות רווחיות
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                  חצי שנה אחרונה
                </p>
              </div>
              <span className="px-3 py-1.5 bg-red-500 text-white rounded-full text-sm font-bold shadow-sm">
                {visibleAlerts.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedAlerts.size > 0 && (
                <button
                  onClick={dismissSelectedAlerts}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>הסתר נבחרים ({selectedAlerts.size})</span>
                </button>
              )}
              {dismissedAlerts.size > 0 && (
                <button
                  onClick={() => setShowRestoreDialog(true)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>הצג שוב ({dismissedAlerts.size} מוסתרות)</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Info box about alerts */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>איך זה עובד:</strong> התראות מוסתרות נשמרות עד שהפרויקט משתפר. 
              אם הפרויקט ממשיך להיות בעייתי (רווחיות שלילית של 10% ומעלה), ההתראה תחזור אוטומטית בבדיקה הבאה.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleAlerts.map((alert, index) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.03, y: -4 }}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 border-2 border-red-200 dark:border-red-800 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group"
              >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 dark:bg-red-900/20 rounded-bl-full opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-100 dark:bg-orange-900/20 rounded-tr-full opacity-15 group-hover:opacity-25 transition-opacity" />
                
                <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedAlerts.has(alert.id)}
                    onChange={() => toggleAlertSelection(alert.id)}
                    className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissAlert(alert.id)
                    }}
                    className="p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 shadow-sm"
                    title="הסתר התראה"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                          {alert.name}
                        </h4>
                        {alert.is_subproject && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded-full font-medium shadow-sm">
                            תת-פרויקט
                          </span>
                        )}
                      </div>
                      
                      {/* Financial Summary */}
                      <div className="space-y-2 mt-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 dark:text-gray-400">הכנסות</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {alert.income.toLocaleString('he-IL')} ₪
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 dark:text-gray-400">הוצאות</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {alert.expense.toLocaleString('he-IL')} ₪
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-500 dark:text-gray-400">רווח/הפסד</span>
                          <span className={`font-bold ${alert.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {alert.profit >= 0 ? '+' : ''}{alert.profit.toLocaleString('he-IL')} ₪
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Loss Percentage - Big and Bold */}
                  <div className="mt-4 pt-4 border-t-2 border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          אחוז הפסד
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-red-600 dark:text-red-400">
                            {Math.abs(alert.profit_margin).toFixed(1)}
                          </span>
                          <span className="text-xl font-bold text-red-600 dark:text-red-400">%</span>
                        </div>
                      </div>
                      <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-2xl">⚠️</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <button
                    onClick={() => handleAlertClick(alert)}
                    className="mt-4 w-full px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                  >
                    <span>פתח פרויקט</span>
                    <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="text-green-800 dark:text-green-200 font-medium">
                  אין פרויקטים בעייתיים מבחינת רווחיות בחצי שנה האחרונה
                </span>
              </div>
            </motion.div>
          )}
        </>
      )}
      {alertsLoading && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center text-gray-600 dark:text-gray-400">
          טוען התראות רווחיות...
        </div>
      )}

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

      {/* Restore Dialog */}
      {showRestoreDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowRestoreDialog(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              הצג מחדש התראות מוסתרות
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              יש לך {dismissedAlerts.size} התראות מוסתרות. האם אתה בטוח שברצונך להציג אותן מחדש?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRestoreDialog(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={restoreDismissedAlerts}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                הצג מחדש
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
