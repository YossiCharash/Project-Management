import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { archiveProject, createProject, fetchProjects, fetchProjectsWithArchived, hardDeleteProject, restoreProject, updateProject } from '../store/slices/projectsSlice'
import { Link } from 'react-router-dom'
import ExpenseChart, { ExpensePoint } from '../components/charts/ExpenseChart'
import { fetchMe } from '../store/slices/authSlice'
import Modal from '../components/Modal'
import api from '../lib/api'

export default function Dashboard() {
  const dispatch = useAppDispatch()
  const { items, loading, error } = useAppSelector(s => s.projects)
  const me = useAppSelector(s => s.auth.me)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [monthly, setMonthly] = useState<number>(0)
  const [annual, setAnnual] = useState<number>(0)
  const [creating, setCreating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [openCreate, setOpenCreate] = useState(false)
  const [viewMode, setViewMode] = useState<'active' | 'archive' | 'all'>('active')

  const [chartData, setChartData] = useState<ExpensePoint[]>([])

  useEffect(() => { if (!me) dispatch(fetchMe()) }, [dispatch, me])
  useEffect(() => {
    if (viewMode === 'active') dispatch(fetchProjects())
    else if (viewMode === 'archive') dispatch(fetchProjectsWithArchived({ include_archived: true, only_archived: true }))
    else dispatch(fetchProjectsWithArchived(true))
  }, [dispatch, viewMode])

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        // בחר פרויקט להצגת הוצאות: אם יש בחירה עתידית – נחליף. לעת עתה נשתמש בראשון.
        const firstActive = items.find((p: any) => p.is_active !== false)
        if (!firstActive) { setChartData([]); return }
        const { data } = await api.get(`/transactions/project/${firstActive.id}`)
        // המפה לפי חודש (שם עברי בסיסי)
        const months = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
        const map: Record<string, number> = {}
        for (const t of data as any[]) {
          if (t.type !== 'Expense') continue
          const d = new Date(t.tx_date)
          const key = months[d.getMonth()]
          map[key] = (map[key] ?? 0) + Number(t.amount)
        }
        const points: ExpensePoint[] = months.map(m => ({ name: m, expense: map[m] ?? 0 }))
        setChartData(points)
      } catch { setChartData([]) }
    }
    loadExpenses()
  }, [items])

  const resetForm = () => {
    setName(''); setDescription(''); setStartDate(''); setEndDate(''); setMonthly(0); setAnnual(0); setLocalError(null); setEditingId(null)
  }

  const onCreateOrUpdate = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setCreating(true)
    try {
      const payload: any = { name, budget_monthly: monthly, budget_annual: annual }
      if (description) payload.description = description
      if (startDate) payload.start_date = startDate
      if (endDate) payload.end_date = endDate

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
    if (p.is_active === false) return // prevent editing archived
    setEditingId(id)
    setName(p.name || '')
    // @ts-expect-error optional fields not in Project interface listed here
    setDescription((p as any).description || '')
    // @ts-expect-error optional fields not in Project interface listed here
    setStartDate((p as any).start_date || '')
    // @ts-expect-error optional fields not in Project interface listed here
    setEndDate((p as any).end_date || '')
    setMonthly(p.budget_monthly ?? 0)
    setAnnual(p.budget_annual ?? 0)
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

  const hardDelete = async (id: number) => {
    if (confirm('מחיקה לצמיתות! פעולה זו בלתי הפיכה. להמשיך?')) {
      await dispatch(hardDeleteProject(id))
    }
  }

  const isAdmin = me?.role === 'Admin' || me?.role === 'ProjectManager'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">לוח בקרה</h1>
      <div className="flex items-center gap-3">
        {isAdmin && (
          <button className="bg-gray-900 text-white px-4 py-2 rounded" onClick={()=>setOpenCreate(true)}>צור פרויקט</button>
        )}
        <label className="text-sm">תצוגה:</label>
        <select className="border rounded p-1 text-sm" value={viewMode} onChange={e=>setViewMode(e.target.value as any)}>
          <option value="active">פעילים</option>
          <option value="archive">בארכיון</option>
          <option value="all">הכל</option>
        </select>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">פרויקטים</h2>
        {loading ? 'טוען...' : (
          <ul className="divide-y">
            {items.map(p => (
              <li key={p.id} className="py-2 flex items-center gap-3">
                <Link className="text-blue-600" to={`/projects/${p.id}`}>{p.name}</Link>
                {/* @ts-expect-error */}
                {p.is_active === false && <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">בארכיון</span>}
                {isAdmin && (
                  <>
                    {/* @ts-expect-error */}
                    {p.is_active !== false && (
                      <button className="ml-auto px-2 py-1 bg-yellow-500 text-white rounded" onClick={()=>openEditModal(p.id)}>ערוך</button>
                    )}
                    {/* @ts-expect-error */}
                    {p.is_active === false ? (
                      <>
                        <button className="ml-auto px-2 py-1 bg-green-600 text-white rounded" onClick={()=>restore(p.id)}>שחזר</button>
                        <button className="px-2 py-1 bg-red-700 text-white rounded" onClick={()=>hardDelete(p.id)}>מחק לצמיתות</button>
                      </>
                    ) : (
                      <>
                        <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>archive(p.id)}>ארכב</button>
                        <button className="px-2 py-1 bg-red-700 text-white rounded" onClick={()=>hardDelete(p.id)}>מחק לצמיתות</button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">סקירת הוצאות</h2>
        <ExpenseChart data={chartData} />
      </div>

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
    </div>
  )
}
