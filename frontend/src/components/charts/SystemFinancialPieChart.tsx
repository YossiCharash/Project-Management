import React from 'react'
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Legend } from 'recharts'

interface SystemFinancialPieChartProps {
  totalIncome: number
  totalExpense: number
  expenseCategories: Array<{
    category: string
    amount: number
    color: string
  }>
}

const COLORS = {
  income: '#10B981', // green-500
  cleaning: '#3B82F6', // blue-500
  electricity: '#F59E0B', // amber-500
  insurance: '#8B5CF6', // violet-500
  gardening: '#059669', // emerald-500
  other: '#EF4444', // red-500
}

export default function SystemFinancialPieChart({ 
  totalIncome, 
  totalExpense, 
  expenseCategories 
}: SystemFinancialPieChartProps) {
  // Create data for the pie chart
  const chartData = [
    {
      name: 'הכנסות',
      value: totalIncome,
      color: COLORS.income,
      fill: COLORS.income
    },
    ...expenseCategories.map(cat => ({
      name: cat.category,
      value: cat.amount,
      color: cat.color,
      fill: cat.color
    }))
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">
            {data.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {data.value.toLocaleString()} ₪
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {((data.value / (totalIncome + totalExpense)) * 100).toFixed(1)}%
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

  return (
    <div className="w-full h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
          סקירה פיננסית כללית
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          הכנסות והוצאות לפי קטגוריות
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <div className="text-green-600 dark:text-green-400 font-semibold">
            סה״כ הכנסות
          </div>
          <div className="text-lg font-bold text-green-700 dark:text-green-300">
            {totalIncome.toLocaleString()} ₪
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <div className="text-red-600 dark:text-red-400 font-semibold">
            סה״כ הוצאות
          </div>
          <div className="text-lg font-bold text-red-700 dark:text-red-300">
            {totalExpense.toLocaleString()} ₪
          </div>
        </div>
      </div>
    </div>
  )
}
