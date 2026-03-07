import React, { memo, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import { formatRentShort } from '@/lib/mapUtils'
import type { RentFeature } from '@/lib/rentGrid'

// Pool of permanent label marker slots — same pattern as VacancyMarkerPool.
// Each grid cell is assigned a slot once; coordinate never changes after assignment.
// Visibility toggled via opacity only to prevent Google Maps iOS animation.
const POOL_SIZE = 120
const NULL_COORD = { latitude: 0.001, longitude: 0.001 }

type Slot = { feature: RentFeature } | null

type Props = {
  features: RentFeature[]   // viewport-filtered street grid cells with data
  visible: boolean          // false when street layer is not active
  showAllBhk: boolean       // true at zoom >= 16 — show all 4 BHK rows instead of just 1BHK
}

export const RentGridLabels = memo(function RentGridLabels({ features, visible, showAllBhk }: Props) {
  const idToSlot = useRef<Map<string, number>>(new Map())
  const occupiedSlots = useRef<Set<number>>(new Set())
  const [slots, setSlots] = useState<Slot[]>(() => new Array(POOL_SIZE).fill(null))

  // Briefly enable tracksViewChanges when slots change OR showAllBhk toggles so
  // Google Maps re-captures the label bitmap with updated content.
  const [tracking, setTracking] = useState(false)
  useEffect(() => {
    setTracking(true)
    const t = setTimeout(() => setTracking(false), 150)
    return () => clearTimeout(t)
  }, [slots, showAllBhk])

  // Assign grid cells to permanent slots. Coordinates set once and never changed.
  useEffect(() => {
    const next: Slot[] = new Array(POOL_SIZE).fill(null)
    const currentIds = new Set(features.map(f => f.id))

    // Free slots for cells that left the viewport
    for (const [id, idx] of idToSlot.current) {
      if (!currentIds.has(id)) {
        idToSlot.current.delete(id)
        occupiedSlots.current.delete(idx)
      }
    }

    // Keep existing slots stable; assign new slots for new cells
    for (const f of features) {
      if (idToSlot.current.has(f.id)) {
        next[idToSlot.current.get(f.id)!] = { feature: f }
      } else {
        for (let i = 0; i < POOL_SIZE; i++) {
          if (!occupiedSlots.current.has(i)) {
            idToSlot.current.set(f.id, i)
            occupiedSlots.current.add(i)
            next[i] = { feature: f }
            break
          }
        }
      }
    }

    setSlots(next)
  }, [features])

  return (
    <>
      {slots.map((slot, i) => {
        const isVisible = visible && slot !== null
        return (
          <Marker
            key={`rl-${i}`}
            coordinate={slot ? slot.feature.centroid : NULL_COORD}
            tracksViewChanges={tracking}
            opacity={isVisible ? 1 : 0}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={undefined}
          >
            {slot && showAllBhk ? (
              // Zoom >= 16: show all 4 BHK normalised rents
              <View style={styles.labelExpanded}>
                <Text style={styles.row}><Text style={styles.bhk}>1BHK </Text>{formatRentShort(slot.feature.norm1)}</Text>
                <Text style={styles.row}><Text style={styles.bhk}>2BHK </Text>{formatRentShort(slot.feature.norm2)}</Text>
                <Text style={styles.row}><Text style={styles.bhk}>3BHK </Text>{formatRentShort(slot.feature.norm3)}</Text>
                <Text style={styles.row}><Text style={styles.bhk}>4BHK </Text>{formatRentShort(slot.feature.norm4)}</Text>
              </View>
            ) : slot ? (
              // Zoom < 16: single compact 1BHK label
              <View style={styles.label}>
                <Text style={styles.text}>{formatRentShort(slot.feature.norm1)}</Text>
              </View>
            ) : (
              <View style={styles.empty} />
            )}
          </Marker>
        )
      })}
    </>
  )
})

const styles = StyleSheet.create({
  label: {
    backgroundColor: 'rgba(10, 22, 40, 0.72)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  text: {
    color: '#f0f6ff',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelExpanded: {
    backgroundColor: 'rgba(10, 22, 40, 0.82)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    gap: 1,
  },
  row: {
    color: '#f0f6ff',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  bhk: {
    color: '#7896b4',
    fontSize: 8,
    fontWeight: '500',
  },
  empty: {
    width: 1,
    height: 1,
  },
})
