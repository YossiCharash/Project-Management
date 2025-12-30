import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { BudgetWithSpending } from '../../types/api'

interface BudgetProgressChartProps {
  budgets: BudgetWithSpending[]
  projectName: string
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
        <p className="font-semibold text-gray-900 dark:text-white mb-2">{data.category}</p>
      <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 dark:text-gray-400">תקציב:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{Number(data.budget ?? 0).toLocaleString()} ₪</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 dark:text-gray-400">הוצא:</span>
            <span className={`font-semibold ${data.spent > data.budget ? 'text-red-600' : 'text-blue-600'}`}>
              {Number(data.spent ?? 0).toLocaleString()} ₪
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 dark:text-gray-400">נותר:</span>
            <span className={`font-semibold ${data.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {Number(data.remaining ?? 0).toLocaleString()} ₪
            </span>
          </div>
          <div className="flex justify-between gap-4 border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <span className="text-gray-600 dark:text-gray-400">אחוז הוצא:</span>
            <span className={`font-bold ${data.spentPercent > 100 ? 'text-red-600' : data.spentPercent > 80 ? 'text-orange-600' : 'text-green-600'}`}>
              {data.spentPercent.toFixed(1)}%
            </span>
          </div>
          {data.expectedPercent && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">אחוז צפוי:</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{data.expectedPercent.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

export default function BudgetProgressChart({ budgets, projectName }: BudgetProgressChartProps) {
  if (!budgets || budgets.length === 0) {
    return (
      <div className="w-full h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-lg mb-2">אין תקציבים להצגה</div>
          <div className="text-sm">לא הוגדרו תקציבים לקטגוריות עבור פרויקט זה</div>
        </div>
      </div>
    )
  }

  // Prepare data for the chart
  const chartData = budgets.map(budget => {
    const spent = Number(budget.spent_amount ?? 0)
    const remaining = Number(budget.remaining_amount ?? (budget.amount - spent))
    
    // Calculate spent percentage safely
    let spentPercent = 0
    if (budget.spent_percentage !== undefined && budget.spent_percentage !== null) {
      spentPercent = Number(budget.spent_percentage)
    } else if (budget.amount > 0) {
      spentPercent = (spent / budget.amount) * 100
    }
    
    return {
      category: budget.category,
      budget: budget.amount,
      spent,
      remaining,
      spentPercent: Math.max(spentPercent, 0),
      expectedPercent: budget.expected_spent_percentage,
      isOverBudget: budget.is_over_budget,
      isSpendingTooFast: budget.is_spending_too_fast
    }
  })

  // Color function based on budget status
  const getColor = (entry: any) => {
    if (entry.isOverBudget) return '#EF4444' // Red - over budget
    if (entry.isSpendingTooFast) return '#F59E0B' // Orange - spending too fast
    if (entry.spentPercent > 80) return '#FCD34D' // Yellow - close to budget
    return '#10B981' // Green - good
  }

  return (
    <div className="w-full h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
          מצב תקציבים - {projectName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          הוצאות מול תקציבים לקטגוריות
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis 
            dataKey="category" 
            type="category" 
            width={70}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => {
              const labels: Record<string, string> = {
                budget: 'תקציב',
                spent: 'הוצאה נטו'
              }
              return labels[value] || value
            }}
          />
          
          {/* Budget Bar - Light gray background */}
          <Bar 
            dataKey="budget" 
            name="תקציב"
            fill="#E5E7EB"
            radius={[0, 4, 4, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`budget-${index}`} fill="#E5E7EB" />
            ))}
          </Bar>
          
          {/* Spent Bar - Colored based on status */}
          <Bar 
            dataKey="spent" 
            name="הוצא"
            fill="#3B82F6"
            radius={[0, 4, 4, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`spent-${index}`} fill={getColor(entry)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend for status colors */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span className="text-gray-600 dark:text-gray-400">בתקציב (&lt; 80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-400"></div>
          <span className="text-gray-600 dark:text-gray-400">קרוב לתקציב (80-100%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500"></div>
          <span className="text-gray-600 dark:text-gray-400">הוצאה מהירה מהצפוי</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span className="text-gray-600 dark:text-gray-400">חריגה מעל התקציב</span>
        </div>
      </div>
    </div>
  )
}

