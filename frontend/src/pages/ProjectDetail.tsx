import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../lib/api'
import { ReportAPI } from '../lib/apiClient'
import { ExpenseCategory } from '../types/api'
import ProjectExpensePieChart from '../components/charts/ProjectExpensePieChart'
import ProjectTrendsChart from '../components/charts/ProjectTrendsChart'
import EditTransactionModal from '../components/EditTransactionModal'
import CreateRecurringTransactionModal from '../components/CreateRecurringTransactionModal'
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
  const [dateFilterMode, setDateFilterMode] = useState<'current_month' | 'selected_month' | 'date_range'>('current_month')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [editTransactionModalOpen, setEditTransactionModalOpen] = useState(false)
  const [selectedTransactionForEdit, setSelectedTransactionForEdit] = useState<any | null>(null)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedTransactionForDocuments, setSelectedTransactionForDocuments] = useState<any | null>(null)
  const [transactionDocuments, setTransactionDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null)
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [uploadedDocuments, setUploadedDocuments] = useState<Array<{id: number, fileName: string, description: string}>>([])
  
  // State for file uploads during transaction creation
  const [filesToUpload, setFilesToUpload] = useState<File[]>([])

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

      const response = await api.post('/transactions', payload)
      const newTransactionId = response.data?.id

      // If files were selected, upload them
      if (filesToUpload.length > 0 && newTransactionId) {
        try {
          let successCount = 0
          let errorCount = 0
          const uploadedDocs: Array<{id: number, fileName: string, description: string}> = []
          
          // Upload each file
          for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i]
            try {
              const formData = new FormData()
              formData.append('file', file)
              const uploadResponse = await api.post(`/transactions/${newTransactionId}/supplier-document`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              })
              
              // Get document ID from response
              if (uploadResponse.data && uploadResponse.data.id) {
                successCount++
                uploadedDocs.push({
                  id: uploadResponse.data.id,
                  fileName: file.name,
                  description: uploadResponse.data.description || ''
                })
              }
            } catch (err: any) {
              console.error(`Error uploading file ${file.name}:`, err)
              errorCount++
            }
          }
          
          // If some files were uploaded successfully, show description modal
          if (successCount > 0 && uploadedDocs.length > 0) {
            setUploadedDocuments(uploadedDocs)
            setSelectedTransactionForDocuments({ id: newTransactionId })
            setShowDescriptionModal(true)
          }
          
          // Show result message if there were errors
          if (errorCount > 0) {
            if (successCount > 0) {
              alert(`הועלו ${successCount} מסמכים, ${errorCount} נכשלו`)
            } else {
              alert(`שגיאה בהעלאת המסמכים`)
            }
          }
        } catch (err: any) {
          console.error('Error uploading files:', err)
          alert('העסקה נוצרה בהצלחה אך הייתה שגיאה בהעלאת חלק מהמסמכים')
        }
      }

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
      setFilesToUpload([])

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


  // Filter transactions based on date filter mode
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  const filtered = txs.filter(t => {
    const txDate = new Date(t.tx_date)
    let dateMatches = false

    if (dateFilterMode === 'current_month') {
      // Show only current month
      const txMonth = txDate.getMonth() + 1
      const txYear = txDate.getFullYear()
      dateMatches = txMonth === currentMonth && txYear === currentYear
    } else if (dateFilterMode === 'selected_month') {
      // Show selected month
      const [year, month] = selectedMonth.split('-').map(Number)
      const txMonth = txDate.getMonth() + 1
      const txYear = txDate.getFullYear()
      dateMatches = txMonth === month && txYear === year
    } else if (dateFilterMode === 'date_range') {
      // Show date range
      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        dateMatches = txDate >= start && txDate <= end
      } else {
        dateMatches = true // Show all if dates not set
      }
    }
    
    return dateMatches &&
      (filterType === 'all' || t.type === filterType) &&
      (filterExceptional === 'all' || t.is_exceptional)
  })

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את העסקה?')) {
      return
    }
    
    try {
      await api.delete(`/transactions/${transactionId}`)
      await loadChartsData()
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'שגיאה במחיקת העסקה')
    }
  }

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
          <button
            onClick={() => setShowRecurringModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            + עסקה מחזורית
          </button>
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

          <div className="md:col-span-7">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                העלה מסמכים (אופציונלי)
              </span>
            </label>
            <div className="relative">
              <label 
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 transition-all duration-300 group hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const files = Array.from(e.dataTransfer.files)
                  if (files.length > 0) {
                    setFilesToUpload(prev => [...prev, ...files])
                  }
                }}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="w-16 h-16 mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <span className="font-bold">לחץ להעלאה</span> או גרור קבצים לכאן
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF, תמונות, מסמכים (מרובה)</p>
                </div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    if (e.target.files) {
                      setFilesToUpload(prev => [...prev, ...Array.from(e.target.files || [])])
                    }
                  }}
                />
              </label>
            </div>
            {filesToUpload.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    נבחרו {filesToUpload.length} קבצים
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilesToUpload([])}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                  >
                    נקה הכל
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  {filesToUpload.map((file, index) => (
                    <motion.div
                      key={`${file.name}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newFiles = filesToUpload.filter((_, i) => i !== index)
                          setFilesToUpload(newFiles)
                        }}
                        className="ml-3 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                        title="הסר קובץ"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
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
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              רשימת עסקאות
            </h3>
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

          {/* Date Filter Options */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                סינון לפי תאריך
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dateFilter"
                    value="current_month"
                    checked={dateFilterMode === 'current_month'}
                    onChange={() => setDateFilterMode('current_month')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">חודש נוכחי</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dateFilter"
                    value="selected_month"
                    checked={dateFilterMode === 'selected_month'}
                    onChange={() => setDateFilterMode('selected_month')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">חודש מסוים</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dateFilter"
                    value="date_range"
                    checked={dateFilterMode === 'date_range'}
                    onChange={() => setDateFilterMode('date_range')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">טווח תאריכים</span>
                </label>
              </div>
            </div>

            {dateFilterMode === 'selected_month' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  בחר חודש
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {dateFilterMode === 'date_range' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    מתאריך
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    עד תאריך
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
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
                        <button
                          onClick={() => handleDeleteTransaction(t.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          מחק
                        </button>
                        <button
                          onClick={async () => {
                            setSelectedTransactionForDocuments(t)
                            setShowDocumentsModal(true)
                            setDocumentsLoading(true)
                            try {
                              const { data } = await api.get(`/transactions/${t.id}/documents`)
                              setTransactionDocuments(data || [])
                            } catch (err: any) {
                              console.error('Error loading documents:', err)
                              setTransactionDocuments([])
                            } finally {
                              setDocumentsLoading(false)
                            }
                          }}
                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          מסמכים
                        </button>
                        <label className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">
                          העלה מסמכים
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                              const files = e.target.files
                              if (!files || files.length === 0) return
                              
                              try {
                                let successCount = 0
                                let errorCount = 0
                                const uploadedDocs: Array<{id: number, fileName: string, description: string}> = []
                                
                                // Upload each file
                                for (let i = 0; i < files.length; i++) {
                                  const file = files[i]
                                  try {
                                    const formData = new FormData()
                                    formData.append('file', file)
                                    const response = await api.post(`/transactions/${t.id}/supplier-document`, formData, {
                                      headers: { 'Content-Type': 'multipart/form-data' }
                                    })
                                    
                                    // Get document ID from response
                                    if (response.data && response.data.id) {
                                      successCount++
                                      uploadedDocs.push({
                                        id: response.data.id,
                                        fileName: file.name,
                                        description: response.data.description || ''
                                      })
                                    }
                                  } catch (err: any) {
                                    console.error(`Error uploading file ${file.name}:`, err)
                                    errorCount++
                                  }
                                }
                                
                                // If some files were uploaded successfully, show description modal
                                if (successCount > 0 && uploadedDocs.length > 0) {
                                  setUploadedDocuments(uploadedDocs)
                                  setSelectedTransactionForDocuments(t)
                                  setShowDescriptionModal(true)
                                  
                                  await loadChartsData()
                                  // Reload documents in modal if it's open
                                  if (showDocumentsModal && selectedTransactionForDocuments?.id === t.id) {
                                    const { data } = await api.get(`/transactions/${t.id}/documents`)
                                    setTransactionDocuments(data || [])
                                  }
                                } else if (successCount > 0) {
                                  // Files uploaded but no IDs received - just reload
                                  await loadChartsData()
                                  if (showDocumentsModal && selectedTransactionForDocuments?.id === t.id) {
                                    const { data } = await api.get(`/transactions/${t.id}/documents`)
                                    setTransactionDocuments(data || [])
                                  }
                                }
                                
                                // Show result message if there were errors
                                if (errorCount > 0) {
                                  if (successCount > 0) {
                                    alert(`הועלו ${successCount} מסמכים, ${errorCount} נכשלו`)
                                  } else {
                                    alert(`שגיאה בהעלאת המסמכים`)
                                  }
                                }
                              } catch (err: any) {
                                alert(err.response?.data?.detail ?? 'שגיאה בהעלאת מסמכים')
                              }
                              e.target.value = ''
                            }}
                          />
                        </label>
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
      <CreateRecurringTransactionModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onSuccess={async () => {
          setShowRecurringModal(false)
          await loadChartsData()
        }}
        projectId={parseInt(id || '0')}
      />

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

      {/* Documents Modal */}
      {showDocumentsModal && selectedTransactionForDocuments && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowDocumentsModal(false)
            setSelectedTransactionForDocuments(null)
            setSelectedDocument(null)
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  מסמכי עסקה #{selectedTransactionForDocuments.id}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedTransactionForDocuments.description || 'ללא תיאור'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDocumentsModal(false)
                  setSelectedTransactionForDocuments(null)
                  setSelectedDocument(null)
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {documentsLoading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  טוען מסמכים...
                </div>
              ) : transactionDocuments.length === 0 ? (
                <div className="text-center py-16">
                  <svg
                    className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    אין מסמכים לעסקה זו
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    העלה מסמך באמצעות כפתור "העלה מסמך" בטבלת העסקאות
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {transactionDocuments.map((doc) => {
                    const getFileExtension = (filePath: string): string => {
                      return filePath.split('.').pop()?.toLowerCase() || ''
                    }
                    const getFileName = (filePath: string): string => {
                      const parts = filePath.split('/')
                      return parts[parts.length - 1] || 'קובץ'
                    }
                    const isImage = (filePath: string): boolean => {
                      const ext = getFileExtension(filePath)
                      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
                    }
                    const isPdf = (filePath: string): boolean => {
                      return getFileExtension(filePath) === 'pdf'
                    }
                    const getFileUrl = (filePath: string): string => {
                      if (filePath.startsWith('http')) return filePath
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
                      const baseUrl = apiUrl.replace('/api/v1', '')
                      let normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
                      normalizedPath = normalizedPath.replace(/([^:]\/)\/+/g, '$1')
                      return `${baseUrl}${normalizedPath}`
                    }

                    return (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-xl transition-all cursor-pointer bg-white dark:bg-gray-800"
                        onClick={() => setSelectedDocument(doc)}
                      >
                        {isImage(doc.file_path) ? (
                          <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-700 overflow-hidden group">
                            <img
                              src={getFileUrl(doc.file_path)}
                              alt={doc.description || 'מסמך'}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute top-2 right-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
                              📷 תמונה
                            </div>
                          </div>
                        ) : isPdf(doc.file_path) ? (
                          <div className="aspect-[4/3] bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 flex flex-col items-center justify-center group hover:from-red-100 hover:to-red-200 dark:hover:from-red-800/30 dark:hover:to-red-700/30 transition-colors">
                            <svg
                              className="w-20 h-20 text-red-600 dark:text-red-400 mb-3 group-hover:scale-110 transition-transform"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h12l4 4v16H2v-1z" />
                            </svg>
                            <span className="text-red-700 dark:text-red-300 font-bold text-lg">PDF</span>
                          </div>
                        ) : (
                          <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 flex flex-col items-center justify-center group">
                            <svg
                              className="w-20 h-20 text-gray-400 dark:text-gray-500 mb-3 group-hover:scale-110 transition-transform"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                              {getFileExtension(doc.file_path).toUpperCase() || 'קובץ'}
                            </span>
                          </div>
                        )}
                        <div className="p-4 bg-white dark:bg-gray-800">
                          <p className="text-sm text-gray-900 dark:text-white truncate font-semibold mb-1">
                            {doc.description || getFileName(doc.file_path)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            📅 {new Date(doc.uploaded_at).toLocaleDateString('he-IL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedDocument(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-7xl max-h-[95vh] w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {selectedDocument.description || selectedDocument.file_path.split('/').pop()}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(selectedDocument.uploaded_at).toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedDocument(null)}
                className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                aria-label="סגור"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {(() => {
                const getFileExtension = (filePath: string): string => {
                  return filePath.split('.').pop()?.toLowerCase() || ''
                }
                const getFileName = (filePath: string): string => {
                  const parts = filePath.split('/')
                  return parts[parts.length - 1] || 'קובץ'
                }
                const isImage = (filePath: string): boolean => {
                  const ext = getFileExtension(filePath)
                  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
                }
                const isPdf = (filePath: string): boolean => {
                  return getFileExtension(filePath) === 'pdf'
                }
                const getFileUrl = (filePath: string): string => {
                  if (filePath.startsWith('http')) return filePath
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
                  const baseUrl = apiUrl.replace('/api/v1', '')
                  let normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
                  normalizedPath = normalizedPath.replace(/([^:]\/)\/+/g, '$1')
                  return `${baseUrl}${normalizedPath}`
                }

                if (isImage(selectedDocument.file_path)) {
                  return (
                    <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg p-4 min-h-[400px]">
                      <img
                        src={getFileUrl(selectedDocument.file_path)}
                        alt={selectedDocument.description || getFileName(selectedDocument.file_path)}
                        className="max-w-full max-h-[75vh] h-auto mx-auto rounded-lg shadow-xl object-contain"
                      />
                    </div>
                  )
                } else if (isPdf(selectedDocument.file_path)) {
                  return (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                      <div className="flex flex-col h-[80vh]">
                        <div className="flex-1 relative">
                          <iframe
                            src={`${getFileUrl(selectedDocument.file_path)}#toolbar=1&navpanes=1&scrollbar=1`}
                            className="w-full h-full border-0"
                            title={selectedDocument.description || getFileName(selectedDocument.file_path)}
                          />
                          <div className="absolute top-4 right-4 flex gap-2">
                            <a
                              href={getFileUrl(selectedDocument.file_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>🔗</span>
                              פתח בחלון חדש
                            </a>
                            <a
                              href={getFileUrl(selectedDocument.file_path)}
                              download
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>📥</span>
                              הורד
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                } else {
                  return (
                    <div className="text-center py-16">
                      <div className="mb-6">
                        <svg
                          className="w-24 h-24 text-gray-400 dark:text-gray-500 mx-auto mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                          לא ניתן להציג את הקובץ ישירות
                        </p>
                        <p className="text-gray-500 dark:text-gray-500 text-sm mb-6">
                          סוג קובץ: {getFileExtension(selectedDocument.file_path).toUpperCase() || 'לא ידוע'}
                        </p>
                      </div>
                      <a
                        href={getFileUrl(selectedDocument.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <span>📥</span>
                        פתח קישור חדש להורדה
                      </a>
                    </div>
                  )
                }
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Description Modal for Uploaded Documents */}
      {showDescriptionModal && selectedTransactionForDocuments && uploadedDocuments.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowDescriptionModal(false)
            setUploadedDocuments([])
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  הוסף תיאורים למסמכים
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  עסקה #{selectedTransactionForDocuments.id} - {uploadedDocuments.length} מסמכים
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDescriptionModal(false)
                  setUploadedDocuments([])
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-4">
                {uploadedDocuments.map((doc, index) => (
                  <div key={doc.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {doc.fileName}
                    </label>
                    <input
                      type="text"
                      value={doc.description}
                      onChange={(e) => {
                        const updated = [...uploadedDocuments]
                        updated[index] = { ...updated[index], description: e.target.value }
                        setUploadedDocuments(updated)
                      }}
                      placeholder="הזן תיאור למסמך (אופציונלי)"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus={index === 0}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowDescriptionModal(false)
                  setUploadedDocuments([])
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                דלג
              </button>
              <button
                onClick={async () => {
                  try {
                    let updateCount = 0
                    for (const doc of uploadedDocuments) {
                      if (doc.id > 0) {
                        try {
                          const formData = new FormData()
                          formData.append('description', doc.description || '')
                          await api.put(`/transactions/${selectedTransactionForDocuments.id}/documents/${doc.id}`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          })
                          updateCount++
                        } catch (err: any) {
                          console.error(`Error updating description for doc ${doc.id}:`, err)
                        }
                      }
                    }
                    
                    setShowDescriptionModal(false)
                    setUploadedDocuments([])
                    
                    // Reload data
                    await loadChartsData()
                    if (showDocumentsModal && selectedTransactionForDocuments?.id === selectedTransactionForDocuments.id) {
                      const { data } = await api.get(`/transactions/${selectedTransactionForDocuments.id}/documents`)
                      setTransactionDocuments(data || [])
                    }
                  } catch (err: any) {
                    console.error('Error saving descriptions:', err)
                    alert('שגיאה בשמירת התיאורים')
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                שמור תיאורים
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}