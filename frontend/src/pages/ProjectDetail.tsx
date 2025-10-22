import { useEffect, useState, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface Transaction {
  id: number
  type: 'Income' | 'Expense'
  amount: number
  description?: string | null
  tx_date: string
  category?: string | null
  notes?: string | null
  subproject_id?: number | null
  is_exceptional?: boolean
}

interface Subproject {
  id: number
  name: string
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  const [type, setType] = useState<'Income' | 'Expense'>('Expense')
  const [txDate, setTxDate] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [subprojectId, setSubprojectId] = useState<number | ''>('')
  const [isExceptional, setIsExceptional] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [subprojects, setSubprojects] = useState<Subproject[]>([])

  const [filterType, setFilterType] = useState<'all' | 'Income' | 'Expense'>('all')
  const [filterExceptional, setFilterExceptional] = useState<'all' | 'only'>('all')

  const load = async () => {
    if (!id) return

    setLoading(true)
    try {
      const { data } = await api.get(`/transactions/project/${id}`)
      setTxs(data || [])
    } catch (err: any) {
      console.error('Error loading transactions:', err)
      setError('שגיאה בטעינת העסקאות')
      setTxs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      load()
    }
  }, [id])

  useEffect(() => {
    const loadSubs = async () => {
      try {
        const { data } = await api.get(`/projects`)
        // placeholder עד שיהיה endpoint לתת-פרויקטים
        setSubprojects([])
      } catch {
        setSubprojects([])
      }
    }
    if (id) {
      loadSubs()
    }
  }, [id])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()

    if (!id) {
      setError('מזהה פרויקט חסר')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: any = {
        project_id: Number(id),
        tx_date: txDate,
        type,
        amount: amount === '' ? 0 : Number(amount),
        description: desc || undefined,
        category: category || undefined,
        notes: notes || undefined,
        subproject_id: subprojectId === '' ? undefined : Number(subprojectId),
        is_exceptional: isExceptional,
      }

      await api.post('/transactions', payload)

      // Reset form
      setType('Expense')
      setTxDate('')
      setAmount('')
      setDesc('')
      setCategory('')
      setNotes('')
      setSubprojectId('')
      setIsExceptional(false)

      // Reload transactions
      await load()
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'שמירה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  const filtered = txs.filter(t =>
    (filterType === 'all' || t.type === filterType) &&
    (filterExceptional === 'all' || t.is_exceptional)
  )

  const income = filtered
    .filter(t => t.type === 'Income')
    .reduce((s, t) => s + Number(t.amount || 0), 0)

  const expense = filtered
    .filter(t => t.type === 'Expense')
    .reduce((s, t) => s + Number(t.amount || 0), 0)

  if (!id) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          מזהה פרויקט לא תקין
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-gray-900 text-white px-4 py-2 rounded"
        >
          חזור לדשבורד
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">פרויקט #{id}</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-600 hover:text-gray-900 underline"
        >
          ← חזור לדשבורד
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">הוספת פעולה</h2>
        <form onSubmit={onCreate} className="grid md:grid-cols-6 gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">סוג</label>
            <select
              className="border rounded p-2 w-full"
              value={type}
              onChange={e => setType(e.target.value as any)}
            >
              <option value="Income">הכנסה</option>
              <option value="Expense">הוצאה</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">תאריך חיוב</label>
            <input
              className="border rounded p-2 w-full"
              type="date"
              value={txDate}
              onChange={e => setTxDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">סכום</label>
            <input
              className="border rounded p-2 w-full"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">קטגוריה</label>
            <input
              className="border rounded p-2 w-full"
              placeholder="לדוגמה: חשמל/ניקיון"
              value={category}
              onChange={e => setCategory(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">תת־פרויקט</label>
            <select
              className="border rounded p-2 w-full"
              value={subprojectId}
              onChange={e => setSubprojectId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">ללא</option>
              {subprojects.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="exceptional"
              type="checkbox"
              checked={isExceptional}
              onChange={e => setIsExceptional(e.target.checked)}
            />
            <label htmlFor="exceptional" className="text-sm">הוצאה חריגה</label>
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs text-gray-600 mb-1">הערות</label>
            <input
              className="border rounded p-2 w-full"
              placeholder="הערות"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="md:col-span-6 text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="md:col-span-6 flex justify-end">
            <button
              type="submit"
              className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? 'שומר...' : 'הוסף'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center gap-3 mb-2">
          <label className="text-sm font-semibold">סינון:</label>
          <select
            className="border rounded p-1 text-sm"
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
          >
            <option value="all">הכל</option>
            <option value="Income">הכנסות</option>
            <option value="Expense">הוצאות</option>
          </select>
          <label className="text-sm flex items-center gap-1">
            <input
              type="checkbox"
              checked={filterExceptional === 'only'}
              onChange={e => setFilterExceptional(e.target.checked ? 'only' : 'all')}
            />
            רק חריגות
          </label>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500">אין עסקאות להצגה</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">סוג</th>
                  <th className="p-2">תאריך</th>
                  <th className="p-2">סכום</th>
                  <th className="p-2">קטגוריה</th>
                  <th className="p-2">תיאור</th>
                  <th className="p-2">הערות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      {t.type === 'Income' ? 'הכנסה' : 'הוצאה'}
                      {t.is_exceptional ? ' (חריגה)' : ''}
                    </td>
                    <td className="p-2">{t.tx_date}</td>
                    <td className={`p-2 font-semibold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(t.amount || 0).toFixed(2)} ₪
                    </td>
                    <td className="p-2">{t.category ?? '-'}</td>
                    <td className="p-2">{t.description ?? '-'}</td>
                    <td className="p-2">{t.notes ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-3">סיכום</h3>
        <div className="flex gap-6 text-lg">
          <div className="text-green-600 font-semibold">
            הכנסות: {income.toFixed(2)} ₪
          </div>
          <div className="text-red-600 font-semibold">
            הוצאות: {expense.toFixed(2)} ₪
          </div>
          <div className={`font-bold ${income - expense < 0 ? 'text-red-600' : 'text-green-600'}`}>
            רווח: {(income - expense).toFixed(2)} ₪
          </div>
        </div>
      </div>
    </div>
  )
}