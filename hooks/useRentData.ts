import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { LocalityRow } from '@/lib/rentGrid'
import type { LocalityRentStats, StreetGridStats } from 'rent-right-shared'

export type { LocalityRentStats, StreetGridStats }

type CityBounds = { latMin: number; latMax: number; lngMin: number; lngMax: number }

export function useRentData(cityName: string, _bounds: CityBounds | undefined) {
  const [localities, setLocalities] = useState<LocalityRow[]>([])
  const [localityStats, setLocalityStats] = useState<LocalityRentStats[]>([])
  const [streetGridStats, setStreetGridStats] = useState<StreetGridStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cityName) return
    setLoading(true)

    // Fetch locality polygon geometry
    supabase
      .from('localities')
      .select('name, lat, lng, level, polygon')
      .eq('city', cityName)
      .lte('level', 2)
      .then(({ data }) => {
        if (data) setLocalities(data.map((d: any) => ({
          ...d,
          polygon: d.polygon ?? undefined,
        })) as LocalityRow[])
      })

    // Fetch pre-computed locality rent stats
    supabase
      .from('locality_rent_stats')
      .select('*')
      .eq('city', cityName)
      .then(({ data }) => {
        if (data) setLocalityStats(data as LocalityRentStats[])
      })

    // Fetch pre-computed 250m street grid stats
    supabase
      .from('street_grid_stats')
      .select('grid_lat, grid_lng, city, norm_rent, submission_count, rent_ratio, baseline_rent')
      .eq('city', cityName)
      .then(({ data }) => {
        if (data) setStreetGridStats(data as StreetGridStats[])
        setLoading(false)
      })
  }, [cityName])

  return { localities, localityStats, streetGridStats, loading }
}
