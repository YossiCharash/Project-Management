import { useEffect, useState, ChangeEvent, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../lib/api'
import { ReportAPI, BudgetAPI } from '../lib/apiClient'
import { ExpenseCategory, BudgetWithSpending } from '../types/api'
import ProjectTrendsChart from '../components/charts/ProjectTrendsChart'
import BudgetCard from '../components/charts/BudgetCard'
import BudgetProgressChart from '../components/charts/BudgetProgressChart'
import EditTransactionModal from '../components/EditTransactionModal'
import CreateTransactionModal from '../components/CreateTransactionModal'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchSuppliers } from '../store/slices/suppliersSlice'
import { ChevronDown } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  CLEANING: 'ניקיון',
  'ניקיון': 'ניקיון',
  ELECTRICITY: 'חשמל',
  'חשמל': 'חשמל',
  INSURANCE: 'ביטוח',
  'ביטוח': 'ביטוח',
  GARDENING: 'גינון',
  'גינון': 'גינון',
  OTHER: 'אחר',
  'אחר': 'אחר'
}

// Reverse mapping: Hebrew to English (for filtering)
const CATEGORY_REVERSE_MAP: Record<string, string> = {
  'ניקיון': 'CLEANING',
  'חשמל': 'ELECTRICITY',
  'ביטוח': 'INSURANCE',
  'גינון': 'GARDENING',
  'אחר': 'OTHER',
  'תחזוקה': 'MAINTENANCE'
}

// Normalize category for comparison (handles both Hebrew and English)
const normalizeCategoryForFilter = (category: string | null | undefined): string | null => {
  if (!category) return null
  const trimmed = String(category).trim()
  if (trimmed.length === 0) return null
  
  // If it's already in English (uppercase), return as is
  // Check if all characters are uppercase letters (English enum values)
  if (trimmed === trimmed.toUpperCase() && /^[A-Z_]+$/.test(trimmed)) {
    return trimmed
  }
  
  // If it's in Hebrew, try to convert to English
  if (CATEGORY_REVERSE_MAP[trimmed]) {
    return CATEGORY_REVERSE_MAP[trimmed]
  }
  
  // Otherwise return as is (might be a custom category)
  return trimmed
}

const calculateMonthlyIncomeAccrual = (monthlyIncome: number, incomeStartDate: Date, currentDate: Date): number => {
  if (monthlyIncome <= 0) return 0
  if (incomeStartDate.getTime() > currentDate.getTime()) return 0

  const firstOccurrence = new Date(incomeStartDate.getTime())
  if (firstOccurrence.getDate() !== 1) {
    firstOccurrence.setMonth(firstOccurrence.getMonth() + 1)
    firstOccurrence.setDate(1)
  }

  if (firstOccurrence.getTime() > currentDate.getTime()) return 0

  const monthsPassed =
    (currentDate.getFullYear() - firstOccurrence.getFullYear()) * 12 +
    (currentDate.getMonth() - firstOccurrence.getMonth())
  const occurrences = monthsPassed + 1

  return monthlyIncome * occurrences
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STANDING_ORDER: 'הוראת קבע',
  'הוראת קבע': 'הוראת קבע',
  CREDIT: 'אשראי',
  'אשראי': 'אשראי',
  CHECK: 'שיק',
  'שיק': 'שיק',
  CASH: 'מזומן',
  'מזומן': 'מזומן',
  BANK_TRANSFER: 'העברה בנקאית',
  'העברה בנקאית': 'העברה בנקאית'
}

interface Transaction {
  id: number
  type: 'Income' | 'Expense'
  amount: number
  description?: string | null
  tx_date: string
  category?: string | null
  payment_method?: string | null
  notes?: string | null
  subproject_id?: number | null
  is_exceptional?: boolean
  is_generated?: boolean
  supplier_id?: number | null
  created_by_user_id?: number | null
  created_by_user?: {
    id: number
    full_name: string
    email: string
  } | null
  from_fund?: boolean
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { items: suppliers } = useAppSelector(s => s.suppliers)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [projectBudgets, setProjectBudgets] = useState<BudgetWithSpending[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [chartsLoading, setChartsLoading] = useState(false)
  const [projectImageUrl, setProjectImageUrl] = useState<string | null>(null)
  const [projectBudget, setProjectBudget] = useState<{ budget_monthly: number; budget_annual: number }>({ budget_monthly: 0, budget_annual: 0 })
  const [projectStartDate, setProjectStartDate] = useState<string | null>(null)
  const [projectEndDate, setProjectEndDate] = useState<string | null>(null)

  const [filterType, setFilterType] = useState<'all' | 'Income' | 'Expense'>('all')
  const [filterExceptional, setFilterExceptional] = useState<'all' | 'only'>('all')
  const [dateFilterMode, setDateFilterMode] = useState<'current_month' | 'selected_month' | 'date_range'>('current_month')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [editTransactionModalOpen, setEditTransactionModalOpen] = useState(false)
  const [selectedTransactionForEdit, setSelectedTransactionForEdit] = useState<any | null>(null)
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedTransactionForDocuments, setSelectedTransactionForDocuments] = useState<any | null>(null)
  const [transactionDocuments, setTransactionDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null)
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [uploadedDocuments, setUploadedDocuments] = useState<Array<{id: number, fileName: string, description: string}>>([])
  const [budgetDeleteLoading, setBudgetDeleteLoading] = useState<number | null>(null)
  const [showAddBudgetForm, setShowAddBudgetForm] = useState(false)
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetFormError, setBudgetFormError] = useState<string | null>(null)
  const [newBudgetForm, setNewBudgetForm] = useState({
    category: 'ניקיון',
    amount: '',
    period_type: 'Annual' as 'Annual' | 'Monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  })
  const expenseCategoryOptions = ['ניקיון', 'חשמל', 'ביטוח', 'גינון', 'תחזוקה', 'אחר']
  
  // Get all unique categories from transactions (in addition to standard options)
  const allCategoriesFromTransactions = Array.from(new Set(
    txs
      .map(t => t.category)
      .filter((cat): cat is string => cat !== null && cat !== undefined && cat !== '')
      .map(cat => cat.trim())
  ))
  
  // Combine standard options with categories found in transactions (avoid duplicates)
  const allCategoryOptions = Array.from(new Set([...expenseCategoryOptions, ...allCategoriesFromTransactions]))
  
  
  // Fund state
  const [fundData, setFundData] = useState<{
    current_balance: number
    monthly_amount: number
    last_monthly_addition: string | null
    initial_balance: number
    initial_total: number
    total_additions: number
    total_deductions: number
    transactions: Array<{
      id: number
      tx_date: string
      type: string
      amount: number
      description: string | null
      category: string | null
      notes: string | null
      created_by_user: {
        id: number
        full_name: string
        email: string
      } | null
      file_path: string | null
      documents_count: number
    }>
  } | null>(null)
  const [hasFund, setHasFund] = useState(false)
  const [fundLoading, setFundLoading] = useState(false)
  const [fundCategoryFilter, setFundCategoryFilter] = useState<string>('all')
  const [transactionsExpandedId, setTransactionsExpandedId] = useState<number | null>(null)
  const [showFundTransactionsModal, setShowFundTransactionsModal] = useState(false)

  const load = async () => {
    if (!id) return

    setLoading(true)
    try {
      const { data } = await api.get(`/transactions/project/${id}`)
      setTxs(data || [])
    } catch (err: any) {
      setTxs([])
    } finally {
      setLoading(false)
    }
  }

  const loadChartsData = async () => {
    if (!id) return

    setChartsLoading(true)
    try {
      // Load expense categories, transactions, and budgets for charts
      const [categoriesData, transactionsData, budgetsData] = await Promise.all([
        ReportAPI.getProjectExpenseCategories(parseInt(id)),
        ReportAPI.getProjectTransactions(parseInt(id)),
        BudgetAPI.getProjectBudgets(parseInt(id)).catch(() => {
          return []
        }) // Don't fail if no budgets
      ])
      
      setExpenseCategories(categoriesData || [])
      setTxs(transactionsData || [])
      setProjectBudgets(budgetsData || [])
    } catch (err: any) {
      // Error loading charts data
    } finally {
      setChartsLoading(false)
    }
  }

const formatCurrency = (value: number | string | null | undefined) => {
  return Number(value || 0).toLocaleString('he-IL')
}

const formatDate = (value: string | null) => {
    try {
      return value ? new Date(value).toLocaleDateString('he-IL') : 'לא הוגדר'
    } catch {
      return 'לא הוגדר'
    }
  }

  const loadProjectInfo = async () => {
    if (!id) return

    try {
      const { data } = await api.get(`/projects/${id}`)
      
      console.log('📥 DEBUG - Project data loaded:', {
        id,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        budget_monthly: data.budget_monthly,
        budget_annual: data.budget_annual
      })
      
      setProjectName(data.name || `פרויקט ${id}`)
      setProjectBudget({
        budget_monthly: data.budget_monthly || 0,
        budget_annual: data.budget_annual || 0
      })
      setProjectStartDate(data.start_date || null)
      setProjectEndDate(data.end_date || null)
      
      console.log('📥 DEBUG - State set:', {
        projectStartDate: data.start_date || null,
        projectEndDate: data.end_date || null,
        budgetMonthly: data.budget_monthly || 0
      })
      
      if (data.image_url) {
        // Backend now returns full S3 URL in image_url for new uploads.
        // For backward compatibility, if it's a relative path we still prefix with /uploads.
        if (data.image_url.startsWith('http')) {
          setProjectImageUrl(data.image_url)
        } else {
          const apiUrl = import.meta.env.VITE_API_URL || ''
          // @ts-ignore
          const baseUrl = apiUrl ? apiUrl.replace('/api/v1', '') : ''
          setProjectImageUrl(`${baseUrl}/uploads/${data.image_url}`)
        }
      }
      // Check if project has fund and load fund data
      const hasFundFlag = data.has_fund || false
      const monthlyFundAmount = data.monthly_fund_amount || 0
      setHasFund(hasFundFlag)
      
      // Always try to load fund data if has_fund is true (even if fund doesn't exist yet)
      if (hasFundFlag) {
        await loadFundData()
      } else {
        // Also try to load if monthly_fund_amount exists (backward compatibility)
        if (monthlyFundAmount > 0) {
          await loadFundData()
        } else {
          setFundData(null)
          setFundLoading(false)
        }
      }
    } catch (err: any) {
      setProjectName(`פרויקט ${id}`)
      setProjectBudget({ budget_monthly: 0, budget_annual: 0 })
    }
  }

  const loadFundData = async () => {
    if (!id) return
    
    setFundLoading(true)
    try {
      const { data } = await api.get(`/projects/${id}/fund`)
      if (data) {
        setFundData(data)
        setHasFund(true) // Ensure hasFund is set to true if fund data exists
      } else {
        setFundData(null)
      }
    } catch (err: any) {
      // If fund doesn't exist (404), that's OK - project might not have fund yet
      setFundData(null)
    } finally {
      setFundLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      loadProjectInfo()
      // Load transactions list first, then charts data
      load().then(() => {
        loadChartsData()
      })
    }
  }, [id])

  useEffect(() => {
    dispatch(fetchSuppliers())
  }, [dispatch])

  // Reload project info when project is updated (e.g., after editing in modal)
  useEffect(() => {
    const handleProjectUpdated = (event: CustomEvent) => {
      if (event.detail?.projectId && id && event.detail.projectId === parseInt(id)) {
        loadProjectInfo()
      }
    }

    window.addEventListener('projectUpdated', handleProjectUpdated as EventListener)
    return () => window.removeEventListener('projectUpdated', handleProjectUpdated as EventListener)
  }, [id])

  const handleDeleteBudget = async (budgetId: number) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את התקציב?')) {
      return
    }
    try {
      setBudgetDeleteLoading(budgetId)
      await BudgetAPI.deleteBudget(budgetId)
      await loadChartsData()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'שגיאה במחיקת התקציב')
    } finally {
      setBudgetDeleteLoading(null)
    }
  }

  const handleAddBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!id) return
    if (!newBudgetForm.amount || Number(newBudgetForm.amount) <= 0) {
      setBudgetFormError('יש להזין סכום חיובי')
      return
    }
    if (!newBudgetForm.start_date) {
      setBudgetFormError('יש לבחור תאריך התחלה')
      return
    }

    // Check if budget already exists for this category
    const existingBudget = projectBudgets.find(
      budget => budget.category === newBudgetForm.category
    )
    if (existingBudget) {
      setBudgetFormError(`כבר קיים תקציב לקטגוריה "${newBudgetForm.category}". ניתן לערוך את התקציב הקיים או למחוק אותו לפני יצירת תקציב חדש.`)
      return
    }

    try {
      setBudgetSaving(true)
      setBudgetFormError(null)
      await BudgetAPI.createBudget({
        project_id: parseInt(id),
        category: newBudgetForm.category,
        amount: Number(newBudgetForm.amount),
        period_type: newBudgetForm.period_type,
        start_date: newBudgetForm.start_date,
        end_date: newBudgetForm.period_type === 'Annual' ? (newBudgetForm.end_date || null) : null
      })
      await loadChartsData()
      setShowAddBudgetForm(false)
      setNewBudgetForm({
        category: 'ניקיון',
        amount: '',
        period_type: 'Annual',
        start_date: newBudgetForm.start_date,
        end_date: ''
      })
    } catch (err: any) {
      setBudgetFormError(err?.response?.data?.detail || 'שגיאה ביצירת התקציב')
    } finally {
      setBudgetSaving(false)
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
    // Exclude fund transactions from the list
    if (t.from_fund === true) {
      return false
    }
    
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
    } else {
      dateMatches = true // Show all if no date filter mode
    }
    
    // Category filter: if 'all', show all transactions
    // Otherwise, match by category (handle both Hebrew and English categories)
    let categoryMatches = true
    if (categoryFilter && categoryFilter !== 'all') {
      const txCategory = normalizeCategoryForFilter(t.category)
      const filterCategory = normalizeCategoryForFilter(categoryFilter)
      // Match if normalized categories are equal, or if original categories match
      const normalizedMatch: boolean = txCategory !== null && filterCategory !== null && txCategory === filterCategory
      const directMatch: boolean = !!(t.category && String(t.category).trim() === String(categoryFilter).trim())
      categoryMatches = normalizedMatch || directMatch
    }
    
    // Exceptional filter: if 'all', show all; if 'only', show only exceptional
    const exceptionalMatches = filterExceptional === 'all' || 
      (filterExceptional === 'only' && t.is_exceptional === true)
    
    // Type filter
    const typeMatches = filterType === 'all' || t.type === filterType
    
    const result = dateMatches && typeMatches && exceptionalMatches && categoryMatches
    
    return result
  })
  
  // Calculate how many transactions match category (regardless of date filter)
  const transactionsMatchingCategory = categoryFilter === 'all' 
    ? txs.length 
    : txs.filter(t => {
        const txCategory = normalizeCategoryForFilter(t.category)
        const filterCategory = normalizeCategoryForFilter(categoryFilter)
        return (txCategory !== null && filterCategory !== null && txCategory === filterCategory) ||
               (t.category && String(t.category).trim() === String(categoryFilter).trim())
      }).length



  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את העסקה?')) {
      return
    }
    
    try {
      await api.delete(`/transactions/${transactionId}`)
      await load() // Reload transactions list
      await loadChartsData()
      if (hasFund) {
        await loadFundData() // Reload fund data
      }
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'שגיאה במחיקת העסקה')
    }
  }

  // Calculate income and expense from project start_date until now
  // Only actual transactions are counted - budget is NOT included in income
  // This is separate from the filtered transactions which are used for the transactions list
  const calculateFinancialSummary = () => {
    const now = new Date()
    
    // Calculate start date: use project.start_date if available, otherwise use 1 year ago as fallback
    let calculationStartDate: Date
    if (projectStartDate) {
      calculationStartDate = new Date(projectStartDate)
    } else {
      // Fallback: use 1 year ago if no project start date
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      calculationStartDate = oneYearAgo
    }
    
    // Debug: Check all transactions
    console.log('🔍 DEBUG - All transactions:', {
      totalTxs: txs.length,
      incomeTxs: txs.filter(t => t.type === 'Income').length,
      expenseTxs: txs.filter(t => t.type === 'Expense').length,
      incomeTxsList: txs.filter(t => t.type === 'Income').map(t => ({ id: t.id, amount: t.amount, date: t.tx_date, from_fund: t.from_fund })),
      projectStartDate,
      calculationStartDate: calculationStartDate.toISOString()
    })
    
    // Filter transactions from calculationStartDate to now
    // Exclude fund transactions (from_fund == true) - only include regular transactions
    const summaryTransactions = txs.filter(t => {
      const txDate = new Date(t.tx_date)
      const isInDateRange = txDate >= calculationStartDate && txDate <= now
      const isNotFromFund = !(t.from_fund === true)  // Exclude fund transactions
      const passes = isInDateRange && isNotFromFund
      
      // Debug income transactions
      if (t.type === 'Income') {
        console.log('🔍 Income transaction:', {
          id: t.id,
          amount: t.amount,
          date: t.tx_date,
          txDate: txDate.toISOString(),
          calculationStartDate: calculationStartDate.toISOString(),
          isInDateRange,
          from_fund: t.from_fund,
          isNotFromFund,
          passes
        })
      }
      
      return passes
    })
    
    // Calculate actual transaction income and expense (excluding fund transactions)
    // Only actual transactions are counted - budget is NOT included
    const incomeTransactions = summaryTransactions.filter(t => t.type === 'Income')
    const expenseTransactions = summaryTransactions.filter(t => t.type === 'Expense')
    
    console.log('🔍 DEBUG - Filtered transactions:', {
      summaryTransactionsCount: summaryTransactions.length,
      incomeTransactionsCount: incomeTransactions.length,
      expenseTransactionsCount: expenseTransactions.length,
      incomeTransactions: incomeTransactions.map(t => ({ id: t.id, amount: t.amount }))
    })
    
    const monthlyIncome = Number(projectBudget?.budget_monthly || 0)
    const transactionIncome = monthlyIncome > 0
      ? 0
      : incomeTransactions.reduce((s, t) => s + Number(t.amount || 0), 0)
    const transactionExpense = expenseTransactions.reduce((s, t) => s + Number(t.amount || 0), 0)
    
    // Calculate income from project monthly budget (treated as expected monthly income)
    // Calculate only for the current year, from project start date (or start of year if project started earlier)
    
    console.log('🔍 DEBUG - Checking project income conditions:', {
      monthlyIncome,
      calculationStartDate: calculationStartDate?.toISOString(),
      hasMonthlyIncome: monthlyIncome > 0,
      hasStartDate: !!calculationStartDate,
      allConditionsMet: !!(monthlyIncome > 0 && calculationStartDate)
    })
    
    let projectIncome = 0
    if (monthlyIncome > 0 && calculationStartDate) {
      
      // Calculate start date for income calculation: use the later of project start date or start of current year
      const currentYearStart = new Date(now.getFullYear(), 0, 1) // January 1st of current year
      const incomeCalculationStart = calculationStartDate > currentYearStart ? calculationStartDate : currentYearStart
      projectIncome = calculateMonthlyIncomeAccrual(monthlyIncome, incomeCalculationStart, now)
      
      console.log('✅ DEBUG - Project income calculation (current year):', {
        monthlyIncome,
        calculationStartDate: calculationStartDate.toISOString(),
        currentYearStart: currentYearStart.toISOString(),
        incomeCalculationStart: incomeCalculationStart.toISOString(),
        monthlyOccurrences: monthlyIncome > 0 ? projectIncome / monthlyIncome : 0,
        projectIncome
      })
    } else {
      console.log('❌ DEBUG - Project income NOT calculated because:', {
        missingMonthlyIncome: !(monthlyIncome > 0),
        missingStartDate: !calculationStartDate
      })
    }
    
    // Total income = transaction income + project income (from monthly budget)
    const totalIncome = transactionIncome + projectIncome
    
    console.log('🔍 DEBUG - Final calculation:', {
      transactionIncome,
      projectIncome,
      totalIncome,
      transactionExpense
    })
    
    return {
      income: totalIncome,
      expense: transactionExpense
    }
  }
  
  // Use useMemo to recalculate only when txs, projectStartDate, or projectBudget change
  const financialSummary = useMemo(() => {
    console.log('🔄 useMemo triggered - recalculating financial summary', {
      txsCount: txs.length,
      projectStartDate,
      projectBudget
    })
    return calculateFinancialSummary()
  }, [txs, projectStartDate, projectBudget])
  
  const income = financialSummary.income
  const expense = financialSummary.expense
  
  console.log('💰 Final values displayed:', { income, expense, txsCount: txs.length })

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
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
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
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="text-gray-400 dark:text-gray-500">📅</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">תאריך התחלה:</span>
                  {formatDate(projectStartDate)}
                </span>
                <span className="hidden sm:block text-gray-300 dark:text-gray-600">|</span>
                <span className="flex items-center gap-1">
                  <span className="text-gray-400 dark:text-gray-500">🏁</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">תאריך סיום:</span>
                  {projectEndDate ? formatDate(projectEndDate) : 'לא הוגדר'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={() => setShowCreateTransactionModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            צור עסקה חדשה
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddBudgetForm(true)
              setBudgetFormError(null)
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            + הוסף תקציב
          </button>
                    <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            ← חזור לדשבורד
                    </button>
                      </div>
      </motion.div>

      {/* Financial Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
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

      {/* Fund and Transactions Section */}
      {(hasFund || fundData) && (
        <div className="max-w-6xl mx-auto w-full space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Fund Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  פרטי הקופה
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  מעקב אחר יתרת הקופה ועסקאות מהקופה
                </p>
              </div>
              {fundData && fundData.transactions && fundData.transactions.length > 0 && (
                <button
                  onClick={() => setShowFundTransactionsModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  עסקאות קופה ({fundData.transactions.length})
                </button>
              )}
            </div>

            {fundLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                טוען פרטי קופה...
              </div>
            ) : fundData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      יתרה נוכחית
                    </h3>
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {fundData.current_balance.toLocaleString('he-IL')} ₪
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    יתרה זמינה כעת
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-green-700 dark:text-green-300">
                      כמה היה מתחילה
                    </h3>
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {fundData.initial_total.toLocaleString('he-IL')} ₪
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    סכום כולל שנכנס לקופה
                  </p>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-red-700 dark:text-red-300">
                      כמה יצא
                    </h3>
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                    {fundData.total_deductions.toLocaleString('he-IL')} ₪
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    סה"כ סכום שירד מהקופה
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      סכום חודשי
                    </h3>
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    {fundData.monthly_amount.toLocaleString('he-IL')} ₪
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    מתווסף אוטומטית כל חודש
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                לא ניתן לטעון את פרטי הקופה
              </div>
            )}
          </motion.div>

          {/* Transactions List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                רשימת עסקאות
              </h2>
            </div>
            <div className="flex flex-col">
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        רשימת עסקאות
                      </h3>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3">
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
                        <div>
                          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span>קטגוריה:</span>
                            <select
                              className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={categoryFilter}
                              onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                              <option value="all">כל הקטגוריות</option>
                              {allCategoryOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </label>
                        </div>
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
                    <div className="text-center py-8 space-y-3">
                      <div className="text-gray-500 dark:text-gray-400 font-medium">אין עסקאות להצגה</div>
                      {txs.length > 0 && (
                        <div className="text-sm text-gray-400 dark:text-gray-500 space-y-2">
                          {categoryFilter !== 'all' && (
                            <>
                              <div>הסינון לפי קטגוריה "{categoryFilter}" לא מצא תוצאות</div>
                              {transactionsMatchingCategory > 0 && dateFilterMode === 'current_month' && (
                                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                  <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                                    נמצאו {transactionsMatchingCategory} עסקאות עם הקטגוריה "{categoryFilter}"
                                  </div>
                                  <div className="text-blue-700 dark:text-blue-300 text-xs mb-2">
                                    אבל הן לא בחודש הנוכחי. שנה את סינון התאריך לראות אותן.
                                  </div>
                                  <button
                                    onClick={() => setDateFilterMode('date_range')}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                  >
                                    הצג את כל העסקאות עם הקטגוריה הזו
                                  </button>
                                </div>
                              )}
                              {transactionsMatchingCategory === 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  אין עסקאות עם הקטגוריה "{categoryFilter}" במערכת
                                </div>
                              )}
                            </>
                          )}
                          {categoryFilter === 'all' && dateFilterMode === 'current_month' && (
                            <div className="mt-1">התצוגה מוגבלת לחודש הנוכחי - נסה לשנות את סינון התאריך לראות עסקאות מחודשים קודמים</div>
                          )}
                          <div className="mt-2 text-xs">
                            סך הכל {txs.length} עסקאות במערכת
                            {categoryFilter !== 'all' && transactionsMatchingCategory > 0 && (
                              <span> • {transactionsMatchingCategory} עם הקטגוריה "{categoryFilter}"</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div id="transactions-list" className="space-y-3 p-4 max-h-[600px] overflow-y-auto">
                      {filtered.map(tx => {
                        const expanded = transactionsExpandedId === tx.id
                        return (
                          <div key={tx.id} className="border border-gray-200 dark:border-gray-700 rounded-xl">
                            <button
                              className="w-full px-4 py-3 text-right flex items-center gap-4 justify-between"
                              onClick={() => setTransactionsExpandedId(expanded ? null : tx.id)}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tx.type === 'Income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {tx.type === 'Income' ? 'הכנסה' : 'הוצאה'}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-300">{tx.category ? (CATEGORY_LABELS[tx.category] || tx.category) : '-'}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-500 dark:text-gray-400">{new Date(tx.tx_date).toLocaleDateString('he-IL')}</span>
                                <span className={`text-lg font-semibold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(tx.amount)} ₪
                                </span>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                              </div>
                            </button>
                            {expanded && (
                              <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">אמצעי תשלום</div>
                                    <div>{tx.payment_method ? PAYMENT_METHOD_LABELS[tx.payment_method] || tx.payment_method : '-'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">ספק</div>
                                    <div>{tx.supplier?.name || '-'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">נוצר על ידי</div>
                                    <div>{tx.created_by_user?.full_name || '-'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">חריגה</div>
                                    <div>{tx.is_exceptional ? 'כן' : 'לא'}</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">תיאור</div>
                                    <div>{tx.description || 'ללא'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">הערות</div>
                                    <div>{tx.notes || 'ללא'}</div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                                  <button
                                    onClick={async () => {
                                      setSelectedTransactionForDocuments(tx)
                                      setShowDocumentsModal(true)
                                      setDocumentsLoading(true)
                                      try {
                                        const { data } = await api.get(`/transactions/${tx.id}/documents`)
                                        setTransactionDocuments(data || [])
                                      } catch (err) {
                                        setTransactionDocuments([])
                                      } finally {
                                        setDocumentsLoading(false)
                                      }
                                    }}
                                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    מסמכים
                                    {tx.documents_count > 0 && (
                                      <span className="bg-white/20 px-1 rounded text-xs">
                                        {tx.documents_count}
                                      </span>
                                    )}
                                  </button>
                                  <label className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    העלה מסמכים
                                    <input
                                      type="file"
                                      multiple
                                      className="hidden"
                                      onChange={async (e) => {
                                        const files = Array.from(e.target.files || [])
                                        if (files.length === 0) return

                                        let successCount = 0
                                        let errorCount = 0
                                        const uploadedDocs: Array<{id: number, fileName: string, description: string}> = []
                                        
                                        for (let i = 0; i < files.length; i++) {
                                          const file = files[i]
                                          try {
                                            const formData = new FormData()
                                            formData.append('file', file)
                                            const response = await api.post(`/transactions/${tx.id}/supplier-document`, formData, {
                                              headers: { 'Content-Type': 'multipart/form-data' }
                                            })
                                            if (response.data && response.data.id) {
                                              successCount++
                                              uploadedDocs.push({
                                                id: response.data.id,
                                                fileName: file.name,
                                                description: response.data.description || ''
                                              })
                                            }
                                          } catch (err: any) {
                                            errorCount++
                                          }
                                        }

                                        if (successCount > 0 && uploadedDocs.length > 0) {
                                          setUploadedDocuments(uploadedDocs)
                                          setSelectedTransactionForDocuments(tx)
                                          setShowDescriptionModal(true)

                                          await load()
                                          if (showDocumentsModal && selectedTransactionForDocuments?.id === tx.id) {
                                            const { data } = await api.get(`/transactions/${tx.id}/documents`)
                                            setTransactionDocuments(data || [])
                                          }
                                        } else if (successCount > 0) {
                                          await load()
                                          if (showDocumentsModal && selectedTransactionForDocuments?.id === tx.id) {
                                            const { data } = await api.get(`/transactions/${tx.id}/documents`)
                                            setTransactionDocuments(data || [])
                                          }
                                        }

                                        if (errorCount > 0) {
                                          if (successCount > 0) {
                                            alert(`הועלו ${successCount} מסמכים, ${errorCount} נכשלו`)
                                          } else {
                                            alert(`שגיאה בהעלאת המסמכים`)
                                          }
                                        }

                                        e.target.value = ''
                                      }}
                                    />
                                  </label>
                                  <button
                                    onClick={() => handleEditAnyTransaction(tx)}
                                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    ערוך
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                  >
                                    מחק
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Fund Transactions Modal */}
      {showFundTransactionsModal && fundData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowFundTransactionsModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  עסקאות מהקופה
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {fundData.transactions.length} עסקאות
                </p>
              </div>
              <button
                onClick={() => setShowFundTransactionsModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {fundData.transactions.length === 0 ? (
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    אין עסקאות מהקופה
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    עדיין לא בוצעו עסקאות מהקופה
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fundData.transactions
                    .filter(tx => fundCategoryFilter === 'all' || tx.category === fundCategoryFilter)
                    .map((tx) => (
                    <div key={tx.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {new Date(tx.tx_date).toLocaleDateString('he-IL', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {tx.category ? (CATEGORY_LABELS[tx.category] || tx.category) : 'קופה'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-red-600 dark:text-red-400">
                            -{tx.amount.toLocaleString('he-IL')} ₪
                          </span>
                        </div>
                      </div>
                      
                      {tx.description && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">תיאור: </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{tx.description}</span>
                        </div>
                      )}
                      
                      {tx.created_by_user && (
                        <div className="mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            בוצע על ידי: {tx.created_by_user.full_name}
                          </span>
                        </div>
                      )}
                      
                      {tx.notes && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">הערות: </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{tx.notes}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={async () => {
                            setSelectedTransactionForDocuments(tx)
                            setShowDocumentsModal(true)
                            setDocumentsLoading(true)
                            try {
                              const { data } = await api.get(`/transactions/${tx.id}/documents`)
                              setTransactionDocuments(data || [])
                            } catch (err) {
                              setTransactionDocuments([])
                            } finally {
                              setDocumentsLoading(false)
                            }
                          }}
                          className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          מסמכים
                          {tx.documents_count > 0 && (
                            <span className="bg-white/20 px-1 rounded text-xs">
                              {tx.documents_count}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleEditAnyTransaction(tx as Transaction)}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Budget Cards and Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 md:mb-0">
              תקציבים לקטגוריות ומגמות פיננסיות
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              מעקב אחר התקציבים וההוצאות בכל קטגוריה ומגמות פיננסיות
            </p>
          </div>
        </div>

        
        {chartsLoading ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-96 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="mt-6 h-96 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {projectBudgets && projectBudgets.length > 0 ? (
                <>
                  {projectBudgets.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      onDelete={() => handleDeleteBudget(budget.id)}
                      deleting={budgetDeleteLoading === budget.id}
                    />
                  ))}
                  <div className={
                    projectBudgets.length === 1 ? 'lg:col-span-3' :
                    projectBudgets.length === 2 ? 'lg:col-span-2' :
                    projectBudgets.length === 3 ? 'lg:col-span-1' :
                    'lg:col-span-4'
                  }>
                    <ProjectTrendsChart
                      projectId={parseInt(id || '0')}
                      projectName={projectName}
                      transactions={txs}
                      expenseCategories={expenseCategories}
                      compact={true}
                    />
                  </div>
                </>
              ) : (
                <div className="lg:col-span-4">
                  <ProjectTrendsChart
                    projectId={parseInt(id || '0')}
                    projectName={projectName}
                    transactions={txs}
                    expenseCategories={expenseCategories}
                    compact={true}
                  />
                  {!chartsLoading && (!projectBudgets || projectBudgets.length === 0) && (
                    <div className="mt-6 text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                      <p className="text-gray-500 dark:text-gray-400">
                        אין תקציבים לקטגוריות לפרויקט זה
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                        ניתן להוסיף תקציבים לקטגוריות בעת יצירה או עריכה של הפרויקט
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            {projectBudgets && projectBudgets.length > 0 && (
              <div className="mt-6">
                <BudgetProgressChart
                  budgets={projectBudgets}
                  projectName={projectName || `פרויקט #${id}`}
                />
              </div>
            )}
          </>
        )}
      </motion.div>


      {/* Legacy Transactions Block (disabled) */}
      {false && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              רשימת עסקאות
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
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
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>קטגוריה:</span>
                  <select
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">כל הקטגוריות</option>
                    {allCategoryOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
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
          <div className="text-center py-8 space-y-3">
            <div className="text-gray-500 dark:text-gray-400 font-medium">אין עסקאות להצגה</div>
            {txs.length > 0 && (
              <div className="text-sm text-gray-400 dark:text-gray-500 space-y-2">
                {categoryFilter !== 'all' && (
                  <>
                    <div>הסינון לפי קטגוריה "{categoryFilter}" לא מצא תוצאות</div>
                    {transactionsMatchingCategory > 0 && dateFilterMode === 'current_month' && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                          נמצאו {transactionsMatchingCategory} עסקאות עם הקטגוריה "{categoryFilter}"
                        </div>
                        <div className="text-blue-700 dark:text-blue-300 text-xs mb-2">
                          אבל הן לא בחודש הנוכחי. שנה את סינון התאריך לראות אותן.
                        </div>
                        <button
                          onClick={() => setDateFilterMode('date_range')}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          הצג את כל העסקאות עם הקטגוריה הזו
                        </button>
                      </div>
                    )}
                    {transactionsMatchingCategory === 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        אין עסקאות עם הקטגוריה "{categoryFilter}" במערכת
                      </div>
                    )}
                  </>
                )}
                {categoryFilter === 'all' && dateFilterMode === 'current_month' && (
                  <div className="mt-1">התצוגה מוגבלת לחודש הנוכחי - נסה לשנות את סינון התאריך לראות עסקאות מחודשים קודמים</div>
                )}
                <div className="mt-2 text-xs">
                  סך הכל {txs.length} עסקאות במערכת
                  {categoryFilter !== 'all' && transactionsMatchingCategory > 0 && (
                    <span> • {transactionsMatchingCategory} עם הקטגוריה "{categoryFilter}"</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 text-left">
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">סוג</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">תאריך</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">סכום</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">קטגוריה</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">אמצעי תשלום</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">ספק</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">נוצר על ידי</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">תיאור</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">הערות</th>
                  <th className="p-3 font-medium text-gray-700 dark:text-gray-300">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
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
                        {t.is_generated && (
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
                    <td className="p-3 text-gray-700 dark:text-gray-300">
                      {t.category ? (CATEGORY_LABELS[t.category] || t.category) : '-'}
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">
                      {t.payment_method ? (PAYMENT_METHOD_LABELS[t.payment_method] || t.payment_method) : '-'}
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">
                      {(() => {
                        const supplierId = t.supplier_id
                        if (!supplierId) {
                          return '-'
                        }
                        const supplier = suppliers.find(s => s.id === supplierId)
                        return supplier?.name ?? `[ספק ${supplierId}]`
                      })()}
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">
                      {t.created_by_user ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{t.created_by_user.full_name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{t.created_by_user.email}</span>
                        </div>
                      ) : t.is_generated ? (
                        <span className="text-gray-400 dark:text-gray-500">מערכת (מחזורי)</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">מערכת</span>
                      )}
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
      )}


      {/* Modals */}
      <CreateTransactionModal
        isOpen={showCreateTransactionModal}
        onClose={() => setShowCreateTransactionModal(false)}
        onSuccess={async () => {
          setShowCreateTransactionModal(false)
          await load() // Reload transactions list to get updated data with created_by_user
          await loadChartsData()
          if (hasFund) {
            await loadFundData() // Reload fund data
          }
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
          await load() // Reload transactions list to get updated data
          if (hasFund) {
            await loadFundData() // Reload fund data
          }
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
                      const apiUrl = import.meta.env.VITE_API_URL || ''
                      // @ts-ignore
                      const baseUrl = apiUrl ? apiUrl.replace('/api/v1', '') : ''
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
                  const apiUrl = import.meta.env.VITE_API_URL || ''
                  // @ts-ignore
                  const baseUrl = apiUrl ? apiUrl.replace('/api/v1', '') : ''
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

      {/* Create Budget Modal */}
      {showAddBudgetForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddBudgetForm(false)
            setBudgetFormError(null)
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                יצירת תקציב חדש
              </h2>
              <button
                onClick={() => {
                  setShowAddBudgetForm(false)
                  setBudgetFormError(null)
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
              <form
                onSubmit={handleAddBudget}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      קטגוריה *
                    </label>
                    <select
                      value={newBudgetForm.category}
                      onChange={(e) => setNewBudgetForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {expenseCategoryOptions
                        .filter(option => {
                          // Filter out categories that already have a budget
                          const hasBudget = projectBudgets.some(budget => budget.category === option)
                          return !hasBudget
                        })
                        .map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    {expenseCategoryOptions.filter(option => {
                      const hasBudget = projectBudgets.some(budget => budget.category === option)
                      return !hasBudget
                    }).length === 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        כל הקטגוריות כבר יש להן תקציב
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      סכום (₪) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newBudgetForm.amount}
                      onChange={(e) => setNewBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      סוג תקופה *
                    </label>
                    <select
                      value={newBudgetForm.period_type}
                      onChange={(e) => setNewBudgetForm(prev => ({ ...prev, period_type: e.target.value as 'Annual' | 'Monthly' }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="Annual">שנתי</option>
                      <option value="Monthly">חודשי</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      תאריך התחלה *
                    </label>
                    <input
                      type="date"
                      value={newBudgetForm.start_date}
                      onChange={(e) => setNewBudgetForm(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  {newBudgetForm.period_type === 'Annual' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        תאריך סיום (אופציונלי)
                      </label>
                      <input
                        type="date"
                        value={newBudgetForm.end_date}
                        onChange={(e) => setNewBudgetForm(prev => ({ ...prev, end_date: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                </div>

                {budgetFormError && (
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                    {budgetFormError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBudgetForm(false)
                      setBudgetFormError(null)
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    disabled={budgetSaving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {budgetSaving ? 'שומר...' : 'שמור תקציב'}
                  </button>
                </div>
              </form>
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
                          // Ignore errors
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