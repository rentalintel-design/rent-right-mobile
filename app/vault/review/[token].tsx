import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, Image, TextInput,
  StyleSheet, ActivityIndicator, Dimensions, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { getAllRooms, countPhotos } from 'rent-right-shared'
import type { VaultRecord, VaultFloor, VaultRoom, AddedFurnishing } from 'rent-right-shared'

const PHOTO_SIZE = (Dimensions.get('window').width - Spacing.base * 2 - Spacing.xs * 2) / 3
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

type Step = 'loading' | 'not_found' | 'expired' | 'denied' | 'review' | 'done'

export default function VaultReviewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const c = useColors()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('loading')
  const [record, setRecord] = useState<VaultRecord | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setStep('not_found'); return }

    supabase
      .from('vault_records')
      .select('*')
      .eq('share_token', token)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { setStep('not_found'); return }

        const rec = data as VaultRecord

        // 7-day expiry check
        if (rec.shared_at && Date.now() - new Date(rec.shared_at).getTime() > SEVEN_DAYS) {
          setStep('expired')
          return
        }

        // One-time claim: bind current user if not yet claimed
        if (!rec.other_party_user_id && user?.id) {
          await supabase
            .from('vault_records')
            .update({ other_party_user_id: user.id })
            .eq('id', rec.id)
          rec.other_party_user_id = user.id
        }

        // Access control: deny if another user already claimed
        if (rec.other_party_user_id && rec.other_party_user_id !== user?.id) {
          setStep('denied')
          return
        }

        setRecord(rec)
        setStep('review')
      })
  }, [token, user?.id])

  const handleAccept = useCallback(async () => {
    if (!record?.id) return
    setSubmitting(true)
    const { error } = await supabase.from('vault_records').update({
      sharing_status: 'accepted',
      accepted_at: new Date().toISOString(),
      other_party_user_id: user?.id ?? null,
    }).eq('id', record.id)

    if (error) {
      Alert.alert('Error', error.message)
      setSubmitting(false)
      return
    }
    setStep('done')
    setSubmitting(false)
  }, [record?.id, user?.id])

  const handleRequestChanges = useCallback(async () => {
    if (!record?.id || !changeNote.trim()) {
      Alert.alert('Note required', 'Please describe what changes are needed.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('vault_records').update({
      sharing_status: 'changes_requested',
      change_request_note: changeNote.trim(),
      other_party_user_id: user?.id ?? null,
    }).eq('id', record.id)

    if (error) {
      Alert.alert('Error', error.message)
      setSubmitting(false)
      return
    }
    setStep('done')
    setSubmitting(false)
  }, [record?.id, changeNote, user?.id])

  // Status screens
  if (step === 'loading') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}><ActivityIndicator color={c.accent} size="large" /></View>
      </SafeAreaView>
    )
  }

  if (step === 'not_found' || step === 'expired' || step === 'denied') {
    const messages: Record<string, { icon: string; title: string; desc: string }> = {
      not_found: { icon: '🔍', title: 'Not Found', desc: 'This vault review link is invalid.' },
      expired: { icon: '⏰', title: 'Link Expired', desc: 'This share link has expired (7 days). Ask the owner to reshare.' },
      denied: { icon: '🔒', title: 'Access Denied', desc: 'This link has already been claimed by another user.' },
    }
    const msg = messages[step]
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>{msg.icon}</Text>
          <Text style={[Typography.title, { color: c.text1, textAlign: 'center' }]}>{msg.title}</Text>
          <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>{msg.desc}</Text>
          <Pressable style={[styles.backBtn, { backgroundColor: c.accent }]} onPress={() => router.back()}>
            <Text style={[Typography.caption, { color: '#fff' }]}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  if (step === 'done') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={[Typography.title, { color: c.text1, textAlign: 'center' }]}>Response Submitted</Text>
          <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
            The record owner will be notified of your response.
          </Text>
          <Pressable style={[styles.backBtn, { backgroundColor: c.accent }]} onPress={() => router.replace('/(tabs)/vault')}>
            <Text style={[Typography.caption, { color: '#fff' }]}>Go to Vault</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // Review view
  if (!record) return null

  const floors = (record.floors ?? []) as VaultFloor[]
  const roomData = (record.room_data ?? {}) as Record<string, VaultRoom>
  const furnishings = (record.furnishings ?? []) as AddedFurnishing[]
  const allRooms = getAllRooms(floors)
  const totalPhotos = countPhotos(roomData)

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <Text style={[Typography.caption, { color: c.accent, fontWeight: '600' }]}>Review Record</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Property header */}
        <View style={[styles.section, styles.propertyHeader, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <Text style={[Typography.title, { color: c.text1 }]}>{record.property_type}</Text>
          {record.property_address && (
            <Text style={[Typography.body, { color: c.text3 }]}>📍 {record.property_address}</Text>
          )}
          {record.city && <Text style={[Typography.caption, { color: c.text4 }]}>{record.city}</Text>}
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
              Furnishings ({furnishings.length})
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
                      <Image key={m.id} source={{ uri: m.url }} style={[styles.photo, { width: PHOTO_SIZE, height: PHOTO_SIZE }]} resizeMode="cover" />
                    ))}
                  </View>
                ) : (
                  <Text style={[Typography.caption, { color: c.text4, fontStyle: 'italic', marginTop: Spacing.xs }]}>No photos</Text>
                )}
              </View>
            )
          })}
        </View>

        {/* Action section */}
        <View style={[styles.section, styles.actionSection, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Your Response</Text>

          <Pressable
            style={[styles.acceptBtn, { backgroundColor: '#22c55e' }]}
            onPress={handleAccept}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <Text style={[Typography.subtitle, { color: '#fff' }]}>✓ Accept Record</Text>
            )}
          </Pressable>

          <Text style={[Typography.caption, { color: c.text3, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
            Or request changes:
          </Text>
          <TextInput
            style={[styles.noteInput, { backgroundColor: c.bgPage, borderColor: c.border, color: c.text1 }]}
            value={changeNote}
            onChangeText={setChangeNote}
            placeholder="Describe what needs to be changed..."
            placeholderTextColor={c.text4}
            multiline
            numberOfLines={3}
          />
          <Pressable
            style={[styles.changesBtn, { borderColor: '#eab308' }]}
            onPress={handleRequestChanges}
            disabled={submitting}
          >
            <Text style={[Typography.caption, { color: '#eab308', fontWeight: '600' }]}>Request Changes</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.base },
  backBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
  body: { padding: Spacing.base, paddingBottom: 40 },
  section: { marginBottom: Spacing.lg },
  propertyHeader: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  furnishingList: { gap: Spacing.xs },
  furnishingItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  qtyBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  roomSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  photo: { borderRadius: Radius.sm },
  actionSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  acceptBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  noteInput: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  changesBtn: { borderRadius: Radius.md, borderWidth: 1, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
})
