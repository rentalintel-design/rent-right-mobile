import type { Vacancy } from '@/hooks/useVacancies'

// Maps representative vacancy ID → count of vacancies in that cluster cell.
// Vacancies NOT in this map are non-representatives and should be hidden (opacity 0).
export type ClusterMap = Map<string, number>

// Steps are strict powers of 2 of each other (each = 2× the next finer level).
// This guarantees hierarchical stability: if two vacancies share a cell at zoom Z,
// they will ALWAYS share a cell at any coarser zoom. Only splitting ever happens
// as you zoom in — a vacancy can never "rejoin" a cluster it already left.
function gridStep(zoom: number): number {
  if (zoom >= 16) return 0.002   // ~220 m
  if (zoom >= 14) return 0.004   // ~440 m  (2×)
  if (zoom >= 12) return 0.008   // ~880 m  (2×)
  if (zoom >= 10) return 0.016   // ~1.8 km (2×)
  if (zoom >= 8)  return 0.032   // ~3.5 km (2×)
  return 0.064                   // ~7 km   (2×)
}

// Returns a ClusterMap: which vacancy IDs are visible (as representatives) and their cluster count.
// Vacancies not in the map should be hidden. Coordinates never change — only visibility.
export function buildClusterMap(vacancies: Vacancy[], zoom: number): ClusterMap {
  const step = gridStep(zoom)
  const cells = new Map<string, Vacancy[]>()

  for (const v of vacancies) {
    const ci = Math.floor(v.lat / step)
    const cj = Math.floor(v.lng / step)
    const key = `${ci}:${cj}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key)!.push(v)
  }

  const result: ClusterMap = new Map()
  for (const group of cells.values()) {
    // Pick the first vacancy in the cell as representative
    result.set(group[0].id, group.length)
  }
  return result
}
