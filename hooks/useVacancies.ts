import { useState, useEffect, useMemo, useCallback } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/lib/supabase'
import { getCached, setCache } from '@/lib/cache'

export type BhkFilter = 'All' | '1BHK' | '2BHK' | '3BHK' | '4BHK+'
export type RentFilter = 'All' | 'Under ₹20k' | '₹20-35k' | '₹35-50k' | '₹50k+'
export type SourceFilter = 'All' | 'User' | 'Reddit'
export type FurnishingFilter = 'All' | 'Furnished' | 'Semi-Furnished' | 'Unfurnished'
export type FavoritesFilter = false | true

export type Vacancy = {
  id: string
  lat: number
  lng: number
  city: string
  bhk_type: string
  asking_rent: number
  deposit: number | null
  available_from: string | null
  contact_phone: string
  notes: string | null
  society_id: string | null
  society_name: string | null
  created_at: string
  expires_at: string
  user_id: string | null
  source: string | null
  status: string | null
  photos: string[] | null
  furnishing: string | null
  property_type: string | null
  area_sqft: number | null
  parking_bike: number | null
  parking_car: number | null
  landmark: string | null
  preference: string | null
  description: string | null
  locality_name: string | null
  sublocality_name: string | null
}

type CityBounds = { latMin: number; latMax: number; lngMin: number; lngMax: number }

type Params = {
  cityName: string
  bounds: CityBounds | undefined
  bhkFilter: BhkFilter
  rentFilter: RentFilter
  sourceFilter: SourceFilter
  furnishingFilter: FurnishingFilter
  favoritesOnly?: boolean
  userId?: string
}

export function useVacancies({ cityName, bounds, bhkFilter, rentFilter, sourceFilter, furnishingFilter, favoritesOnly = false, userId }: Params) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    if (!bounds) { setVacancies([]); return }
    let cancelled = false
    const cacheKey = `vacancies_v2:${cityName}`
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

    const load = async () => {
      // Show cached data immediately
      const cached = await getCached<Vacancy[]>(cacheKey, CACHE_TTL)
      if (cached && !cancelled) {
        setVacancies(cached.data)
        if (!cached.stale && cached.data.length > 0) return // only skip network if we have real cached data
      }

      // Fetch fresh data
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('vacancies')
        .select('id, lat, lng, city, bhk_type, asking_rent, deposit, available_from, contact_phone, notes, society_id, society_name, created_at, expires_at, user_id, source, status, photos, furnishing, property_type, area_sqft, parking_bike, parking_car, landmark, preference, description, locality_name, sublocality_name')
        .eq('is_active', true)
        .gt('expires_at', now)
        .gte('lat', bounds.latMin)
        .lte('lat', bounds.latMax)
        .gte('lng', bounds.lngMin)
        .lte('lng', bounds.lngMax)
      if (cancelled) return
      if (error) { console.error('[vacancies]', error.message); return }
      if (data) {
        setVacancies(data as Vacancy[])
        setCache(cacheKey, data)
      }
    }
    load()
    return () => { cancelled = true }
  }, [cityName, refreshKey])

  // Favorites
  useEffect(() => {
    if (!userId) return
    supabase.from('favorites').select('vacancy_id').eq('user_id', userId)
      .then(({ data }) => {
        if (data) setFavoriteIds(new Set(data.map(f => f.vacancy_id as string)))
      })
  }, [userId])

  const toggleFavorite = useCallback(async (vacancyId: string) => {
    if (!userId) return
    if (favoriteIds.has(vacancyId)) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('vacancy_id', vacancyId)
      setFavoriteIds(prev => { const s = new Set(prev); s.delete(vacancyId); return s })
    } else {
      if (favoriteIds.size >= 5) {
        Alert.alert('Limit reached', 'You can save up to 5 vacancies. Remove one before adding another.')
        return
      }
      await supabase.from('favorites').insert({ user_id: userId, vacancy_id: vacancyId })
      setFavoriteIds(prev => new Set(prev).add(vacancyId))
    }
  }, [userId, favoriteIds])

  const filteredVacancies = useMemo(() => {
    return vacancies.filter(v => {
      if (bhkFilter !== 'All' && v.bhk_type !== bhkFilter) return false
      if (rentFilter !== 'All') {
        const rent = v.asking_rent
        if (rentFilter === 'Under ₹20k' && rent >= 20000) return false
        if (rentFilter === '₹20-35k' && (rent < 20000 || rent > 35000)) return false
        if (rentFilter === '₹35-50k' && (rent < 35000 || rent > 50000)) return false
        if (rentFilter === '₹50k+' && rent < 50000) return false
      }
      if (sourceFilter === 'Reddit' && v.source !== 'reddit') return false
      if (sourceFilter === 'User' && v.source === 'reddit') return false
      if (furnishingFilter !== 'All') {
        const f = v.furnishing?.toLowerCase() ?? ''
        if (furnishingFilter === 'Furnished' && f !== 'furnished') return false
        if (furnishingFilter === 'Semi-Furnished' && f !== 'semi_furnished' && f !== 'semi-furnished') return false
        if (furnishingFilter === 'Unfurnished' && f !== 'unfurnished') return false
      }
      if (favoritesOnly && !favoriteIds.has(v.id)) return false
      return true
    })
  }, [vacancies, bhkFilter, rentFilter, sourceFilter, furnishingFilter, favoritesOnly, favoriteIds])

  return { vacancies, filteredVacancies, favoriteIds, toggleFavorite, refresh }
}
