// Nominatim geocoding — extracted from MapView.tsx for reuse across components.

export type GeoResult = {
  id: string
  label: string
  sublabel: string
  lat: number
  lng: number
}

export type Bounds = {
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
}

// Geocode a query string within an optional bounding box.
// Pass null for bounds to search all of India.
export async function geocodeSearch(q: string, bounds: Bounds | null): Promise<GeoResult[]> {
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=4&countrycodes=in`
    if (bounds) {
      const viewbox = `${bounds.lngMin},${bounds.latMax},${bounds.lngMax},${bounds.latMin}`
      url += `&bounded=1&viewbox=${viewbox}`
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return []
    const data = await res.json() as {
      place_id: number
      display_name: string
      lat: string
      lon: string
      name: string
    }[]
    return data.map(r => ({
      id: `nom-${r.place_id}`,
      label: r.name || r.display_name.split(',')[0].trim(),
      sublabel: r.display_name.split(',').slice(0, 2).join(',').trim(),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }))
  } catch (e) {
    console.warn('[geocode]', e)
    return []
  }
}
