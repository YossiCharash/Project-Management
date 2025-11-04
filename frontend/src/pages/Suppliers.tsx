import { useEffect, useState, ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier, uploadSupplierDocument } from '../store/slices/suppliersSlice'
import { Eye, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Suppliers() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items, loading, error } = useAppSelector(s => s.suppliers)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [annualBudget, setAnnualBudget] = useState<number | ''>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<Record<number, boolean>>({})
  const [successMessage, setSuccessMessage] = useState<{ fileName: string; supplierId: number } | null>(null)
  const [uploadError, setUploadError] = useState<{ message: string; supplierId: number } | null>(null)
  const [uploadModal, setUploadModal] = useState<{ supplierId: number; file: File } | null>(null)
  const [documentDescription, setDocumentDescription] = useState('')

  const [editId, setEditId] = useState<number | null>(null)

  useEffect(() => { dispatch(fetchSuppliers()) }, [dispatch])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    
    if (!name || name.trim() === '') {
      setFormError('שם הספק הוא שדה חובה')
      return
    }

    setSaving(true)
    try {
      const result = await dispatch(createSupplier({ name: name.trim(), contact_email: email.trim() || undefined, phone: phone.trim() || undefined, annual_budget: annualBudget === '' ? undefined : Number(annualBudget) }))
      if (createSupplier.rejected.match(result)) {
        setFormError(result.payload as string || 'שגיאה ביצירת ספק')
      } else {
        setName(''); setEmail(''); setPhone(''); setAnnualBudget('')
        setFormError(null)
      }
    } catch (err: any) {
      setFormError(err.message || 'שגיאה ביצירת ספק')
    } finally {
      setSaving(false)
    }
  }

  const onUpdate = async (id: number) => {
    await dispatch(updateSupplier({ id, changes: { name, contact_email: email || undefined, phone: phone || undefined, annual_budget: annualBudget === '' ? undefined : Number(annualBudget) } }))
    setEditId(null); setName(''); setEmail(''); setPhone(''); setAnnualBudget('')
  }

  const onDelete = async (id: number) => {
    if (confirm('למחוק ספק לצמיתות?')) await dispatch(deleteSupplier(id))
  }

  const onFileSelect = (id: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadModal({ supplierId: id, file })
    setDocumentDescription('')
    e.target.value = ''
  }

  const handleUploadConfirm = async () => {
    if (!uploadModal) return
    
    const { supplierId, file } = uploadModal
    setUploadModal(null)
    setUploading(prev => ({ ...prev, [supplierId]: true }))
    setUploadError(null)
    
    try {
      const result = await dispatch(uploadSupplierDocument({ 
        id: supplierId, 
        file,
        description: documentDescription.trim() || undefined
      }))
      if (uploadSupplierDocument.fulfilled.match(result)) {
        setSuccessMessage({ fileName: file.name, supplierId })
        setTimeout(() => setSuccessMessage(null), 5000)
        // Refresh suppliers to update the list
        await dispatch(fetchSuppliers())
      } else if (uploadSupplierDocument.rejected.match(result)) {
        setUploadError({ 
          message: result.payload as string || 'שגיאה בהעלאת הקובץ', 
          supplierId 
        })
        setTimeout(() => setUploadError(null), 5000)
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      setUploadError({ 
        message: err.message || 'שגיאה בהעלאת הקובץ', 
        supplierId 
      })
      setTimeout(() => setUploadError(null), 5000)
    } finally {
      setUploading(prev => ({ ...prev, [supplierId]: false }))
      setDocumentDescription('')
    }
  }

  const handleUploadCancel = () => {
    setUploadModal(null)
    setDocumentDescription('')
  }

  const startEdit = (id: number) => {
    const s = items.find(x=>x.id===id)
    if (!s) return
    setEditId(id)
    setName(s.name)
    setEmail(s.contact_email ?? '')
    setPhone(s.phone ?? '')
    setAnnualBudget(s.annual_budget ?? '')
  }

  return (
    <div className="space-y-4 relative">
      {/* Success Toast Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-4 left-1/2 z-50 transform -translate-x-1/2"
          >
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[300px] max-w-md">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-green-800 dark:text-green-200 font-semibold">הקובץ הועלה בהצלחה!</p>
                <p className="text-green-700 dark:text-green-300 text-sm truncate">{successMessage.fileName}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast Notification */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-20 left-1/2 z-50 transform -translate-x-1/2"
          >
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[300px] max-w-md">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 dark:text-red-200 font-semibold">שגיאה בהעלאת הקובץ</p>
                <p className="text-red-700 dark:text-red-300 text-sm">{uploadError.message}</p>
              </div>
              <button
                onClick={() => setUploadError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">ספקים</h1>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">הוספת ספק</h2>
        <form onSubmit={onCreate} className="grid md:grid-cols-4 gap-2">
          <input 
            className="border rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" 
            placeholder="שם *" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            required
            minLength={1}
          />
          <input 
            className="border rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" 
            placeholder="אימייל" 
            type="email"
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
          />
          <input 
            className="border rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" 
            placeholder="טלפון" 
            value={phone} 
            onChange={e=>setPhone(e.target.value)} 
          />
          <input 
            className="border rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" 
            placeholder="תקציב שנתי" 
            type="number" 
            step="0.01"
            min="0"
            value={annualBudget} 
            onChange={e=>setAnnualBudget(e.target.value === '' ? '' : Number(e.target.value))} 
          />
          {formError && (
            <div className="md:col-span-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-2 rounded">
              {formError}
            </div>
          )}
          <div className="md:col-span-4 flex justify-end">
            <button 
              type="submit"
              disabled={saving}
              className="bg-gray-900 dark:bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'שומר...' : 'הוסף ספק'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">רשימת ספקים</h2>
        {loading ? 'טוען...' : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-left">
                <th className="p-2 text-gray-900 dark:text-white">שם</th>
                <th className="p-2 text-gray-900 dark:text-white">אימייל</th>
                <th className="p-2 text-gray-900 dark:text-white">טלפון</th>
                <th className="p-2 text-gray-900 dark:text-white">תקציב שנתי</th>
                <th className="p-2 text-gray-900 dark:text-white">מסמכים</th>
                <th className="p-2 text-gray-900 dark:text-white"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-2 text-gray-900 dark:text-white">{editId===s.id ? <input className="border p-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={name} onChange={e=>setName(e.target.value)} /> : s.name}</td>
                  <td className="p-2 text-gray-900 dark:text-white">{editId===s.id ? <input className="border p-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={email} onChange={e=>setEmail(e.target.value)} /> : (s.contact_email ?? '')}</td>
                  <td className="p-2 text-gray-900 dark:text-white">{editId===s.id ? <input className="border p-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={phone} onChange={e=>setPhone(e.target.value)} /> : (s.phone ?? '')}</td>
                  <td className="p-2 text-gray-900 dark:text-white">{editId===s.id ? <input className="border p-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" type="number" value={annualBudget} onChange={e=>setAnnualBudget(e.target.value === '' ? '' : Number(e.target.value))} /> : (s.annual_budget ?? '')}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/suppliers/${s.id}/documents`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        צפה במסמכים
                      </button>
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-sm font-medium cursor-pointer">
                        {uploading[s.id] ? (
                          <>
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                            מעלה...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            העלה מסמך
                          </>
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={(e)=>onFileSelect(s.id, e)}
                          disabled={uploading[s.id]}
                        />
                      </label>
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    {editId===s.id ? (
                      <>
                        <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={()=>onUpdate(s.id)}>שמור</button>
                        <button className="ml-2 px-2 py-1 bg-gray-200 rounded" onClick={()=>setEditId(null)}>בטל</button>
                      </>
                    ) : (
                      <>
                        <button className="px-2 py-1 bg-yellow-500 text-white rounded" onClick={()=>startEdit(s.id)}>ערוך</button>
                        <button className="ml-2 px-2 py-1 bg-red-600 text-white rounded" onClick={()=>onDelete(s.id)}>מחק</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </div>

      {/* Upload Document Modal */}
      <AnimatePresence>
        {uploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={handleUploadCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  העלאת מסמך
                </h3>
                <button
                  onClick={handleUploadCancel}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">קובץ נבחר:</p>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                      {uploadModal.file.name}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    תיאור המסמך (אופציונלי)
                  </label>
                  <input
                    type="text"
                    value={documentDescription}
                    onChange={(e) => setDocumentDescription(e.target.value)}
                    placeholder="הזן תיאור למסמך..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUploadConfirm()
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    התיאור יוצג במקום שם הקובץ
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={handleUploadCancel}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleUploadConfirm}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    העלה
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
