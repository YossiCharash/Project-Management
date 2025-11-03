import React, { useState, useEffect } from 'react'
import { ProjectWithFinance, DashboardSnapshot } from '../types/api'
import { DashboardAPI } from '../lib/apiClient'

interface ProjectCardProps {
  project: ProjectWithFinance
  onProjectClick?: (project: ProjectWithFinance) => void
  onProjectEdit?: (project: ProjectWithFinance) => void
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onProjectClick, onProjectEdit }) => {
  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'bg-green-100 text-green-800 border-green-200'
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'red': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
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

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onProjectClick?.(project)}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status_color)}`}>
          {getStatusText(project.status_color)}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        {project.address && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">📍</span>
            <span>{project.address}, {project.city}</span>
          </div>
        )}
        
        {project.num_residents && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">👥</span>
            <span>{project.num_residents} דיירים</span>
          </div>
        )}

        {project.monthly_price_per_apartment && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">💰</span>
            <span>{project.monthly_price_per_apartment.toFixed(0)} ₪ לדירה</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs">הכנסות השנה</div>
            <div className="font-semibold text-green-600">
              {project.income_month_to_date.toFixed(0)} ₪
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">הוצאות השנה</div>
            <div className="font-semibold text-red-600">
              {project.expense_month_to_date.toFixed(0)} ₪
            </div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">רווח/הפסד</span>
            <span className={`font-bold ${project.profit_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {project.profit_percent >= 0 ? '+' : ''}{project.profit_percent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {onProjectEdit && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onProjectEdit(project)
            }}
            className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            ערוך פרויקט
          </button>
        </div>
      )}
    </div>
  )
}

interface AlertsStripProps {
  alerts: DashboardSnapshot['alerts']
  projects: ProjectWithFinance[]
}

const AlertsStrip: React.FC<AlertsStripProps> = ({ alerts, projects }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const budgetOverrunProjects = projects.filter(p => alerts.budget_overrun.includes(p.id))
  const missingProofProjects = projects.filter(p => alerts.missing_proof.includes(p.id))
  const unpaidRecurringProjects = projects.filter(p => alerts.unpaid_recurring.includes(p.id))

  const totalAlerts = alerts.budget_overrun.length + alerts.missing_proof.length + alerts.unpaid_recurring.length

  if (totalAlerts === 0) return null

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-600">⚠️</span>
          <span className="font-semibold text-yellow-800">
            התראות ({totalAlerts})
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-yellow-600 hover:text-yellow-800"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {budgetOverrunProjects.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-red-600">חריגת תקציב:</span>
              <ul className="list-disc list-inside ml-4">
                {budgetOverrunProjects.map(project => (
                  <li key={project.id} className="text-red-600">
                    {project.name} - הוצאות: {project.expense_month_to_date.toFixed(0)} ₪, תקציב שנתי: {(project.budget_annual + (project.budget_monthly * 12)).toFixed(0)} ₪
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missingProofProjects.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-orange-600">חסרים אישורים:</span>
              <ul className="list-disc list-inside ml-4">
                {missingProofProjects.map(project => (
                  <li key={project.id} className="text-orange-600">
                    {project.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unpaidRecurringProjects.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-purple-600">הוצאות חוזרות לא שולמו:</span>
              <ul className="list-disc list-inside ml-4">
                {unpaidRecurringProjects.map(project => (
                  <li key={project.id} className="text-purple-600">
                    {project.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface SummaryChartProps {
  summary: DashboardSnapshot['summary']
}

const SummaryChart: React.FC<SummaryChartProps> = ({ summary }) => {
  const maxValue = Math.max(summary.total_income, summary.total_expense)
  const incomePercent = maxValue > 0 ? (summary.total_income / maxValue) * 100 : 0
  const expensePercent = maxValue > 0 ? (summary.total_expense / maxValue) * 100 : 0

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">סיכום כללי</h3>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">הכנסות</span>
            <span className="text-sm font-semibold text-green-600">
              {summary.total_income.toFixed(0)} ₪
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${incomePercent}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">הוצאות</span>
            <span className="text-sm font-semibold text-red-600">
              {summary.total_expense.toFixed(0)} ₪
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-red-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${expensePercent}%` }}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">רווח/הפסד נטו</span>
            <span className={`text-lg font-bold ${summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.total_profit >= 0 ? '+' : ''}{summary.total_profit.toFixed(0)} ₪
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface EnhancedDashboardProps {
  onProjectClick?: (project: ProjectWithFinance) => void
  onProjectEdit?: (project: ProjectWithFinance) => void
  onCreateProject?: () => void
}

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({
  onProjectClick,
  onProjectEdit,
  onCreateProject
}) => {
  const [dashboardData, setDashboardData] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCity, setFilterCity] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterParent, setFilterParent] = useState<string>('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">טוען נתונים...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-600">שגיאה: {error}</div>
        <button 
          onClick={loadDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          נסה שוב
        </button>
      </div>
    )
  }

  if (!dashboardData) return null

  const filteredProjects = getFilteredProjects()
  const allProjectsFlat = getAllProjectsFlat(dashboardData.projects)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">לוח בקרה מתקדם</h1>
          {lastRefresh && (
            <p className="text-sm text-gray-500 mt-1">
              עודכן לאחרונה: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>⟳</span>
            <span>רענן</span>
          </button>
          {onCreateProject && (
            <button
              onClick={onCreateProject}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              צור פרויקט חדש
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סינון לפי עיר</label>
            <input
              type="text"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              placeholder="הקלד שם עיר..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סינון לפי סטטוס</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">כל הסטטוסים</option>
              <option value="green">רווחי</option>
              <option value="yellow">מאוזן</option>
              <option value="red">הפסדי</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סינון לפי היררכיה</label>
            <select
              value={filterParent}
              onChange={(e) => setFilterParent(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">כל הפרויקטים</option>
              <option value="root">פרויקטים ראשיים בלבד</option>
              <option value="child">תת-פרויקטים בלבד</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <AlertsStrip alerts={dashboardData.alerts} projects={allProjectsFlat} />

      {/* Summary Chart */}
      <SummaryChart summary={dashboardData.summary} />

      {/* Project Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          פרויקטים ({filteredProjects.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onProjectClick={onProjectClick}
              onProjectEdit={onProjectEdit}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default EnhancedDashboard
