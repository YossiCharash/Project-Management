import { useEffect, useState, ChangeEvent, FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../utils/hooks'
import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier, uploadSupplierDocument } from '../store/slices/suppliersSlice'

export default function Suppliers() {
  const dispatch = useAppDispatch()
  const { items, loading, error } = useAppSelector(s => s.suppliers)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [annualBudget, setAnnualBudget] = useState<number | ''>('')

  const [editId, setEditId] = useState<number | null>(null)

  useEffect(() => { dispatch(fetchSuppliers()) }, [dispatch])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    await dispatch(createSupplier({ name, contact_email: email || undefined, phone: phone || undefined, annual_budget: annualBudget === '' ? undefined : Number(annualBudget) }))
    setName(''); setEmail(''); setPhone(''); setAnnualBudget('')
  }

  const onUpdate = async (id: number) => {
    await dispatch(updateSupplier({ id, changes: { name, contact_email: email || undefined, phone: phone || undefined, annual_budget: annualBudget === '' ? undefined : Number(annualBudget) } }))
    setEditId(null); setName(''); setEmail(''); setPhone(''); setAnnualBudget('')
  }

  const onDelete = async (id: number) => {
    if (confirm('למחוק ספק לצמיתות?')) await dispatch(deleteSupplier(id))
  }

  const onUpload = async (id: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await dispatch(uploadSupplierDocument({ id, file }))
    e.target.value = ''
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">ספקים</h1>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">הוספת ספק</h2>
        <form onSubmit={onCreate} className="grid md:grid-cols-4 gap-2">
          <input className="border rounded p-2" placeholder="שם" value={name} onChange={e=>setName(e.target.value)} />
          <input className="border rounded p-2" placeholder="אימייל" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="border rounded p-2" placeholder="טלפון" value={phone} onChange={e=>setPhone(e.target.value)} />
          <input className="border rounded p-2" placeholder="תקציב שנתי" type="number" value={annualBudget} onChange={e=>setAnnualBudget(e.target.value === '' ? '' : Number(e.target.value))} />
          <div className="md:col-span-4 flex justify-end">
            <button className="bg-gray-900 text-white px-4 py-2 rounded">הוסף ספק</button>
          </div>
        </form>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">רשימת ספקים</h2>
        {loading ? 'טוען...' : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">שם</th>
                <th className="p-2">אימייל</th>
                <th className="p-2">טלפון</th>
                <th className="p-2">תקציב שנתי</th>
                <th className="p-2">מסמכים</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{editId===s.id ? <input className="border p-1" value={name} onChange={e=>setName(e.target.value)} /> : s.name}</td>
                  <td className="p-2">{editId===s.id ? <input className="border p-1" value={email} onChange={e=>setEmail(e.target.value)} /> : (s.contact_email ?? '')}</td>
                  <td className="p-2">{editId===s.id ? <input className="border p-1" value={phone} onChange={e=>setPhone(e.target.value)} /> : (s.phone ?? '')}</td>
                  <td className="p-2">{editId===s.id ? <input className="border p-1" type="number" value={annualBudget} onChange={e=>setAnnualBudget(e.target.value === '' ? '' : Number(e.target.value))} /> : (s.annual_budget ?? '')}</td>
                  <td className="p-2">
                    <label className="cursor-pointer text-blue-600">
                      העלה מסמך
                      <input type="file" className="hidden" onChange={(e)=>onUpload(s.id, e)} />
                    </label>
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
    </div>
  )
}
