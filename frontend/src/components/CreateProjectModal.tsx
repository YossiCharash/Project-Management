import React, { useState, useEffect } from 'react'
import { Project, ProjectCreate, RecurringTransactionTemplateCreate } from '../types/api'
import { ProjectAPI } from '../lib/apiClient'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (project: Project) => void
  editingProject?: Project | null
  parentProjectId?: number
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingProject,
  parentProjectId
}) => {
  const [formData, setFormData] = useState<ProjectCreate>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    budget_monthly: 0,
    budget_annual: 0,
    num_residents: undefined,
    monthly_price_per_apartment: undefined,
    address: '',
    city: '',
    relation_project: undefined,
    manager_id: undefined
  })

  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recurringTransactions, setRecurringTransactions] = useState<Partial<RecurringTransactionTemplateCreate>[]>([])
  const [showRecurringSection, setShowRecurringSection] = useState(false)

  // Load available projects for parent selection
  useEffect(() => {
    if (isOpen) {
      loadProjects()
    }
  }, [isOpen])

  // Populate form when editing
  useEffect(() => {
    if (editingProject) {
      setFormData({
        name: editingProject.name,
        description: editingProject.description || '',
        start_date: editingProject.start_date || '',
        end_date: editingProject.end_date || '',
        budget_monthly: editingProject.budget_monthly,
        budget_annual: editingProject.budget_annual,
        num_residents: editingProject.num_residents || undefined,
        monthly_price_per_apartment: editingProject.monthly_price_per_apartment || undefined,
        address: editingProject.address || '',
        city: editingProject.city || '',
        relation_project: editingProject.relation_project || undefined,
        manager_id: editingProject.manager_id || undefined
      })
    } else {
      resetForm()
    }
  }, [editingProject])

  const loadProjects = async () => {
    try {
      const projects = await ProjectAPI.getProjects()
      setAvailableProjects(projects.filter(p => p.is_active))
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      budget_monthly: 0,
      budget_annual: 0,
      num_residents: undefined,
      monthly_price_per_apartment: undefined,
      address: '',
      city: '',
      relation_project: parentProjectId || undefined,
      manager_id: undefined
    })
    setRecurringTransactions([])
    setShowRecurringSection(false)
    setError(null)
  }

  const addRecurringTransaction = () => {
    setRecurringTransactions([...recurringTransactions, {
      description: '',
      type: 'Expense',
      amount: 0,
      category: null,
      notes: null,
      frequency: 'Monthly',
      day_of_month: 1,
      start_date: new Date().toISOString().split('T')[0],
      end_type: 'No End',
      end_date: null,
      max_occurrences: null
    }])
    setShowRecurringSection(true)
  }

  const removeRecurringTransaction = (index: number) => {
    setRecurringTransactions(recurringTransactions.filter((_, i) => i !== index))
  }

  const updateRecurringTransaction = (index: number, field: string, value: any) => {
    const updated = [...recurringTransactions]
    updated[index] = { ...updated[index], [field]: value }
    
    // Clear end_date or max_occurrences based on end_type
    if (field === 'end_type') {
      if (value !== 'On Date') updated[index].end_date = null
      if (value !== 'After Occurrences') updated[index].max_occurrences = null
    }
    
    setRecurringTransactions(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const projectData = {
        ...formData,
        description: formData.description || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        num_residents: formData.num_residents || undefined,
        monthly_price_per_apartment: formData.monthly_price_per_apartment || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        relation_project: formData.relation_project || undefined,
        manager_id: formData.manager_id || undefined,
        recurring_transactions: recurringTransactions.length > 0 && !editingProject
          ? recurringTransactions.filter(rt => rt.description && rt.amount).map(rt => ({
              ...rt,
              project_id: 0  // Will be set by backend
            }))
          : undefined
      }

      let result: Project
      if (editingProject) {
        result = await ProjectAPI.updateProject(editingProject.id, projectData)
      } else {
        result = await ProjectAPI.createProject(projectData)
      }

      onSuccess(result)
      onClose()
      resetForm()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'שמירה נכשלה')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    resetForm()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {editingProject ? 'עריכת פרויקט' : (parentProjectId ? 'יצירת תת-פרויקט חדש' : 'יצירת פרויקט חדש')}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם הפרויקט *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                פרויקט אב
              </label>
              <select
                value={formData.relation_project || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  relation_project: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">ללא פרויקט אב</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תיאור
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                כתובת
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                עיר
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מספר דיירים
              </label>
              <input
                type="number"
                min="0"
                value={formData.num_residents || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  num_residents: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מחיר חודשי לדירה
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.monthly_price_per_apartment || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  monthly_price_per_apartment: e.target.value ? parseFloat(e.target.value) : undefined 
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תקציב חודשי
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.budget_monthly}
                onChange={(e) => setFormData({ ...formData, budget_monthly: parseFloat(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תקציב שנתי
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.budget_annual}
                onChange={(e) => setFormData({ ...formData, budget_annual: parseFloat(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך התחלה
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך סיום
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Recurring Transactions Section - Only show for new projects */}
          {!editingProject && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  עסקאות מחזוריות
                </h3>
                <button
                  type="button"
                  onClick={addRecurringTransaction}
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  + הוסף עסקה מחזורית
                </button>
              </div>

              {showRecurringSection && recurringTransactions.length > 0 && (
                <div className="space-y-4">
                  {recurringTransactions.map((rt, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-md p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">עסקה מחזורית #{index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => removeRecurringTransaction(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          ✕ מחק
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            תיאור *
                          </label>
                          <input
                            type="text"
                            required
                            value={rt.description || ''}
                            onChange={(e) => updateRecurringTransaction(index, 'description', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            סוג *
                          </label>
                          <select
                            required
                            value={rt.type || 'Expense'}
                            onChange={(e) => updateRecurringTransaction(index, 'type', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Expense">הוצאה</option>
                            <option value="Income">הכנסה</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            סכום *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={rt.amount || ''}
                            onChange={(e) => updateRecurringTransaction(index, 'amount', parseFloat(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            יום בחודש *
                          </label>
                          <select
                            required
                            value={rt.day_of_month || 1}
                            onChange={(e) => updateRecurringTransaction(index, 'day_of_month', parseInt(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {Array.from({ length: 31 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>{i + 1}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            תאריך התחלה *
                          </label>
                          <input
                            type="date"
                            required
                            value={rt.start_date || ''}
                            onChange={(e) => updateRecurringTransaction(index, 'start_date', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            סיום
                          </label>
                          <select
                            value={rt.end_type || 'No End'}
                            onChange={(e) => updateRecurringTransaction(index, 'end_type', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="No End">ללא סיום</option>
                            <option value="After Occurrences">לאחר מספר הופעות</option>
                            <option value="On Date">בתאריך מסוים</option>
                          </select>
                        </div>

                        {rt.end_type === 'After Occurrences' && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              מספר הופעות
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={rt.max_occurrences || ''}
                              onChange={(e) => updateRecurringTransaction(index, 'max_occurrences', parseInt(e.target.value))}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {rt.end_type === 'On Date' && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              תאריך סיום
                            </label>
                            <input
                              type="date"
                              value={rt.end_date || ''}
                              onChange={(e) => updateRecurringTransaction(index, 'end_date', e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          קטגוריה
                        </label>
                        <select
                          value={rt.category || ''}
                          onChange={(e) => updateRecurringTransaction(index, 'category', e.target.value || null)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">בחר קטגוריה</option>
                          <option value="ניקיון">ניקיון</option>
                          <option value="חשמל">חשמל</option>
                          <option value="ביטוח">ביטוח</option>
                          <option value="גינון">גינון</option>
                          <option value="תחזוקה">תחזוקה</option>
                          <option value="אחר">אחר</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showRecurringSection && recurringTransactions.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  אין עסקאות מחזוריות. לחץ על "הוסף עסקה מחזורית" כדי להתחיל.
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'שומר...' : (editingProject ? 'שמור שינויים' : (parentProjectId ? 'צור תת-פרויקט' : 'צור פרויקט'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateProjectModal
