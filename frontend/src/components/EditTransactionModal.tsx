import React, { useState, useEffect } from 'react'
import { CategoryAPI } from '../lib/apiClient'
import { Transaction, TransactionCreate } from '../types/api'
import { TransactionAPI } from '../lib/apiClient'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { fetchSuppliers } from '../store/slices/suppliersSlice'

interface EditTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  transaction: Transaction | null
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  transaction
}) => {
  const dispatch = useAppDispatch()
  const { items: suppliers } = useAppSelector(s => s.suppliers)
  const [formData, setFormData] = useState<Partial<TransactionCreate>>({
    tx_date: '',
    type: 'Expense',
    amount: 0,
    description: '',
    category: '',
    payment_method: '',
    notes: '',
    is_exceptional: false,
    supplier_id: undefined
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchSuppliers())
      loadCategories()
    }
  }, [isOpen, dispatch])

  const loadCategories = async () => {
    try {
      const categories = await CategoryAPI.getCategories()
      const categoryNames = categories.filter(cat => cat.is_active).map(cat => cat.name)
      setAvailableCategories(categoryNames)
    } catch (err) {
      console.error('Error loading categories:', err)
      setAvailableCategories([])
    }
  }

  useEffect(() => {
    if (transaction && isOpen) {
      setFormData({
        tx_date: transaction.tx_date,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description || '',
        category: transaction.category || '',
        payment_method: transaction.payment_method || '',
        notes: transaction.notes || '',
        is_exceptional: transaction.is_exceptional || false,
        supplier_id: (transaction as any).supplier_id || undefined
      })
    }
  }, [transaction, isOpen])

  const resetForm = () => {
    setFormData({
      tx_date: '',
      type: 'Expense',
      amount: 0,
      description: '',
      category: '',
      payment_method: '',
      notes: '',
      is_exceptional: false,
      supplier_id: undefined
    })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction) return

    if (!formData.tx_date || !formData.amount || formData.amount <= 0) {
      setError('יש למלא תאריך וסכום חיובי')
      return
    }

    if (!formData.supplier_id || formData.supplier_id === 0) {
      setError('יש לבחור ספק (חובה)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const updateData: Partial<TransactionCreate> = {
        tx_date: formData.tx_date!,
        type: formData.type!,
        amount: formData.amount!,
        description: formData.description || undefined,
        category: formData.category || undefined,
        payment_method: formData.payment_method || undefined,
        notes: formData.notes || undefined,
        is_exceptional: formData.is_exceptional,
        supplier_id: formData.supplier_id!
      }

      await TransactionAPI.updateTransaction(transaction.id, updateData)
      onSuccess()
      onClose()
      resetForm()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'שמירה נכשלה')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!transaction) return

    if (!confirm('האם אתה בטוח שברצונך למחוק את העסקה הזו?')) {
      return
    }

    try {
      await TransactionAPI.deleteTransaction(transaction.id)
      onSuccess()
      onClose()
      resetForm()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'מחיקה נכשלה')
    }
  }

  const handleClose = () => {
    onClose()
    resetForm()
  }

  if (!isOpen || !transaction) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            עריכת עסקה
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                סוג *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Income' | 'Expense' })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="Expense">הוצאה</option>
                <option value="Income">הכנסה</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                תאריך *
              </label>
              <input
                type="date"
                required
                value={formData.tx_date}
                onChange={(e) => setFormData({ ...formData, tx_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                סכום *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                קטגוריה
              </label>
              <select
                value={formData.category || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value || '',
                    // reset or auto-select supplier when category changes
                    supplier_id: (() => {
                      const newCategory = e.target.value || ''
                      if (!newCategory) return undefined
                      const candidates = suppliers.filter(
                        s => s.is_active && s.category === newCategory
                      )
                      return candidates.length === 1 ? candidates[0].id : undefined
                    })(),
                  })
                }
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
                אמצעי תשלום
              </label>
              <select
                value={formData.payment_method || ''}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value || '' })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">בחר אמצעי תשלום</option>
                <option value="הוראת קבע">הוראת קבע</option>
                <option value="אשראי">אשראי</option>
                <option value="שיק">שיק</option>
                <option value="מזומן">מזומן</option>
                <option value="העברה בנקאית">העברה בנקאית</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ספק * <span className="text-red-500">(חובה)</span>
              </label>
              <select
                required
                value={formData.supplier_id || ''}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תיאור
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              הערות
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="exceptional"
              type="checkbox"
              checked={formData.is_exceptional || false}
              onChange={(e) => setFormData({ ...formData, is_exceptional: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="exceptional" className="text-sm text-gray-700 dark:text-gray-300">
              הוצאה חריגה
            </label>
          </div>

          {transaction.is_generated && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md p-3">
              <p className="text-purple-800 dark:text-purple-200 text-sm">
                ⚠️ זו עסקה שנוצרה אוטומטית מעסקה מחזורית. שינויים כאן יחולו רק על העסקה הספציפית הזו.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              מחק
            </button>
            
            <div className="flex gap-3">
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
                {loading ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTransactionModal

