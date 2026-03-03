import React, { useRef, useCallback } from 'react'
import { View, Text, StyleSheet, PanResponder } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '@/hooks/use-theme-color'
import { formatRentShort } from '@/lib/mapUtils'
import { Spacing, Typography } from '@/constants/theme'

type Props = {
  rentMin: number
  rentMax: number
  onChangeMin: (val: number) => void
  onChangeMax: (val: number) => void
}

function sliderToRent(v: number): number {
  if (v <= 0.75) return Math.round((5000 + (v / 0.75) * 95000) / 1000) * 1000
  return Math.round((100000 + ((v - 0.75) / 0.25) * 100000) / 5000) * 5000
}

function rentToSlider(r: number): number {
  if (r <= 100000) return ((r - 5000) / 95000) * 0.75
  return 0.75 + ((r - 100000) / 100000) * 0.25
}

const TRACK_HEIGHT = 5
const THUMB_SIZE = 18
const MIN_COLOR = '#16a34a'
const MAX_COLOR = '#f97316'

export default function RentSlider({ rentMin, rentMax, onChangeMin, onChangeMax }: Props) {
  const c = useColors()
  const trackRef = useRef<View>(null)
  const trackWidthRef = useRef(0)
  const trackPageXRef = useRef(0)

  const minPct = rentToSlider(rentMin)
  const maxPct = rentToSlider(rentMax)

  // Keep latest values accessible in PanResponder without recreating it
  const rentMinRef = useRef(rentMin)
  const rentMaxRef = useRef(rentMax)
  rentMinRef.current = rentMin
  rentMaxRef.current = rentMax

  const measureTrack = useCallback(() => {
    trackRef.current?.measure((_x, _y, width, _h, pageX) => {
      trackWidthRef.current = width
      trackPageXRef.current = pageX
    })
  }, [])

  const minPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        trackRef.current?.measure((_x, _y, width, _h, pageX) => {
          trackWidthRef.current = width
          trackPageXRef.current = pageX
        })
      },
      onPanResponderMove: (e) => {
        if (!trackWidthRef.current) return
        const relX = e.nativeEvent.pageX - trackPageXRef.current
        const pct = Math.max(0, Math.min(rentToSlider(rentMaxRef.current) - 0.01, relX / trackWidthRef.current))
        onChangeMin(sliderToRent(pct))
      },
    })
  ).current

  const maxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        trackRef.current?.measure((_x, _y, width, _h, pageX) => {
          trackWidthRef.current = width
          trackPageXRef.current = pageX
        })
      },
      onPanResponderMove: (e) => {
        if (!trackWidthRef.current) return
        const relX = e.nativeEvent.pageX - trackPageXRef.current
        const pct = Math.max(rentToSlider(rentMinRef.current) + 0.01, Math.min(1, relX / trackWidthRef.current))
        onChangeMax(sliderToRent(pct))
      },
    })
  ).current

  return (
    <View style={[styles.container, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
      <View style={styles.labelRow}>
        <Text style={[Typography.caption, { color: MIN_COLOR, fontWeight: '700' }]}>₹{formatRentShort(rentMin)}</Text>
        <Text style={[Typography.caption, { color: c.text3 }]}>Rent range</Text>
        <Text style={[Typography.caption, { color: MAX_COLOR, fontWeight: '700' }]}>₹{formatRentShort(rentMax)}</Text>
      </View>

      <View
        ref={trackRef}
        style={styles.trackArea}
        onLayout={measureTrack}
      >
        <View style={[styles.track, { backgroundColor: c.border }]} />

        <LinearGradient
          colors={[MIN_COLOR, MAX_COLOR]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rangeFill, {
            left: `${minPct * 100}%` as any,
            width: `${(maxPct - minPct) * 100}%` as any,
          }]}
        />

        <View
          {...minPanResponder.panHandlers}
          style={[styles.thumb, {
            left: `${minPct * 100}%` as any,
            backgroundColor: MIN_COLOR,
            marginLeft: -(THUMB_SIZE / 2),
          }]}
        />

        <View
          {...maxPanResponder.panHandlers}
          style={[styles.thumb, {
            left: `${maxPct * 100}%` as any,
            backgroundColor: MAX_COLOR,
            marginLeft: -(THUMB_SIZE / 2),
          }]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  trackArea: {
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  rangeFill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2.5,
    borderColor: '#fff',
    top: '50%' as any,
    marginTop: -(THUMB_SIZE / 2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
})
