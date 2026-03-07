import React, { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import { formatRentShort } from '@/lib/mapUtils'
import { BHK_COLORS } from '@/constants/mapStyles'
import type { Vacancy } from '@/hooks/useVacancies'

const NULL_COORD = { latitude: 0.001, longitude: 0.001 }

type Props = {
  vacancy: Vacancy
  onPress: (vacancy: Vacancy) => void
  hidden?: boolean
}

export const VacancyMarker = memo(function VacancyMarker({ vacancy, onPress, hidden }: Props) {
  const color = BHK_COLORS[vacancy.bhk_type] ?? '#3b82f6'

  return (
    <Marker
      coordinate={hidden ? NULL_COORD : { latitude: vacancy.lat, longitude: vacancy.lng }}
      onPress={hidden ? undefined : () => onPress(vacancy)}
      tracksViewChanges={false}
      opacity={hidden ? 0 : 1}
    >
      <View style={[styles.pill, { backgroundColor: color }]}>
        <Text style={styles.text}>{formatRentShort(vacancy.asking_rent)}</Text>
      </View>
    </Marker>
  )
})

export function ClusterMarker({ count, coordinate, onPress, hidden }: {
  count: number
  coordinate: { latitude: number; longitude: number }
  onPress: () => void
  hidden?: boolean
}) {
  const size = Math.min(48, 28 + Math.log2(count) * 4)
  return (
    <Marker
      coordinate={hidden ? NULL_COORD : coordinate}
      onPress={hidden ? undefined : onPress}
      tracksViewChanges={false}
      opacity={hidden ? 0 : 1}
    >
      <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cluster: {
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  clusterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
})
