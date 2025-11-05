import api from '../lib/api'
import { Project, ProjectCreate, Transaction, TransactionCreate, ProjectWithFinance, DashboardSnapshot, ExpenseCategory, RecurringTransactionTemplate, RecurringTransactionTemplateCreate, RecurringTransactionTemplateUpdate, BudgetWithSpending } from '../types/api'

// Enhanced API client with proper TypeScript types
export class ProjectAPI {
  // Get all projects with optional parent-child relationships
  static async getProjects(includeArchived = false): Promise<Project[]> {
    const { data } = await api.get<Project[]>(`/projects?include_archived=${includeArchived}`)
    return data
  }

  // Get project with financial data for dashboard
  static async getProjectWithFinance(projectId: number): Promise<ProjectWithFinance> {
    const { data } = await api.get<ProjectWithFinance>(`/projects/get_values/${projectId}`)
    return data
  }

  // Create project with optional parent relationship
  static async createProject(project: ProjectCreate): Promise<Project> {
    const { data } = await api.post<Project>('/projects', project)
    return data
  }

  // Update project
  static async updateProject(projectId: number, updates: Partial<ProjectCreate>): Promise<Project> {
    const { data } = await api.put<Project>(`/projects/${projectId}`, updates)
    return data
  }

  // Archive project
  static async archiveProject(projectId: number): Promise<Project> {
    const { data } = await api.post<Project>(`/projects/${projectId}/archive`)
    return data
  }

  // Restore project
  static async restoreProject(projectId: number): Promise<Project> {
    const { data } = await api.post<Project>(`/projects/${projectId}/restore`)
    return data
  }

  // Upload project image
  static async uploadProjectImage(projectId: number, file: File): Promise<Project> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post<Project>(`/projects/${projectId}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  }

  // Get profitability alerts
  static async getProfitabilityAlerts(): Promise<{
    alerts: Array<{
      id: number
      name: string
      profit_margin: number
      income: number
      expense: number
      profit: number
      is_subproject: boolean
      parent_project_id: number | null
    }>
    count: number
    period_start: string
    period_end: string
  }> {
    const { data } = await api.get('/projects/profitability-alerts')
    return data
  }
}

export class TransactionAPI {
  // Get transactions for a project
  static async getProjectTransactions(projectId: number): Promise<Transaction[]> {
    const { data } = await api.get<Transaction[]>(`/transactions/project/${projectId}`)
    return data
  }

  // Create transaction
  static async createTransaction(transaction: TransactionCreate): Promise<Transaction> {
    // Keep amounts as positive values
    const payload = {
      ...transaction,
      amount: Math.abs(transaction.amount)
    }
    const { data } = await api.post<Transaction>('/transactions', payload)
    return data
  }

  // Update transaction
  static async updateTransaction(transactionId: number, updates: Partial<TransactionCreate>): Promise<Transaction> {
    const { data } = await api.put<Transaction>(`/transactions/${transactionId}`, updates)
    return data
  }

  // Upload receipt for transaction
  static async uploadReceipt(transactionId: number, file: File): Promise<Transaction> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post<Transaction>(`/transactions/${transactionId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  }

  // Delete transaction
  static async deleteTransaction(transactionId: number): Promise<void> {
    await api.delete(`/transactions/${transactionId}`)
  }
}

export class DashboardAPI {
  // Get dashboard snapshot with all projects and financial data from backend
  static async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    try {
      // Use the new comprehensive backend endpoint for real-time data
      const { data } = await api.get<DashboardSnapshot>('/reports/dashboard-snapshot')
      return data
    } catch (error: any) {
      throw error
      
      // If authentication error, let the interceptor handle it
      if (error.response?.status === 401) {
        throw error
      }
      
      // Return empty state on other errors
      return {
        projects: [],
        alerts: { budget_overrun: [], missing_proof: [], unpaid_recurring: [] },
        summary: { total_income: 0, total_expense: 0, total_profit: 0 },
        expense_categories: []
      }
    }
  }
}

export class ReportAPI {
  // Get expense categories for a specific project
  static async getProjectExpenseCategories(projectId: number): Promise<ExpenseCategory[]> {
    const { data } = await api.get<ExpenseCategory[]>(`/reports/project/${projectId}/expense-categories`)
    return data
  }

  // Get all transactions for a specific project
  static async getProjectTransactions(projectId: number): Promise<Transaction[]> {
    const { data } = await api.get<Transaction[]>(`/reports/project/${projectId}/transactions`)
    return data
  }
}

export class BudgetAPI {
  // Get all budgets for a project with spending information
  static async getProjectBudgets(projectId: number): Promise<BudgetWithSpending[]> {
    const { data } = await api.get<BudgetWithSpending[]>(`/budgets/project/${projectId}`)
    return data
  }

  // Get a specific budget with spending information
  static async getBudget(budgetId: number): Promise<BudgetWithSpending> {
    const { data } = await api.get<BudgetWithSpending>(`/budgets/${budgetId}`)
    return data
  }
}

export class RecurringTransactionAPI {
  // Get all recurring transaction templates for a project
  static async getProjectRecurringTemplates(projectId: number): Promise<RecurringTransactionTemplate[]> {
    const { data } = await api.get<RecurringTransactionTemplate[]>(`/recurring-transactions/project/${projectId}`)
    return data
  }

  // Create a recurring transaction template
  static async createTemplate(template: RecurringTransactionTemplateCreate): Promise<RecurringTransactionTemplate> {
    const { data } = await api.post<RecurringTransactionTemplate>('/recurring-transactions', template)
    return data
  }

  // Update a recurring transaction template
  static async updateTemplate(templateId: number, updates: RecurringTransactionTemplateUpdate): Promise<RecurringTransactionTemplate> {
    const { data } = await api.put<RecurringTransactionTemplate>(`/recurring-transactions/${templateId}`, updates)
    return data
  }

  // Delete a recurring transaction template
  static async deleteTemplate(templateId: number): Promise<void> {
    await api.delete(`/recurring-transactions/${templateId}`)
  }

  // Deactivate a recurring transaction template
  static async deactivateTemplate(templateId: number): Promise<RecurringTransactionTemplate> {
    const { data } = await api.post<RecurringTransactionTemplate>(`/recurring-transactions/${templateId}/deactivate`)
    return data
  }

  // Get all transactions generated from a specific template
  static async getTemplateTransactions(templateId: number): Promise<Transaction[]> {
    const { data } = await api.get<Transaction[]>(`/recurring-transactions/${templateId}/transactions`)
    return data
  }

  // Get a template with its transactions
  static async getTemplate(templateId: number): Promise<RecurringTransactionTemplate & { generated_transactions?: Transaction[] }> {
    const { data } = await api.get<RecurringTransactionTemplate & { generated_transactions?: Transaction[] }>(`/recurring-transactions/${templateId}`)
    return data
  }

  // Generate transactions for a specific month
  static async generateMonthlyTransactions(year: number, month: number): Promise<{ generated_count: number; transactions: Transaction[] }> {
    const { data } = await api.post<{ generated_count: number; transactions: Transaction[] }>(`/recurring-transactions/generate/${year}/${month}`)
    return data
  }

  // Update a specific transaction instance (for recurring transactions)
  static async updateTransactionInstance(transactionId: number, updates: { tx_date?: string; amount?: number; category?: string; notes?: string }): Promise<Transaction> {
    const { data } = await api.put<Transaction>(`/recurring-transactions/transactions/${transactionId}`, updates)
    return data
  }

  // Delete a specific transaction instance (for recurring transactions)
  static async deleteTransactionInstance(transactionId: number): Promise<void> {
    await api.delete(`/recurring-transactions/transactions/${transactionId}`)
  }
}
