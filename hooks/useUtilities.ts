import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchUtilityAccounts,
  fetchUtilityBills,
  type UtilityAccount,
  type UtilityBill,
} from 'rent-right-shared'

export function useUtilities(tenancyId: string | undefined) {
  const [accounts, setAccounts] = useState<UtilityAccount[]>([])
  const [bills, setBills] = useState<UtilityBill[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!tenancyId) return
    setLoading(true)

    const [acctResult, billResult] = await Promise.all([
      fetchUtilityAccounts(supabase as any, tenancyId),
      fetchUtilityBills(supabase as any, tenancyId),
    ])

    if (acctResult.data) setAccounts(acctResult.data)
    if (billResult.data) setBills(billResult.data)
    setLoading(false)
  }, [tenancyId])

  useEffect(() => { refresh() }, [refresh])

  return { accounts, bills, loading, refresh }
}
