/**
 * Single source of truth for tenant-visible vacancy filtering.
 *
 * A vacancy is visible to tenants iff:
 *   - is_active = true
 *   - status = 'active'  (not booked / rented_out / draft)
 *   - expires_at is in the future
 *
 * Use this predicate for any client-side guard. The Supabase query in
 * useVacancies.ts enforces the same conditions at the DB level.
 */
export function isVisibleToTenants(v: {
  is_active?: boolean
  status?: string | null
  expires_at?: string | null
}): boolean {
  if (!v.is_active) return false
  if (v.status && v.status !== 'active') return false
  if (v.expires_at && new Date(v.expires_at) <= new Date()) return false
  return true
}
