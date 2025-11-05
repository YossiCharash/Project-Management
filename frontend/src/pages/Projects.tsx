import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchMe } from '../store/slices/authSlice'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Filter, 
  Grid, 
  List,
  Edit,
  Archive,
  Eye,
  RefreshCw,
  RotateCcw
} from 'lucide-react'
import { ProjectWithFinance, DashboardSnapshot } from '../types/api'
import { DashboardAPI, ProjectAPI } from '../lib/apiClient'
import CreateProjectModal from '../components/CreateProjectModal'
import CategoryBarChart, { CategoryPoint } from '../components/charts/CategoryBarChart'
import api from '../lib/api'

interface ProjectCardProps {
  project: ProjectWithFinance
  projectChart?: CategoryPoint[]
  onProjectClick?: (project: ProjectWithFinance) => void
  onProjectEdit?: (project: ProjectWithFinance) => void
  onProjectArchive?: (project: ProjectWithFinance) => void
  onProjectRestore?: (project: ProjectWithFinance) => void
  hasSubprojects?: boolean
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  projectChart,
  onProjectClick, 
  onProjectEdit, 
  onProjectArchive,
  onProjectRestore,
  hasSubprojects = false
}) => {
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

  const getProfitabilityDetails = (project: ProjectWithFinance) => {
    const profit = (project.income_month_to_date || 0) - (project.expense_month_to_date || 0)
    const profitPercent = project.profit_percent || 0
    
    return {
      profit,
      profitPercent,
      isProfitable: profitPercent >= 10,
      isLoss: profitPercent <= -10,
      isBalanced: profitPercent > -10 && profitPercent < 10
    }
  }

  const getImageUrl = (imageUrl: string | null | undefined): string | null => {
    if (!imageUrl) return null
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
    const baseUrl = apiUrl.replace('/api/v1', '')
    return `${baseUrl}/uploads/${imageUrl}`
  }

  const imageUrl = getImageUrl(project.image_url)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border ${
        project.is_active === false 
          ? 'border-gray-300 dark:border-gray-600 opacity-75' 
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="p-6">
        {imageUrl && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={project.name}
              className="w-full h-48 object-cover"
              onError={(e) => {
                console.error('Failed to load image:', imageUrl, e)
                e.currentTarget.style.display = 'none'
              }}
              onLoad={() => {
                console.log('Image loaded successfully:', imageUrl)
              }}
            />
          </div>
        )}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {project.name}
              </h3>
              {hasSubprojects && (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                  יש תת-פרויקטים
                </span>
              )}
            </div>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(project.status_color)}`}>
              {getStatusText(project.status_color)}
            </span>
            {project.is_active === false && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                מאורכב
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
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

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          {/* Profitability Status - Prominent Display */}
          <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">סטטוס רווחיות</span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(project.status_color || 'yellow')}`}>
                {getStatusText(project.status_color || 'yellow')}
              </span>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${(Number(project.profit_percent) || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {(Number(project.profit_percent) || 0) >= 0 ? '+' : ''}{Number(project.profit_percent || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">רווח/הפסד שנתי</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">הכנסות השנה</div>
              <div className="font-semibold text-green-600 dark:text-green-400">
                {Number(project.income_month_to_date || 0).toLocaleString('he-IL')} ₪
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">הוצאות השנה</div>
              <div className="font-semibold text-red-600 dark:text-red-400">
                {Number(project.expense_month_to_date || 0).toLocaleString('he-IL')} ₪
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 text-xs">רווח/הפסד נטו</span>
              <span className={`font-bold ${((Number(project.income_month_to_date) || 0) - (Number(project.expense_month_to_date) || 0)) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {((Number(project.income_month_to_date) || 0) - (Number(project.expense_month_to_date) || 0)) >= 0 ? '+' : ''}{((Number(project.income_month_to_date) || 0) - (Number(project.expense_month_to_date) || 0)).toLocaleString('he-IL')} ₪
              </span>
            </div>
          </div>
        </div>


        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex gap-2">
            <button
              onClick={() => onProjectClick?.(project)}
              className="flex-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {hasSubprojects ? 'צפה בתת-פרויקטים' : 'צפה'}
            </button>
            {onProjectEdit && project.is_active !== false && (
              <button
                onClick={() => onProjectEdit(project)}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onProjectArchive && project.is_active !== false && (
              <button
                onClick={() => onProjectArchive(project)}
                className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                title="ארכב פרויקט"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}
            {onProjectRestore && project.is_active === false && (
              <button
                onClick={() => onProjectRestore(project)}
                className="px-3 py-2 text-sm bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                title="שחזר פרויקט"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function Projects() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const me = useAppSelector(s => s.auth.me)
  
  const [dashboardData, setDashboardData] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectCharts, setProjectCharts] = useState<Record<number, CategoryPoint[]>>({})
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [projectTypeFilter, setProjectTypeFilter] = useState('')
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithFinance | null>(null)
  const [archivingProject, setArchivingProject] = useState<number | null>(null)
  useEffect(() => {
    if (!me) dispatch(fetchMe())
    loadProjectsData(archiveFilter !== 'active')
  }, [dispatch, me, archiveFilter])

  // Refresh data when navigating back to this page
  useEffect(() => {
    if (location.pathname === '/projects') {
      loadProjectsData(archiveFilter !== 'active')
    }
  }, [location.pathname, archiveFilter])

  // Auto-refresh financial data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        loadProjectsData(archiveFilter !== 'active')
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [archiveFilter, loading])

  const loadProjectsData = async (includeArchived = false) => {
    setLoading(true)
    setError(null)
    try {
      // Load dashboard snapshot for active projects
      const data = await DashboardAPI.getDashboardSnapshot()
      
      // Debug: Log the raw data to see what we're getting
      console.log('Raw dashboard snapshot data:', data)
      if (data.projects && data.projects.length > 0) {
        console.log('Sample project data:', data.projects[0])
        console.log('Financial fields check:', {
          income_month_to_date: data.projects[0].income_month_to_date,
          expense_month_to_date: data.projects[0].expense_month_to_date,
          profit_percent: data.projects[0].profit_percent,
          status_color: data.projects[0].status_color,
          has_income_field: 'income_month_to_date' in data.projects[0],
          has_expense_field: 'expense_month_to_date' in data.projects[0]
        })
      }
      
      // Ensure all projects have financial data properly formatted
      if (data.projects) {
        data.projects = data.projects.map((p: any) => {
          // Get all possible field names that might contain financial data
          const incomeValue = p.income_month_to_date ?? p.income ?? 0
          const expenseValue = p.expense_month_to_date ?? p.expense ?? p.expenses ?? 0
          const profitValue = p.profit_percent ?? p.profit_percentage ?? 0
          const statusValue = p.status_color ?? p.status ?? 'yellow'
          
          const formatted = {
            ...p,
            income_month_to_date: Number(incomeValue),
            expense_month_to_date: Number(expenseValue),
            profit_percent: Number(profitValue),
            status_color: statusValue,
            total_value: Number(p.total_value ?? p.budget_monthly ?? p.budget_annual ?? 0)
          }
          console.log(`Project ${p.id} (${p.name}) financial data:`, {
            raw_income: p.income_month_to_date,
            raw_expense: p.expense_month_to_date,
            raw_profit: p.profit_percent,
            formatted_income: formatted.income_month_to_date,
            formatted_expense: formatted.expense_month_to_date,
            formatted_profit: formatted.profit_percent
          })
          return formatted
        })
      }
      
      // If we need archived projects, load them separately and merge
      if (includeArchived || archiveFilter !== 'active') {
        try {
          const archivedProjects = await ProjectAPI.getProjects(true)
          // Get only archived projects
          const archived = archivedProjects.filter((p: any) => p.is_active === false)
          
          // Convert archived projects to ProjectWithFinance format (with basic structure)
          const archivedWithFinance: ProjectWithFinance[] = archived.map((p: any) => ({
            ...p,
            income_month_to_date: 0,
            expense_month_to_date: 0,
            profit_percent: 0,
            status_color: 'yellow' as const,
            total_value: 0
          }))
          
          // Merge active and archived projects
          data.projects = [...data.projects, ...archivedWithFinance]
        } catch (archivedErr) {
          console.warn('Failed to load archived projects:', archivedErr)
          // Continue with only active projects if archived loading fails
        }
      }
      
      setDashboardData(data)
      await loadProjectCharts(data.projects)
    } catch (err: any) {
      console.error('Projects data loading error:', err)
      setError(err.message || 'שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }

  const loadProjectCharts = async (projects: ProjectWithFinance[]) => {
    const charts: Record<number, CategoryPoint[]> = {}
    const visible = projects.filter((p: any) => p.is_active !== false)
    
    for (const p of visible) {
      try {
        const { data } = await api.get(`/transactions/project/${p.id}`)
        const map: Record<string, { income: number; expense: number }> = {}
        for (const t of data as any[]) {
          const cat = (t.category || 'ללא קטגוריה') as string
          if (!map[cat]) map[cat] = { income: 0, expense: 0 }
          if (t.type === 'Income') map[cat].income += Number(t.amount)
          else map[cat].expense += Number(t.amount)
        }
        charts[p.id] = Object.entries(map).map(([category, v]) => ({ category, income: v.income, expense: v.expense }))
      } catch { 
        charts[p.id] = [] 
      }
    }
    setProjectCharts(charts)
  }

  const handleProjectClick = (project: ProjectWithFinance) => {
    // Check if project has subprojects
    const hasSubprojects = dashboardData?.projects?.some((p: any) => p.relation_project === project.id)
    
    if (hasSubprojects) {
      // Navigate to parent project detail page with consolidated view
      navigate(`/projects/${project.id}/parent`)
    } else {
      // Navigate to project detail page
      navigate(`/projects/${project.id}`)
    }
  }

  const handleProjectEdit = (project: ProjectWithFinance) => {
    setEditingProject(project)
    setShowCreateModal(true)
  }

  const handleProjectArchive = async (project: ProjectWithFinance) => {
    if (confirm('האם לארכב את הפרויקט? ניתן לשחזר מאוחר יותר.')) {
      try {
        setArchivingProject(project.id)
        await ProjectAPI.archiveProject(project.id)
        await loadProjectsData(archiveFilter !== 'active')
      } catch (err: any) {
        console.error('Failed to archive project:', err)
        alert(err.response?.data?.detail || 'שגיאה בארכוב הפרויקט')
      } finally {
        setArchivingProject(null)
      }
    }
  }

  const handleProjectRestore = async (project: ProjectWithFinance) => {
    if (confirm('האם לשחזר את הפרויקט?')) {
      try {
        setArchivingProject(project.id)
        await ProjectAPI.restoreProject(project.id)
        await loadProjectsData(archiveFilter !== 'active')
      } catch (err: any) {
        console.error('Failed to restore project:', err)
        alert(err.response?.data?.detail || 'שגיאה בשחזור הפרויקט')
      } finally {
        setArchivingProject(null)
      }
    }
  }

  const handleCreateProject = () => {
    setEditingProject(null)
    setShowCreateModal(true)
  }

  const handleProjectSuccess = () => {
    setShowCreateModal(false)
    setEditingProject(null)
    loadProjectsData()
  }

  const filteredProjects = dashboardData?.projects?.filter((project: any) => {
    const matchesSearch = project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.address?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || project.status_color === statusFilter
    const matchesCity = !cityFilter || project.city?.toLowerCase().includes(cityFilter.toLowerCase())
    
    // Filter by project type (parent projects vs subprojects)
    let matchesType = true
    if (projectTypeFilter === 'parent') {
      matchesType = !project.relation_project // Parent projects don't have relation_project
    } else if (projectTypeFilter === 'subproject') {
      matchesType = !!project.relation_project // Subprojects have relation_project
    }
    
    // Filter by archive status
    let matchesArchive = true
    if (archiveFilter === 'active') {
      matchesArchive = project.is_active !== false
    } else if (archiveFilter === 'archived') {
      matchesArchive = project.is_active === false
    } // 'all' shows everything
    
    return matchesSearch && matchesStatus && matchesCity && matchesType && matchesArchive
  }) || []

  const isAdmin = me?.role === 'Admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">טוען פרויקטים...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">פרויקטים</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ניהול וצפייה בכל הפרויקטים במערכת
          </p>
        </div>
        {isAdmin && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateProject}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>צור פרויקט חדש</span>
          </motion.button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              חיפוש
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חפש פרויקט..."
                className="w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              סטטוס רווחיות
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">כל הסטטוסים</option>
              <option value="green">רווחי (10%+)</option>
              <option value="yellow">מאוזן (-10% עד 10%)</option>
              <option value="red">הפסדי (-10% ומטה)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              עיר
            </label>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="סינון לפי עיר..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              סוג פרויקט
            </label>
            <select
              value={projectTypeFilter}
              onChange={(e) => setProjectTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">כל הפרויקטים</option>
              <option value="parent">פרויקטים ראשיים</option>
              <option value="subproject">תת-פרויקטים</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              סטטוס ארכוב
            </label>
            <select
              value={archiveFilter}
              onChange={(e) => setArchiveFilter(e.target.value as 'active' | 'archived' | 'all')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="active">פעילים בלבד</option>
              <option value="archived">מאורכבים בלבד</option>
              <option value="all">הכל</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              תצוגה
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          נמצאו {filteredProjects.length} פרויקטים
        </div>
        <button
          onClick={() => loadProjectsData(archiveFilter !== 'active')}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          רענן
        </button>
      </div>

      {/* Projects Grid/List */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            לא נמצאו פרויקטים המתאימים לחיפוש
          </div>
        </div>
      ) : (
        <div className={`grid gap-6 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
            : 'grid-cols-1'
        }`}>
          {filteredProjects.map((project: any) => {
            const hasSubprojects = dashboardData?.projects?.some((p: any) => p.relation_project === project.id)
            return (
              <ProjectCard
                key={project.id}
                project={project}
                projectChart={projectCharts[project.id]}
                onProjectClick={handleProjectClick}
                onProjectEdit={isAdmin ? handleProjectEdit : undefined}
                onProjectArchive={isAdmin ? handleProjectArchive : undefined}
                onProjectRestore={isAdmin ? handleProjectRestore : undefined}
                hasSubprojects={hasSubprojects}
              />
            )
          })}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProjectSuccess}
        editingProject={editingProject}
      />
    </div>
  )
}
