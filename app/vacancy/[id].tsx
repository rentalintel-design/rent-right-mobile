import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Dimensions, ActivityIndicator, FlatList, Alert, Linking, Share, Modal,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRent, formatAvailable } from '@/lib/vacancyUtils'
import { getCached, setCache } from '@/lib/cache'
import type { Vacancy } from '@/hooks/useVacancies'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function VacancyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useColors()
  const { user } = useAuth()

  const [vacancy, setVacancy] = useState<Vacancy | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxVisible, setLightboxVisible] = useState(false)

  useEffect(() => {
    if (!id) return
    const cacheKey = `vacancy:${id}`
    const load = async () => {
      // Show cached immediately
      const cached = await getCached<Vacancy>(cacheKey, 5 * 60 * 1000)
      if (cached) {
        setVacancy(cached.data)
        setLoading(false)
        if (!cached.stale) return
      }
      // Fetch fresh
      const { data, error } = await supabase
        .from('vacancies')
        .select('*')
        .eq('id', id)
        .single()
      if (!error && data) {
        setVacancy(data as Vacancy)
        setCache(cacheKey, data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!user?.id || !id) return
    supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('vacancy_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavorite(!!data))
  }, [user?.id, id])

  const toggleFavorite = useCallback(async () => {
    if (!user?.id || !vacancy) return
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('vacancy_id', vacancy.id)
      setIsFavorite(false)
    } else {
      // Check cap
      const { count } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if ((count ?? 0) >= 5) {
        Alert.alert('Limit reached', 'You can save up to 5 vacancies. Remove one before adding another.')
        return
      }
      await supabase.from('favorites').insert({ user_id: user.id, vacancy_id: vacancy.id })
      setIsFavorite(true)
    }
  }, [user?.id, vacancy, isFavorite])

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!vacancy) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>Vacancy not found</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: c.accent }]}>
            <Text style={[Typography.caption, { color: '#fff' }]}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const photos = vacancy.photos ?? []
  const location = [vacancy.sublocality_name, vacancy.society_name].filter(Boolean).join(' · ')

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Back button */}
      <Pressable style={styles.backFab} onPress={() => router.back()}>
        <Text style={{ fontSize: 20 }}>←</Text>
      </Pressable>

      {/* Share button */}
      <Pressable
        style={styles.shareFab}
        onPress={() => {
          const loc = [vacancy.locality_name, vacancy.sublocality_name].filter(Boolean).join(', ') || vacancy.city
          const text = `Check out this ${vacancy.bhk_type} in ${loc} for ${formatRent(vacancy.asking_rent)}/mo on Rent Right`
          const url = `https://rent-right-seven.vercel.app/vacancy/${vacancy.id}`
          Share.share({ message: `${text}\n${url}` })
        }}
      >
        <Text style={{ fontSize: 18 }}>↗</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Photo carousel */}
        {photos.length > 0 ? (
          <View style={styles.carousel}>
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onMomentumScrollEnd={e => {
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
              }}
              renderItem={({ item, index }) => (
                <Pressable onPress={() => { setLightboxIndex(index); setLightboxVisible(true) }}>
                  <Image source={{ uri: item }} style={[styles.carouselPhoto, { width: SCREEN_WIDTH }]} contentFit="cover" transition={200} />
                </Pressable>
              )}
            />
            {/* Dots */}
            {photos.length > 1 && (
              <View style={styles.dots}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i === photoIndex ? '#fff' : 'rgba(255,255,255,0.4)' }]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: c.bgSubtle }]}>
            <Text style={{ fontSize: 48 }}>🏠</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Rent heading */}
          <View style={styles.rentRow}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.display, { color: c.text1 }]}>
                {formatRent(vacancy.asking_rent)}
                <Text style={[Typography.body, { color: c.text3 }]}>/month</Text>
              </Text>
              <View style={styles.bhkBadge}>
                <View style={[styles.badge, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
                  <Text style={[Typography.caption, { color: c.text2, fontWeight: '600' }]}>{vacancy.bhk_type}</Text>
                </View>
                {vacancy.source === 'reddit' && (
                  <View style={[styles.badge, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
                    <Text style={[Typography.caption, { color: c.text3 }]}>Reddit</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Location */}
          {location ? (
            <Text style={[Typography.body, { color: c.text3, marginBottom: Spacing.base }]}>
              📍 {location}
            </Text>
          ) : null}

          {/* Key facts grid */}
          <View style={[styles.factsGrid, { borderColor: c.border }]}>
            <Fact label="Deposit" value={vacancy.deposit ? formatRent(vacancy.deposit) : '—'} c={c} />
            <Fact label="Available" value={formatAvailable(vacancy.available_from)} c={c} />
            <Fact
              label="Listed"
              value={new Date(vacancy.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              c={c}
            />
            <Fact
              label="Expires"
              value={new Date(vacancy.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              c={c}
            />
          </View>

          {/* Property details */}
          {(vacancy.furnishing || vacancy.property_type || vacancy.area_sqft || vacancy.parking_bike || vacancy.parking_car || vacancy.preference) && (
            <View style={[styles.section, styles.detailsBox, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Property Details</Text>
              <View style={styles.chipRow}>
                {vacancy.property_type && <Chip label={vacancy.property_type.replace(/_/g, ' ')} c={c} />}
                {vacancy.furnishing && <Chip label={vacancy.furnishing.replace(/_/g, ' ')} c={c} />}
                {vacancy.preference && <Chip label={`👥 ${vacancy.preference}`} c={c} />}
              </View>
              {(vacancy.area_sqft || vacancy.parking_bike || vacancy.parking_car || vacancy.landmark) && (
                <View style={[styles.statsGrid, { marginTop: Spacing.md }]}>
                  {vacancy.area_sqft ? <StatItem icon="📐" label={`${vacancy.area_sqft} sq ft`} c={c} /> : null}
                  {vacancy.parking_bike ? <StatItem icon="🏍" label={`${vacancy.parking_bike} bike spot${vacancy.parking_bike > 1 ? 's' : ''}`} c={c} /> : null}
                  {vacancy.parking_car ? <StatItem icon="🚗" label={`${vacancy.parking_car} car spot${vacancy.parking_car > 1 ? 's' : ''}`} c={c} /> : null}
                  {vacancy.landmark ? <StatItem icon="📍" label={vacancy.landmark} c={c} /> : null}
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {vacancy.description && (
            <View style={styles.section}>
              <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Description</Text>
              <Text style={[Typography.body, { color: c.text2, lineHeight: 22 }]}>{vacancy.description}</Text>
            </View>
          )}

          {/* Notes */}
          {vacancy.notes && (
            <View style={styles.section}>
              <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Notes</Text>
              <View style={[styles.notesBox, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
                <Text style={[Typography.body, { color: c.text2, lineHeight: 22 }]}>{vacancy.notes}</Text>
              </View>
            </View>
          )}

          {/* Contact section */}
          <View style={[styles.section, styles.contactBox, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.md }]}>Contact Landlord</Text>
            <Pressable
              style={[styles.chatBtn, { backgroundColor: c.accent }]}
              onPress={async () => {
                if (!user?.id || !vacancy) return
                const { data: existing } = await supabase
                  .from('conversations')
                  .select('id')
                  .eq('tenant_id', user.id)
                  .eq('vacancy_id', vacancy.id)
                  .single()
                if (existing?.id) { router.push(`/chat/${existing.id}`); return }
                const { data: created } = await supabase
                  .from('conversations')
                  .insert({ tenant_id: user.id, landlord_id: vacancy.user_id, vacancy_id: vacancy.id })
                  .select('id')
                  .single()
                if (created?.id) router.push(`/chat/${created.id}`)
              }}
            >
              <Text style={[Typography.subtitle, { color: '#fff' }]}>💬 Message Landlord</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom: Favorite button */}
      <View style={[styles.footer, { backgroundColor: c.bgPage, borderTopColor: c.border }]}>
        <Pressable
          style={[styles.favBtn, { backgroundColor: isFavorite ? '#ef4444' : c.bgSurface, borderColor: isFavorite ? '#ef4444' : c.border }]}
          onPress={toggleFavorite}
        >
          <Text style={[Typography.subtitle, { color: isFavorite ? '#fff' : c.text2 }]}>
            {isFavorite ? '❤️  Saved' : '🤍  Save Vacancy'}
          </Text>
        </Pressable>
      </View>

      {/* Lightbox / full-screen photo viewer */}
      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <View style={styles.lightboxBg}>
          <FlatList
            data={vacancy?.photos ?? []}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            initialScrollIndex={lightboxIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: '100%' }} contentFit="contain" />
            )}
          />
          <Pressable style={styles.lightboxClose} onPress={() => setLightboxVisible(false)}>
            <Text style={{ color: '#fff', fontSize: 28 }}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
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
    <View style={[styles.chipItem, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
      <Text style={[Typography.caption, { color: c.text2, textTransform: 'capitalize' }]}>{label}</Text>
    </View>
  )
}

function StatItem({ icon, label, c }: { icon: string; label: string; c: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={[Typography.caption, { color: c.text2 }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  backBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  backFab: {
    position: 'absolute',
    top: 56,
    left: Spacing.base,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareFab: {
    position: 'absolute',
    top: 56,
    right: Spacing.base,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: 100 },
  carousel: { position: 'relative' },
  carouselPhoto: { height: 260 },
  dots: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  photoPlaceholder: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: Spacing.base },
  rentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xs },
  bhkBadge: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 3, borderWidth: 1 },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  factItem: { width: '45%', gap: 3 },
  section: { marginBottom: Spacing.base },
  detailsBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chipItem: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, borderWidth: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, width: '45%' },
  notesBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  contactBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  chatBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.base,
    borderTopWidth: 1,
  },
  favBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  lightboxBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 56,
    right: Spacing.base,
    padding: Spacing.sm,
  },
})
