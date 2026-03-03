import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator, Dimensions, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { getAllRooms, countPhotos } from 'rent-right-shared'
import type { VaultRecord, VaultFloor, VaultRoom, AddedFurnishing } from 'rent-right-shared'
import VaultShareDialog from '@/components/vault/VaultShareDialog'

const PHOTO_SIZE = (Dimensions.get('window').width - Spacing.base * 2 - Spacing.xs * 2) / 3

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#9ca3af' },
  shared: { label: 'Shared', color: '#fb923c' },
  changes_requested: { label: 'Changes Requested', color: '#fbbf24' },
  accepted: { label: 'Accepted', color: '#4ade80' },
}

export default function VaultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useColors()
  const { user } = useAuth()
  const [record, setRecord] = useState<VaultRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [showShare, setShowShare] = useState(false)

  const reloadRecord = useCallback(() => {
    if (!id) return
    supabase.from('vault_records').select('*').eq('id', id).single()
      .then(({ data }) => { if (data) setRecord(data as VaultRecord) })
  }, [id])

  useEffect(() => {
    if (!id) return
    supabase
      .from('vault_records')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setRecord(data as VaultRecord)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!record) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>Record not found</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: c.accent }]}>
            <Text style={[Typography.caption, { color: '#fff' }]}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const floors = (record.floors ?? []) as VaultFloor[]
  const roomData = (record.room_data ?? {}) as Record<string, VaultRoom>
  const furnishings = (record.furnishings ?? []) as AddedFurnishing[]
  const allRooms = getAllRooms(floors)
  const totalPhotos = countPhotos(roomData)
  const status = record.sharing_status ?? 'draft'
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.draft
  const isOwner = user?.id === record.user_id
  const canEdit = isOwner && !record.is_locked && status === 'draft'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <Text style={[Typography.caption, { color: statusInfo.color, fontWeight: '600' }]}>
          {record.is_locked ? '🔒 ' : ''}{statusInfo.label}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Property header */}
        <View style={[styles.section, styles.propertyHeader, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <Text style={[Typography.title, { color: c.text1 }]}>{record.property_type}</Text>
          {record.property_address && (
            <Text style={[Typography.body, { color: c.text3 }]}>📍 {record.property_address}</Text>
          )}
          <View style={styles.metaRow}>
            {record.city && <Text style={[Typography.caption, { color: c.text4 }]}>{record.city}</Text>}
            <Text style={[Typography.caption, { color: c.text4 }]}>
              {record.created_at ? new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={[Typography.caption, { color: c.text3 }]}>📸 {totalPhotos} photos</Text>
            <Text style={[Typography.caption, { color: c.text3 }]}>🚪 {allRooms.length} rooms</Text>
            <Text style={[Typography.caption, { color: c.text3 }]}>🪑 {furnishings.length} items</Text>
          </View>
        </View>

        {/* Furnishings */}
        {furnishings.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>
              Furnishings & Assets ({furnishings.length})
            </Text>
            <View style={styles.furnishingList}>
              {furnishings.map(f => (
                <View key={f.id} style={[styles.furnishingItem, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
                  <Text style={{ fontSize: 16 }}>{f.itemIcon}</Text>
                  <Text style={[Typography.caption, { color: c.text2, flex: 1 }]}>{f.itemName}</Text>
                  {f.quantity > 1 && (
                    <View style={[styles.qtyBadge, { backgroundColor: c.bgSubtle }]}>
                      <Text style={[Typography.caption, { color: c.text3, fontSize: 10 }]}>×{f.quantity}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rooms */}
        <View style={styles.section}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.md }]}>
            Rooms ({allRooms.length})
          </Text>
          {allRooms.map(room => {
            const media = roomData[room.instanceId]?.media ?? []
            return (
              <View key={room.instanceId} style={[styles.roomSection, { borderColor: c.border }]}>
                <View style={styles.roomHeader}>
                  <Text style={{ fontSize: 20 }}>{room.config.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.subtitle, { color: c.text1 }]}>{room.config.name}</Text>
                    <Text style={[Typography.caption, { color: c.text4 }]}>Floor {room.floorIndex}</Text>
                  </View>
                  <Text style={[Typography.caption, { color: c.text3 }]}>{media.length} photo{media.length !== 1 ? 's' : ''}</Text>
                </View>

                {media.length > 0 ? (
                  <View style={styles.photoGrid}>
                    {media.filter(m => !m.isVideo).map(m => (
                      <Image
                        key={m.id}
                        source={{ uri: m.url }}
                        style={[styles.photo, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
                        contentFit="cover" transition={200}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={[Typography.caption, { color: c.text4, fontStyle: 'italic', marginTop: Spacing.xs }]}>
                    No photos for this room
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Footer buttons */}
      {isOwner && (
        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bgPage }]}>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {canEdit && (
              <Pressable
                style={[styles.editBtn, { backgroundColor: c.bgSubtle, borderColor: c.border, borderWidth: 1, flex: 1 }]}
                onPress={() => router.push(`/vault/create?id=${record.id}`)}
              >
                <Text style={[Typography.subtitle, { color: c.text2 }]}>Edit</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.editBtn, { backgroundColor: c.accent, flex: 1 }]}
              onPress={() => setShowShare(true)}
            >
              <Text style={[Typography.subtitle, { color: '#fff' }]}>Share</Text>
            </Pressable>
          </View>
        </View>
      )}

      {record && (
        <VaultShareDialog
          visible={showShare}
          record={record}
          onClose={() => setShowShare(false)}
          onShared={() => { setShowShare(false); reloadRecord() }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  backBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  body: { padding: Spacing.base, paddingBottom: 100 },
  section: { marginBottom: Spacing.lg },
  propertyHeader: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  metaRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  furnishingList: { gap: Spacing.xs },
  furnishingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  qtyBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  roomSection: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  photo: { borderRadius: Radius.sm },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.base,
    borderTopWidth: 1,
  },
  editBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
})
