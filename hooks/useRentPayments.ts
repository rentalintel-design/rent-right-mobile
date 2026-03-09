import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ensureCurrentMonthPayment,
  checkAndMarkOverdue,
  fetchPaymentHistory,
  type RentPayment,
} from 'rent-right-shared'

export function useRentPayments(tenancyId: string | undefined, monthlyRent: number) {
  const [currentPayment, setCurrentPayment] = useState<RentPayment | null>(null)
  const [history, setHistory] = useState<RentPayment[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!tenancyId) return
    setLoading(true)

    // Auto-mark overdue if needed
    await checkAndMarkOverdue(supabase as any, tenancyId)

    // Ensure current month payment row exists
    const currentResult = await ensureCurrentMonthPayment(supabase as any, tenancyId, monthlyRent)
    if (currentResult.data) setCurrentPayment(currentResult.data)

    // Fetch history
    const historyResult = await fetchPaymentHistory(supabase as any, tenancyId, 6)
    if (historyResult.data) setHistory(historyResult.data)

    setLoading(false)
  }, [tenancyId, monthlyRent])

  useEffect(() => { refresh() }, [refresh])

  return { currentPayment, history, loading, refresh }
}
