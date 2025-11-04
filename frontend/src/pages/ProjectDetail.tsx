import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../lib/api'
import { ReportAPI } from '../lib/apiClient'
import { ExpenseCategory, Transaction } from '../types/api'
import ProjectExpensePieChart from '../components/charts/ProjectExpensePieChart'
import ProjectTrendsChart from '../components/charts/ProjectTrendsChart'
import EditTransactionModal from '../components/EditTransactionModal'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchSuppliers } from '../store/slices/suppliersSlice'

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
  const dispatch = useAppDispatch()
  const { items: suppliers } = useAppSelector(s => s.suppliers)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [chartsLoading, setChartsLoading] = useState(false)
  const [projectImageUrl, setProjectImageUrl] = useState<string | null>(null)

  const [type, setType] = useState<'Income' | 'Expense'>('Expense')
  const [txDate, setTxDate] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [subprojectId, setSubprojectId] = useState<number | ''>('')
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [isExceptional, setIsExceptional] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [subprojects, setSubprojects] = useState<Subproject[]>([])

  const [filterType, setFilterType] = useState<'all' | 'Income' | 'Expense'>('all')
  const [filterExceptional, setFilterExceptional] = useState<'all' | 'only'>('all')

  const [editTransactionModalOpen, setEditTransactionModalOpen] = useState(false)
  const [selectedTransactionForEdit, setSelectedTransactionForEdit] = useState<Transaction | null>(null)

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

  const loadChartsData = async () => {
    if (!id) return

    setChartsLoading(true)
    try {
      console.log('Loading charts data for project:', id)
      // Load expense categories and transactions for charts
      const [categoriesData, transactionsData] = await Promise.all([
        ReportAPI.getProjectExpenseCategories(parseInt(id)),
        ReportAPI.getProjectTransactions(parseInt(id))
      ])
      
      setExpenseCategories(categoriesData)
      setTxs(transactionsData)
    } catch (err: any) {
      console.error('Error loading charts data:', err)
      setError('שגיאה בטעינת נתוני הגרפים')
    } finally {
      setChartsLoading(false)
    }
  }

  const loadProjectInfo = async () => {
    if (!id) return

    try {
      const { data } = await api.get(`/projects/${id}`)
      setProjectName(data.name || `פרויקט ${id}`)
      if (data.image_url) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
        const baseUrl = apiUrl.replace('/api/v1', '')
        setProjectImageUrl(`${baseUrl}/uploads/${data.image_url}`)
      }
    } catch (err: any) {
      console.error('Error loading project info:', err)
      setProjectName(`פרויקט ${id}`)
    }
  }

  useEffect(() => {
    if (id) {
      loadProjectInfo()
      loadChartsData()
    }
    dispatch(fetchSuppliers())
  }, [id, dispatch])


  useEffect(() => {
    const loadSubs = async () => {
      try {
        const { data } = await api.get(`/projects`)
        // Filter to get only sub-projects (projects with relation_project)
        const subProjects = data.filter((p: any) => p.relation_project)
        setSubprojects(subProjects.map((p: any) => ({ id: p.id, name: p.name })))
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

    // Validate required fields
    if (!txDate) {
      setError('תאריך חיוב נדרש')
      return
    }

    if (amount === '' || Number(amount) <= 0) {
      setError('סכום חיובי נדרש')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: any = {
        project_id: Number(id),
        tx_date: txDate,
        type,
        amount: Number(amount),
        description: desc || undefined,
        category: category || undefined,
        notes: notes || undefined,
        subproject_id: subprojectId === '' ? undefined : Number(subprojectId),
        supplier_id: supplierId === '' ? undefined : Number(supplierId),
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
      setSupplierId('')
      setIsExceptional(false)

      // Reload transactions and charts data
      await loadChartsData()
    } catch (e: any) {
      console.error('Transaction creation error:', e)
      setError(e.response?.data?.detail ?? 'שמירה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  const handleEditAnyTransaction = (transaction: Transaction) => {
    setSelectedTransactionForEdit(transaction)
    setEditTransactionModalOpen(true)
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
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            {projectImageUrl && (
              <div className="rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={projectImageUrl}
                  alt={projectName || `פרויקט #${id}`}
                  className="w-32 h-32 object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {projectName || `פרויקט #${id}`}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                ניהול פיננסי מפורט
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          ← חזור לדשבורד
        </button>
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Project Expense Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {chartsLoading ? (
            <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse flex items-center justify-center">
              <div className="text-gray-500 dark:text-gray-400">טוען נתוני גרפים...</div>
            </div>
          ) : (
            <ProjectExpensePieChart
              expenseCategories={expenseCategories}
              projectName={projectName}
            />
          )}
        </motion.div>

        {/* Project Trends Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {chartsLoading ? (
            <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse flex items-center justify-center">
              <div className="text-gray-500 dark:text-gray-400">טוען נתוני גרפים...</div>
            </div>
          ) : (
            <ProjectTrendsChart
              projectId={parseInt(id || '0')}
              projectName={projectName}
              transactions={txs}
            />
          )}
        </motion.div>
      </div>

      {/* Transaction Management Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">הוספת עסקה חדשה</h2>
        </div>
        <form onSubmit={onCreate} className="grid md:grid-cols-7 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">סוג</label>
            <select
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={type}
              onChange={e => setType(e.target.value as any)}
            >
              <option value="Income">הכנסה</option>
              <option value="Expense">הוצאה</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">תאריך חיוב</label>
            <input
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="date"
              value={txDate}
              onChange={e => setTxDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">סכום</label>
            <input
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">קטגוריה</label>
            <select
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">בחר קטגוריה</option>
              <option value="ניקיון">ניקיון</option>
              <option value="חשמל">חשמל</option>
              <option value="ביטוח">ביטוח</option>
              <option value="גינון">גינון</option>
              <option value="אחר">אחר</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">תת־פרויקט</label>
            <select
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subprojectId}
              onChange={e => setSubprojectId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">ללא</option>
              {subprojects.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ספק</label>
            <select
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={supplierId}
              onChange={e => setSupplierId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">ללא ספק</option>
              {suppliers.filter(s => s.is_active).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="exceptional"
              type="checkbox"
              checked={isExceptional}
              onChange={e => setIsExceptional(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="exceptional" className="text-sm text-gray-700 dark:text-gray-300">הוצאה חריגה</label>
          </div>

          <div className="md:col-span-7">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">הערות</label>
            <input
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="הערות"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="md:col-span-7 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="md:col-span-7 flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={saving}
            >
              {saving ? 'שומר...' : 'הוסף עסקה'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Transactions List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">רשימת עסקאות</h3>
          <div className="flex items-center gap-4">
            <select
              className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
            >
              <option value="all">הכל</option>
              <option value="Income">הכנסות</option>
              <option value="Expense">הוצאות</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={filterExceptional === 'only'}
                onChange={e => setFilterExceptional(e.target.checked ? 'only' : 'all')}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              רק חריגות
            </label>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">אין עסקאות להצגה</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 text-left">
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">סוג</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">תאריך</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">סכום</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">קטגוריה</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">ספק</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">תיאור</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">הערות</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const transaction = t as any // Cast to access is_generated
                  return (
                  <tr key={t.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          t.type === 'Income' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {t.type === 'Income' ? 'הכנסה' : 'הוצאה'}
                          {t.is_exceptional ? ' (חריגה)' : ''}
                        </span>
                        {transaction.is_generated && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300" title="נוצר אוטומטית מעסקה מחזורית">
                            🔄 מחזורי
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{t.tx_date}</td>
                    <td className={`p-3 font-semibold ${t.type === 'Income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {Number(t.amount || 0).toFixed(2)} ₪
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{t.category ?? '-'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">
                      {(t as any).supplier_id ? suppliers.find(s => s.id === (t as any).supplier_id)?.name ?? '-' : '-'}
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{t.description ?? '-'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{t.notes ?? '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditAnyTransaction(t)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          ערוך
                        </button>
                        {(t as any).supplier_id && (
                          <label className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">
                            העלה מסמך
                            <input
                              type="file"
                              className="hidden"
                              onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                try {
                                  const formData = new FormData()
                                  formData.append('file', file)
                                  await api.post(`/transactions/${t.id}/supplier-document`, formData, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                  })
                                  alert('מסמך הועלה בהצלחה')
                                  await loadChartsData()
                                } catch (err: any) {
                                  alert(err.response?.data?.detail ?? 'שגיאה בהעלאת מסמך')
                                }
                                e.target.value = ''
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">סיכום פיננסי</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
            <div className="text-green-600 dark:text-green-400 font-semibold mb-1">הכנסות</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {income.toFixed(2)} ₪
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
            <div className="text-red-600 dark:text-red-400 font-semibold mb-1">הוצאות</div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {expense.toFixed(2)} ₪
            </div>
          </div>
          <div className={`p-4 rounded-lg text-center ${
            income - expense < 0 
              ? 'bg-red-50 dark:bg-red-900/20' 
              : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <div className={`font-semibold mb-1 ${
              income - expense < 0 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              רווח נטו
            </div>
            <div className={`text-2xl font-bold ${
              income - expense < 0 
                ? 'text-red-700 dark:text-red-300' 
                : 'text-green-700 dark:text-green-300'
            }`}>
              {(income - expense).toFixed(2)} ₪
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <EditTransactionModal
        isOpen={editTransactionModalOpen}
        onClose={() => {
          setEditTransactionModalOpen(false)
          setSelectedTransactionForEdit(null)
        }}
        onSuccess={async () => {
          setEditTransactionModalOpen(false)
          setSelectedTransactionForEdit(null)
          await loadChartsData()
        }}
        transaction={selectedTransactionForEdit}
      />
    </div>
  )
}