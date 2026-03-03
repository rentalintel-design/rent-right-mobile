import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import * as Location from 'expo-location'
import { useColors } from '@/hooks/use-theme-color'

type Props = {
  onLocate: (lat: number, lng: number) => void
}

export default function LocateButton({ onLocate }: Props) {
  const c = useColors()

  const handlePress = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    onLocate(loc.coords.latitude, loc.coords.longitude)
  }

  return (
    <Pressable
      style={[styles.btn, { backgroundColor: c.bgSurface, borderColor: c.border }]}
      onPress={handlePress}
    >
      <Text style={styles.icon}>📍</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  icon: { fontSize: 20 },
})
