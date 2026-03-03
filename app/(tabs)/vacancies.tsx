import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, ScrollView, Pressable,
  StyleSheet, RefreshControl, ActivityIndicator, Alert, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { CITY_BOUNDS } from 'rent-right-shared'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useVacancies, BhkFilter, RentFilter, FurnishingFilter, Vacancy } from '@/hooks/useVacancies'
import { useMembership } from '@/hooks/useMembership'
import VacancyCard from '@/components/vacancy/VacancyCard'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRent, daysAgo } from '@/lib/vacancyUtils'

const BHK_OPTIONS: BhkFilter[] = ['All', '1BHK', '2BHK', '3BHK', '4BHK+']
const RENT_OPTIONS: RentFilter[] = ['All', 'Under ₹20k', '₹20-35k', '₹35-50k', '₹50k+']
const FURNISHING_OPTIONS: FurnishingFilter[] = ['All', 'Furnished', 'Semi-Furnished', 'Unfurnished']

const STATUS_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: '#9ca3af20', text: '#9ca3af' },
  active: { label: 'Active', bg: '#22c55e20', text: '#22c55e' },
  booked: { label: 'Booked', bg: '#fb923c20', text: '#fb923c' },
  rented_out: { label: 'Rented', bg: '#3b82f620', text: '#3b82f6' },
}

type Tab = 'browse' | 'my_listings'

export default function VacanciesScreen() {
  const c = useColors()
  const { profile, user } = useAuth()
  const isLandlord = profile?.role === 'landlord'

  const [tab, setTab] = useState<Tab>('browse')
  const [bhkFilter, setBhkFilter] = useState<BhkFilter>('All')
  const [rentFilter, setRentFilter] = useState<RentFilter>('All')
  const [furnishingFilter, setFurnishingFilter] = useState<FurnishingFilter>('All')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const cityName = (profile?.city ?? 'bengaluru').toLowerCase()
  const cityBounds = CITY_BOUNDS[cityName as keyof typeof CITY_BOUNDS]
  const bounds = cityBounds
    ? { latMin: cityBounds.south, latMax: cityBounds.north, lngMin: cityBounds.west, lngMax: cityBounds.east }
    : undefined

  const { filteredVacancies, favoriteIds, toggleFavorite, refresh } = useVacancies({
    cityName,
    bounds,
    bhkFilter,
    rentFilter,
    sourceFilter: 'All',
    furnishingFilter,
    favoritesOnly,
    userId: user?.id,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    if (tab === 'browse') refresh()
    else fetchMyListings()
    setTimeout(() => setRefreshing(false), 1200)
  }, [refresh, tab])

  // My Listings state
  const [myListings, setMyListings] = useState<Vacancy[]>([])
  const [myLoading, setMyLoading] = useState(false)
  const { canPostAsLandlord, refresh: refreshMembership } = useMembership(user?.id)

  const fetchMyListings = useCallback(async () => {
    if (!user?.id) return
    setMyLoading(true)
    const { data } = await supabase
      .from('vacancies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setMyListings(data as Vacancy[])
    setMyLoading(false)
  }, [user?.id])

  useFocusEffect(useCallback(() => {
    if (tab === 'my_listings') fetchMyListings()
  }, [tab, fetchMyListings]))

  useEffect(() => {
    if (tab === 'my_listings') fetchMyListings()
  }, [tab])

  const handlePublish = useCallback(async (vacancy: Vacancy) => {
    await refreshMembership()
    if (!canPostAsLandlord) {
      Alert.alert('Quota exceeded', 'Purchase a landlord plan to post more vacancies.')
      return
    }
    Alert.alert('Publish', 'Make this vacancy visible to tenants?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish', onPress: async () => {
          await supabase.from('vacancies').update({ status: 'active' }).eq('id', vacancy.id)
          fetchMyListings()
        },
      },
    ])
  }, [canPostAsLandlord, refreshMembership, fetchMyListings])

  const handleStatusChange = useCallback(async (vacancyId: string, newStatus: string) => {
    const label = newStatus === 'booked' ? 'Booked' : 'Rented Out'
    Alert.alert(`Mark as ${label}?`, 'This will hide the listing from tenants.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          await supabase.from('vacancies').update({ status: newStatus }).eq('id', vacancyId)
          fetchMyListings()
        },
      },
    ])
  }, [fetchMyListings])

  const handleExtend = useCallback(async (vacancy: Vacancy) => {
    const newExpiry = new Date(new Date(vacancy.expires_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    Alert.alert('Extend 30 days?', `New expiry: ${new Date(newExpiry).toLocaleDateString('en-IN')}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Extend', onPress: async () => {
          await supabase.from('vacancies').update({ expires_at: newExpiry }).eq('id', vacancy.id)
          fetchMyListings()
        },
      },
    ])
  }, [fetchMyListings])

  const handleDelete = useCallback(async (vacancyId: string) => {
    Alert.alert('Delete listing?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('vacancies').delete().eq('id', vacancyId)
          fetchMyListings()
        },
      },
    ])
  }, [fetchMyListings])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.title, { color: c.text1 }]}>Vacancies</Text>
          {tab === 'browse' && (
            <Text style={[Typography.caption, { color: c.text3 }]}>
              {cityName} · {filteredVacancies.length} listing{filteredVacancies.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        {tab === 'browse' && (
          <Pressable
            style={[styles.favToggle, { backgroundColor: favoritesOnly ? c.accent : c.bgSubtle, borderColor: favoritesOnly ? c.accent : c.border }]}
            onPress={() => setFavoritesOnly(v => !v)}
          >
            <Text style={[Typography.caption, { color: favoritesOnly ? '#fff' : c.text3 }]}>
              {favoritesOnly ? '❤️ Saved' : '🤍 Saved'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Tab toggle for landlords */}
      {isLandlord && (
        <View style={[styles.tabRow, { borderBottomColor: c.border }]}>
          <Pressable
            style={[styles.tabBtn, tab === 'browse' && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab('browse')}
          >
            <Text style={[Typography.caption, { color: tab === 'browse' ? c.accent : c.text3, fontWeight: '600' }]}>Browse</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'my_listings' && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab('my_listings')}
          >
            <Text style={[Typography.caption, { color: tab === 'my_listings' ? c.accent : c.text3, fontWeight: '600' }]}>My Listings</Text>
          </Pressable>
        </View>
      )}

      {tab === 'browse' ? (
        <>
          {/* Filter chips */}
          <View style={[styles.filtersWrapper, { borderBottomColor: c.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {BHK_OPTIONS.map(opt => (
                <FilterChip key={opt} label={opt === 'All' ? 'BHK: All' : opt} active={bhkFilter === opt} onPress={() => setBhkFilter(opt)} c={c} />
              ))}
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              {RENT_OPTIONS.filter(o => o !== 'All').map(opt => (
                <FilterChip key={opt} label={opt} active={rentFilter === opt} onPress={() => setRentFilter(rentFilter === opt ? 'All' : opt)} c={c} />
              ))}
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              {FURNISHING_OPTIONS.filter(o => o !== 'All').map(opt => (
                <FilterChip key={opt} label={opt} active={furnishingFilter === opt} onPress={() => setFurnishingFilter(furnishingFilter === opt ? 'All' : opt)} c={c} />
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredVacancies}
            keyExtractor={v => v.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
            renderItem={({ item }) => (
              <VacancyCard vacancy={item} isFavorite={favoriteIds.has(item.id)} onToggleFavorite={toggleFavorite} />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                {!bounds ? (
                  <ActivityIndicator color={c.accent} />
                ) : (
                  <>
                    <Text style={{ fontSize: 36, marginBottom: Spacing.base }}>🏠</Text>
                    <Text style={[Typography.subtitle, { color: c.text2, textAlign: 'center' }]}>
                      {favoritesOnly ? 'No saved vacancies' : 'No vacancies match your filters'}
                    </Text>
                    <Text style={[Typography.caption, { color: c.text4, textAlign: 'center', marginTop: Spacing.sm }]}>
                      {favoritesOnly ? 'Tap the heart on any listing to save it here.' : 'Try changing or clearing the filters above.'}
                    </Text>
                  </>
                )}
              </View>
            }
          />
        </>
      ) : (
        /* My Listings */
        <>
          {myLoading ? (
            <View style={styles.empty}><ActivityIndicator color={c.accent} size="large" /></View>
          ) : (
            <FlatList
              data={myListings}
              keyExtractor={v => v.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
              renderItem={({ item }) => (
                <MyListingCard
                  vacancy={item}
                  c={c}
                  onPublish={() => handlePublish(item)}
                  onEdit={() => router.push(`/vacancy/create?id=${item.id}`)}
                  onMarkBooked={() => handleStatusChange(item.id, 'booked')}
                  onMarkRented={() => handleStatusChange(item.id, 'rented_out')}
                  onExtend={() => handleExtend(item)}
                  onDelete={() => handleDelete(item.id)}
                  onShare={() => {
                    const loc = item.notes || item.city
                    const text = `Check out this ${item.bhk_type} in ${loc} for ${formatRent(item.asking_rent)}/mo on Rent Right`
                    const url = `https://rent-right-seven.vercel.app/vacancy/${item.id}`
                    Share.share({ message: `${text}\n${url}` })
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={{ fontSize: 36, marginBottom: Spacing.base }}>📋</Text>
                  <Text style={[Typography.subtitle, { color: c.text2, textAlign: 'center' }]}>No listings yet</Text>
                  <Text style={[Typography.caption, { color: c.text4, textAlign: 'center', marginTop: Spacing.sm }]}>
                    Post your first vacancy to find tenants.
                  </Text>
                </View>
              }
            />
          )}

          {/* FAB */}
          <Pressable
            style={[styles.fab, { backgroundColor: c.accent }]}
            onPress={() => router.push('/vacancy/create')}
          >
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '300' }}>＋</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  )
}

/* My Listing Card */
function MyListingCard({
  vacancy, c, onPublish, onEdit, onMarkBooked, onMarkRented, onExtend, onDelete, onShare,
}: {
  vacancy: Vacancy; c: any
  onPublish: () => void; onEdit: () => void
  onMarkBooked: () => void; onMarkRented: () => void
  onExtend: () => void; onDelete: () => void; onShare: () => void
}) {
  const status = vacancy.status ?? 'draft'
  const statusInfo = STATUS_COLORS[status] ?? STATUS_COLORS.draft
  const expiresAt = new Date(vacancy.expires_at)
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <View style={[styles.listingCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
      <View style={styles.listingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.subtitle, { color: c.text1 }]}>
            {vacancy.bhk_type} · {formatRent(vacancy.asking_rent)}
          </Text>
          {vacancy.notes && (
            <Text style={[Typography.caption, { color: c.text3 }]} numberOfLines={1}>{vacancy.notes}</Text>
          )}
          <Text style={[Typography.caption, { color: c.text4, marginTop: 2 }]}>
            {vacancy.city} · {daysAgo(vacancy.created_at)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[Typography.caption, { color: statusInfo.text, fontSize: 10, fontWeight: '600' }]}>{statusInfo.label}</Text>
        </View>
      </View>

      {status === 'active' && (
        <Text style={[Typography.caption, { color: daysLeft < 7 ? '#ef4444' : c.text4, marginTop: Spacing.xs }]}>
          {daysLeft > 0 ? `Expires in ${daysLeft}d` : 'Expired'}
        </Text>
      )}

      <View style={styles.actionRow}>
        {status === 'draft' && (
          <>
            <ActionBtn label="Publish" color="#22c55e" onPress={onPublish} />
            <ActionBtn label="Edit" color={c.accent} onPress={onEdit} />
          </>
        )}
        {status === 'active' && (
          <>
            <ActionBtn label="Share" color="#22c55e" onPress={onShare} />
            <ActionBtn label="Booked" color="#fb923c" onPress={onMarkBooked} />
            <ActionBtn label="Rented" color="#3b82f6" onPress={onMarkRented} />
            <ActionBtn label="Edit" color={c.accent} onPress={onEdit} />
            <ActionBtn label="Extend" color="#a855f7" onPress={onExtend} />
          </>
        )}
        <ActionBtn label="Delete" color="#ef4444" onPress={onDelete} />
      </View>
    </View>
  )
}

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.actionBtn, { borderColor: color + '40' }]} onPress={onPress}>
      <Text style={[Typography.caption, { color, fontSize: 11, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  )
}

function FilterChip({ label, active, onPress, c }: { label: string; active: boolean; onPress: () => void; c: any }) {
  return (
    <Pressable
      style={[styles.chip, { backgroundColor: active ? c.accent : c.bgSubtle, borderColor: active ? c.accent : c.border }]}
      onPress={onPress}
    >
      <Text style={[Typography.caption, { color: active ? '#fff' : c.text3, fontWeight: active ? '600' : '400' }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  favToggle: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  filtersWrapper: { borderBottomWidth: 1 },
  filters: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  divider: { width: 1, height: 20, marginHorizontal: Spacing.xs },
  list: { paddingTop: Spacing.sm, paddingBottom: Spacing['3xl'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  listingCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  listingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
})
