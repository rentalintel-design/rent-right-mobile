import React, { memo, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import { formatRentShort } from '@/lib/mapUtils'
import { BHK_COLORS } from '@/constants/mapStyles'
import type { ClusterMap } from '@/lib/clusterVacancies'
import type { Vacancy } from '@/hooks/useVacancies'

// Pool of permanent marker slots. Each vacancy is assigned a slot once and never moves.
// Clustering is achieved by toggling opacity only — coordinate prop never changes.
// This prevents Google Maps iOS from animating markers (which caused the "bouncing").
const POOL_SIZE = 300
const NULL_COORD = { latitude: 0.001, longitude: 0.001 }

type Slot = { vacancy: Vacancy } | null

type Props = {
  vacancies: Vacancy[]
  clusterMap: ClusterMap   // which vacancy IDs are visible, and their cluster count
  hidden: boolean          // true when rent layer is active — hide all markers
  onVacancyPress: (vacancy: Vacancy) => void
  onClusterPress: (coord: { latitude: number; longitude: number }) => void
}

export const VacancyMarkerPool = memo(function VacancyMarkerPool({
  vacancies, clusterMap, hidden, onVacancyPress, onClusterPress,
}: Props) {
  const idToSlot = useRef<Map<string, number>>(new Map())
  const occupiedSlots = useRef<Set<number>>(new Set())
  const [slots, setSlots] = useState<Slot[]>(() => new Array(POOL_SIZE).fill(null))

  // Briefly enable tracksViewChanges when clusterMap changes so Google Maps
  // re-captures the updated marker visual (cluster bubble ↔ rent pill), then
  // disables it to freeze the bitmap. This avoids key-based remounting which
  // caused a visible gap between cluster disappearing and vacancy appearing.
  const [tracking, setTracking] = useState(false)
  useEffect(() => {
    setTracking(true)
    const t = setTimeout(() => setTracking(false), 150)
    return () => clearTimeout(t)
  }, [clusterMap])

  // Assign vacancies to permanent slots — runs only when vacancy list changes (data load).
  // Coordinates are set once here and NEVER updated again.
  useEffect(() => {
    const next: Slot[] = new Array(POOL_SIZE).fill(null)
    const currentIds = new Set(vacancies.map(v => v.id))

    // Free slots for removed vacancies
    for (const [id, idx] of idToSlot.current) {
      if (!currentIds.has(id)) {
        idToSlot.current.delete(id)
        occupiedSlots.current.delete(idx)
      }
    }

    // Keep existing slots stable, assign new slots only for new vacancies
    for (const v of vacancies) {
      if (idToSlot.current.has(v.id)) {
        next[idToSlot.current.get(v.id)!] = { vacancy: v }
      } else {
        for (let i = 0; i < POOL_SIZE; i++) {
          if (!occupiedSlots.current.has(i)) {
            idToSlot.current.set(v.id, i)
            occupiedSlots.current.add(i)
            next[i] = { vacancy: v }
            break
          }
        }
      }
    }

    setSlots(next)
  }, [vacancies])

  return (
    <>
      {slots.map((slot, i) => {
        const count = slot ? (clusterMap.get(slot.vacancy.id) ?? 0) : 0
        const isVisible = !hidden && count > 0

        return (
          <Marker
            key={`vm-${i}`}
            coordinate={slot
              ? { latitude: slot.vacancy.lat, longitude: slot.vacancy.lng }
              : NULL_COORD
            }
            tracksViewChanges={tracking}
            opacity={isVisible ? 1 : 0}
            onPress={
              isVisible && slot
                ? count > 1
                  ? () => onClusterPress({ latitude: slot.vacancy.lat, longitude: slot.vacancy.lng })
                  : () => onVacancyPress(slot.vacancy)
                : undefined
            }
          >
            {slot && count > 1 ? (
              // Cluster bubble — shows count of grouped vacancies
              (() => {
                const size = Math.min(48, 28 + Math.log2(count) * 4)
                return (
                  <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
                    <Text style={styles.clusterText}>{count}</Text>
                  </View>
                )
              })()
            ) : slot && count === 1 ? (
              // Single vacancy pill — only when this slot is the visible representative
              <View style={[styles.pill, { backgroundColor: BHK_COLORS[slot.vacancy.bhk_type] ?? '#3b82f6' }]}>
                <Text style={styles.pillText}>{formatRentShort(slot.vacancy.asking_rent)}</Text>
              </View>
            ) : (
              // count=0 (non-representative or empty slot) → always render empty so
              // Google Maps never captures a pill bitmap for a hidden marker.
              <View style={styles.empty} />
            )}
          </Marker>
        )
      })}
    </>
  )
})

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  pillText: {
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
  empty: {
    width: 1,
    height: 1,
  },
})
