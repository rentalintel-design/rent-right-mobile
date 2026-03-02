// ── Shared types for MapView and its extracted sub-components ────────────────

export type CityProp = {
  name: string
  label: string
  lat: number
  lng: number
  zoom: number
}

export type Property = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  source: string
  bhk_types: string[]   // BHK types with rent data
  min_rent: number | null
  max_rent: number | null
}

export type Society = {
  id: string
  name: string
  lat: number
  lng: number
  osm_type: string   // 'node' | 'way' | 'relation'
}

export type RentSummary = {
  bhk_type: string
  last_submitted: string | null
  min_rent: number
  max_rent: number
  count: number
}

export type RentCell = {
  propertyId: string
  lat: number
  lng: number
  name: string
  count: number       // total rent submissions
  lastRent: number    // most recent rent_amount
  lastBhk: string     // bhk_type of last submission
  lastSubmitted: string // ISO timestamp
  allSubmissions: { bhk_type: string; rent_amount: number; submitted_at: string; source?: 'user' | 'reddit' }[]
  source?: 'user' | 'reddit'
}

export type ActiveLayer = 'none' | 'rent-locality' | 'rent-street' | 'rent-raw'

export type LocalityRow = {
  name: string
  lat: number
  lng: number
  level: number
  polygon?: [number, number][]
}

export type ViewportBounds = {
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
}

// Filter types
export type DataFilter = 'All' | 'Has data' | 'No data'
export type FurnishingFilter = 'All' | 'Furnished' | 'Semi-Furnished' | 'Unfurnished'
// BhkFilter, RentFilter, SourceFilter are imported from @/hooks/useVacancies
