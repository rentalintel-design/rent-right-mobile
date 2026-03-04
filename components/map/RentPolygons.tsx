import React, { memo, useMemo } from 'react'
import { Polygon } from 'react-native-maps'
import { rentRatioColor } from '@/lib/mapUtils'
import type { RentFeature } from '@/lib/rentGrid'

// Fixed pool size — polygons are pre-allocated at mount and NEVER added/removed.
// Props (coordinates, colors) are updated in-place. This avoids the Google Maps
// iOS SDK crash that occurs when native Polygon views are created/destroyed during
// map pan/zoom gestures.
const POOL_SIZE = 120

// Tiny invisible polygon far off-screen (null island, Indian Ocean).
// Used for empty pool slots so they don't render visibly.
const NULL_COORDS = [
  { latitude: 0.0010, longitude: 0.0010 },
  { latitude: 0.0010, longitude: 0.0012 },
  { latitude: 0.0012, longitude: 0.0012 },
  { latitude: 0.0012, longitude: 0.0010 },
]

// No-data fill — subtle grey matching web
const NODATA_FILL = 'rgba(148, 163, 184, 0.18)'

type Props = {
  features: RentFeature[]
  rentMin: number
  rentMax: number
}

export const RentPolygons = memo(function RentPolygons({ features, rentMin, rentMax }: Props) {
  const slots = useMemo(() => {
    return Array.from({ length: POOL_SIZE }, (_, i) => {
      const f = features[i]
      if (!f) return {
        coords: NULL_COORDS,
        fill: 'rgba(0,0,0,0)',
        stroke: 'rgba(0,0,0,0)',
      }

      const hasRent = f.hasData && f.normRent > 0
      const t = (hasRent && rentMax > rentMin)
        ? Math.max(0, Math.min(1, (f.normRent - rentMin) / (rentMax - rentMin)))
        : 0.5

      const fill = hasRent ? rentRatioColor(0.5 + t, undefined) : NODATA_FILL
      const stroke = hasRent ? rentRatioColor(0.5 + t, 0.8) : 'rgba(148, 163, 184, 0.2)'
      return { coords: f.coordinates, fill, stroke }
    })
  }, [features, rentMin, rentMax])

  return (
    <>
      {slots.map((s, i) => (
        <Polygon
          key={`pool-${i}`}
          coordinates={s.coords}
          fillColor={s.fill}
          strokeColor={s.stroke}
          strokeWidth={1}
        />
      ))}
    </>
  )
})
