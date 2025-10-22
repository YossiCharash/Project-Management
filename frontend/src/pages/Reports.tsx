import { useEffect, useState } from 'react'
import api from '../lib/api'
import IncomeExpensePie from '../components/charts/IncomeExpensePie'

interface Report { income: number; expenses: number; profit: number; budget_monthly: number; budget_annual: number }

export default function Reports() {
  const [projectId, setProjectId] = useState('1')
  const [data, setData] = useState<Report | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data } = await api.get(`/reports/project/${projectId}`)
      setData(data)
    }
    run()
  }, [projectId])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">דוחות</h1>
      <div className="flex gap-2 items-center">
        <label>מזהה פרויקט</label>
        <input className="border p-1 rounded w-24" value={projectId} onChange={e=>setProjectId(e.target.value)} />
      </div>
      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-2">הכנסות מול הוצאות</h2>
            <IncomeExpensePie income={data.income} expenses={data.expenses} />
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-2">סיכום</h2>
            <ul className="space-y-1 text-sm">
              <li><b>הכנסות:</b> <span className="text-[var(--green)]">{data.income.toFixed(2)}</span></li>
              <li><b>הוצאות:</b> <span className="text-[var(--red)]">{data.expenses.toFixed(2)}</span></li>
              <li><b>רווח:</b> {(data.profit).toFixed(2)}</li>
              <li><b>תקציב חודשי:</b> {data.budget_monthly.toFixed(2)}</li>
              <li><b>תקציב שנתי:</b> {data.budget_annual.toFixed(2)}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
