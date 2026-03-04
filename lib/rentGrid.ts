// Rent grid builders — matches web app architecture
import { CITY_BOUNDS, GRID_STEP_250 } from 'rent-right-shared'
import type { LocalityRentStats, StreetGridStats } from 'rent-right-shared'
import { pointInPolygon } from './mapUtils'

export type RentCell = {
  propertyId: string
  lat: number
  lng: number
  count: number
  lastRent: number
  lastBhk: string
  allSubmissions: Array<{ bhk_type: string; rent_amount: number; submitted_at: string }>
}

export type LocalityRow = {
  name: string
  lat: number
  lng: number
  level: number
  polygon?: [number, number][]
}

export type RentFeature = {
  coordinates: { latitude: number; longitude: number }[]
  hasData: boolean
  count: number
  normRent: number
  rentRatio: number
  isLocality: boolean
  norm1: number
  norm2: number
  norm3: number
  norm4: number
  centroid: { latitude: number; longitude: number }
}

/** Build locality-level rent polygons from pre-computed server-side stats.
 *  Joins locality polygon geometry with locality_rent_stats by name.
 */
export function buildLocalityRentFromStats(
  locs: LocalityRow[],
  stats: LocalityRentStats[],
): RentFeature[] {
  const statsMap = new Map<string, LocalityRentStats>()
  for (const s of stats) statsMap.set(s.locality_name, s)

  const seen = new Set<string>()
  const seeds = locs.filter(l => {
    if (l.level !== 2 || !l.polygon) return false
    const key = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return seeds.flatMap(seed => {
    const ring = seed.polygon!
    if (!ring || ring.length < 3) return []

    const s = statsMap.get(seed.name)
    const normRent = s?.norm_rent ?? 0
    const rentRatio = s?.rent_ratio ?? 0
    const cx = ring.reduce((sum, p) => sum + p[0], 0) / ring.length
    const cy = ring.reduce((sum, p) => sum + p[1], 0) / ring.length
    if (!isFinite(cx) || !isFinite(cy)) return []

    return [{
      coordinates: ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
      centroid: { latitude: cy, longitude: cx },
      hasData: (s?.submission_count ?? 0) > 0,
      count: s?.submission_count ?? 0,
      normRent,
      rentRatio,
      // normRent is already 1BHK-normalised; derive other BHK estimates
      norm1: normRent,
      norm2: Math.round(normRent * 1.33),
      norm3: Math.round(normRent * 1.5),
      norm4: Math.round(normRent * 1.6),
      isLocality: true,
    }]
  })
}

/** Build 250m street-level grid from pre-computed server-side stats.
 *  Skips empty cells — only renders cells with actual submission data.
 */
export function buildStreetGridFromStats(
  cityName: string,
  stats: StreetGridStats[],
  cityHull: [number, number][] | null,
): RentFeature[] {
  const cityBounds = CITY_BOUNDS[cityName]
  if (!cityBounds) return []

  const step = GRID_STEP_250

  const statsMap = new Map<string, StreetGridStats>()
  for (const s of stats) statsMap.set(`${s.grid_lat}|${s.grid_lng}`, s)

  const features: RentFeature[] = []
  let ci = 0

  for (let lat = cityBounds.latMin; lat < cityBounds.latMax; lat += step, ci++) {
    const cLat = lat + step / 2
    let cj = 0
    for (let lng = cityBounds.lngMin; lng < cityBounds.lngMax; lng += step, cj++) {
      const cLng = lng + step / 2

      if (cityHull && !pointInPolygon(cLng, cLat, cityHull)) continue

      const s = statsMap.get(`${ci}|${cj}`)
      if (!s || (s.submission_count ?? 0) === 0) continue

      const normRent = s.norm_rent ?? 0
      const rentRatio = s.rent_ratio ?? 0

      features.push({
        coordinates: [
          { latitude: lat, longitude: lng },
          { latitude: lat, longitude: lng + step },
          { latitude: lat + step, longitude: lng + step },
          { latitude: lat + step, longitude: lng },
        ],
        centroid: { latitude: cLat, longitude: cLng },
        hasData: true,
        count: s.submission_count,
        normRent,
        rentRatio,
        norm1: normRent,
        norm2: Math.round(normRent * 1.33),
        norm3: Math.round(normRent * 1.5),
        norm4: Math.round(normRent * 1.6),
        isLocality: false,
      })
    }
  }

  return features
}
