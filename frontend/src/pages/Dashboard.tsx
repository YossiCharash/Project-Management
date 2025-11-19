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
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [creating, setCreating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [openCreate, setOpenCreate] = useState(false)
  const [projectCharts, setProjectCharts] = useState<Record<number, CategoryPoint[]>>({})

  useEffect(() => { if (!me) dispatch(fetchMe()) }, [dispatch, me])
  
  // Load projects for dashboard
  useEffect(() => {
    dispatch(fetchProjects())
  }, [dispatch])

  // Load project charts for dashboard
  useEffect(() => {
    const loadProjectCharts = async () => {
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
    if (items.length) loadProjectCharts()
  }, [items])

  const resetForm = () => {
    setName(''); setDescription(''); setStartDate(''); setEndDate(''); setMonthly(0); setAnnual(0); setAddress(''); setCity(''); setLocalError(null); setEditingId(null)
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

  const handleProjectSuccess = (project: any) => {
    // Refresh the dashboard
    dispatch(fetchProjects())
  }

  const visibleItems = items?.filter?.((p: any) => p?.is_active !== false) ?? []

  return (
    <div className="space-y-6">
      {/* Modern Dashboard - Clean view without create project option or welcome section */}
      <ModernDashboard
        onProjectClick={handleProjectClick}
        onProjectEdit={handleProjectEdit}
      />

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
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProjectSuccess}
        editingProject={editingProject}
      />
    </div>
  )
}
