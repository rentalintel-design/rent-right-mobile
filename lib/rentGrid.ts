// Rent grid builders — ported from web app
import { Delaunay } from 'd3-delaunay'
import { CITY_BOUNDS, BHK_DIVISOR, GRID_STEP } from 'rent-right-shared'
import { pointInPolygon, median } from './mapUtils'

export type RentCell = {
  propertyId: string
  lat: number
  lng: number
  count: number
  lastRent: number
  lastBhk: string
  allSubmissions: Array<{ bhk_type: string; rent_amount: number; submitted_at: string }>
}

// Re-export with null support for Supabase data
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

/** Build street-level rent grid — returns flat array of polygon features */
export function buildRentGrid(
  cityName: string,
  rentCells: RentCell[],
  cityHull: [number, number][] | null,
  baselineRent: number,
  step = GRID_STEP,
  viewBounds?: { latMin: number; latMax: number; lngMin: number; lngMax: number },
): RentFeature[] {
  const cityBounds = CITY_BOUNDS[cityName]
  if (!cityBounds) return []

  const snapDown = (val: number, origin: number, s: number) =>
    origin + Math.floor((val - origin) / s) * s
  const bounds = viewBounds ? {
    latMin: Math.max(cityBounds.latMin, snapDown(viewBounds.latMin, cityBounds.latMin, step)),
    latMax: Math.min(cityBounds.latMax, viewBounds.latMax),
    lngMin: Math.max(cityBounds.lngMin, snapDown(viewBounds.lngMin, cityBounds.lngMin, step)),
    lngMax: Math.min(cityBounds.lngMax, viewBounds.lngMax),
  } : cityBounds

  // Bucket rent cells by grid position
  const buckets: Record<string, RentCell[]> = {}
  for (const rc of rentCells) {
    const ci = Math.floor((rc.lat - bounds.latMin) / step)
    const cj = Math.floor((rc.lng - bounds.lngMin) / step)
    const key = `${ci}|${cj}`
    if (!buckets[key]) buckets[key] = []
    buckets[key].push(rc)
  }

  const features: RentFeature[] = []
  let ci = 0
  for (let lat = bounds.latMin; lat < bounds.latMax; lat += step, ci++) {
    const cLat = lat + step / 2
    let cj = 0
    for (let lng = bounds.lngMin; lng < bounds.lngMax; lng += step, cj++) {
      const cLng = lng + step / 2
      if (cityHull) {
        const h = step / 2
        if (!pointInPolygon(cLng, cLat, cityHull)) continue
      }

      const cellRcs = buckets[`${ci}|${cj}`]
      let hasData = false, count = 0, normSum = 0, normCount = 0
      const bhkBuckets: Record<string, number[]> = { '1BHK': [], '2BHK': [], '3BHK': [], '4BHK+': [] }

      if (cellRcs) {
        for (const rc of cellRcs) {
          hasData = true
          count += rc.count
          for (const s of rc.allSubmissions) {
            const div = BHK_DIVISOR[s.bhk_type] ?? 1.0
            normSum += s.rent_amount / div
            normCount++
            const key = (s.bhk_type === '4BHK' || s.bhk_type === '5BHK') ? '4BHK+' : s.bhk_type
            if (bhkBuckets[key]) bhkBuckets[key].push(s.rent_amount)
          }
        }
      }

      const normRent = normCount > 0 ? normSum / normCount : 0
      const rentRatio = baselineRent > 0 && normRent > 0 ? normRent / baselineRent : 0

      features.push({
        coordinates: [
          { latitude: lat, longitude: lng },
          { latitude: lat, longitude: lng + step },
          { latitude: lat + step, longitude: lng + step },
          { latitude: lat + step, longitude: lng },
        ],
        centroid: { latitude: cLat, longitude: cLng },
        hasData, count, normRent, rentRatio,
        norm1: median(bhkBuckets['1BHK']),
        norm2: median(bhkBuckets['2BHK']),
        norm3: median(bhkBuckets['3BHK']),
        norm4: median(bhkBuckets['4BHK+']),
        isLocality: false,
      })
    }
  }
  return features
}

/** Build locality-level rent polygons from stored Voronoi polygons */
export function buildLocalityRentFeatures(
  locs: LocalityRow[],
  cells: RentCell[],
  baseline: number,
): RentFeature[] {
  const _coordSeen = new Set<string>()
  const seeds = locs.filter(l => {
    if (l.level !== 2 || !l.polygon) return false
    const key = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`
    if (_coordSeen.has(key)) return false
    _coordSeen.add(key)
    return true
  })
  if (seeds.length === 0) return []

  const delaunay = Delaunay.from(seeds, l => l.lng, l => l.lat)
  const cellData = seeds.map(() => ({
    hasData: false, count: 0,
    normSum: 0, normCount: 0,
    bhkBuckets: { '1BHK': [], '2BHK': [], '3BHK': [], '4BHK+': [] } as Record<string, number[]>,
  }))

  for (const rc of cells) {
    const idx = delaunay.find(rc.lng, rc.lat)
    const cell = cellData[idx]
    cell.hasData = true
    cell.count += rc.count
    for (const s of rc.allSubmissions) {
      const div = BHK_DIVISOR[s.bhk_type] ?? 1.0
      cell.normSum += s.rent_amount / div
      cell.normCount++
      const key = (s.bhk_type === '4BHK' || s.bhk_type === '5BHK') ? '4BHK+' : s.bhk_type
      if (cell.bhkBuckets[key]) cell.bhkBuckets[key].push(s.rent_amount)
    }
  }

  return seeds.map((seed, i) => {
    const d = cellData[i]
    const normRent = d.normCount > 0 ? d.normSum / d.normCount : 0
    const rentRatio = baseline > 0 && normRent > 0 ? normRent / baseline : 0
    const ring = seed.polygon!
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length

    return {
      coordinates: ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
      centroid: { latitude: cy, longitude: cx },
      hasData: d.hasData, count: d.count, normRent, rentRatio,
      norm1: median(d.bhkBuckets['1BHK']),
      norm2: median(d.bhkBuckets['2BHK']),
      norm3: median(d.bhkBuckets['3BHK']),
      norm4: median(d.bhkBuckets['4BHK+']),
      isLocality: true,
    }
  })
}
