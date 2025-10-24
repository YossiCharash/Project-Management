import api from '../lib/api'
import { Project, ProjectCreate, Transaction, TransactionCreate, ProjectWithFinance, DashboardSnapshot, ExpenseCategory } from '../types/api'

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
}

export class TransactionAPI {
  // Get transactions for a project
  static async getProjectTransactions(projectId: number): Promise<Transaction[]> {
    const { data } = await api.get<Transaction[]>(`/transactions/project/${projectId}`)
    return data
  }

  // Create transaction (expenses should be negative amounts)
  static async createTransaction(transaction: TransactionCreate): Promise<Transaction> {
    // Ensure expenses are negative
    const payload = {
      ...transaction,
      amount: transaction.type === 'Expense' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount)
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
      console.error('Failed to fetch dashboard snapshot:', error)
      
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
