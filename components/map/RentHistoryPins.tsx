import React, { memo, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import { formatRentShort, spreadOverlappingPins } from '@/lib/mapUtils'
import type { RentCell } from '@/lib/rentGrid'

type Props = {
  cells: RentCell[]
  zoom: number
}

export const RentHistoryPins = memo(function RentHistoryPins({ cells, zoom }: Props) {
  const spread = useMemo(() => spreadOverlappingPins(cells, zoom), [cells, zoom])

  return (
    <>
      {spread.map((cell, i) => (
        <Marker
          key={cell.propertyId + i}
          coordinate={{
            latitude: cell.lat + (cell.offsetY * 0.00001),
            longitude: cell.lng + (cell.offsetX * 0.00001),
          }}
          tracksViewChanges={false}
        >
          <View style={styles.pin}>
            <Text style={styles.pinText}>
              {formatRentShort(cell.lastRent)}
              {cell.count > 1 ? '++' : ''}
            </Text>
          </View>
        </Marker>
      ))}
    </>
  )
})

const styles = StyleSheet.create({
  pin: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  pinText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
})
