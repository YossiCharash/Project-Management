import React, { useEffect, useState } from 'react'
import { useAppSelector } from '../utils/hooks'
import api from '../lib/api'
import { 
  Plus, 
  Copy, 
  Trash2, 
  Edit,
  Key,
  Users,
  Calendar,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { motion } from 'framer-motion'

interface GroupCode {
  id: number
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export default function GroupCodeManagement() {
  const { me } = useAppSelector(s => s.auth)
  const [groupCodes, setGroupCodes] = useState<GroupCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupCode, setNewGroupCode] = useState({
    name: '',
    description: ''
  })

  // Check if user is admin
  if (me?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">גישה נדחית</h1>
          <p className="text-gray-600 dark:text-gray-400">רק מנהלי מערכת יכולים לגשת לעמוד זה</p>
        </div>
      </div>
    )
  }

  const fetchGroupCodes = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/group-codes/')
      setGroupCodes(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createGroupCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/group-codes/', newGroupCode)
      setShowCreateModal(false)
      setNewGroupCode({ name: '', description: '' })
      fetchGroupCodes()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyGroupCode = (code: string) => {
    navigator.clipboard.writeText(code)
    // You could add a toast notification here
  }

  const deleteGroupCode = async (groupCodeId: number) => {
    if (!confirm('האם אתם בטוחים שברצונכם למחוק את קוד הקבוצה?')) {
      return
    }

    try {
      await api.delete(`/group-codes/${groupCodeId}`)
      fetchGroupCodes()
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    fetchGroupCodes()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ניהול קודי קבוצה</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">יצירה וניהול קודי קבוצה למשתמשים חדשים</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              צור קוד קבוצה
            </button>
          </div>

          {/* Group Codes List */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">קוד קבוצה</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">שם הקבוצה</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">תיאור</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">סטטוס</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">תאריך יצירה</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      טוען קודי קבוצה...
                    </td>
                  </tr>
                ) : groupCodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      אין קודי קבוצה במערכת
                    </td>
                  </tr>
                ) : (
                  groupCodes.map((groupCode) => (
                    <tr key={groupCode.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono">
                            {groupCode.code}
                          </code>
                          <button
                            onClick={() => copyGroupCode(groupCode.code)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            title="העתק קוד"
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{groupCode.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{groupCode.description || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          groupCode.is_active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {groupCode.is_active ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(groupCode.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteGroupCode(groupCode.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            מחק
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Create Group Code Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">צור קוד קבוצה</h2>
              <form onSubmit={createGroupCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">שם הקבוצה</label>
                  <input
                    type="text"
                    value={newGroupCode.name}
                    onChange={(e) => setNewGroupCode({...newGroupCode, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">תיאור (אופציונלי)</label>
                  <textarea
                    value={newGroupCode.description}
                    onChange={(e) => setNewGroupCode({...newGroupCode, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    disabled={loading}
                  >
                    {loading ? 'יוצר...' : 'צור קוד'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
