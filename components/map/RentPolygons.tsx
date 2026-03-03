import React, { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Polygon, Marker } from 'react-native-maps'
import { formatRentShort, rentRatioColor } from '@/lib/mapUtils'
import type { RentFeature } from '@/lib/rentGrid'

type Props = {
  features: RentFeature[]
  rentMin: number
  rentMax: number
  showLabels: boolean
}

export const RentPolygons = memo(function RentPolygons({ features, rentMin, rentMax, showLabels }: Props) {
  return (
    <>
      {features.map((f, i) => {
        const fillColor = f.hasData
          ? rentRatioColor(f.rentRatio)
          : 'rgba(148, 163, 184, 0.12)'
        const strokeColor = f.hasData
          ? rentRatioColor(f.rentRatio, 0.8)
          : 'rgba(148, 163, 184, 0.2)'

        // Filter by rent range
        if (f.hasData && f.normRent > 0) {
          if (f.normRent < rentMin || f.normRent > rentMax) return null
        }

        return (
          <React.Fragment key={i}>
            <Polygon
              coordinates={f.coordinates}
              fillColor={fillColor}
              strokeColor={strokeColor}
              strokeWidth={1}
            />
            {showLabels && f.hasData && f.normRent > 0 && (
              <Marker
                coordinate={f.centroid}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.label}>
                  <Text style={styles.labelText}>{formatRentShort(f.normRent)}</Text>
                </View>
              </Marker>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
})

const styles = StyleSheet.create({
  label: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
})
