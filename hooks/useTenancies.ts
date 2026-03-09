import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchMyTenancies, type Tenancy } from 'rent-right-shared'

export function useTenancies(userId: string | undefined) {
  const [tenancies, setTenancies] = useState<Tenancy[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const result = await fetchMyTenancies(supabase as any, userId)
    if (result.data) setTenancies(result.data)
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  return { tenancies, loading, refresh }
}
