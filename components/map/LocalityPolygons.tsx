import React, { memo } from 'react'
import { Polygon } from 'react-native-maps'
import { rentRatioColor } from '@/lib/mapUtils'
import type { RentFeature } from '@/lib/rentGrid'
import type { ActiveLayer } from 'rent-right-shared'

const NODATA_FILL = 'rgba(148, 163, 184, 0.18)'

type Props = {
  features: RentFeature[]
  activeLayer: ActiveLayer
  rentMin: number
  rentMax: number
}

export const LocalityPolygons = memo(function LocalityPolygons({
  features, activeLayer, rentMin, rentMax,
}: Props) {
  const visible = activeLayer === 'rent-locality'

  return (
    <>
      {features.map((f) => {
        const hasRent = f.hasData && f.normRent > 0
        const t = (hasRent && rentMax > rentMin)
          ? Math.max(0, Math.min(1, (f.normRent - rentMin) / (rentMax - rentMin)))
          : 0.5

        const fill = visible
          ? (hasRent ? rentRatioColor(0.5 + t, undefined) : NODATA_FILL)
          : 'rgba(0,0,0,0)'
        const stroke = visible
          ? (hasRent ? rentRatioColor(0.5 + t, 0.8) : 'rgba(148, 163, 184, 0.2)')
          : 'rgba(0,0,0,0)'

        return (
          <Polygon
            key={f.id}
            coordinates={f.coordinates}
            fillColor={fill}
            strokeColor={stroke}
            strokeWidth={1}
          />
        )
      })}
    </>
  )
})
