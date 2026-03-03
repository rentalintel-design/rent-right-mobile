import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { useColors } from '@/hooks/use-theme-color'
import { formatRentShort } from '@/lib/mapUtils'
import { Spacing, Typography } from '@/constants/theme'

type Props = {
  rentMin: number
  rentMax: number
  onChangeMin: (val: number) => void
  onChangeMax: (val: number) => void
}

// Non-linear scale: slider 0-1 maps to ₹5k-₹200k
function sliderToRent(v: number): number {
  if (v <= 0.75) return 5000 + (v / 0.75) * 95000  // 5k-100k
  return 100000 + ((v - 0.75) / 0.25) * 100000     // 100k-200k
}

function rentToSlider(r: number): number {
  if (r <= 100000) return ((r - 5000) / 95000) * 0.75
  return 0.75 + ((r - 100000) / 100000) * 0.25
}

export default function RentSlider({ rentMin, rentMax, onChangeMin, onChangeMax }: Props) {
  const c = useColors()

  return (
    <View style={[styles.container, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
      <View style={styles.row}>
        <Text style={[Typography.caption, { color: c.text3 }]}>Min: {formatRentShort(rentMin)}</Text>
        <Text style={[Typography.caption, { color: c.text3 }]}>Max: {formatRentShort(rentMax)}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={rentToSlider(rentMin)}
        onValueChange={v => onChangeMin(Math.round(sliderToRent(v) / 1000) * 1000)}
        minimumTrackTintColor="#22c55e"
        maximumTrackTintColor={c.border}
        thumbTintColor="#22c55e"
      />
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={rentToSlider(rentMax)}
        onValueChange={v => onChangeMax(Math.round(sliderToRent(v) / 1000) * 1000)}
        minimumTrackTintColor="#f97316"
        maximumTrackTintColor={c.border}
        thumbTintColor="#f97316"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  slider: {
    width: '100%',
    height: 30,
  },
})
