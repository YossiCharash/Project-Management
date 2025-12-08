import React, { useState, useEffect } from 'react'
import { RecurringTransactionTemplate, RecurringTransactionTemplateUpdate } from '../types/api'
import { RecurringTransactionAPI, CategoryAPI } from '../lib/apiClient'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchSuppliers } from '../store/slices/suppliersSlice'

interface EditRecurringTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  template: RecurringTransactionTemplate | null
}

const EditRecurringTemplateModal: React.FC<EditRecurringTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  template
}) => {
  const dispatch = useAppDispatch()
  const { items: suppliers } = useAppSelector(s => s.suppliers)
  
  const [formData, setFormData] = useState<RecurringTransactionTemplateUpdate>({
    description: '',
    amount: 0,
    category: '',
    notes: '',
    supplier_id: null,
    day_of_month: 1,
    start_date: '',
    end_type: 'No End',
    end_date: null,
    max_occurrences: null
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchSuppliers())
      loadCategories()
    }
    if (template && isOpen) {
      setFormData({
        description: template.description,
        amount: template.amount,
        category: template.category || '',
        notes: template.notes || '',
        supplier_id: template.supplier_id || null,
        day_of_month: template.day_of_month,
        start_date: template.start_date,
        end_type: template.end_type,
        end_date: template.end_date || null,
        max_occurrences: template.max_occurrences || null
      })
    }
  }, [template, isOpen, dispatch])

  const resetForm = () => {
    setFormData({
      description: '',
      amount: 0,
      category: '',
      notes: '',
      supplier_id: null,
      day_of_month: 1,
      start_date: '',
      end_type: 'No End',
      end_date: null,
      max_occurrences: null
    })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return

    setLoading(true)
    setError(null)

    try {
      const updateData = {
        ...formData,
        description: formData.description || undefined,
        category: formData.category || undefined,
        notes: formData.notes || undefined,
        end_date: formData.end_type === 'On Date' ? formData.end_date : null,
        max_occurrences: formData.end_type === 'After Occurrences' ? formData.max_occurrences : null
      }

      await RecurringTransactionAPI.updateTemplate(template.id, updateData)
      onSuccess()
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

  if (!isOpen || !template) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            עריכת תבנית עסקה חוזרת
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              שינויים יוחלו על עסקאות עתידיות שייווצרו מתבנית זו. עסקאות שכבר נוצרו לא ישתנו.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                תיאור *
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                סכום קבוע *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              קטגוריה
            </label>
            <select
              value={formData.category}
              onChange={(e) => {
                const newCategory = e.target.value
                const candidates = suppliers.filter(
                  s => s.is_active && s.category === newCategory
                )
                setFormData({
                  ...formData,
                  category: newCategory,
                  // auto-select only supplier if exactly one exists
                  supplier_id:
                    newCategory && candidates.length === 1 ? candidates[0].id : null,
                })
              }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">בחר קטגוריה</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ספק *
            </label>
            <select
              required
              value={formData.supplier_id || 0}
              onChange={(e) => setFormData({ ...formData, supplier_id: parseInt(e.target.value) || null })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="0">
                {formData.category ? 'בחר ספק' : 'בחר קודם קטגוריה'}
              </option>
              {suppliers
                .filter(
                  s =>
                    s.is_active &&
                    !!formData.category &&
                    s.category === formData.category
                )
                .map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              הערות
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="הערות נוספות"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              הגדרות חוזרות
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  יום בחודש לביצוע *
                </label>
                <select
                  required
                  value={formData.day_of_month}
                  onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  תאריך התחלה חדש (תאריך אפקטיבי) *
                </label>
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                סיום
              </label>
              <select
                value={formData.end_type}
                onChange={(e) => setFormData({ ...formData, end_type: e.target.value as any })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="No End">ללא סיום</option>
                <option value="After Occurrences">לאחר מספר הופעות</option>
                <option value="On Date">בתאריך מסוים</option>
              </select>
            </div>

            {formData.end_type === 'After Occurrences' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  מספר הופעות
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_occurrences || ''}
                  onChange={(e) => setFormData({ ...formData, max_occurrences: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}

            {formData.end_type === 'On Date' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  תאריך סיום
                </label>
                <input
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}
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
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'שומר...' : 'שמור שינויים'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditRecurringTemplateModal
