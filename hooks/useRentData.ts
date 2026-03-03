import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { BHK_DIVISOR } from 'rent-right-shared'
import { median } from '@/lib/mapUtils'
import type { RentCell, LocalityRow } from '@/lib/rentGrid'

type CityBounds = { latMin: number; latMax: number; lngMin: number; lngMax: number }

export function useRentData(cityName: string, bounds: CityBounds | undefined) {
  const [rentCells, setRentCells] = useState<RentCell[]>([])
  const [localities, setLocalities] = useState<LocalityRow[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch localities
  useEffect(() => {
    if (!cityName) return
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
  }, [cityName])

  // Fetch rent submissions grouped by property
  useEffect(() => {
    if (!bounds) { setLoading(false); return }
    let cancelled = false
    setLoading(true)

    const fetchRentData = async () => {
      // Fetch properties with their rent submissions
      const { data: properties } = await supabase
        .from('properties')
        .select('id, lat, lng')
        .gte('lat', bounds.latMin)
        .lte('lat', bounds.latMax)
        .gte('lng', bounds.lngMin)
        .lte('lng', bounds.lngMax)

      if (cancelled || !properties) { setLoading(false); return }

      const propertyIds = properties.map(p => p.id)
      if (propertyIds.length === 0) { setRentCells([]); setLoading(false); return }

      // Fetch rent submissions for these properties (batch if needed)
      const batchSize = 200
      const allSubmissions: Array<{ property_id: string; bhk_type: string; rent_amount: number; submitted_at: string }> = []

      for (let i = 0; i < propertyIds.length; i += batchSize) {
        const batch = propertyIds.slice(i, i + batchSize)
        const { data } = await supabase
          .from('rent_submissions')
          .select('property_id, bhk_type, rent_amount, submitted_at')
          .in('property_id', batch)
        if (data) allSubmissions.push(...(data as typeof allSubmissions))
      }

      if (cancelled) return

      // Group by property
      const byProperty = new Map<string, typeof allSubmissions>()
      for (const s of allSubmissions) {
        if (!byProperty.has(s.property_id)) byProperty.set(s.property_id, [])
        byProperty.get(s.property_id)!.push(s)
      }

      const propertyMap = new Map(properties.map(p => [p.id, p]))
      const cells: RentCell[] = []

      for (const [propId, subs] of byProperty) {
        const prop = propertyMap.get(propId)
        if (!prop) continue
        const sorted = subs.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        cells.push({
          propertyId: propId,
          lat: prop.lat,
          lng: prop.lng,
          count: subs.length,
          lastRent: sorted[0].rent_amount,
          lastBhk: sorted[0].bhk_type,
          allSubmissions: subs,
        })
      }

      setRentCells(cells)
      setLoading(false)
    }

    fetchRentData()
    return () => { cancelled = true }
  }, [cityName])

  // Compute baseline rent: median of recent 10% normalized submissions
  const baselineRent = useMemo(() => {
    const all = rentCells.flatMap(rc => rc.allSubmissions)
    if (all.length === 0) return 25000
    const sorted = all.slice().sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    )
    const recent = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.1)))
    const normed = recent.map(s => s.rent_amount / (BHK_DIVISOR[s.bhk_type] ?? 1.0))
    normed.sort((a, b) => a - b)
    return normed[Math.floor(normed.length / 2)]
  }, [rentCells])

  return { rentCells, localities, baselineRent, loading }
}
