import { useEffect, useState } from 'react'
import api from '../lib/api'
import IncomeExpensePie from '../components/charts/IncomeExpensePie'
import { FileText, Archive, Download, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { CategoryAPI, SupplierAPI } from '../lib/apiClient'

interface Report { 
    income: number; 
    expenses: number; 
    profit: number; 
    budget_monthly: number; 
    budget_annual: number;
    has_budget: boolean;
    has_fund: boolean;
}
interface Project { id: number; name: string; start_date?: string | null; end_date?: string | null }
interface Category { id: number; name: string }
interface Supplier { id: number; name: string }

export default function Reports() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Options State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeBudgets, setIncludeBudgets] = useState(true)
  const [includeFunds, setIncludeFunds] = useState(false)
  const [includeTransactions, setIncludeTransactions] = useState(true)
  const [onlyRecurring, setOnlyRecurring] = useState(false)
  const [txType, setTxType] = useState<string[]>([]) // empty = all
  
  // New Filters
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([])
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // ZIP Options
  const [includeContract, setIncludeContract] = useState(false)
  const [includeImage, setIncludeImage] = useState(false)
  const [showZipOptions, setShowZipOptions] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
        try {
            const { data } = await api.get('/reports/dashboard-snapshot')
            if (data.projects) {
                setProjects(data.projects)
                if (data.projects.length > 0) {
                    setProjectId(String(data.projects[0].id))
                }
            }
        } catch (e) {
            console.error(e)
        }
    }
    fetchProjects()
    
    // Fetch Categories and Suppliers
    CategoryAPI.getCategories().then(setCategories).catch(console.error)
    SupplierAPI.getSuppliers().then(setSuppliers).catch(console.error)
  }, [])

  // Update default dates when project changes
  useEffect(() => {
    if (!projectId) return
    
    const selectedProject = projects.find(p => String(p.id) === projectId)
    if (selectedProject) {
      // Set default dates from project start_date and end_date
      if (selectedProject.start_date) {
        // Handle both ISO string format (with time) and date-only format
        const dateStr = selectedProject.start_date.split('T')[0]
        setStartDate(dateStr)
      } else {
        setStartDate('')
      }
      
      if (selectedProject.end_date) {
        // Handle both ISO string format (with time) and date-only format
        const dateStr = selectedProject.end_date.split('T')[0]
        setEndDate(dateStr)
      } else {
        setEndDate('')
      }
    }
  }, [projectId, projects])

  useEffect(() => {
    if (!projectId) return
    const run = async () => {
      setLoading(true)
      try {
          const { data } = await api.get(`/reports/project/${projectId}`)
          setData(data)
          // Update checkbox defaults based on availability
          setIncludeBudgets(!!data.has_budget)
          setIncludeFunds(!!data.has_fund)
      } catch (e) {
          console.error(e)
      } finally {
          setLoading(false)
      }
    }
    run()
  }, [projectId])

  const handleDownload = async (format: 'pdf' | 'excel' | 'zip') => {
      if (!projectId) return
      
      // If ZIP, show options first if not already confirmed or if user didn't see them
      if (format === 'zip' && !showZipOptions) {
          setShowZipOptions(true)
          return
      }

      setGenerating(true)
      
      const payload = {
          project_id: Number(projectId),
          start_date: startDate || null,
          end_date: endDate || null,
          include_summary: includeSummary,
          include_budgets: includeBudgets,
          include_funds: includeFunds,
          include_transactions: includeTransactions,
          transaction_types: txType.length > 0 ? txType : ["Income", "Expense"],
          only_recurring: onlyRecurring,
          categories: selectedCategories.length > 0 ? selectedCategories : null,
          suppliers: selectedSuppliers.length > 0 ? selectedSuppliers : null,
          include_project_contract: format === 'zip' ? includeContract : false,
          include_project_image: format === 'zip' ? includeImage : false,
          format: format
      }

      try {
        const response = await api.post('/reports/project/custom-report', payload, { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        
        // Try to get filename from header
        let filename = `report_project_${projectId}.${format === 'excel' ? 'xlsx' : format}`;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/) || contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1]);
            }
        }
        
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        // Reset zip options visibility after download
        if (format === 'zip') setShowZipOptions(false)
      } catch (e) {
          console.error("Export failed", e)
          alert("שגיאה בהפקת הדוח")
      } finally {
          setGenerating(false)
      }
  }

  const toggleTxType = (type: string) => {
      if (txType.includes(type)) {
          setTxType(txType.filter(t => t !== type))
      } else {
          setTxType([...txType, type])
      }
  }

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">דוחות וייצוא נתונים</h1>
      
      {/* Project Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">בחר פרויקט</label>
          <select 
            className="w-full md:w-64 border border-gray-300 dark:border-gray-600 p-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
            value={projectId} 
            onChange={e => setProjectId(e.target.value)}
          >
              {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
          {/* Quick Stats */}
          {data && !loading && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">סקירה כללית (מצטבר)</h2>
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="w-48 h-48">
                        <IncomeExpensePie income={data.income} expenses={data.expenses} />
                    </div>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 flex-1">
                        <li className="flex justify-between">
                            <span>הכנסות:</span> 
                            <span className="font-bold text-green-600 dark:text-green-400">{data.income.toFixed(2)} ₪</span>
                        </li>
                        <li className="flex justify-between">
                            <span>הוצאות:</span> 
                            <span className="font-bold text-red-600 dark:text-red-400">{data.expenses.toFixed(2)} ₪</span>
                        </li>
                        <li className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                            <span>רווח:</span> 
                            <span className={`font-bold ${data.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {data.profit.toFixed(2)} ₪
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
          )}

          {/* Report Settings */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  הגדרות דוח
              </h2>
              
              <div className="space-y-4">
                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">מתאריך</label>
                          <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded p-1.5 dark:bg-gray-700 dark:text-white" value={startDate} onChange={e => setStartDate(e.target.value)} />
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">עד תאריך</label>
                          <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded p-1.5 dark:bg-gray-700 dark:text-white" value={endDate} onChange={e => setEndDate(e.target.value)} />
                      </div>
                  </div>

                  <hr className="dark:border-gray-700" />

                  {/* Components */}
                  <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">רכיבי הדוח</label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer dark:text-gray-300">
                              <input type="checkbox" checked={includeSummary} onChange={e => setIncludeSummary(e.target.checked)} className="rounded text-blue-600" />
                              סיכום פיננסי
                          </label>
                          <label className={`flex items-center gap-2 cursor-pointer dark:text-gray-300 ${!data?.has_budget ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <input 
                                type="checkbox" 
                                checked={includeBudgets} 
                                onChange={e => setIncludeBudgets(e.target.checked)} 
                                className="rounded text-blue-600" 
                                disabled={!data?.has_budget}
                              />
                              פירוט תקציבים {!data?.has_budget && '(אין תקציב)'}
                          </label>
                          <label className={`flex items-center gap-2 cursor-pointer dark:text-gray-300 ${!data?.has_fund ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <input 
                                type="checkbox" 
                                checked={includeFunds} 
                                onChange={e => setIncludeFunds(e.target.checked)} 
                                className="rounded text-blue-600" 
                                disabled={!data?.has_fund}
                              />
                              מצב קופה (Funds) {!data?.has_fund && '(אין קופה)'}
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer dark:text-gray-300">
                              <input type="checkbox" checked={includeTransactions} onChange={e => setIncludeTransactions(e.target.checked)} className="rounded text-blue-600" />
                              רשימת עסקאות
                          </label>
                      </div>
                  </div>

                  {/* Transactions Filters (Conditional) */}
                  {includeTransactions && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-sm transition-all">
                        <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                            <label className="block text-xs font-medium text-gray-500 cursor-pointer">סינון עסקאות מתקדם</label>
                            {showAdvancedFilters ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                        
                        {showAdvancedFilters && (
                            <div className="space-y-3 pt-2 border-t dark:border-gray-600">
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1 cursor-pointer dark:text-gray-300">
                                        <input type="checkbox" checked={txType.length === 0 || (txType.includes('Income') && txType.includes('Expense'))} 
                                            onChange={() => setTxType([])}
                                            className="rounded text-blue-600" />
                                        הכל
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer dark:text-gray-300">
                                        <input type="checkbox" checked={txType.includes('Income') && !txType.includes('Expense')} 
                                            onChange={() => setTxType(['Income'])}
                                            className="rounded text-blue-600" />
                                        רק הכנסות
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer dark:text-gray-300">
                                        <input type="checkbox" checked={txType.includes('Expense') && !txType.includes('Income')} 
                                            onChange={() => setTxType(['Expense'])}
                                            className="rounded text-blue-600" />
                                        רק הוצאות
                                    </label>
                                </div>
                                
                                <label className="flex items-center gap-2 cursor-pointer dark:text-gray-300">
                                    <input type="checkbox" checked={onlyRecurring} onChange={e => setOnlyRecurring(e.target.checked)} className="rounded text-blue-600" />
                                    רק עסקאות מחזוריות (קבועות)
                                </label>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">קטגוריות</label>
                                    <select 
                                        multiple 
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded p-1.5 dark:bg-gray-700 dark:text-white h-24 text-xs"
                                        value={selectedCategories}
                                        onChange={e => {
                                            const options = Array.from(e.target.selectedOptions, option => option.value);
                                            setSelectedCategories(options);
                                        }}
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <div className="text-[10px] text-gray-400 mt-1">לחץ Ctrl לבחירה מרובה</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">ספקים</label>
                                    <select 
                                        multiple 
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded p-1.5 dark:bg-gray-700 dark:text-white h-24 text-xs"
                                        value={selectedSuppliers.map(String)}
                                        onChange={e => {
                                            const options = Array.from(e.target.selectedOptions, option => Number(option.value));
                                            setSelectedSuppliers(options);
                                        }}
                                    >
                                        {suppliers.map(sup => (
                                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                                        ))}
                                    </select>
                                    <div className="text-[10px] text-gray-400 mt-1">לחץ Ctrl לבחירה מרובה</div>
                                </div>
                            </div>
                        )}
                    </div>
                  )}

                  {/* ZIP Options */}
                  {showZipOptions && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                          <h3 className="text-sm font-semibold mb-2 text-blue-800 dark:text-blue-300">אפשרויות הורדת ZIP</h3>
                          <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer dark:text-gray-300">
                                  <input type="checkbox" checked={includeContract} onChange={e => setIncludeContract(e.target.checked)} className="rounded text-blue-600" />
                                  כלול את חוזה הפרויקט
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer dark:text-gray-300">
                                  <input type="checkbox" checked={includeImage} onChange={e => setIncludeImage(e.target.checked)} className="rounded text-blue-600" />
                                  כלול תמונת פרויקט
                              </label>
                          </div>
                          <button 
                            onClick={() => handleDownload('zip')}
                            disabled={generating}
                            className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                          >
                              {generating ? 'מכין קובץ...' : 'אשר והורד'}
                          </button>
                      </div>
                  )}

                  {!showZipOptions && (
                    <div className="pt-4 flex gap-3">
                        <button 
                            onClick={() => handleDownload('pdf')}
                            disabled={generating}
                            className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </button>
                        <button 
                            onClick={() => handleDownload('excel')}
                            disabled={generating}
                            className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            Excel
                        </button>
                        <button 
                            onClick={() => setShowZipOptions(true)}
                            disabled={generating}
                            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Archive className="w-4 h-4" />
                            ZIP (עם מסמכים)
                        </button>
                    </div>
                  )}
                  
                  {generating && !showZipOptions && <p className="text-center text-xs text-gray-500 animate-pulse">מפיק דוח... נא להמתין</p>}
              </div>
          </div>
      </div>
    </div>
  )
}
