import React, { useState, useEffect } from 'react'
import { Project, ProjectCreate } from '../types/api'
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
      address: '',
      city: '',
      relation_project: parentProjectId || undefined,
      manager_id: undefined
    })
    setError(null)
    setSelectedImage(null)
    setImagePreview(null)
    setBudgetInputType('monthly')
  }

  const getImageUrl = (imageUrl: string): string => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
    const baseUrl = apiUrl.replace('/api/v1', '')
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
      const projectData = {
        ...formData,
        description: formData.description || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        relation_project: formData.relation_project || undefined,
        manager_id: formData.manager_id || undefined
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
          console.error('Failed to upload image:', imgErr)
          // Don't fail the whole operation if image upload fails
          imageUploadError = true
          setError(`הפרויקט נוצר בהצלחה אך העלאת התמונה נכשלה: ${imgErr.response?.data?.detail || 'שגיאה לא ידועה'}`)
        }
      }

      onSuccess(result)
      // Only close if there was no image upload error
      if (!imageUploadError) {
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
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תמונת הפרויקט
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="תצוגה מקדימה"
                    className="max-w-full h-48 object-cover rounded-md border border-gray-300"
                  />
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null)
                        setImagePreview(editingProject?.image_url ? getImageUrl(editingProject.image_url) : null)
                      }}
                      className="mt-2 text-sm text-red-600 hover:text-red-700"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                כתובת
              </label>
              <input
                type="text"
                value={formData.address || ''}
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
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                סוג הקלט לתקציב
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="monthly"
                    checked={budgetInputType === 'monthly'}
                    onChange={(e) => setBudgetInputType(e.target.value as 'monthly' | 'yearly')}
                    className="ml-2"
                  />
                  <span className="text-sm text-gray-700">חודשי</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="yearly"
                    checked={budgetInputType === 'yearly'}
                    onChange={(e) => setBudgetInputType(e.target.value as 'monthly' | 'yearly')}
                    className="ml-2"
                  />
                  <span className="text-sm text-gray-700">שנתי</span>
                </label>
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
                  onChange={(e) => {
                    const monthlyValue = parseFloat(e.target.value) || 0
                    setFormData({
                      ...formData,
                      budget_monthly: monthlyValue,
                      budget_annual: monthlyValue * 12
                    })
                  }}
                  disabled={budgetInputType === 'yearly'}
                  className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    budgetInputType === 'yearly' ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
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
                  onChange={(e) => {
                    const yearlyValue = parseFloat(e.target.value) || 0
                    setFormData({
                      ...formData,
                      budget_annual: yearlyValue,
                      budget_monthly: yearlyValue / 12
                    })
                  }}
                  disabled={budgetInputType === 'monthly'}
                  className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    budgetInputType === 'monthly' ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך התחלה
              </label>
              <input
                type="date"
                value={formData.start_date || ''}
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
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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
