import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '@/hooks/use-theme-color'
import { Spacing, Radius, Typography } from '@/constants/theme'
import type { ActiveLayer } from 'rent-right-shared'

type Props = {
  activeLayer: ActiveLayer
  onChangeLayer: (layer: ActiveLayer) => void
  hasContributed: boolean
}

const LAYERS: { key: ActiveLayer; label: string; icon: string; locked?: boolean }[] = [
  { key: 'none', label: 'None', icon: '✕' },
  { key: 'rent-locality', label: 'Locality', icon: '🗺' },
  { key: 'rent-street', label: 'Street', icon: '📡', locked: true },
  { key: 'rent-raw', label: 'History', icon: '📌', locked: true },
]

export default function LayerToggleBar({ activeLayer, onChangeLayer, hasContributed }: Props) {
  const c = useColors()

  return (
    <View style={[styles.bar, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
      {LAYERS.map(l => {
        const isLocked = l.locked && !hasContributed
        const isActive = activeLayer === l.key
        return (
          <Pressable
            key={l.key}
            style={[
              styles.btn,
              isActive && { backgroundColor: c.accent },
              isLocked && styles.locked,
            ]}
            onPress={() => {
              if (isLocked) return // TODO: show contribution prompt
              onChangeLayer(isActive ? 'none' : l.key)
            }}
            disabled={isLocked}
          >
            <Text style={styles.icon}>{l.icon}</Text>
            <Text style={[
              styles.label,
              { color: isActive ? '#fff' : isLocked ? c.text4 : c.text2 },
            ]}>
              {l.label}
              {isLocked ? ' 🔒' : ''}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    gap: 3,
  },
  icon: { fontSize: 14 },
  label: { ...Typography.caption, fontSize: 10 },
  locked: { opacity: 0.5 },
})
