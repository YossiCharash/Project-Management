import React, { useMemo } from 'react'
import { BudgetWithSpending } from '../../types/api'

interface BudgetCardProps {
  budget: BudgetWithSpending
}

const BudgetCard: React.FC<BudgetCardProps> = ({ budget }) => {
  // Calculate progress percentage
  const progressPercent = Math.min((budget.spent_amount / budget.amount) * 100, 100)
  
  // Determine status
  const isOverBudget = budget.is_over_budget
  const isSpendingTooFast = budget.is_spending_too_fast
  const isWarning = progressPercent > 80 && !isOverBudget
  
  // Color based on status
  let statusColor = '#10B981' // Green - good
  let statusText = 'בתקציב'
  if (isOverBudget) {
    statusColor = '#EF4444' // Red - over budget
    statusText = 'חריגה מעל התקציב!'
  } else if (isSpendingTooFast) {
    statusColor = '#F59E0B' // Orange - spending too fast
    statusText = 'הוצאה מהירה מהצפוי'
  } else if (isWarning) {
    statusColor = '#FCD34D' // Yellow - warning
    statusText = 'קרוב לתקציב'
  }

  // Calculate expected amount based on time elapsed
  const expectedAmount = useMemo(() => {
    return (budget.amount * budget.expected_spent_percentage) / 100
  }, [budget.amount, budget.expected_spent_percentage])

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 ${isOverBudget ? 'border-red-500' : isSpendingTooFast ? 'border-orange-500' : isWarning ? 'border-yellow-400' : 'border-gray-200 dark:border-gray-700'} p-6`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">{budget.category}</h4>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isOverBudget ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : isSpendingTooFast ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : isWarning ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
            {statusText}
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {budget.period_type === 'Annual' ? 'תקציב שנתי' : 'תקציב חודשי'}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">התקדמות</span>
          <span className={`text-sm font-bold ${progressPercent > 100 ? 'text-red-600' : progressPercent > 80 ? 'text-orange-600' : 'text-green-600'}`}>
            {progressPercent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isOverBudget ? 'bg-red-500' : isSpendingTooFast ? 'bg-orange-500' : isWarning ? 'bg-yellow-400' : 'bg-green-500'}`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>0 ₪</span>
          <span>{budget.amount.toLocaleString()} ₪</span>
        </div>
      </div>

      {/* Comparison Details */}
      <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">צפוי לפי זמן</div>
          <div className="font-bold text-gray-900 dark:text-white text-lg">
            {expectedAmount.toLocaleString()} ₪
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {budget.expected_spent_percentage.toFixed(1)}%
          </div>
        </div>
        <div className="text-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">הוצא בפועל</div>
          <div className="font-bold text-gray-900 dark:text-white text-lg">
            {budget.spent_amount.toLocaleString()} ₪
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {progressPercent.toFixed(1)}%
          </div>
        </div>
      </div>
      
      {/* Difference indicator */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">הפרש:</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {budget.spent_amount > expectedAmount ? '+' : ''}{(budget.spent_amount - expectedAmount).toLocaleString()} ₪
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            ({progressPercent > budget.expected_spent_percentage ? '+' : ''}{(progressPercent - budget.expected_spent_percentage).toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Summary Numbers */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">תקציב</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {budget.amount.toLocaleString()} ₪
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">הוצא</div>
          <div className={`text-lg font-bold ${isOverBudget ? 'text-red-600' : 'text-blue-600'}`}>
            {budget.spent_amount.toLocaleString()} ₪
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">נותר</div>
          <div className={`text-lg font-bold ${budget.remaining_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {budget.remaining_amount.toLocaleString()} ₪
          </div>
        </div>
      </div>

      {/* Time-based warning */}
      {budget.is_spending_too_fast && budget.expected_spent_percentage > 0 && !budget.is_over_budget && (
        <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-800 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-orange-600 dark:text-orange-400 text-2xl">⚠️</span>
            <div className="flex-1">
              <div className="text-base font-bold text-orange-800 dark:text-orange-200 mb-2">
                הוצאה מהירה מהצפוי
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300">
                הוצאת <span className="font-semibold">{budget.spent_percentage.toFixed(1)}%</span> מהתקציב, אך צפוי רק <span className="font-semibold">{budget.expected_spent_percentage.toFixed(1)}%</span> לפי זמן שחלף
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Over budget warning */}
      {budget.is_over_budget && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-red-600 dark:text-red-400 text-2xl">🚨</span>
            <div className="flex-1">
              <div className="text-base font-bold text-red-800 dark:text-red-200 mb-2">
                חריגה מעל התקציב!
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                הוצאת <span className="font-semibold">{budget.spent_amount.toLocaleString()} ₪</span> מתוך <span className="font-semibold">{budget.amount.toLocaleString()} ₪</span>
                {budget.expected_spent_percentage > 0 && (
                  <span> - צפוי היה רק <span className="font-semibold">{budget.expected_spent_percentage.toFixed(1)}%</span> לפי זמן</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BudgetCard
