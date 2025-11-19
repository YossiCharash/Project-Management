import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign,
  Users,
  MapPin,
  Building,
  RefreshCw
} from 'lucide-react'
import { ProjectWithFinance } from '../types/api'
import { DashboardAPI } from '../lib/apiClient'
import api from '../lib/api'
import ProjectExpensePieChart from './charts/ProjectExpensePieChart'
import ProjectTrendsChart from './charts/ProjectTrendsChart'

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
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
  }
  // If it's in Hebrew, try to convert to English
  if (CATEGORY_REVERSE_MAP[trimmed]) {
    return CATEGORY_REVERSE_MAP[trimmed]
  }
  // Otherwise return as is (might be a custom category)
  return trimmed
}

interface DateRange {
  start: string
  end: string
}

interface FinancialSummary {
  totalIncome: number
  totalExpense: number
  netProfit: number
  profitMargin: number
  subprojectCount: number
  activeSubprojects: number
}

interface SubprojectFinancial {
  id: number
  name: string
  income: number
  expense: number
  profit: number
  profitMargin: number
  status: 'green' | 'yellow' | 'red'
}

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
  subproject_name?: string
}

interface ExpenseCategory {
  category: string
  amount: number
  color: string
}

// Simple Hebrew text constants
const HebrewText = {
  projects: {
    parentProject: 'פרויקט ראשי',
    subprojects: 'תת-פרויקטים',
    projectDetails: 'פרטי הפרויקט',
    projectDescription: 'תיאור הפרויקט',
    projectAddress: 'כתובת הפרויקט',
    monthlyBudget: 'תקציב חודשי',
    annualBudget: 'תקציב שנתי'
  },
  financial: {
    totalIncome: 'סה"כ הכנסות',
    totalExpense: 'סה"כ הוצאות',
    netProfit: 'רווח נטו',
    profitMargin: 'אחוז רווחיות',
    income: 'הכנסות',
    expense: 'הוצאות'
  },
  status: {
    active: 'פעיל',
    profitable: 'רווחי',
    balanced: 'מאוזן',
    lossMaking: 'הפסדי'
  },
  time: {
    dateRange: 'בחירת תקופת זמן',
    specificMonth: 'חודש ספציפי',
    specificYear: 'שנה ספציפית',
    customRange: 'טווח תאריכים',
    month: 'חודש',
    year: 'שנה',
    fromDate: 'מתאריך',
    toDate: 'עד תאריך'
  },
  actions: {
    refresh: 'רענן'
  },
  ui: {
    loading: 'טוען...',
    noData: 'לא נמצא'
  },
  property: {
    residents: 'דיירים',
    apartment: 'לדירה'
  },
  months: {
    january: 'ינואר',
    february: 'פברואר',
    march: 'מרץ',
    april: 'אפריל',
    may: 'מאי',
    june: 'יוני',
    july: 'יולי',
    august: 'אוגוסט',
    september: 'ספטמבר',
    october: 'אוקטובר',
    november: 'נובמבר',
    december: 'דצמבר'
  }
}

// Utility functions
const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('he-IL')} ₪`
}

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`
}

const getStatusText = (status: 'green' | 'yellow' | 'red'): string => {
  switch (status) {
    case 'green': return HebrewText.status.profitable
    case 'yellow': return HebrewText.status.balanced
    case 'red': return HebrewText.status.lossMaking
    default: return HebrewText.ui.noData
  }
}

const getStatusColorClass = (status: 'green' | 'yellow' | 'red'): string => {
  switch (status) {
    case 'green': return 'text-green-600 dark:text-green-400'
    case 'yellow': return 'text-yellow-600 dark:text-yellow-400'
    case 'red': return 'text-red-600 dark:text-red-400'
    default: return 'text-gray-600 dark:text-gray-400'
  }
}

const getStatusBgClass = (status: 'green' | 'yellow' | 'red'): string => {
  switch (status) {
    case 'green': return 'bg-green-50 dark:bg-green-900/20'
    case 'yellow': return 'bg-yellow-50 dark:bg-yellow-900/20'
    case 'red': return 'bg-red-50 dark:bg-red-900/20'
    default: return 'bg-gray-50 dark:bg-gray-700'
  }
}

const DateSelector: React.FC<{
  dateType: 'month' | 'year' | 'custom'
  onDateTypeChange: (type: 'month' | 'year' | 'custom') => void
  selectedMonth: string
  onMonthChange: (month: string) => void
  selectedYear: string
  onYearChange: (year: string) => void
  customRange: DateRange
  onCustomRangeChange: (range: DateRange) => void
}> = ({
  dateType,
  onDateTypeChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  customRange,
  onCustomRangeChange
}) => {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  const months = [
    { value: '01', label: HebrewText.months.january },
    { value: '02', label: HebrewText.months.february },
    { value: '03', label: HebrewText.months.march },
    { value: '04', label: HebrewText.months.april },
    { value: '05', label: HebrewText.months.may },
    { value: '06', label: HebrewText.months.june },
    { value: '07', label: HebrewText.months.july },
    { value: '08', label: HebrewText.months.august },
    { value: '09', label: HebrewText.months.september },
    { value: '10', label: HebrewText.months.october },
    { value: '11', label: HebrewText.months.november },
    { value: '12', label: HebrewText.months.december }
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{HebrewText.time.dateRange}</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {HebrewText.time.dateRange}
          </label>
          <select
            value={dateType}
            onChange={(e) => onDateTypeChange(e.target.value as 'month' | 'year' | 'custom')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="month">{HebrewText.time.specificMonth}</option>
            <option value="year">{HebrewText.time.specificYear}</option>
            <option value="custom">{HebrewText.time.customRange}</option>
          </select>
        </div>

        {dateType === 'month' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {HebrewText.time.month}
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {dateType === 'year' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {HebrewText.time.year}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {years.map(year => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {dateType === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {HebrewText.time.fromDate}
              </label>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => onCustomRangeChange({ ...customRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {HebrewText.time.toDate}
              </label>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => onCustomRangeChange({ ...customRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const SubprojectCard: React.FC<{
  subproject: SubprojectFinancial
  imageUrl: string | null
  onViewClick: () => void
}> = ({ subproject, imageUrl, onViewClick }) => {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:shadow-md transition-shadow duration-200">
      {imageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt={subproject.name}
            className="w-full h-40 object-cover"
          />
        </div>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {subproject.name}
          </h4>
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBgClass(subproject.status)} ${getStatusColorClass(subproject.status)}`}>
            {getStatusText(subproject.status)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">הכנסות</span>
          <span className="font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(subproject.income)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">הוצאות</span>
          <span className="font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(subproject.expense)}
          </span>
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">רווח נטו</span>
            <span className={`font-bold text-lg ${
              subproject.profit >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(subproject.profit)}
            </span>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">רווחיות</span>
            <span className={`text-sm font-medium ${
              subproject.profitMargin >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatPercentage(subproject.profitMargin)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">מזהה פרויקט</span>
          <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
            #{subproject.id}
          </span>
        </div>
        
        <button
          onClick={onViewClick}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <span>צפה בפרויקט</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const SubprojectCardsList: React.FC<{
  subprojects: SubprojectFinancial[]
  onNavigate: (path: string) => void
}> = ({ subprojects, onNavigate }) => {
  const [subprojectImages, setSubprojectImages] = useState<Record<number, string | null>>({})

  useEffect(() => {
    const loadImages = async () => {
      const images: Record<number, string | null> = {}
      for (const subproject of subprojects) {
        try {
          const { data } = await api.get(`/projects/${subproject.id}`)
          if (data.image_url) {
            const apiUrl = import.meta.env.VITE_API_URL || ''
            // @ts-ignore
            const baseUrl = apiUrl ? apiUrl.replace('/api/v1', '') : ''
            images[subproject.id] = `${baseUrl}/uploads/${data.image_url}`
          } else {
            images[subproject.id] = null
          }
        } catch (err) {
          // Error loading image
          images[subproject.id] = null
        }
      }
      setSubprojectImages(images)
    }
    if (subprojects.length > 0) {
      loadImages()
    }
  }, [subprojects])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {subprojects.map((subproject) => (
        <SubprojectCard
          key={subproject.id}
          subproject={subproject}
          imageUrl={subprojectImages[subproject.id] || null}
          onViewClick={() => onNavigate(`/projects/${subproject.id}`)}
        />
      ))}
    </div>
  )
}

const ConsolidatedFinancialSummary: React.FC<{
  summary: FinancialSummary
  subprojects: SubprojectFinancial[]
}> = ({ summary, subprojects }) => {
  return (
    <div className="space-y-6">
      {/* Main Financial Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">סיכום פיננסי מאוחד</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              {formatCurrency(summary.totalIncome)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{HebrewText.financial.totalIncome}</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
              {formatCurrency(summary.totalExpense)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{HebrewText.financial.totalExpense}</div>
          </div>
          
          <div className="text-center">
            <div className={`text-3xl font-bold mb-1 ${
              summary.netProfit >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {summary.netProfit >= 0 ? '+' : ''}{formatCurrency(summary.netProfit)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{HebrewText.financial.netProfit}</div>
          </div>
          
          <div className="text-center">
            <div className={`text-3xl font-bold mb-1 ${
              summary.profitMargin >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {summary.profitMargin >= 0 ? '+' : ''}{formatPercentage(summary.profitMargin)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{HebrewText.financial.profitMargin}</div>
          </div>
        </div>
      </div>

      {/* Subprojects Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            {HebrewText.projects.subprojects} ({summary.subprojectCount})
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {summary.activeSubprojects} {HebrewText.status.active}
          </div>
        </div>
        
        <div className="space-y-3">
          {subprojects.map((subproject) => (
            <div key={subproject.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">{subproject.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {HebrewText.financial.income}: {formatCurrency(subproject.income)} | {HebrewText.financial.expense}: {formatCurrency(subproject.expense)}
                </div>
              </div>
              
              <div className="text-right">
                <div className={`font-semibold ${getStatusColorClass(subproject.status)}`}>
                  {subproject.profit >= 0 ? '+' : ''}{formatCurrency(subproject.profit)}
                </div>
                <div className={`text-sm ${getStatusColorClass(subproject.status)}`}>
                  {subproject.profitMargin >= 0 ? '+' : ''}{formatPercentage(subproject.profitMargin)}
                </div>
              </div>
              
              <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${getStatusBgClass(subproject.status)} ${getStatusColorClass(subproject.status)}`}>
                {getStatusText(subproject.status)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


const ConsolidatedTransactionsTable: React.FC<{
  transactions: Transaction[]
  loading: boolean
  onFilterChange: (filters: {
    type: 'all' | 'Income' | 'Expense'
    month: string
    year: string
    category: string
    exceptional: 'all' | 'only' | 'none'
  }) => void
  filters: {
    type: 'all' | 'Income' | 'Expense'
    month: string
    year: string
    category: string
    exceptional: 'all' | 'only' | 'none'
  }
}> = ({ transactions, loading, onFilterChange, filters }) => {
  const filteredTransactions = transactions.filter(transaction => {
    const txDate = new Date(transaction.tx_date)
    const transactionMonth = (txDate.getMonth() + 1).toString().padStart(2, '0')
    const transactionYear = txDate.getFullYear().toString()
    
    const typeMatch = filters.type === 'all' || transaction.type === filters.type
    const monthMatch = !filters.month || transactionMonth === filters.month
    const yearMatch = !filters.year || transactionYear === filters.year
    
    // Category filter: exact match (consistent with ProjectDetail.tsx)
    // Handle both Hebrew and English categories
    let categoryMatch = true
    if (filters.category) {
      const txCategory = normalizeCategoryForFilter(transaction.category)
      const filterCategory = normalizeCategoryForFilter(filters.category)
      // Match if normalized categories are equal, or if original categories match
      const normalizedMatch: boolean = txCategory !== null && filterCategory !== null && txCategory === filterCategory
      const directMatch: boolean = !!(transaction.category && String(transaction.category).trim() === String(filters.category).trim())
      categoryMatch = normalizedMatch || directMatch
    }
    
    // Exceptional filter: handle null/undefined explicitly
    const exceptionalMatch = filters.exceptional === 'all' || 
      (filters.exceptional === 'only' && transaction.is_exceptional === true) ||
      (filters.exceptional === 'none' && transaction.is_exceptional !== true)
    
    return typeMatch && monthMatch && yearMatch && categoryMatch && exceptionalMatch
  })

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalExpense = filteredTransactions
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const categories = Array.from(new Set(transactions.map(t => t.category).filter(Boolean)))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          עסקאות מאוחדות ({filteredTransactions.length})
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          הכנסות: {formatCurrency(totalIncome)} | הוצאות: {formatCurrency(totalExpense)}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            סוג עסקה
          </label>
          <select
            value={filters.type}
            onChange={(e) => onFilterChange({ ...filters, type: e.target.value as 'all' | 'Income' | 'Expense' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">הכל</option>
            <option value="Income">הכנסות</option>
            <option value="Expense">הוצאות</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            חודש
          </label>
          <select
            value={filters.month}
            onChange={(e) => onFilterChange({ ...filters, month: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">כל החודשים</option>
            <option value="01">ינואר</option>
            <option value="02">פברואר</option>
            <option value="03">מרץ</option>
            <option value="04">אפריל</option>
            <option value="05">מאי</option>
            <option value="06">יוני</option>
            <option value="07">יולי</option>
            <option value="08">אוגוסט</option>
            <option value="09">ספטמבר</option>
            <option value="10">אוקטובר</option>
            <option value="11">נובמבר</option>
            <option value="12">דצמבר</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            שנה
          </label>
          <select
            value={filters.year}
            onChange={(e) => onFilterChange({ ...filters, year: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">כל השנים</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
            <option value="2021">2021</option>
            <option value="2020">2020</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            קטגוריה
          </label>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">כל הקטגוריות</option>
            {categories.map(category => (
              <option key={category} value={category || ''}>{category}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            עסקאות חריגות
          </label>
          <select
            value={filters.exceptional}
            onChange={(e) => onFilterChange({ ...filters, exceptional: e.target.value as 'all' | 'only' | 'none' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">הכל</option>
            <option value="only">רק חריגות</option>
            <option value="none">ללא חריגות</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          טוען עסקאות...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          לא נמצאו עסקאות המתאימות לסינון
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 text-left">
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">תת-פרויקט</th>
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">סוג</th>
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">תאריך</th>
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">סכום</th>
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">קטגוריה</th>
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">תיאור</th>
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">הערות</th>
                <th className="p-3 font-medium text-gray-700 dark:text-gray-300">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(transaction => (
                <tr key={transaction.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3 text-gray-900 dark:text-white font-medium">
                    {transaction.subproject_name || 'ללא תת-פרויקט'}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      transaction.type === 'Income' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                    }`}>
                      {transaction.type === 'Income' ? 'הכנסה' : 'הוצאה'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700 dark:text-gray-300">
                    {new Date(transaction.tx_date).toLocaleDateString('he-IL')}
                  </td>
                  <td className={`p-3 font-semibold ${
                    transaction.type === 'Income' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="p-3 text-gray-700 dark:text-gray-300">
                    {transaction.category || '-'}
                  </td>
                  <td className="p-3 text-gray-700 dark:text-gray-300">
                    {transaction.description || '-'}
                  </td>
                  <td className="p-3 text-gray-700 dark:text-gray-300">
                    {transaction.notes || '-'}
                  </td>
                  <td className="p-3">
                    {transaction.is_exceptional && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 rounded-full text-xs font-medium">
                        חריגה
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {filteredTransactions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
              <div className="text-green-600 dark:text-green-400 font-semibold mb-1">סה"כ הכנסות</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(totalIncome)}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
              <div className="text-red-600 dark:text-red-400 font-semibold mb-1">סה"כ הוצאות</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(totalExpense)}
              </div>
            </div>
            <div className={`p-4 rounded-lg text-center ${
              totalIncome - totalExpense < 0 
                ? 'bg-red-50 dark:bg-red-900/20' 
                : 'bg-green-50 dark:bg-green-900/20'
            }`}>
              <div className={`font-semibold mb-1 ${
                totalIncome - totalExpense < 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-green-600 dark:text-green-400'
              }`}>
                רווח נטו
              </div>
              <div className={`text-2xl font-bold ${
                totalIncome - totalExpense < 0 
                  ? 'text-red-700 dark:text-red-300' 
                  : 'text-green-700 dark:text-green-300'
              }`}>
                {formatCurrency(totalIncome - totalExpense)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ParentProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [parentProject, setParentProject] = useState<ProjectWithFinance | null>(null)
  const [subprojects, setSubprojects] = useState<SubprojectFinancial[]>([])
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [chartsLoading, setChartsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Transaction filters
  const [transactionFilters, setTransactionFilters] = useState({
    type: 'all' as 'all' | 'Income' | 'Expense',
    month: '',
    year: '',
    category: '',
    exceptional: 'all' as 'all' | 'only' | 'none'
  })
  
  // Date selector state
  const [dateType, setDateType] = useState<'month' | 'year' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() < 9 ? `0${new Date().getMonth() + 1}` : `${new Date().getMonth() + 1}`)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [customRange, setCustomRange] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (id) {
      loadParentProjectData()
    }
  }, [id])

  // Reload data when date filters change
  useEffect(() => {
    if (id && parentProject) {
      loadAdvancedFinancialSummary(parseInt(id))
      loadTransactions()
      loadChartsData()
    }
  }, [dateType, selectedMonth, selectedYear, customRange, id, parentProject])

  const loadParentProjectData = async () => {
    if (!id) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Load parent project info
      const dashboardData = await DashboardAPI.getDashboardSnapshot()
      const parent = dashboardData.projects.find(p => p.id === parseInt(id))
      
      if (!parent) {
        setError('פרויקט לא נמצא')
        return
      }
      
      setParentProject(parent)
      
      // Load all data using the new advanced API
      await loadAdvancedFinancialSummary(parseInt(id))
      
      // Load transactions
      await loadTransactions()
      
      // Load charts data
      await loadChartsData()
      
    } catch (err: any) {
      // Parent project data loading error
      setError(err.message || 'שגיאה בטעינת נתוני הפרויקט')
    } finally {
      setLoading(false)
    }
  }

  const loadAdvancedFinancialSummary = async (parentId: number) => {
    try {
      // Build date range parameters
      let startDate: string | undefined
      let endDate: string | undefined
      
      if (dateType === 'month') {
        const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1)
        const nextMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1)
        startDate = targetDate.toISOString().split('T')[0]
        endDate = nextMonth.toISOString().split('T')[0]
      } else if (dateType === 'year') {
        const targetYear = parseInt(selectedYear)
        startDate = `${targetYear}-01-01`
        endDate = `${targetYear}-12-31`
      } else if (dateType === 'custom') {
        startDate = customRange.start
        endDate = customRange.end
      }
      
      // Load advanced financial summary
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      
      // Loading financial summary
      
      const { data: financialSummary } = await api.get(`/projects/${parentId}/financial-summary?${params.toString()}`)
      
      // Financial summary loaded
      
      // Update state with advanced data
      if (financialSummary.financial_summary) {
        setFinancialSummary({
          totalIncome: financialSummary.financial_summary.total_income,
          totalExpense: financialSummary.financial_summary.total_expense,
          netProfit: financialSummary.financial_summary.net_profit,
          profitMargin: financialSummary.financial_summary.profit_margin,
          subprojectCount: financialSummary.financial_summary.subproject_count,
          activeSubprojects: financialSummary.financial_summary.active_subprojects
        })
      }
      
      // Update subprojects with advanced data
      if (financialSummary.subproject_financials) {
        const advancedSubprojects: SubprojectFinancial[] = financialSummary.subproject_financials.map((sp: any) => ({
          id: sp.id,
          name: sp.name,
          income: sp.income,
          expense: sp.expense,
          profit: sp.profit,
          profitMargin: sp.profit_margin,
          status: sp.status
        }))
        setSubprojects(advancedSubprojects)
      }
      
    } catch (err: any) {
      // Error loading advanced financial summary, fallback to basic loading
      try {
        await loadSubprojectsData(parentId)
      } catch (fallbackErr) {
        // Fallback loading also failed
      }
    }
  }

  const loadChartsData = async () => {
    if (!id) return
    
    setChartsLoading(true)
    try {
      // Load expense categories for pie chart
      const { data: transactions } = await api.get(`/transactions/project/${id}`)
      
      // Filter transactions by date range
      const filteredTransactions = filterTransactionsByDate(transactions || [])
      
      // Calculate expense categories
      const categoryMap: { [key: string]: number } = {}
      filteredTransactions.forEach((tx: any) => {
        if (tx.type === 'Expense') {
          const category = tx.category || 'ללא קטגוריה'
          categoryMap[category] = (categoryMap[category] || 0) + Number(tx.amount || 0)
        }
      })
      
      // Convert to array with colors
      const colors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
      ]
      
      const categories: ExpenseCategory[] = Object.entries(categoryMap).map(([category, amount], index) => ({
        category,
        amount,
        color: colors[index % colors.length]
      }))
      
      setExpenseCategories(categories)
      
    } catch (err: any) {
      // Error loading charts data
    } finally {
      setChartsLoading(false)
    }
  }

  const loadSubprojectsData = async (parentId: number) => {
    try {
      // Get all projects and filter subprojects
      const { data: allProjects } = await api.get('/projects')
      const subprojectList = allProjects.filter((p: any) => p.relation_project === parentId)
      
      const subprojectFinancials: SubprojectFinancial[] = []
      let totalIncome = 0
      let totalExpense = 0
      
      // Calculate financial data for parent project
      try {
        const { data: parentTransactions } = await api.get(`/transactions/project/${parentId}`)
        
        // Ensure we have transactions data
        const transactions = parentTransactions || []
        
        // Filter parent transactions by date range
        const filteredParentTransactions = filterTransactionsByDate(transactions)
        
        const parentIncome = filteredParentTransactions
          .filter((t: any) => t.type === 'Income')
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
        
        const parentExpense = filteredParentTransactions
          .filter((t: any) => t.type === 'Expense')
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
        
        const parentProfit = parentIncome - parentExpense
        const parentProfitMargin = parentIncome > 0 ? (parentProfit / parentIncome) * 100 : 0
        
        let parentStatus: 'green' | 'yellow' | 'red' = 'yellow'
        if (parentProfitMargin >= 10) parentStatus = 'green'
        else if (parentProfitMargin <= -10) parentStatus = 'red'
        
        // Add parent project as first item in subprojects list
        subprojectFinancials.push({
          id: parentId,
          name: `${parentProject?.name || 'פרויקט ראשי'} (ראשי)`,
          income: parentIncome,
          expense: parentExpense,
          profit: parentProfit,
          profitMargin: parentProfitMargin,
          status: parentStatus
        })
        
        totalIncome += parentIncome
        totalExpense += parentExpense
        
      } catch (err) {
        // Error loading parent project financial data
      }
      
      // Calculate financial data for each subproject
      for (const subproject of subprojectList) {
        try {
          // Get transactions for the subproject
          const { data: transactions } = await api.get(`/transactions/project/${subproject.id}`)
          
          // Ensure we have transactions data
          const transactionsData = transactions || []
          
          // Filter subproject transactions by date range
          const filteredTransactions = filterTransactionsByDate(transactionsData)
          
          const income = filteredTransactions
            .filter((t: any) => t.type === 'Income')
            .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
          
          const expense = filteredTransactions
            .filter((t: any) => t.type === 'Expense')
            .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
          
          const profit = income - expense
          const profitMargin = income > 0 ? (profit / income) * 100 : 0
          
          let status: 'green' | 'yellow' | 'red' = 'yellow'
          if (profitMargin >= 10) status = 'green'
          else if (profitMargin <= -10) status = 'red'
          
          subprojectFinancials.push({
            id: subproject.id,
            name: subproject.name,
            income,
            expense,
            profit,
            profitMargin,
            status
          })
          
          totalIncome += income
          totalExpense += expense
          
        } catch (err) {
          // Error loading financial data
        }
      }
      
      setSubprojects(subprojectFinancials)
      
      const netProfit = totalIncome - totalExpense
      const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0
      
      setFinancialSummary({
        totalIncome,
        totalExpense,
        netProfit,
        profitMargin,
        subprojectCount: subprojectList.length + 1, // +1 for parent project
        activeSubprojects: subprojectList.filter((p: any) => p.is_active !== false).length + 1 // +1 for parent project
      })
      
      // Show message if no financial data found
      if (subprojectFinancials.length === 0) {
        // No financial data found
      }
      
    } catch (err: any) {
      // Error loading subprojects financial data
      setError('שגיאה בטעינת נתונים פיננסיים של תת-פרויקטים')
    }
  }

  const loadTransactions = async () => {
    if (!id) return
    
    setTransactionsLoading(true)
    try {
      const allTransactions: Transaction[] = []
      
      // Load parent project transactions
      try {
        const { data: parentTransactions } = await api.get(`/transactions/project/${id}`)
        const parentProjectName = parentProject?.name || 'פרויקט ראשי'
        
        // Ensure we have transactions data
        const transactions = parentTransactions || []
        
        // Filter transactions by date range
        const filteredParentTransactions = filterTransactionsByDate(transactions)
        
        filteredParentTransactions.forEach((transaction: any) => {
          allTransactions.push({
            ...transaction,
            subproject_name: parentProjectName,
            subproject_id: null
          })
        })
      } catch (err) {
        // Error loading parent project transactions
      }
      
      // Load subprojects transactions
      try {
        const { data: allProjects } = await api.get('/projects')
        const subprojectList = allProjects.filter((p: any) => p.relation_project === parseInt(id))
        
        for (const subproject of subprojectList) {
          try {
            const { data: subprojectTransactions } = await api.get(`/transactions/project/${subproject.id}`)
            
            // Ensure we have transactions data
            const transactions = subprojectTransactions || []
            
            // Filter transactions by date range
            const filteredSubprojectTransactions = filterTransactionsByDate(transactions)
            
            filteredSubprojectTransactions.forEach((transaction: any) => {
              allTransactions.push({
                ...transaction,
                subproject_name: subproject.name,
                subproject_id: subproject.id
              })
            })
          } catch (err) {
            // Error loading transactions
          }
        }
      } catch (err) {
        // Error loading subprojects
      }
      
      // Sort transactions by date (newest first)
      allTransactions.sort((a, b) => new Date(b.tx_date).getTime() - new Date(a.tx_date).getTime())
      
      setTransactions(allTransactions)
      
      // Show message if no transactions found
      if (allTransactions.length === 0) {
        // No transactions found
      }
    } catch (err: any) {
      // Error loading transactions
      setError('שגיאה בטעינת הטרנזקציות')
    } finally {
      setTransactionsLoading(false)
    }
  }

  const filterTransactionsByDate = (transactions: any[]) => {
    return transactions.filter((transaction: any) => {
      const txDate = new Date(transaction.tx_date)
      
      if (dateType === 'month') {
        const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1)
        const nextMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1)
        return txDate >= targetDate && txDate < nextMonth
      } else if (dateType === 'year') {
        const targetYear = parseInt(selectedYear)
        return txDate.getFullYear() === targetYear
      } else if (dateType === 'custom') {
        const startDate = new Date(customRange.start)
        const endDate = new Date(customRange.end)
        return txDate >= startDate && txDate <= endDate
      }
      
      return true
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{HebrewText.ui.loading} {HebrewText.projects.parentProject}...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="bg-gray-900 text-white px-4 py-2 rounded"
        >
          חזור לפרויקטים
        </button>
      </div>
    )
  }

  if (!parentProject) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded">
          {HebrewText.projects.parentProject} {HebrewText.ui.noData}
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="bg-gray-900 text-white px-4 py-2 rounded"
        >
          חזור לפרויקטים
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {parentProject.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {HebrewText.projects.parentProject} - {HebrewText.projects.subprojects}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadParentProjectData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {HebrewText.actions.refresh}
          </button>
        </div>
      </motion.div>

      {/* Parent Project Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{HebrewText.projects.projectDetails}</h2>
        
        {parentProject.image_url && (
          <div className="mb-6 rounded-lg overflow-hidden">
            {(() => {
              const rawUrl = parentProject.image_url
              // If backend already returned full URL (S3 / CloudFront), use as-is
              if (rawUrl.startsWith('http')) {
                return (
                  <img
                    src={rawUrl}
                    alt={parentProject.name}
                    className="w-full h-64 object-cover"
                  />
                )
              }
              const apiUrl = import.meta.env.VITE_API_URL || ''
              // @ts-ignore
              const baseUrl = apiUrl ? apiUrl.replace('/api/v1', '') : ''
              const imageUrl = `${baseUrl}/uploads/${rawUrl}`
              return (
                <img
                  src={imageUrl}
                  alt={parentProject.name}
                  className="w-full h-64 object-cover"
                />
              )
            })()}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {parentProject.description && (
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{HebrewText.projects.projectDescription}</div>
              <div className="text-gray-900 dark:text-white">{parentProject.description}</div>
            </div>
          )}
          
          {parentProject.address && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{HebrewText.projects.projectAddress}</div>
                <div className="text-gray-900 dark:text-white">{parentProject.address}</div>
                {parentProject.city && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">{parentProject.city}</div>
                )}
              </div>
            </div>
          )}
          
          {parentProject.num_residents && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{HebrewText.property.residents}</div>
                <div className="text-gray-900 dark:text-white">{parentProject.num_residents}</div>
              </div>
            </div>
          )}
          
          {parentProject.monthly_price_per_apartment && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{HebrewText.projects.monthlyBudget} {HebrewText.property.apartment}</div>
                <div className="text-gray-900 dark:text-white">{parentProject.monthly_price_per_apartment.toFixed(0)} ₪</div>
              </div>
            </div>
          )}
          
          {parentProject.budget_monthly > 0 && (
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{HebrewText.projects.monthlyBudget}</div>
                <div className="text-gray-900 dark:text-white">{parentProject.budget_monthly.toFixed(0)} ₪</div>
              </div>
            </div>
          )}
          
          {parentProject.budget_annual > 0 && (
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{HebrewText.projects.annualBudget}</div>
                <div className="text-gray-900 dark:text-white">{parentProject.budget_annual.toFixed(0)} ₪</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Date Selector */}
      <DateSelector
        dateType={dateType}
        onDateTypeChange={setDateType}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {/* Subprojects Cards */}
      {subprojects.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              תת-פרויקטים ({subprojects.length})
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              סה"כ פרויקטים: {subprojects.length}
            </div>
          </div>

          <SubprojectCardsList subprojects={subprojects} onNavigate={navigate} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              אין תת-פרויקטים
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              לפרויקט זה אין תת-פרויקטים קשורים
            </p>
            <button
              onClick={() => navigate('/projects')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              צפה בכל הפרויקטים
            </button>
          </div>
        </div>
      )}

      {/* Consolidated Financial Summary */}
      {financialSummary && (
        <ConsolidatedFinancialSummary
          summary={financialSummary}
          subprojects={subprojects}
        />
      )}

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
              projectName={parentProject?.name || 'פרויקט ראשי'}
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
              projectName={parentProject?.name || 'פרויקט ראשי'}
              transactions={transactions}
            />
          )}
        </motion.div>
      </div>

      {/* Consolidated Transactions Table */}
      <ConsolidatedTransactionsTable
        transactions={transactions}
        loading={transactionsLoading}
        onFilterChange={setTransactionFilters}
        filters={transactionFilters}
      />
    </div>
  )
}
