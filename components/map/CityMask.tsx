import React, { memo } from 'react'
import { Polygon } from 'react-native-maps'

const WORLD_BOUNDARY = [
  { latitude: 85,  longitude: -180 },
  { latitude: 85,  longitude:  180 },
  { latitude: -85, longitude:  180 },
  { latitude: -85, longitude: -180 },
]

type Bounds = { latMin: number; latMax: number; lngMin: number; lngMax: number }

type Props = {
  cityHull: [number, number][] | null  // [lng, lat][]
  bounds?: Bounds | null
}

/** Dims the map OUTSIDE the city boundary.
 *  Mirrors web's city-mask-fill layer (world polygon with city hull as hole).
 *  Rendered AFTER data polygons so it sits on top outside the city.
 */
export const CityMask = memo(function CityMask({ cityHull, bounds }: Props) {
  const ring: { latitude: number; longitude: number }[] | null =
    cityHull && cityHull.length >= 3
      ? cityHull.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
      : bounds
        ? [
            { latitude: bounds.latMin, longitude: bounds.lngMin },
            { latitude: bounds.latMin, longitude: bounds.lngMax },
            { latitude: bounds.latMax, longitude: bounds.lngMax },
            { latitude: bounds.latMax, longitude: bounds.lngMin },
          ]
        : null

  if (!ring) return null

  return (
    <Polygon
      coordinates={WORLD_BOUNDARY}
      holes={[ring]}
      fillColor="rgba(10, 22, 40, 0.55)"
      strokeWidth={0}
    />
  )
})
