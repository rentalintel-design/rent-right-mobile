import React, { memo } from 'react'
import { Polygon } from 'react-native-maps'
import { rentRatioColor } from '@/lib/mapUtils'
import type { RentFeature } from '@/lib/rentGrid'

type Props = {
  features: RentFeature[]
  rentMin: number
  rentMax: number
  showLabels: boolean
}

export const RentPolygons = memo(function RentPolygons({ features, rentMin, rentMax }: Props) {
  return (
    <>
      {features.map((f, i) => {
        const t = (f.hasData && f.normRent > 0 && rentMax > rentMin)
          ? Math.max(0, Math.min(1, (f.normRent - rentMin) / (rentMax - rentMin)))
          : 0.5
        const fillColor = f.hasData
          ? rentRatioColor(0.5 + t, undefined)
          : 'rgba(148, 163, 184, 0.12)'
        const strokeColor = f.hasData
          ? rentRatioColor(0.5 + t, 0.8)
          : 'rgba(148, 163, 184, 0.2)'

        return (
          <Polygon
            key={i}
            coordinates={f.coordinates}
            fillColor={fillColor}
            strokeColor={strokeColor}
            strokeWidth={1}
          />
        )
      })}
    </>
  )
})
