import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  computeMembershipState,
  type Membership,
  type MembershipState,
} from 'rent-right-shared'

export type { Membership, MembershipState }

export type UseMembershipResult = MembershipState & {
  loading: boolean
  refresh: () => Promise<void>
}

export function useMembership(userId?: string): UseMembershipResult {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [vacancyCount, setVacancyCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const [{ data: mData }, { count }] = await Promise.all([
      supabase
        .from('memberships')
        .select('*')
        .eq('user_id', userId)
        .order('purchased_at', { ascending: false }),
      supabase
        .from('vacancies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('status', 'draft'),
    ])
    if (mData) setMemberships(mData as Membership[])
    setVacancyCount(count ?? 0)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const state = computeMembershipState(memberships, vacancyCount)

  return {
    ...state,
    loading,
    refresh: fetch,
  }
}
