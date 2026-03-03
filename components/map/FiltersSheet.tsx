import React, { useCallback, useMemo, useRef } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import BottomSheet from '@gorhom/bottom-sheet'
import { useColors } from '@/hooks/use-theme-color'
import { Spacing, Radius, Typography } from '@/constants/theme'
import type { BhkFilter, RentFilter, SourceFilter, FurnishingFilter } from '@/hooks/useVacancies'

type Props = {
  visible: boolean
  onClose: () => void
  bhkFilter: BhkFilter
  rentFilter: RentFilter
  sourceFilter: SourceFilter
  furnishingFilter: FurnishingFilter
  onBhk: (f: BhkFilter) => void
  onRent: (f: RentFilter) => void
  onSource: (f: SourceFilter) => void
  onFurnishing: (f: FurnishingFilter) => void
  onClearAll: () => void
}

const BHK_OPTIONS: BhkFilter[] = ['All', '1BHK', '2BHK', '3BHK', '4BHK+']
const RENT_OPTIONS: RentFilter[] = ['All', 'Under ₹20k', '₹20-35k', '₹35-50k', '₹50k+']
const SOURCE_OPTIONS: SourceFilter[] = ['All', 'User', 'Reddit']
const FURNISHING_OPTIONS: FurnishingFilter[] = ['All', 'Furnished', 'Semi-Furnished', 'Unfurnished']

export default function FiltersSheet({
  visible, onClose, bhkFilter, rentFilter, sourceFilter, furnishingFilter,
  onBhk, onRent, onSource, onFurnishing, onClearAll,
}: Props) {
  const c = useColors()
  const sheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['65%'], [])

  if (!visible) return null

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: c.bgSurface }}
      handleIndicatorStyle={{ backgroundColor: c.text4 }}
    >
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[Typography.title, { color: c.text1 }]}>Filters</Text>
          <Pressable onPress={onClearAll}>
            <Text style={[Typography.body, { color: c.accent }]}>Clear all</Text>
          </Pressable>
        </View>

        <FilterGroup label="BHK Type" options={BHK_OPTIONS} selected={bhkFilter} onSelect={onBhk} c={c} />
        <FilterGroup label="Monthly Rent" options={RENT_OPTIONS} selected={rentFilter} onSelect={onRent} c={c} />
        <FilterGroup label="Source" options={SOURCE_OPTIONS} selected={sourceFilter} onSelect={onSource} c={c} />
        <FilterGroup label="Furnishing" options={FURNISHING_OPTIONS} selected={furnishingFilter} onSelect={onFurnishing} c={c} />

        <Pressable style={[styles.applyBtn, { backgroundColor: c.accent }]} onPress={onClose}>
          <Text style={[Typography.subtitle, { color: '#fff' }]}>Apply</Text>
        </Pressable>
      </View>
    </BottomSheet>
  )
}

function FilterGroup<T extends string>({ label, options, selected, onSelect, c }: {
  label: string; options: T[]; selected: T; onSelect: (v: T) => void; c: any
}) {
  return (
    <View style={styles.group}>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.sm }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(opt => (
          <Pressable
            key={opt}
            style={[styles.chip, {
              backgroundColor: selected === opt ? c.accent : c.bgSubtle,
              borderColor: selected === opt ? c.accent : c.border,
            }]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[Typography.caption, { color: selected === opt ? '#fff' : c.text2 }]}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  group: { marginBottom: Spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  applyBtn: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
})
