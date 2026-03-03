// Pure utility functions for map — ported from web app
import type { LocalityRow } from 'rent-right-shared'
import { COASTLINE_POLYGONS } from 'rent-right-shared'

/** Build a GeoJSON polygon ring approximating a circle */
export function buildCirclePolygon(lat: number, lng: number, radiusKm: number, steps = 64): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    const dLat = (radiusKm / 6371) * (180 / Math.PI) * Math.cos(angle)
    const dLng = (radiusKm / 6371) * (180 / Math.PI) * Math.sin(angle) / Math.cos(lat * Math.PI / 180)
    points.push([lng + dLng, lat + dLat])
  }
  return points
}

/** Convex hull — Andrew's monotone chain */
export function convexHull(pts: [number, number][]): [number, number][] {
  const p = pts.slice().sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop()
    lower.push(pt)
  }
  const upper: [number, number][] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop()
    upper.push(pt)
  }
  upper.pop(); lower.pop()
  const hull = [...lower, ...upper]
  hull.push(hull[0])
  return hull
}

/** Ray-casting point-in-polygon — ring uses [lng, lat] pairs */
export function pointInPolygon(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

export function buildCityHull(areas: LocalityRow[]): [number, number][] | null {
  const level2 = areas.filter(a => a.level === 2)
  if (level2.length < 3) return null
  const pts: [number, number][] = []
  const pad = 0.15
  for (const a of level2) {
    pts.push([a.lng - pad, a.lat - pad])
    pts.push([a.lng + pad, a.lat - pad])
    pts.push([a.lng - pad, a.lat + pad])
    pts.push([a.lng + pad, a.lat + pad])
  }
  return convexHull(pts)
}

export function getCityClipPolygon(cityName: string, localities: LocalityRow[]): [number, number][] | null {
  const coastline = COASTLINE_POLYGONS[cityName]
  if (coastline) return coastline
  return buildCityHull(localities)
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const s = arr.slice().sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export function formatRentShort(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}k`
  return `₹${amount}`
}

export function lngLatToPixel(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom)
  const x = (lng + 180) / 360 * scale
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  return { x, y }
}

/** Spread overlapping pins into a grid formation */
export function spreadOverlappingPins<T extends { lat: number; lng: number }>(
  cells: T[],
  zoom: number,
  minPx = 26,
): Array<T & { offsetX: number; offsetY: number }> {
  const n = cells.length
  if (n === 0) return []
  const px = cells.map(c => lngLatToPixel(c.lng, c.lat, zoom))
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] }
    return i
  }
  function union(a: number, b: number) { parent[find(a)] = find(b) }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = px[i].x - px[j].x, dy = px[i].y - px[j].y
      if (Math.sqrt(dx * dx + dy * dy) < minPx) union(i, j)
    }
  }
  const clusters: Record<number, number[]> = {}
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!clusters[root]) clusters[root] = []
    clusters[root].push(i)
  }
  const offsets = Array.from({ length: n }, () => ({ x: 0, y: 0 }))
  Object.values(clusters).forEach(members => {
    if (members.length <= 1) return
    const cols = Math.ceil(Math.sqrt(members.length))
    members.forEach((idx, k) => {
      const col = k % cols
      const row = Math.floor(k / cols)
      offsets[idx].x = (col - (Math.min(cols, members.length - row * cols) - 1) / 2) * minPx
      offsets[idx].y = -row * 20
    })
  })
  return cells.map((c, i) => ({ ...c, offsetX: offsets[i].x, offsetY: offsets[i].y }))
}

/** Interpolate rent ratio to color: green (cheap) → orange (expensive) */
export function rentRatioColor(ratio: number, opacity = 0.65): string {
  if (ratio <= 0) return `rgba(148, 163, 184, 0.18)` // grey, no data
  // green #16a34a to orange #f97316
  const t = Math.max(0, Math.min(1, (ratio - 0.5) / 1.0)) // 0.5x baseline = green, 1.5x = orange
  const r = Math.round(22 + t * (249 - 22))
  const g = Math.round(163 + t * (115 - 163))
  const b = Math.round(74 + t * (22 - 74))
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
