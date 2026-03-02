// ── Constants shared across MapView and extracted modules ────────────────────

import mumbaiCoastline from './data/coastlines/mumbai.json'
import chennaiCoastline from './data/coastlines/chennai.json'

// Coastline land-polygons for coastal cities — clips grids to avoid extending into the sea
export const COASTLINE_POLYGONS: Record<string, [number, number][]> = {
  mumbai:  mumbaiCoastline.coordinates[0] as [number, number][],
  chennai: chennaiCoastline.coordinates[0] as [number, number][],
}

// City bounding boxes
export const CITY_BOUNDS: Record<string, { latMin: number; latMax: number; lngMin: number; lngMax: number }> = {
  bengaluru: { latMin: 12.66, latMax: 13.26, lngMin: 77.35, lngMax: 77.93 },
  pune:      { latMin: 18.27, latMax: 18.84, lngMin: 73.55, lngMax: 74.15 },
  hyderabad: { latMin: 17.16, latMax: 17.74, lngMin: 78.05, lngMax: 78.72 },
  gurugram:  { latMin: 28.20, latMax: 28.76, lngMin: 76.85, lngMax: 77.26 },
  chennai:   { latMin: 12.67, latMax: 13.36, lngMin: 79.94, lngMax: 80.38 },
  mumbai:    { latMin: 18.82, latMax: 19.40, lngMin: 72.73, lngMax: 73.21 },
}

// ── Grid constants ──────────────────────────────────────────────────────────
export const GRID_STEP = 0.0009           // ~100m per cell — rent grid (contributors)
export const GRID_STEP_COARSE = 0.00675   // ~750m per cell — coarse grid for non-contributors

// BHK normalisation divisors — convert any BHK type to an equivalent 1BHK rent
// e.g. ₹40k 2BHK → ₹40k/1.33 ≈ ₹30k equivalent 1BHK
export const BHK_DIVISOR: Record<string, number> = {
  '1BHK': 1.0, '2BHK': 1.33, '3BHK': 1.5,
  '4BHK': 1.6, '4BHK+': 1.6, '5BHK': 1.7,
}
