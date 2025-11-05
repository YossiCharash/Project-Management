import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Calendar, Filter } from 'lucide-react'

interface ProjectTrendsChartProps {
  projectId: number
  projectName: string
  transactions: Array<{
    tx_date: string
    type: 'Income' | 'Expense'
    amount: number
    category?: string | null
  }>
  expenseCategories?: Array<{
    category: string
    amount: number
    color: string
  }>
  compact?: boolean
}

interface ChartDataPoint {
  date: string
  income: number
  expense: number
  net: number
}

type FilterType = 'month' | 'year' | 'custom'
type ChartType = 'line' | 'bar' | 'pie'

export default function ProjectTrendsChart({ 
  projectId, 
  projectName, 
  transactions,
  expenseCategories = [],
  compact = false
}: ProjectTrendsChartProps) {
  const [filterType, setFilterType] = useState<FilterType>('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [chartType, setChartType] = useState<ChartType>('line')
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [filteredExpenseCategories, setFilteredExpenseCategories] = useState<Array<{
    category: string
    amount: number
    color: string
  }>>([])

  useEffect(() => {
    processData()
    processExpenseCategories()
  }, [filterType, selectedMonth, selectedYear, customStartDate, customEndDate, transactions, expenseCategories])

  const processData = () => {
    let filteredTransactions = [...transactions]
    const now = new Date()

    switch (filterType) {
      case 'month':
        const monthStart = new Date(selectedMonth + '-01')
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
        filteredTransactions = transactions.filter(tx => {
          const txDate = new Date(tx.tx_date)
          return txDate >= monthStart && txDate <= monthEnd
        })
        break
      case 'year':
        const yearStart = new Date(parseInt(selectedYear), 0, 1)
        const yearEnd = new Date(parseInt(selectedYear), 11, 31)
        filteredTransactions = transactions.filter(tx => {
          const txDate = new Date(tx.tx_date)
          return txDate >= yearStart && txDate <= yearEnd
        })
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate)
          const endDate = new Date(customEndDate)
          filteredTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.tx_date)
            return txDate >= startDate && txDate <= endDate
          })
        }
        break
    }

    // Group by date and calculate totals
    const groupedData: { [key: string]: { income: number; expense: number } } = {}
    
    filteredTransactions.forEach(tx => {
      const date = tx.tx_date
      if (!groupedData[date]) {
        groupedData[date] = { income: 0, expense: 0 }
      }
      
      if (tx.type === 'Income') {
        groupedData[date].income += Math.abs(tx.amount)
      } else {
        groupedData[date].expense += Math.abs(tx.amount)
      }
    })

    // Convert to array and sort by date
    const dataArray = Object.entries(groupedData)
      .map(([date, values]) => ({
        date,
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    setChartData(dataArray)
  }

  const processExpenseCategories = () => {
    // Filter transactions by date
    let filteredTransactions = [...transactions]

    switch (filterType) {
      case 'month':
        const monthStart = new Date(selectedMonth + '-01')
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
        filteredTransactions = transactions.filter(tx => {
          const txDate = new Date(tx.tx_date)
          return txDate >= monthStart && txDate <= monthEnd
        })
        break
      case 'year':
        const yearStart = new Date(parseInt(selectedYear), 0, 1)
        const yearEnd = new Date(parseInt(selectedYear), 11, 31)
        filteredTransactions = transactions.filter(tx => {
          const txDate = new Date(tx.tx_date)
          return txDate >= yearStart && txDate <= yearEnd
        })
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate)
          const endDate = new Date(customEndDate)
          filteredTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.tx_date)
            return txDate >= startDate && txDate <= endDate
          })
        }
        break
    }

    // Group expenses by category
    const categoryTotals: { [key: string]: { amount: number; color: string } } = {}
    
    filteredTransactions
      .filter(tx => tx.type === 'Expense')
      .forEach(tx => {
        const category = tx.category || 'אחר'
        if (!categoryTotals[category]) {
          // Find color from original expenseCategories or use default
          const originalCategory = expenseCategories.find(cat => cat.category === category)
          categoryTotals[category] = {
            amount: 0,
            color: originalCategory?.color || '#8884d8'
          }
        }
        categoryTotals[category].amount += Math.abs(tx.amount)
      })

    // Convert to array and sort by amount
    const categoriesArray = Object.entries(categoryTotals)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        color: data.color
      }))
      .sort((a, b) => b.amount - a.amount)

    setFilteredExpenseCategories(categoriesArray)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">
            {new Date(label).toLocaleDateString('he-IL')}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()} ₪
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const getCurrentMonth = () => {
    const now = new Date()
    return now.toISOString().slice(0, 7)
  }

  const getCurrentYear = () => {
    return new Date().getFullYear().toString()
  }

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
          {chartType === 'pie' ? `פילוח הוצאות - ${projectName}` : `מגמות פיננסיות - ${projectName}`}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          {chartType === 'pie' ? 'הוצאות לפי קטגוריות' : 'הכנסות והוצאות לאורך זמן'}
        </p>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-center">
            {/* Filter Type Selection */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">לפי חודש</option>
                <option value="year">לפי שנה</option>
                <option value="custom">טווח תאריכים</option>
              </select>
            </div>

            {/* Month Filter */}
            {filterType === 'month' && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Year Filter */}
            {filterType === 'year' && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Date Range */}
            {filterType === 'custom' && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  placeholder="תאריך התחלה"
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500">עד</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  placeholder="תאריך סיום"
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
      </div>

      {/* Chart Type Selection - Always visible */}
      <div className="mb-6 flex justify-center">
        <div className="flex items-center gap-2">
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="line">גרף קו</option>
            <option value="bar">גרף עמודות</option>
            <option value="pie">גרף עוגה</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className={compact ? "h-64" : "h-96"}>
        {chartType === 'pie' ? (
          filteredExpenseCategories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredExpenseCategories}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={compact ? 80 : 120}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {filteredExpenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0]
                        const total = filteredExpenseCategories.reduce((sum, cat) => sum + cat.amount, 0)
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {data.name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {data.value?.toLocaleString()} ₪
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {total > 0 ? ((Number(data.value) / total) * 100).toFixed(1) : 0}%
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    content={({ payload }) => (
                      <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {payload?.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center gap-1">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
              {!compact && (
                <div className="mt-4 text-center">
                  <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                    סה״כ הוצאות: {filteredExpenseCategories.reduce((sum, cat) => sum + cat.amount, 0).toLocaleString()} ₪
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <div className="text-lg mb-2">אין הוצאות להצגה</div>
                <div className="text-sm">לא נרשמו הוצאות עבור פרויקט זה בתקופה שנבחרה</div>
              </div>
            </div>
          )
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="הכנסות"
                />
                <Line 
                  type="monotone" 
                  dataKey="expense" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  name="הוצאות"
                />
                <Line 
                  type="monotone" 
                  dataKey="net" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="רווח נטו"
                />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="income" fill="#10B981" name="הכנסות" />
                <Bar dataKey="expense" fill="#EF4444" name="הוצאות" />
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="text-lg mb-2">אין נתונים להצגה</div>
              <div className="text-sm">לא נמצאו עסקאות בטווח הזמן שנבחר</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
