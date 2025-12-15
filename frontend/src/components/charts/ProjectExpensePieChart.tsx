import React from 'react'
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Legend } from 'recharts'

interface ProjectExpensePieChartProps {
  expenseCategories: Array<{
    category: string
    amount: number
    color: string
  }>
  projectName: string
}

export default function ProjectExpensePieChart({ 
  expenseCategories, 
  projectName 
}: ProjectExpensePieChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">
            {data.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {Number(data.value ?? 0).toLocaleString()} ₪
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {((Number(data.value ?? 0) / expenseCategories.reduce((sum, cat) => sum + (cat.amount ?? 0), 0)) * 100).toFixed(1)}%
          </p>
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const totalExpenses = expenseCategories.reduce((sum, cat) => sum + cat.amount, 0)

  return (
    <div className="w-full h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
          פילוח הוצאות - {projectName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          הוצאות לפי קטגוריות
        </p>
      </div>
      
      {expenseCategories.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expenseCategories}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="amount"
              >
                {expenseCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="mt-4 text-center">
            <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
              סה״כ הוצאות: {Number(totalExpenses ?? 0).toLocaleString()} ₪
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="text-lg mb-2">אין הוצאות להצגה</div>
            <div className="text-sm">לא נרשמו הוצאות עבור פרויקט זה</div>
          </div>
        </div>
      )}
    </div>
  )
}
