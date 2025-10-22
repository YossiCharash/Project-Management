import { FormEvent, useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { archiveProject, createProject, fetchProjects, fetchProjectsWithArchived, restoreProject, updateProject } from '../store/slices/projectsSlice'
import { Link, useNavigate } from 'react-router-dom'
import CategoryBarChart, { CategoryPoint } from '../components/charts/CategoryBarChart'
import { fetchMe } from '../store/slices/authSlice'
import Modal from '../components/Modal'
import api from '../lib/api'
import EnhancedDashboard from '../components/EnhancedDashboard'
import ModernDashboard from '../components/ModernDashboard'
import CreateProjectModal from '../components/CreateProjectModal'
import ProjectTreeView from '../components/ProjectTreeView'
import TestComponent from '../components/TestComponent'
import { ProjectWithFinance } from '../types/api'

export default function Dashboard() {
  const dispatch = useAppDispatch()
  const { items, loading, error } = useAppSelector(s => s.projects)
  const me = useAppSelector(s => s.auth.me)
  const navigate = useNavigate()

  // Enhanced dashboard state
  const [viewMode, setViewMode] = useState<'modern' | 'enhanced' | 'legacy' | 'tree' | 'tests'>('modern')
  const [selectedProject, setSelectedProject] = useState<ProjectWithFinance | null>(null)
  const [editingProject, setEditingProject] = useState<ProjectWithFinance | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Legacy dashboard state (kept for backward compatibility)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [monthly, setMonthly] = useState<number>(0)
  const [annual, setAnnual] = useState<number>(0)
  const [numResidents, setNumResidents] = useState<number | ''>('')
  const [pricePerApt, setPricePerApt] = useState<number | ''>('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [creating, setCreating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [openCreate, setOpenCreate] = useState(false)
  const [projectCharts, setProjectCharts] = useState<Record<number, CategoryPoint[]>>({})

  useEffect(() => { if (!me) dispatch(fetchMe()) }, [dispatch, me])
  
  // Load projects for legacy view
  useEffect(() => {
    if (viewMode === 'legacy') {
      dispatch(fetchProjects())
    }
  }, [dispatch, viewMode])

  // Load project charts for legacy view
  useEffect(() => {
    const loadProjectCharts = async () => {
      if (viewMode !== 'legacy') return
      
      const charts: Record<number, CategoryPoint[]> = {}
      const visible = items.filter((p: any) => p.is_active !== false)
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
        } catch { charts[p.id] = [] }
      }
      setProjectCharts(charts)
    }
    if (items.length && viewMode === 'legacy') loadProjectCharts()
  }, [items, viewMode])

  const resetForm = () => {
    setName(''); setDescription(''); setStartDate(''); setEndDate(''); setMonthly(0); setAnnual(0); setNumResidents(''); setPricePerApt(''); setAddress(''); setCity(''); setLocalError(null); setEditingId(null)
  }

  const onCreateOrUpdate = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setCreating(true)
    try {
      const payload: any = {
        name,
        budget_monthly: monthly,
        budget_annual: annual,
        description: description || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        num_residents: numResidents === '' ? undefined : Number(numResidents),
        monthly_price_per_apartment: pricePerApt === '' ? undefined : Number(pricePerApt),
        address: address || undefined,
        city: city || undefined,
      }

      if (editingId) {
        const res = await dispatch(updateProject({ id: editingId, changes: payload }))
        if (updateProject.rejected.match(res)) setLocalError(res.payload as string)
        else { resetForm(); setOpenCreate(false) }
      } else {
        const res = await dispatch(createProject(payload))
        if (createProject.rejected.match(res)) setLocalError(res.payload as string)
        else { resetForm(); setOpenCreate(false) }
      }
    } finally { setCreating(false) }
  }

  const openEditModal = (id: number) => {
    const p = items.find(x => x.id === id)
    if (!p) return
    // @ts-expect-error
    if (p.is_active === false) return
    setEditingId(id)
    setName(p.name || '')
    // @ts-expect-error
    setDescription(p.description || '')
    // @ts-expect-error
    setStartDate(p.start_date || '')
    // @ts-expect-error
    setEndDate(p.end_date || '')
    setMonthly(p.budget_monthly ?? 0)
    setAnnual(p.budget_annual ?? 0)
    setNumResidents((p as any).num_residents ?? '')
    setPricePerApt((p as any).monthly_price_per_apartment ?? '')
    setAddress((p as any).address ?? '')
    setCity((p as any).city ?? '')
    setOpenCreate(true)
  }

  const onCloseModal = () => { setOpenCreate(false); resetForm() }

  const archive = async (id: number) => {
    if (confirm('האם לארכב את הפרויקט? ניתן לשחזר מאוחר יותר.')) {
      await dispatch(archiveProject(id))
    }
  }

  const restore = async (id: number) => {
    await dispatch(restoreProject(id))
  }

  const isAdmin = me?.role === 'Admin' || me?.role === 'ProjectManager'

  // Enhanced dashboard handlers
  const handleProjectClick = (project: ProjectWithFinance) => {
    setSelectedProject(project)
    // Navigate to project detail page
    navigate(`/projects/${project.id}`)
  }

  const handleProjectEdit = (project: ProjectWithFinance) => {
    setEditingProject(project)
    setShowCreateModal(true)
  }

  const handleCreateProject = () => {
    setEditingProject(null)
    setShowCreateModal(true)
  }

  const handleProjectSuccess = (project: any) => {
    setShowCreateModal(false)
    setEditingProject(null)
    // Refresh the dashboard
    if (viewMode === 'legacy') {
      dispatch(fetchProjects())
    }
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setEditingProject(null)
  }

  const visibleItems = items?.filter?.((p: any) => p?.is_active !== false) ?? []

  return (
    <div className="space-y-6">
      {/* View Mode Selector - Only show if admin */}
        {isAdmin && (
        <div className="flex justify-end">
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">תצוגה:</label>
            <select 
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
              value={viewMode} 
              onChange={e=>setViewMode(e.target.value as any)}
            >
              <option value="modern">מודרני</option>
              <option value="enhanced">מתקדם</option>
              <option value="legacy">קלאסי</option>
              <option value="tree">עץ פרויקטים</option>
              <option value="tests">בדיקות</option>
        </select>
      </div>
        </div>
      )}

      {/* Render appropriate view based on selected mode */}
      {viewMode === 'modern' && (
        <ModernDashboard
          onProjectClick={handleProjectClick}
          onProjectEdit={handleProjectEdit}
          onCreateProject={handleCreateProject}
        />
      )}

      {viewMode === 'enhanced' && (
        <EnhancedDashboard
          onProjectClick={handleProjectClick}
          onProjectEdit={handleProjectEdit}
          onCreateProject={handleCreateProject}
        />
      )}

      {viewMode === 'tree' && (
        <ProjectTreeView
          projects={visibleItems as any}
          onProjectSelect={handleProjectClick}
          onProjectEdit={handleProjectEdit}
          onProjectArchive={(project) => archive(project.id)}
          selectedProjectId={selectedProject?.id}
          showActions={isAdmin}
        />
      )}

      {viewMode === 'tests' && (
        <TestComponent />
      )}

      {viewMode === 'legacy' && (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? 'טוען...' : visibleItems.map(p => (
          <div key={p.id} className="bg-white p-4 rounded shadow">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold flex-1">{p.name}</h3>
              {isAdmin && (
                // @ts-expect-error
                p.is_active === false ? (
                  <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={()=>restore(p.id)}>שחזר</button>
                ) : (
                  <>
                    <button className="px-2 py-1 bg-yellow-500 text-white rounded" onClick={()=>openEditModal(p.id)}>ערוך</button>
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>archive(p.id)}>ארכב</button>
                  </>
                )
              )}
            </div>
            {p.is_active === false && <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">בארכיון</span>}
            <CategoryBarChart data={projectCharts[p.id] ?? []} />
          </div>
        ))}
      </div>
      )}

      <Modal open={openCreate} onClose={onCloseModal} title={editingId ? 'עריכת פרויקט' : 'יצירת פרויקט'}>
        <form onSubmit={onCreateOrUpdate} className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">שם פרויקט</label>
            <input className="w-full border rounded p-2" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">תיאור</label>
            <textarea className="w-full border rounded p-2" value={description} onChange={e=>setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">תאריך התחלה</label>
              <input className="border rounded p-2 w-full" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">תאריך סיום</label>
              <input className="border rounded p-2 w-full" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">מספר דיירים</label>
              <input className="border rounded p-2 w-full" type="number" value={numResidents} onChange={e=>setNumResidents(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">מחיר חודשי לדירה</label>
              <input className="border rounded p-2 w-full" type="number" value={pricePerApt} onChange={e=>setPricePerApt(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">כתובת</label>
              <input className="border rounded p-2 w-full" value={address} onChange={e=>setAddress(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">עיר</label>
              <input className="border rounded p-2 w-full" value={city} onChange={e=>setCity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">תקציב חודשי</label>
              <input className="border rounded p-2 w-full" type="number" value={monthly} onChange={e=>setMonthly(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">תקציב שנתי</label>
              <input className="border rounded p-2 w-full" type="number" value={annual} onChange={e=>setAnnual(Number(e.target.value))} />
            </div>
          </div>
          {localError && <div className="text-red-600 text-sm">{localError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-3 py-2 bg-gray-200 rounded" onClick={onCloseModal}>בטל</button>
            <button className="px-3 py-2 bg-gray-900 text-white rounded" disabled={creating}>{creating ? 'שומר...' : (editingId ? 'שמור' : 'צור')}</button>
          </div>
        </form>
      </Modal>

      {/* Enhanced Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        onSuccess={handleProjectSuccess}
        editingProject={editingProject}
      />
    </div>
  )
}
