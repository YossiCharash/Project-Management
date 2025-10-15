import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../lib/api'

interface Transaction { id: number; type: 'Income'|'Expense'; amount: number; description?: string|null }

export default function ProjectDetail() {
  const { id } = useParams()
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/transactions/project/${id}`)
        setTxs(data)
      } finally { setLoading(false) }
    }
    run()
  }, [id])

  const income = txs.filter(t=>t.type==='Income').reduce((s,t)=>s + Number(t.amount), 0)
  const expense = txs.filter(t=>t.type==='Expense').reduce((s,t)=>s + Number(t.amount), 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Project #{id}</h1>
      {loading ? 'Loading...' : (
        <div className="bg-white rounded shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">Type</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {txs.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.type}</td>
                  <td className={`p-2 ${t.type==='Income' ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>{Number(t.amount).toFixed(2)}</td>
                  <td className="p-2">{t.description ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-6">
        <div className="text-[var(--green)]">Income: {income.toFixed(2)}</div>
        <div className="text-[var(--red)]">Expenses: {expense.toFixed(2)}</div>
        <div className={`${income-expense<0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>Profit: {(income-expense).toFixed(2)}</div>
      </div>
    </div>
  )
}
