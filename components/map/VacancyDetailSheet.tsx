import React, { useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, Pressable, Dimensions, Linking, Share } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRentShort } from '@/lib/mapUtils'
import type { Vacancy } from '@/hooks/useVacancies'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const PHOTO_WIDTH = SCREEN_WIDTH - 48

type Props = {
  vacancy: Vacancy | null
  visible: boolean
  onClose: () => void
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
}

export default function VacancyDetailSheet({ vacancy, visible, onClose, isFavorite, onToggleFavorite }: Props) {
  const c = useColors()
  const sheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['40%', '85%'], [])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  if (!vacancy || !visible) return null

  const photos = vacancy.photos ?? []
  const location = [vacancy.locality_name, vacancy.sublocality_name, vacancy.city].filter(Boolean).join(', ')

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      onClose={handleClose}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: c.bgSurface }}
      handleIndicatorStyle={{ backgroundColor: c.text4 }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Photos */}
        {photos.length > 0 && (
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            style={styles.photoList}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={[styles.photo, { width: PHOTO_WIDTH }]}
                contentFit="cover" transition={200}
              />
            )}
          />
        )}

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.title, { color: c.text1 }]}>
              {vacancy.bhk_type} · {formatRentShort(vacancy.asking_rent)}/mo
            </Text>
            <Text style={[Typography.caption, { color: c.text3, marginTop: 2 }]}>{location}</Text>
          </View>
          <Pressable onPress={() => onToggleFavorite(vacancy.id)} style={styles.heartBtn}>
            <Text style={{ fontSize: 22 }}>{isFavorite ? '❤️' : '🤍'}</Text>
          </Pressable>
        </View>

        {/* Key Facts */}
        <View style={[styles.factsGrid, { borderColor: c.border }]}>
          <Fact label="Deposit" value={vacancy.deposit ? formatRentShort(vacancy.deposit) : '—'} c={c} />
          <Fact label="Available" value={vacancy.available_from ? new Date(vacancy.available_from).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Now'} c={c} />
          <Fact label="Listed" value={new Date(vacancy.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} c={c} />
          <Fact label="Source" value={vacancy.source === 'reddit' ? 'Reddit' : 'User'} c={c} />
        </View>

        {/* Details */}
        {(vacancy.furnishing || vacancy.property_type) && (
          <View style={styles.section}>
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Details</Text>
            <View style={styles.chipRow}>
              {vacancy.property_type && <Chip label={vacancy.property_type.replace(/_/g, ' ')} c={c} />}
              {vacancy.furnishing && <Chip label={vacancy.furnishing.replace(/_/g, ' ')} c={c} />}
              {vacancy.preference && <Chip label={vacancy.preference} c={c} />}
            </View>
          </View>
        )}

        {/* Description */}
        {vacancy.description && (
          <View style={styles.section}>
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Description</Text>
            <Text style={[Typography.body, { color: c.text2 }]}>{vacancy.description}</Text>
          </View>
        )}

        {vacancy.notes && !vacancy.description && (
          <View style={styles.section}>
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Notes</Text>
            <Text style={[Typography.body, { color: c.text2 }]}>{vacancy.notes}</Text>
          </View>
        )}

        {/* Action row */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Pressable
            style={[styles.detailsBtn, { borderColor: c.border, flex: 1 }]}
            onPress={() => { onClose(); router.push(`/vacancy/${vacancy.id}`) }}
          >
            <Text style={[Typography.subtitle, { color: c.text2 }]}>View details →</Text>
          </Pressable>
          <Pressable
            style={[styles.detailsBtn, { borderColor: c.border }]}
            onPress={() => {
              const loc = [vacancy.locality_name, vacancy.sublocality_name].filter(Boolean).join(', ') || vacancy.city
              const text = `Check out this ${vacancy.bhk_type} in ${loc} for ${formatRentShort(vacancy.asking_rent)}/mo on Rent Right`
              const url = `https://rent-right-seven.vercel.app/vacancy/${vacancy.id}`
              Share.share({ message: `${text}\n${url}` })
            }}
          >
            <Text style={[Typography.subtitle, { color: c.text2 }]}>↗</Text>
          </Pressable>
        </View>

        {/* Contact */}
        <Pressable
          style={[styles.contactBtn, { backgroundColor: c.accent }]}
          onPress={() => Linking.openURL(`tel:${vacancy.contact_phone}`)}
        >
          <Text style={[Typography.subtitle, { color: '#fff' }]}>
            Call {vacancy.contact_phone}
          </Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

function Fact({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={styles.factItem}>
      <Text style={[Typography.caption, { color: c.text4 }]}>{label}</Text>
      <Text style={[Typography.body, { color: c.text1, fontWeight: '600' }]}>{value}</Text>
    </View>
  )
}

function Chip({ label, c }: { label: string; c: any }) {
  return (
    <View style={[styles.chip, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
      <Text style={[Typography.caption, { color: c.text2, textTransform: 'capitalize' }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },
  photoList: { marginHorizontal: -Spacing.xl, marginBottom: Spacing.base },
  photo: { height: 200, borderRadius: Radius.md, marginHorizontal: Spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.base },
  heartBtn: { padding: Spacing.sm },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  factItem: { width: '45%', gap: 2 },
  section: { marginBottom: Spacing.base },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1 },
  detailsBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  contactBtn: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
})
