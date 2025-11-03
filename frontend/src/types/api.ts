// TypeScript interfaces generated from backend models
export interface Project {
  id: number
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  budget_monthly: number
  budget_annual: number
  num_residents?: number | null
  monthly_price_per_apartment?: number | null
  address?: string | null
  city?: string | null
  relation_project?: number | null // Parent project ID
  is_active: boolean
  manager_id?: number | null
  created_at: string
  total_value: number
}

export interface Subproject {
  id: number
  project_id: number
  name: string
  is_active: boolean
  created_at: string
}

export interface Transaction {
  id: number
  project_id: number
  tx_date: string
  type: 'Income' | 'Expense'
  amount: number
  description?: string | null
  category?: string | null
  notes?: string | null
  is_exceptional: boolean
  file_path?: string | null
  created_at: string
}

export interface ProjectCreate {
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  budget_monthly: number
  budget_annual: number
  num_residents?: number | null
  monthly_price_per_apartment?: number | null
  address?: string | null
  city?: string | null
  relation_project?: number | null // Parent project ID
  manager_id?: number | null
  recurring_transactions?: RecurringTransactionTemplateCreate[] | null
}

export interface TransactionCreate {
  project_id: number
  tx_date: string
  type: 'Income' | 'Expense'
  amount: number
  description?: string | null
  category?: string | null
  notes?: string | null
  is_exceptional?: boolean
}

// Dashboard-specific types
export interface ProjectWithFinance extends Project {
  children?: ProjectWithFinance[]
  income_month_to_date: number
  expense_month_to_date: number
  profit_percent: number
  status_color: 'green' | 'yellow' | 'red'
}

export interface ExpenseCategory {
  category: string
  amount: number
  color: string
}

export interface DashboardSnapshot {
  projects: ProjectWithFinance[]
  alerts: {
    budget_overrun: number[]
    missing_proof: number[]
    unpaid_recurring: number[]
  }
  summary: {
    total_income: number
    total_expense: number
    total_profit: number
  }
  expense_categories: ExpenseCategory[]
}

// Recurring Transaction types
export interface RecurringTransactionTemplateCreate {
  project_id: number
  description: string
  type: 'Income' | 'Expense'
  amount: number
  category?: string | null
  notes?: string | null
  frequency?: 'Monthly'
  day_of_month: number
  start_date: string
  end_type?: 'No End' | 'After Occurrences' | 'On Date'
  end_date?: string | null
  max_occurrences?: number | null
}

export interface RecurringTransactionTemplate {
  id: number
  project_id: number
  description: string
  type: 'Income' | 'Expense'
  amount: number
  category?: string | null
  notes?: string | null
  frequency: 'Monthly'
  day_of_month: number
  start_date: string
  end_type: 'No End' | 'After Occurrences' | 'On Date'
  end_date?: string | null
  max_occurrences?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecurringTransactionTemplateUpdate {
  description?: string | null
  amount?: number
  category?: string | null
  notes?: string | null
  day_of_month?: number
  start_date?: string
  end_type?: 'No End' | 'After Occurrences' | 'On Date'
  end_date?: string | null
  max_occurrences?: number | null
  is_active?: boolean
}