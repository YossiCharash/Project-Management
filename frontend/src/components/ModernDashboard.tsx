import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchMe } from '../store/slices/authSlice'
import { DashboardAPI } from '../lib/apiClient'
import { ProjectWithFinance, DashboardSnapshot } from '../types/api'
import { LoadingDashboard } from './ui/Loading'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Building2, 
  AlertTriangle,
  Plus,
  Filter,
  Search,
  Calendar,
  BarChart3,
  PieChart,
  RefreshCw
} from 'lucide-react'
import { cn } from '../lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'red' | 'purple' | 'orange'
  loading?: boolean
}

function StatCard({ title, value, change, icon: Icon, color, loading = false }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  }

  const changeColor = change && change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          {loading ? (
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          )}
          {change !== undefined && !loading && (
            <div className={cn("flex items-center gap-1 mt-2 text-sm", changeColor)}>
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl bg-gradient-to-br", colorClasses[color])}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  )
}

interface ProjectCardProps {
  project: ProjectWithFinance
  onProjectClick?: (project: ProjectWithFinance) => void
  onProjectEdit?: (project: ProjectWithFinance) => void
}

function ProjectCard({ project, onProjectClick, onProjectEdit }: ProjectCardProps) {
  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800'
      case 'yellow': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      case 'red': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border-gray-200 dark:border-gray-800'
    }
  }

  const getStatusText = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'רווחי'
      case 'yellow': return 'מאוזן'
      case 'red': return 'הפסדי'
      default: return 'לא ידוע'
    }
  }

  // Add a left color accent and ensure the project name is always visible
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={() => onProjectClick?.(project)}
    >
      {/* Left status accent */}
      <span
        className={cn(
          'absolute left-0 top-0 h-full w-1.5 rounded-l-2xl',
          project.status_color === 'green' && 'bg-green-500',
          project.status_color === 'yellow' && 'bg-yellow-500',
          project.status_color === 'red' && 'bg-red-500'
        )}
      />

      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {project.name}
          </h3>
          {project.address && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
              📍 {project.address}, {project.city}
            </p>
          )}
        </div>
        <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", getStatusColor(project.status_color))}>
          {getStatusText(project.status_color)}
        </span>
      </div>

      <div className="space-y-3">
        {project.num_residents && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4" />
            <span>{project.num_residents} דיירים</span>
          </div>
        )}

        {project.monthly_price_per_apartment && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <DollarSign className="w-4 h-4" />
            <span>{project.monthly_price_per_apartment.toFixed(0)} ₪ לדירה</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">הכנסות החודש</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {project.income_month_to_date.toFixed(0)} ₪
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">הוצאות החודש</div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              {project.expense_month_to_date.toFixed(0)} ₪
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">רווח/הפסד</span>
            <span className={cn(
              "text-lg font-bold",
              project.profit_percent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {project.profit_percent >= 0 ? '+' : ''}{project.profit_percent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {onProjectEdit && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onProjectEdit(project)
            }}
            className="w-full px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            ערוך פרויקט
          </button>
        </div>
      )}
    </motion.div>
  )
}

interface AlertsStripProps {
  alerts: DashboardSnapshot['alerts']
  projects: ProjectWithFinance[]
}

function AlertsStrip({ alerts, projects }: AlertsStripProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const budgetOverrunProjects = projects.filter(p => alerts.budget_overrun.includes(p.id))
  const missingProofProjects = projects.filter(p => alerts.missing_proof.includes(p.id))
  const unpaidRecurringProjects = projects.filter(p => alerts.unpaid_recurring.includes(p.id))

  const totalAlerts = alerts.budget_overrun.length + alerts.missing_proof.length + alerts.unpaid_recurring.length

  if (totalAlerts === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">
              התראות ({totalAlerts})
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              דרוש תשומת לב מיידית
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 space-y-3"
          >
            {budgetOverrunProjects.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">חריגת תקציב</h4>
                <ul className="space-y-1">
                  {budgetOverrunProjects.map(project => (
                    <li key={project.id} className="text-sm text-red-700 dark:text-red-400">
                      {project.name} - הוצאות: {project.expense_month_to_date.toFixed(0)} ₪, תקציב: {project.budget_monthly.toFixed(0)} ₪
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {missingProofProjects.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-2">חסרים אישורים</h4>
                <ul className="space-y-1">
                  {missingProofProjects.map(project => (
                    <li key={project.id} className="text-sm text-orange-700 dark:text-orange-400">
                      {project.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unpaidRecurringProjects.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-2">הוצאות חוזרות לא שולמו</h4>
                <ul className="space-y-1">
                  {unpaidRecurringProjects.map(project => (
                    <li key={project.id} className="text-sm text-purple-700 dark:text-purple-400">
                      {project.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface ModernDashboardProps {
  onProjectClick?: (project: ProjectWithFinance) => void
  onProjectEdit?: (project: ProjectWithFinance) => void
  onCreateProject?: () => void
}

export default function ModernDashboard({ onProjectClick, onProjectEdit, onCreateProject }: ModernDashboardProps) {
  const dispatch = useAppDispatch()
  const me = useAppSelector(s => s.auth.me)
  const [dashboardData, setDashboardData] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCity, setFilterCity] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterParent, setFilterParent] = useState<string>('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

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
      setLastRefresh(new Date())
    } catch (err: any) {
      console.error('Dashboard data loading error:', err)
      setError(err.message || 'שגיאה בטעינת הנתונים')
      // Set empty state on error to prevent UI crashes
      setDashboardData({
        projects: [],
        alerts: { budget_overrun: [], missing_proof: [], unpaid_recurring: [] },
        summary: { total_income: 0, total_expense: 0, total_profit: 0 }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadDashboardData()
  }

  const getFilteredProjects = (): ProjectWithFinance[] => {
    if (!dashboardData) return []

    let filtered = dashboardData.projects

    if (filterCity) {
      filtered = filtered.filter(p => p.city?.toLowerCase().includes(filterCity.toLowerCase()))
    }

    if (filterStatus) {
      filtered = filtered.filter(p => p.status_color === filterStatus)
    }

    if (filterParent) {
      if (filterParent === 'root') {
        filtered = filtered.filter(p => !p.relation_project)
      } else if (filterParent === 'child') {
        filtered = filtered.filter(p => p.relation_project)
      }
    }

    return filtered
  }

  const getAllProjectsFlat = (projects: ProjectWithFinance[]): ProjectWithFinance[] => {
    const result: ProjectWithFinance[] = []
    
    const flatten = (projs: ProjectWithFinance[]) => {
      projs.forEach(project => {
        result.push(project)
        if (project.children) {
          flatten(project.children)
        }
      })
    }
    
    flatten(projects)
    return result
  }

  if (loading) return <LoadingDashboard count={6} />

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
          className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
        >
          נסה שוב
        </button>
      </motion.div>
    )
  }

  if (!dashboardData) {
    // Render empty state rather than nothing
    return (
      <div className="space-y-6">
        <div className="text-center text-gray-500 dark:text-gray-400">אין נתוני דשבורד להצגה</div>
      </div>
    )
  }

  const filteredProjects = getFilteredProjects()
  const allProjectsFlat = getAllProjectsFlat(dashboardData.projects)

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
            הנה סקירה כללית של הפרויקטים שלכם
            {lastRefresh && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                (עודכן לאחרונה: {lastRefresh.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>רענן</span>
          </motion.button>
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
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="סה״כ הכנסות"
          value={`${dashboardData.summary.total_income.toFixed(0)} ₪`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="סה״כ הוצאות"
          value={`${dashboardData.summary.total_expense.toFixed(0)} ₪`}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          title="רווח נטו"
          value={`${dashboardData.summary.total_profit.toFixed(0)} ₪`}
          icon={BarChart3}
          color={dashboardData.summary.total_profit >= 0 ? "green" : "red"}
        />
        <StatCard
          title="פרויקטים פעילים"
          value={allProjectsFlat.length}
          icon={Building2}
          color="blue"
        />
      </div>

      {/* Alerts */}
      <AlertsStrip alerts={dashboardData.alerts} projects={allProjectsFlat} />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">סינון פרויקטים</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              placeholder="חיפוש לפי עיר..."
              className="w-full pr-10 pl-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          >
            <option value="">כל הסטטוסים</option>
            <option value="green">רווחי</option>
            <option value="yellow">מאוזן</option>
            <option value="red">הפסדי</option>
          </select>

          <select
            value={filterParent}
            onChange={(e) => setFilterParent(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          >
            <option value="">כל הפרויקטים</option>
            <option value="root">פרויקטים ראשיים בלבד</option>
            <option value="child">תת-פרויקטים בלבד</option>
          </select>
        </div>
      </motion.div>

      {/* Projects Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            פרויקטים ({filteredProjects.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ProjectCard
                project={project}
                onProjectClick={onProjectClick}
                onProjectEdit={onProjectEdit}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
