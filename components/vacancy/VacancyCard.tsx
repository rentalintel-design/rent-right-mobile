import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRent, formatAvailable, daysAgo } from '@/lib/vacancyUtils'
import type { Vacancy } from '@/hooks/useVacancies'

type Props = {
  vacancy: Vacancy
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
}

export default function VacancyCard({ vacancy, isFavorite, onToggleFavorite }: Props) {
  const c = useColors()
  const photo = vacancy.photos?.[0]
  const photoCount = vacancy.photos?.length ?? 0
  const location = [vacancy.sublocality_name, vacancy.society_name].filter(Boolean).join(' · ')

  return (
    <Pressable
      style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}
      onPress={() => router.push(`/vacancy/${vacancy.id}`)}
    >
      {/* Thumbnail */}
      <View style={styles.thumbContainer}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: c.bgSubtle }]}>
            <Text style={styles.thumbEmoji}>🏠</Text>
          </View>
        )}
        {/* Photo count badge */}
        {photoCount > 1 && (
          <View style={[styles.photoBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <Text style={styles.photoBadgeText}>+{photoCount - 1}</Text>
          </View>
        )}
        {/* Favorite button */}
        <Pressable
          style={styles.heartBtn}
          onPress={() => onToggleFavorite(vacancy.id)}
          hitSlop={8}
        >
          <Text style={{ fontSize: 18 }}>{isFavorite ? '❤️' : '🤍'}</Text>
        </Pressable>
      </View>

      {/* Info */}
      <View style={styles.info}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[Typography.subtitle, { color: c.text1, flex: 1 }]} numberOfLines={1}>
            {vacancy.bhk_type} for rent
          </Text>
          {vacancy.source === 'reddit' && (
            <View style={[styles.badge, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
              <Text style={[Typography.caption, { color: c.text3, fontSize: 10 }]}>Reddit</Text>
            </View>
          )}
        </View>

        {/* Rent */}
        <Text style={[Typography.body, { color: c.accent, fontWeight: '700', marginTop: 2 }]}>
          {formatRent(vacancy.asking_rent)}/mo
          {vacancy.deposit ? (
            <Text style={[Typography.caption, { color: c.text3, fontWeight: '400' }]}>
              {' '}· Dep {formatRent(vacancy.deposit)}
            </Text>
          ) : null}
        </Text>

        {/* Location */}
        {location ? (
          <Text style={[Typography.caption, { color: c.text3, marginTop: 4 }]} numberOfLines={1}>
            📍 {location}
          </Text>
        ) : null}

        {/* Notes */}
        {vacancy.notes && (
          <Text style={[Typography.caption, { color: c.text4, marginTop: 4 }]} numberOfLines={2}>
            {vacancy.notes}
          </Text>
        )}

        {/* Chips */}
        <View style={styles.chipRow}>
          <Chip label={formatAvailable(vacancy.available_from)} c={c} />
          <Chip label={daysAgo(vacancy.created_at)} c={c} />
        </View>
      </View>
    </Pressable>
  )
}

function Chip({ label, c }: { label: string; c: any }) {
  return (
    <View style={[styles.chip, { backgroundColor: c.bgSubtle }]}>
      <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  thumbContainer: {
    width: 100,
    height: 120,
  },
  thumb: {
    width: 100,
    height: 120,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 32 },
  photoBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  photoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  heartBtn: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
  },
  info: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', marginTop: Spacing.sm },
  chip: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
})
