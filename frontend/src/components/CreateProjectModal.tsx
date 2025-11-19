import React, { useState, useEffect } from 'react'
import { Project, ProjectCreate, BudgetCreate } from '../types/api'
import { ProjectAPI, BudgetAPI } from '../lib/apiClient'

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
    address: '',
    city: '',
    relation_project: undefined,
    manager_id: undefined
  })

  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [budgetInputType, setBudgetInputType] = useState<'monthly' | 'yearly'>('monthly')
  const [categoryBudgets, setCategoryBudgets] = useState<BudgetCreate[]>([])
  const [hasFund, setHasFund] = useState(false)
  const [monthlyFundAmount, setMonthlyFundAmount] = useState<number>(0)
  
  // Available expense categories
  const expenseCategories = ['ניקיון', 'חשמל', 'ביטוח', 'גינון', 'אחר']

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
        address: editingProject.address || '',
        city: editingProject.city || '',
        relation_project: editingProject.relation_project || undefined,
        manager_id: editingProject.manager_id || undefined
      })
      // Load fund data if exists
      if ('has_fund' in editingProject) {
        setHasFund((editingProject as any).has_fund || false)
        setMonthlyFundAmount((editingProject as any).monthly_fund_amount || 0)
      }
      // Reset image states when editing
      setSelectedImage(null)
      setImagePreview(editingProject.image_url ? getImageUrl(editingProject.image_url) : null)
    } else {
      resetForm()
    }
  }, [editingProject])

  const loadProjects = async () => {
    try {
      const projects = await ProjectAPI.getProjects()
      setAvailableProjects(projects.filter(p => p.is_active))
    } catch (err) {
      // Ignore
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
      address: '',
      city: '',
      relation_project: parentProjectId || undefined,
      manager_id: undefined
    })
    setError(null)
    setSelectedImage(null)
    setImagePreview(null)
    setBudgetInputType('monthly')
    setCategoryBudgets([])
    setHasFund(false)
    setMonthlyFundAmount(0)
  }

  const getImageUrl = (imageUrl: string): string => {
    // If backend already returned full URL (S3 / CloudFront), use as-is
    if (imageUrl.startsWith('http')) {
      return imageUrl
    }
    const apiUrl = import.meta.env.VITE_API_URL || ''
    // @ts-ignore
    const baseUrl = apiUrl ? apiUrl.replace('/api/v1', '') : ''
    return `${baseUrl}/uploads/${imageUrl}`
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        setError('סוג קובץ לא תקין. אנא בחר תמונה (JPG, PNG, GIF, WebP)')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('גודל הקובץ גדול מדי. מקסימום 5MB')
        return
      }

      setSelectedImage(file)
      setError(null)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Filter and validate budgets - remove project_id if present (not needed for project creation)
      const validBudgets = categoryBudgets
        .filter(b => b.amount > 0 && b.category && b.start_date)
        .map(b => {
          const budgetWithoutProjectId: any = { ...b }
          delete budgetWithoutProjectId.project_id
          return {
            ...budgetWithoutProjectId,
            period_type: b.period_type || 'Annual',
            end_date: b.end_date || null
          }
        })

      const projectData: ProjectCreate = {
        ...formData,
        description: formData.description || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        relation_project: formData.relation_project || undefined,
        manager_id: formData.manager_id || undefined,
        budgets: validBudgets.length > 0 ? validBudgets : undefined,
        has_fund: hasFund || false,
        monthly_fund_amount: hasFund ? (monthlyFundAmount || 0) : undefined
      }

      
      // Validate that all required fields are present
      if (!projectData.name || projectData.name.trim() === '') {
        setError('שם הפרויקט נדרש')
        setLoading(false)
        return
      }

      let result: Project
      if (editingProject) {
        result = await ProjectAPI.updateProject(editingProject.id, projectData)
      } else {
        result = await ProjectAPI.createProject(projectData)
      }

      // Upload image if one was selected
      let imageUploadError = false
      if (selectedImage) {
        try {
          result = await ProjectAPI.uploadProjectImage(result.id, selectedImage)
        } catch (imgErr: any) {
          // Don't fail the whole operation if image upload fails
          imageUploadError = true
          setError(`הפרויקט נוצר בהצלחה אך העלאת התמונה נכשלה: ${imgErr.response?.data?.detail || 'שגיאה לא ידועה'}`)
        }
      }

      // Verify budgets were created successfully
      if (validBudgets.length > 0) {
        try {
          // Wait a bit for the backend to process
          await new Promise(resolve => setTimeout(resolve, 500))
          const createdBudgets = await BudgetAPI.getProjectBudgets(result.id)
          if (createdBudgets.length === 0 && validBudgets.length > 0) {
            setError(`הפרויקט נוצר בהצלחה, אך ייתכן שיש בעיה ביצירת התקציבים.`)
          }
        } catch (budgetErr: any) {
          // Don't fail the whole operation
        }
      }

      onSuccess(result)
      // Only close if there was no image upload error
      if (!imageUploadError) {
        // Dispatch custom event to notify other components (e.g., ProjectDetail) that project was updated
        if (editingProject) {
          window.dispatchEvent(new CustomEvent('projectUpdated', { detail: { projectId: result.id } }))
        }
        onClose()
        resetForm()
      }
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

  const addCategoryBudget = () => {
    const today = new Date().toISOString().split('T')[0]
    const newBudget: BudgetCreate = {
      category: expenseCategories[0],
      amount: 0,
      period_type: 'Annual',
      start_date: today,
      end_date: null
    }
    setCategoryBudgets([...categoryBudgets, newBudget])
  }

  const removeCategoryBudget = (index: number) => {
    setCategoryBudgets(categoryBudgets.filter((_, i) => i !== index))
  }

  const updateCategoryBudget = (index: number, field: keyof BudgetCreate, value: any) => {
    const updated = [...categoryBudgets]
    updated[index] = { ...updated[index], [field]: value }
    
    // If period_type is Annual and start_date is set, calculate end_date
    if (field === 'start_date' && updated[index].period_type === 'Annual' && value) {
      const startDate = new Date(value)
      const endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + 1)
      endDate.setDate(endDate.getDate() - 1) // One day before next year
      updated[index].end_date = endDate.toISOString().split('T')[0]
    }
    
    setCategoryBudgets(updated)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {editingProject ? 'עריכת פרויקט' : (parentProjectId ? 'יצירת תת-פרויקט חדש' : 'יצירת פרויקט חדש')}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                שם הפרויקט *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                פרויקט אב
              </label>
              <select
                value={formData.relation_project || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  relation_project: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תיאור
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תמונת הפרויקט
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300"
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="תצוגה מקדימה"
                    className="max-w-full h-48 object-cover rounded-md border border-gray-300 dark:border-gray-600"
                  />
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null)
                        setImagePreview(editingProject?.image_url ? getImageUrl(editingProject.image_url) : null)
                      }}
                      className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      הסר תמונה
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                כתובת
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                עיר
              </label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                סוג הקלט לתקציב
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="monthly"
                    checked={budgetInputType === 'monthly'}
                    onChange={(e) => setBudgetInputType(e.target.value as 'monthly' | 'yearly')}
                    className="ml-2 text-blue-600 dark:text-blue-400"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">חודשי</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="yearly"
                    checked={budgetInputType === 'yearly'}
                    onChange={(e) => setBudgetInputType(e.target.value as 'monthly' | 'yearly')}
                    className="ml-2 text-blue-600 dark:text-blue-400"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">שנתי</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  תקציב חודשי
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.budget_monthly}
                  onChange={(e) => {
                    const monthlyValue = parseFloat(e.target.value) || 0
                    setFormData({
                      ...formData,
                      budget_monthly: monthlyValue,
                      budget_annual: Math.round(monthlyValue * 12 * 100) / 100
                    })
                  }}
                  disabled={budgetInputType === 'yearly'}
                  className={`w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    budgetInputType === 'yearly' ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  תקציב שנתי
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.budget_annual}
                  onChange={(e) => {
                    const yearlyValue = parseFloat(e.target.value) || 0
                    setFormData({
                      ...formData,
                      budget_annual: yearlyValue,
                      budget_monthly: Math.round(yearlyValue / 12 * 100) / 100
                    })
                  }}
                  disabled={budgetInputType === 'monthly'}
                  className={`w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    budgetInputType === 'monthly' ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                תאריך התחלה
              </label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                תאריך סיום
              </label>
              <input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Removed num_residents and monthly_price_per_apartment inputs */}

          {/* Fund Section */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <input
                id="hasFund"
                type="checkbox"
                checked={hasFund}
                onChange={(e) => {
                  setHasFund(e.target.checked)
                  if (!e.target.checked) {
                    setMonthlyFundAmount(0)
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="hasFund" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                הוסף קופה לפרויקט
              </label>
            </div>
            
            {hasFund && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  סכום חודשי לקופה (₪) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required={hasFund}
                  value={monthlyFundAmount}
                  onChange={(e) => setMonthlyFundAmount(parseFloat(e.target.value) || 0)}
                  placeholder="הכנס סכום חודשי"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  הסכום יתווסף לקופה כל חודש באופן אוטומטי
                </p>
              </div>
            )}
          </div>

          {/* Category Budgets Section */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                תקציבים לקטגוריות
              </label>
              <button
                type="button"
                onClick={addCategoryBudget}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                + הוסף תקציב לקטגוריה
              </button>
            </div>
            
            {categoryBudgets.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                אין תקציבים לקטגוריות. לחץ על "הוסף תקציב לקטגוריה" כדי להוסיף תקציב לקטגוריה ספציפית (למשל: חשמל, ניקיון).
              </p>
            )}

            <div className="space-y-3">
              {categoryBudgets.map((budget, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">תקציב #{index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeCategoryBudget(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                    >
                      מחק
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        קטגוריה *
                      </label>
                      <select
                        value={budget.category}
                        onChange={(e) => updateCategoryBudget(index, 'category', e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        {expenseCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        סכום (₪) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={budget.amount}
                        onChange={(e) => updateCategoryBudget(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        סוג תקופה *
                      </label>
                      <select
                        value={budget.period_type || 'Annual'}
                        onChange={(e) => {
                          updateCategoryBudget(index, 'period_type', e.target.value)
                          // If changing to Annual and start_date exists, calculate end_date
                          if (e.target.value === 'Annual' && budget.start_date) {
                            const startDate = new Date(budget.start_date)
                            const endDate = new Date(startDate)
                            endDate.setFullYear(endDate.getFullYear() + 1)
                            endDate.setDate(endDate.getDate() - 1)
                            updateCategoryBudget(index, 'end_date', endDate.toISOString().split('T')[0])
                          } else if (e.target.value === 'Monthly') {
                            updateCategoryBudget(index, 'end_date', null)
                          }
                        }}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="Annual">שנתי</option>
                        <option value="Monthly">חודשי</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        תאריך התחלה *
                      </label>
                      <input
                        type="date"
                        value={budget.start_date}
                        onChange={(e) => updateCategoryBudget(index, 'start_date', e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {budget.period_type === 'Annual' && budget.end_date && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          תאריך סיום
                        </label>
                        <input
                          type="date"
                          value={budget.end_date}
                          onChange={(e) => updateCategoryBudget(index, 'end_date', e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          readOnly
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
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
