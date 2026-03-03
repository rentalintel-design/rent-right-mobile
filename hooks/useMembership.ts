import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type Membership = {
  id: string
  user_id: string
  role: 'tenant' | 'landlord'
  city: string | null
  amount_paid: number
  purchased_at: string
  core_expires_at: string
  vault_expires_at: string
  razorpay_payment_id: string | null
}

export type MembershipState = {
  tenantMembership: Membership | null
  landlordMembership: Membership | null
  isTenantCoreActive: boolean
  isLandlordCoreActive: boolean
  isVaultActive: boolean
  canPostAsLandlord: boolean
  loading: boolean
  refresh: () => Promise<void>
}

export function useMembership(userId?: string): MembershipState {
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

  const now = new Date().toISOString()

  const tenantMembership = memberships.find(m => m.role === 'tenant') ?? null
  const landlordMembership = memberships.find(m => m.role === 'landlord') ?? null

  const isTenantCoreActive = !!tenantMembership && tenantMembership.core_expires_at > now
  const isLandlordCoreActive = !!landlordMembership && landlordMembership.core_expires_at > now
  const isVaultActive = memberships.some(m => m.vault_expires_at > now)

  const landlordMembershipCount = memberships.filter(m => m.role === 'landlord').length
  const canPostAsLandlord = landlordMembershipCount > vacancyCount

  return {
    tenantMembership,
    landlordMembership,
    isTenantCoreActive,
    isLandlordCoreActive,
    isVaultActive,
    canPostAsLandlord,
    loading,
    refresh: fetch,
  }
}
