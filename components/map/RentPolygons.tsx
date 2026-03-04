import React, { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Polygon, Marker } from 'react-native-maps'
import { rentRatioColor, formatRentShort } from '@/lib/mapUtils'
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
        const hasRent = f.hasData && f.normRent > 0
        const t = (hasRent && rentMax > rentMin)
          ? Math.max(0, Math.min(1, (f.normRent - rentMin) / (rentMax - rentMin)))
          : 0.5
        const fillColor = hasRent
          ? rentRatioColor(0.5 + t, undefined)
          : 'rgba(148, 163, 184, 0.35)'
        const strokeColor = hasRent
          ? rentRatioColor(0.5 + t, 0.8)
          : 'rgba(148, 163, 184, 0.4)'

        return (
          <React.Fragment key={i}>
            <Polygon
              coordinates={f.coordinates}
              fillColor={fillColor}
              strokeColor={strokeColor}
              strokeWidth={1}
            />
            {showLabels && hasRent && (
              <Marker
                coordinate={f.centroid}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.label}>
                  {f.norm1 > 0 && (
                    <Text style={styles.labelSub}>1BHK {formatRentShort(f.norm1)}</Text>
                  )}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
    textAlign: 'center',
    marginBottom: 1,
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
})
