import React, { useState, useCallback } from 'react'
import {
  View, Text, Pressable, TextInput, Modal,
  StyleSheet, Alert, ActivityIndicator, Share,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import type { VaultRecord, SharedParty } from 'rent-right-shared'

const SITE_URL = 'https://rent-right-seven.vercel.app'

function generateToken(length = 24): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, length)
}

type Props = {
  visible: boolean
  record: VaultRecord
  onClose: () => void
  onShared: () => void
}

export default function VaultShareDialog({ visible, record, onClose, onShared }: Props) {
  const c = useColors()
  const [name, setName] = useState(record.other_party?.name ?? '')
  const [phone, setPhone] = useState(record.other_party?.phone ?? '')
  const [email, setEmail] = useState(record.other_party?.email ?? '')
  const [role, setRole] = useState<'landlord' | 'tenant'>(record.other_party?.role ?? 'landlord')
  const [saving, setSaving] = useState(false)

  const handleShare = useCallback(async () => {
    setSaving(true)
    try {
      const token = record.share_token ?? generateToken()
      const otherParty: SharedParty = {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        role,
      }

      const { error } = await supabase.from('vault_records').update({
        share_token: token,
        sharing_status: 'shared',
        other_party: otherParty,
        shared_at: new Date().toISOString(),
      }).eq('id', record.id)

      if (error) {
        Alert.alert('Error', error.message)
        setSaving(false)
        return
      }

      const link = `${SITE_URL}/vault/review/${token}`
      await Clipboard.setStringAsync(link)

      try {
        await Share.share({
          message: `Review this move-in record on Rent Right:\n${link}`,
        })
      } catch {
        // user cancelled share sheet — link already copied
      }

      Alert.alert('Shared!', 'Link copied to clipboard.')
      onShared()
    } catch {
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [record.id, record.share_token, name, phone, email, role, onShared])

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <View style={styles.sheetHeader}>
            <Text style={[Typography.subtitle, { color: c.text1 }]}>Share Vault Record</Text>
            <Pressable onPress={onClose}>
              <Text style={[Typography.body, { color: c.text3 }]}>✕</Text>
            </Pressable>
          </View>

          <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.md }]}>
            Enter the other party's details. They'll receive a link to review and accept the record.
          </Text>

          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgPage, borderColor: c.border, color: c.text1 }]}
              value={name}
              onChangeText={setName}
              placeholder="Other party's name"
              placeholderTextColor={c.text4}
            />
          </View>

          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Phone</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgPage, borderColor: c.border, color: c.text1 }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={c.text4}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgPage, borderColor: c.border, color: c.text1 }]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={c.text4}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Their Role</Text>
            <View style={styles.chipRow}>
              {(['landlord', 'tenant'] as const).map(r => (
                <Pressable
                  key={r}
                  style={[styles.chip, { backgroundColor: role === r ? c.accent : c.bgPage, borderColor: role === r ? c.accent : c.border }]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[Typography.caption, { color: role === r ? '#fff' : c.text3 }]}>
                    {r === 'landlord' ? '🏗️ Landlord' : '🔍 Tenant'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            style={[styles.shareBtn, { backgroundColor: c.accent }]}
            onPress={handleShare}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[Typography.subtitle, { color: '#fff' }]}>
                {record.share_token ? 'Reshare' : 'Generate & Share Link'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: Spacing.base,
    paddingBottom: Spacing['2xl'],
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  field: { marginBottom: Spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.xs },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  shareBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
})
