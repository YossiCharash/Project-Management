import React, { useState, useEffect } from 'react'
import { Project, ProjectCreate, BudgetCreate } from '../types/api'
import { ProjectAPI, BudgetAPI, CategoryAPI } from '../lib/apiClient'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (project: Project) => void
  editingProject?: Project | null
  parentProjectId?: number
  projectType?: 'parent' | 'regular' // 'parent' = רק תאריכים, 'regular' = כל השדות
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingProject,
  parentProjectId,
  projectType = 'regular' // Default to regular project
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
  const [selectedContractFile, setSelectedContractFile] = useState<File | null>(null)
  const [existingContractUrl, setExistingContractUrl] = useState<string | null>(null)
  const [budgetInputType, setBudgetInputType] = useState<'monthly' | 'yearly'>('monthly')
  const [categoryBudgets, setCategoryBudgets] = useState<BudgetCreate[]>([])
  const [hasFund, setHasFund] = useState(false)
  const [monthlyFundAmount, setMonthlyFundAmount] = useState<number>(0)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isCheckingName, setIsCheckingName] = useState(false)
  const [nameValid, setNameValid] = useState<boolean | null>(null)
  // Default to 'regular' if no projectType is provided, but allow override
  const [selectedProjectType, setSelectedProjectType] = useState<'parent' | 'regular'>(
    projectType || 'regular'
  )
  
  // Available expense categories - loaded from API (only categories defined in settings)
  const [expenseCategories, setExpenseCategories] = useState<string[]>([])
  
  // Determine if we should show minimal fields (parent project without parentProjectId)
  // A project is a parent project if:
  // 1. Creating a new parent project (selectedProjectType === 'parent' and no parentProjectId)
  // 2. Editing a project that has is_parent_project === true
  const isParentProject = editingProject 
    ? (editingProject.is_parent_project === true)
    : (!parentProjectId && selectedProjectType === 'parent')
  const isParentProjectCreation = !parentProjectId && !editingProject && selectedProjectType === 'parent'
  const isRegularProjectCreation = !parentProjectId && !editingProject && selectedProjectType === 'regular'
  
  // Reset project type when modal opens based on projectType prop
  useEffect(() => {
    if (isOpen && !parentProjectId && !editingProject) {
      // Set project type based on prop (from button clicked)
      setSelectedProjectType(projectType || 'regular')
    }
  }, [isOpen, parentProjectId, editingProject, projectType])

  // Load available projects for parent selection and set parent project if provided
  useEffect(() => {
    if (isOpen) {
      loadProjects()
      loadCategories()
      // Set parent project automatically when creating subproject
      if (parentProjectId && !editingProject) {
        setFormData(prev => ({
          ...prev,
          relation_project: parentProjectId
        }))
      } else if (!parentProjectId && !editingProject) {
        // Clear relation_project when creating parent project
        setFormData(prev => ({
          ...prev,
          relation_project: undefined
        }))
      }
    }
  }, [isOpen, parentProjectId, editingProject])

  // Load categories from API (only categories defined in settings)
  const loadCategories = async () => {
    try {
      const categories = await CategoryAPI.getCategories()
      // Extract only active category names from settings
      const categoryNames = categories.filter(cat => cat.is_active).map(cat => cat.name)
      setExpenseCategories(categoryNames)
    } catch (err) {
      // If loading fails, set empty array (no categories available)
      console.error('Error loading categories:', err)
      setExpenseCategories([])
    }
  }

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
      // Load existing budgets
      loadExistingBudgets(editingProject.id)
      // Reset image states when editing
      setSelectedImage(null)
      setImagePreview(editingProject.image_url ? getImageUrl(editingProject.image_url) : null)
      // Reset contract states when editing
      if (editingProject.contract_file_url) {
        setExistingContractUrl(getFileUrl(editingProject.contract_file_url))
      } else {
        setExistingContractUrl(null)
      }
      setSelectedContractFile(null)
      // Reset name validation when editing
      setNameError(null)
      setNameValid(null)
    } else {
      resetForm()
    }
  }, [editingProject])

  // Load existing budgets for editing
  const loadExistingBudgets = async (projectId: number) => {
    try {
      const budgets = await BudgetAPI.getProjectBudgets(projectId)
      const budgetCreates: BudgetCreate[] = budgets.map(b => ({
        category: b.category,
        amount: b.amount,
        period_type: b.period_type || 'Annual',
        start_date: b.start_date,
        end_date: b.end_date || null
      }))
      setCategoryBudgets(budgetCreates)
      
      // Note: We don't add budget categories to the list - only use categories from settings
      // If a budget has a category not in settings, it will still work but won't appear in dropdown
    } catch (err) {
      // If loading fails, continue without budgets
      console.error('Error loading existing budgets:', err)
    }
  }

  // Check project name availability with debounce
  useEffect(() => {
    const checkName = async () => {
      const name = formData.name.trim()
      
      // Reset validation if name is empty
      if (!name) {
        setNameError(null)
        setNameValid(null)
        setIsCheckingName(false)
        return
      }

      // Don't check if we're editing and name hasn't changed
      if (editingProject && name === editingProject.name) {
        setNameError(null)
        setNameValid(true)
        setIsCheckingName(false)
        return
      }

      // Set checking state but don't block input
      setIsCheckingName(true)
      setNameError(null)
      setNameValid(null)

      try {
        const result = await ProjectAPI.checkProjectName(name, editingProject?.id)
        // Only update if the name hasn't changed during the check
        if (formData.name.trim() === name) {
          if (result.exists) {
            setNameError('שם זה כבר קיים. אנא בחר שם אחר')
            setNameValid(false)
          } else {
            setNameError(null)
            setNameValid(true)
          }
        }
      } catch (err: any) {
        // If there's an error (like 422 validation error), don't block the user
        // This can happen if the name is empty or has invalid characters
        // Only log if it's not a validation error (422)
        if (err?.response?.status !== 422) {
          console.error('Error checking name:', err)
        }
        // Only clear if name hasn't changed
        if (formData.name.trim() === name) {
          setNameError(null)
          setNameValid(null)
        }
      } finally {
        // Only clear checking state if name hasn't changed
        if (formData.name.trim() === name) {
          setIsCheckingName(false)
        }
      }
    }

    // Debounce: wait 300ms after user stops typing (reduced for faster feedback)
    const timeoutId = setTimeout(checkName, 300)
    return () => clearTimeout(timeoutId)
  }, [formData.name, editingProject])

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
    setSelectedContractFile(null)
    setExistingContractUrl(null)
    setBudgetInputType('monthly')
    setCategoryBudgets([])
    setHasFund(false)
    setMonthlyFundAmount(0)
    setNameError(null)
    setNameValid(null)
    setIsCheckingName(false)
    setSelectedProjectType(projectType) // Reset to default project type
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

  const getFileUrl = (fileUrl: string): string => {
    if (!fileUrl) return ''
    if (fileUrl.startsWith('http')) {
      return fileUrl
    }
    const apiUrl = import.meta.env.VITE_API_URL || ''
    // @ts-ignore
    const baseUrl = apiUrl ? apiUrl.replace('/api/v1', '') : ''
    return `${baseUrl}/uploads/${fileUrl}`
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

  const handleContractChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !allowedExtensions.includes(ext)) {
        setError('סוג קובץ לא תקין. ניתן לצרף קובץ PDF, DOC, DOCX או תמונה (JPG/PNG).')
        return
      }

      const maxSizeMb = 15
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`גודל הקובץ גדול מדי. מקסימום ${maxSizeMb}MB`)
        return
      }

      setSelectedContractFile(file)
      setExistingContractUrl(null)
      setError(null)
    }
  }

  const handleClearContractSelection = () => {
    setSelectedContractFile(null)
    if (editingProject?.contract_file_url) {
      setExistingContractUrl(getFileUrl(editingProject.contract_file_url))
    } else {
      setExistingContractUrl(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate required fields based on project type BEFORE creating projectData
      if (parentProjectId) {
        // For subprojects: name is required
        if (!formData.name || formData.name.trim() === '') {
          setError('שם הפרויקט נדרש')
          setLoading(false)
          return
        }

        // Check if name is valid (not duplicate) for subprojects
        if (nameValid === false) {
          setError('לא ניתן לשמור: שם הפרויקט כבר קיים. אנא שנה את השם')
          setLoading(false)
          return
        }

        // If name is still being checked, wait a bit
        if (isCheckingName) {
          setError('בודק שם פרויקט... אנא המתן')
          setLoading(false)
          return
        }
      } else if (!editingProject && isParentProjectCreation) {
        // For parent projects (minimal): name and dates are required
        if (!formData.name || formData.name.trim() === '') {
          setError('שם הפרויקט נדרש')
          setLoading(false)
          return
        }
        if (!formData.start_date || !formData.end_date) {
          setError('תאריך התחלה ותאריך סיום נדרשים')
          setLoading(false)
          return
        }
      } else if (!editingProject && isRegularProjectCreation) {
        // For regular projects: name and dates are required
        if (!formData.name || formData.name.trim() === '') {
          setError('שם הפרויקט נדרש')
          setLoading(false)
          return
        }
        
        if (!formData.start_date || !formData.end_date) {
          setError('תאריך התחלה ותאריך סיום נדרשים')
          setLoading(false)
          return
        }

        // Check if name is valid (not duplicate) for regular projects
        if (nameValid === false) {
          setError('לא ניתן לשמור: שם הפרויקט כבר קיים. אנא שנה את השם')
          setLoading(false)
          return
        }

        // If name is still being checked, wait a bit
        if (isCheckingName) {
          setError('בודק שם פרויקט... אנא המתן')
          setLoading(false)
          return
        }
      } else {
        // For editing: name is required, dates required for parent projects
        if (!formData.name || formData.name.trim() === '') {
          setError('שם הפרויקט נדרש')
          setLoading(false)
          return
        }
        // For parent projects, dates are required
        if (isParentProject && (!formData.start_date || !formData.end_date)) {
          setError('תאריך התחלה ותאריך סיום נדרשים לפרויקט על')
          setLoading(false)
          return
        }
      }

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
        // Name is always required by backend (min_length=1), ensure it exists
        name: formData.name.trim(),
        description: formData.description || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        // Budget fields are required with default 0
        budget_monthly: formData.budget_monthly || 0,
        budget_annual: formData.budget_annual || 0,
        address: formData.address || undefined,
        city: formData.city || undefined,
        // Automatically set parent project when creating subproject
        relation_project: parentProjectId || formData.relation_project || undefined,
        // Set is_parent_project based on project type
        // - If creating parent project: true
        // - If creating subproject (has parentProjectId): false
        // - If creating regular project: false (explicitly set to false)
        is_parent_project: isParentProjectCreation ? true : false,
        manager_id: formData.manager_id || undefined,
        // Only include budgets for regular projects or subprojects (not for parent projects)
        budgets: (isParentProject || isParentProjectCreation ? undefined : (validBudgets.length > 0 ? validBudgets : undefined)),
        has_fund: (isParentProject || isParentProjectCreation) ? false : (hasFund || false),
        monthly_fund_amount: (isParentProject || isParentProjectCreation) ? undefined : (hasFund ? (monthlyFundAmount || 0) : undefined)
      }
      
      // Ensure name is not empty (backend requirement - min_length=1)
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
      if (selectedImage) {
        try {
          result = await ProjectAPI.uploadProjectImage(result.id, selectedImage)
        } catch (imgErr: any) {
          // Don't fail the whole operation if image upload fails
          setError(`הפרויקט נוצר בהצלחה אך העלאת התמונה נכשלה: ${imgErr.response?.data?.detail || 'שגיאה לא ידועה'}`)
        }
      }

      // Upload contract if one was selected
      if (selectedContractFile) {
        try {
          result = await ProjectAPI.uploadProjectContract(result.id, selectedContractFile)
        } catch (contractErr: any) {
          setError(`הפרויקט נשמר אך העלאת החוזה נכשלה: ${contractErr.response?.data?.detail || contractErr.message || 'שגיאה לא ידועה'}`)
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

      // Dispatch custom event to notify other components (e.g., ProjectDetail) that project was updated
      if (editingProject) {
        window.dispatchEvent(new CustomEvent('projectUpdated', { detail: { projectId: result.id } }))
      }
      
      // Always close modal and call onSuccess, even if image upload failed
      onClose()
      resetForm()
      onSuccess(result)
    } catch (err: any) {
      console.error('Error creating/updating project:', err)
      setError(err.response?.data?.detail || err.message || 'שמירה נכשלה')
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    resetForm()
  }

  const addCategoryBudget = () => {
    if (expenseCategories.length === 0) {
      setError('אין קטגוריות זמינות. הוסף קטגוריות בהגדרות תחילה.')
      return
    }
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
          {/* Show project type info when creating new project */}
          {!parentProjectId && !editingProject && (
            <div className={`rounded-lg p-3 border ${
              selectedProjectType === 'parent' 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedProjectType === 'parent' 
                  ? 'יצירת פרויקט על - רק תאריכים נדרשים' 
                  : 'יצירת פרויקט רגיל - כל השדות זמינים'}
              </p>
            </div>
          )}

          {/* Show name field for all project types (parent, regular, subproject, editing) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                שם הפרויקט {(parentProjectId || editingProject || isRegularProjectCreation || isParentProjectCreation) ? '*' : ''}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required={!!(parentProjectId || editingProject || isRegularProjectCreation || isParentProjectCreation)}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                    nameError 
                      ? 'border-red-500 focus:ring-red-500' 
                      : nameValid === true 
                      ? 'border-green-500 focus:ring-green-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                />
                {isCheckingName && (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              {isCheckingName && formData.name.trim() && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">בודק שם...</p>
              )}
              {nameError && !isCheckingName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
              )}
              {nameValid === true && !nameError && !isCheckingName && formData.name.trim() && (
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">✓ שם זמין</p>
              )}
            </div>

            {/* Parent project selector removed - regular projects cannot become subprojects */}
            {/* Show parent project info when creating subproject */}
            {parentProjectId && !editingProject && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  פרויקט אב
                </label>
                <div className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400">
                  {availableProjects.find(p => p.id === parentProjectId)?.name || `פרויקט #${parentProjectId}`}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  תת-הפרויקט יקושר אוטומטית לפרויקט העל הזה
                </p>
              </div>
            )}
          </div>

          {/* Show description for subprojects, regular project creation, or editing non-parent projects */}
          {(parentProjectId || (editingProject && !isParentProject) || isRegularProjectCreation) && (
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
          )}

          {/* Show image upload for all project types (parent, regular, subproject, editing) */}
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

          {/* Contract upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              חוזה עם הבניין
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                onChange={handleContractChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300"
              />
              {selectedContractFile ? (
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>קובץ שנבחר: {selectedContractFile.name}</span>
                  <button
                    type="button"
                    onClick={handleClearContractSelection}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs"
                  >
                    הסר קובץ
                  </button>
                </div>
              ) : existingContractUrl ? (
                <div className="text-sm">
                  <a
                    href={existingContractUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    צפייה בחוזה שכבר שמור
                  </a>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ניתן לצרף מסמך PDF / Word או תמונת חוזה חתום.
                </p>
              )}
            </div>
          </div>

          {/* Show address and city for subprojects, regular project creation, or editing non-parent projects */}
          {(parentProjectId || (editingProject && !isParentProject) || isRegularProjectCreation) && (
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
          )}

          {/* Show budget section for subprojects, regular project creation, or editing non-parent projects */}
          {(parentProjectId || (editingProject && !isParentProject) || isRegularProjectCreation) && (
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
                  required={!!(parentProjectId || editingProject || isRegularProjectCreation)}
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
                  required={!!(parentProjectId || editingProject || isRegularProjectCreation)}
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
          )}

          {/* Dates are always shown and required for parent projects */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                תאריך התחלה {(isParentProjectCreation || isRegularProjectCreation) ? '*' : ''}
              </label>
              <input
                type="date"
                required={isParentProjectCreation || isRegularProjectCreation}
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                תאריך סיום {(isParentProjectCreation || isRegularProjectCreation) ? '*' : ''}
              </label>
              <input
                type="date"
                required={isParentProjectCreation || isRegularProjectCreation}
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Removed num_residents and monthly_price_per_apartment inputs */}

          {/* Fund Section - Only for subprojects, regular project creation, or editing non-parent projects */}
          {(parentProjectId || (editingProject && !isParentProject) || isRegularProjectCreation) && (
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
          )}

          {/* Category Budgets Section - Only for subprojects, regular project creation, or editing non-parent projects */}
          {(parentProjectId || (editingProject && !isParentProject) || isRegularProjectCreation) && (
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
                        <option value="">בחר קטגוריה</option>
                        {expenseCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      {expenseCategories.length === 0 && (
                        <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                          אין קטגוריות זמינות. הוסף קטגוריות בהגדרות תחילה.
                        </p>
                      )}
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
          )}

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
