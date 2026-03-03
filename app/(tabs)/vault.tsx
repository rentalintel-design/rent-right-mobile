import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, Pressable, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { countPhotos, getAllRooms } from 'rent-right-shared'
import type { VaultRecord, VaultFloor, VaultRoom } from 'rent-right-shared'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#374151', text: '#9ca3af' },
  shared: { bg: '#7c2d12', text: '#fb923c' },
  changes_requested: { bg: '#78350f', text: '#fbbf24' },
  accepted: { bg: '#14532d', text: '#4ade80' },
}

export default function VaultScreen() {
  const c = useColors()
  const { user } = useAuth()
  const [records, setRecords] = useState<VaultRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRecords = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('vault_records')
      .select('*')
      .or(`user_id.eq.${user.id},other_party_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (!error && data) setRecords(data as VaultRecord[])
    setLoading(false)
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      fetchRecords()
    }, [fetchRecords])
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRecords()
    setRefreshing(false)
  }, [fetchRecords])

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[Typography.title, { color: c.text1 }]}>Vault</Text>
        <Pressable
          style={[styles.createBtn, { backgroundColor: c.accent }]}
          onPress={() => router.push('/vault/create')}
        >
          <Text style={[Typography.caption, { color: '#fff', fontWeight: '600' }]}>+ New Record</Text>
        </Pressable>
      </View>

      <FlatList
        data={records}
        keyExtractor={r => r.id ?? ''}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />
        }
        renderItem={({ item }) => <VaultCard record={item} c={c} />}
        ListEmptyComponent={<EmptyState c={c} />}
      />
    </SafeAreaView>
  )
}

function VaultCard({ record, c }: { record: VaultRecord; c: any }) {
  const floors = (record.floors ?? []) as VaultFloor[]
  const roomData = (record.room_data ?? {}) as Record<string, VaultRoom>
  const rooms = getAllRooms(floors)
  const photos = countPhotos(roomData)
  const furnishings = (record.furnishings ?? []).length
  const status = record.sharing_status ?? 'draft'
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.draft

  return (
    <Pressable
      style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}
      onPress={() => router.push(`/vault/${record.id}`)}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.subtitle, { color: c.text1 }]}>
            {record.property_type ?? '—'} {record.is_locked ? '🔒' : ''}
          </Text>
          {record.property_address && (
            <Text style={[Typography.caption, { color: c.text3, marginTop: 2 }]} numberOfLines={1}>
              📍 {record.property_address}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
          <Text style={[Typography.caption, { color: statusColor.text, fontSize: 10, textTransform: 'capitalize' }]}>
            {status.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Stat icon="📸" value={photos} label="photos" c={c} />
        <Stat icon="🚪" value={rooms.length} label="rooms" c={c} />
        <Stat icon="🪑" value={furnishings} label="items" c={c} />
      </View>

      <Text style={[Typography.caption, { color: c.text4 }]}>
        Created {record.created_at ? new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
      </Text>
    </Pressable>
  )
}

function Stat({ icon, value, label, c }: { icon: string; value: number; label: string; c: any }) {
  return (
    <View style={styles.stat}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={[Typography.caption, { color: c.text2, fontWeight: '600' }]}>{value}</Text>
      <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>{label}</Text>
    </View>
  )
}

function EmptyState({ c }: { c: any }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 48, marginBottom: Spacing.base }}>🛡️</Text>
      <Text style={[Typography.subtitle, { color: c.text1, textAlign: 'center', marginBottom: Spacing.md }]}>
        No vault records yet
      </Text>
      <Text style={[Typography.caption, { color: c.text3, textAlign: 'center', lineHeight: 20 }]}>
        Create a move-in record to document your rental property with photos and furnishings.
      </Text>
      <View style={styles.features}>
        {['📸 Photo evidence per room', '🔒 Mutually locked with timestamp', '🪑 Complete furnishing inventory'].map(f => (
          <Text key={f} style={[Typography.caption, { color: c.text4 }]}>{f}</Text>
        ))}
      </View>
      <Pressable
        style={[styles.emptyBtn, { backgroundColor: c.accent }]}
        onPress={() => router.push('/vault/create')}
      >
        <Text style={[Typography.subtitle, { color: '#fff' }]}>Create Record</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  createBtn: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  list: { paddingTop: Spacing.sm, paddingBottom: Spacing['3xl'] },
  card: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statsRow: { flexDirection: 'row', gap: Spacing.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  features: { gap: Spacing.xs, marginTop: Spacing.lg, marginBottom: Spacing.lg },
  emptyBtn: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
})
