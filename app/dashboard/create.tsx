import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert, Share, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { createTenancy, type Tenancy } from 'rent-right-shared'

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0] // 'YYYY-MM-DD'
}

function displayDate(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type DateField = 'start' | 'end' | null

export default function CreateTenancyScreen() {
  const c = useColors()
  const { user } = useAuth()

  const [propertyLabel, setPropertyLabel] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [upiId, setUpiId] = useState('')

  // Date state
  const [leaseStart, setLeaseStart] = useState<Date | null>(null)
  const [leaseEnd, setLeaseEnd] = useState<Date | null>(null)
  const [pickerOpen, setPickerOpen] = useState<DateField>(null)
  const [pickerDate, setPickerDate] = useState(new Date())

  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Tenancy | null>(null)

  // Open picker for a field
  const openPicker = (field: DateField) => {
    const current = field === 'start' ? leaseStart : leaseEnd
    setPickerDate(current ?? new Date())
    setPickerOpen(field)
  }

  // Handle picker change
  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPickerOpen(null) // Android auto-closes
    if (event.type === 'dismissed') { setPickerOpen(null); return }
    if (!date) return
    if (pickerOpen === 'start') setLeaseStart(date)
    if (pickerOpen === 'end') setLeaseEnd(date)
    if (Platform.OS === 'android') setPickerOpen(null)
  }

  const handleCreate = useCallback(async () => {
    if (!user?.id) return
    const label = propertyLabel.trim()
    const rent = parseInt(monthlyRent)
    const upi = upiId.trim()

    if (!label) { Alert.alert('Required', 'Property label is required'); return }
    if (!rent || rent <= 0) { Alert.alert('Required', 'Enter a valid monthly rent'); return }
    if (!upi) { Alert.alert('Required', 'UPI ID is required for tenant rent payment'); return }
    if (!leaseStart) { Alert.alert('Required', 'Lease start date is required'); return }
    if (!leaseEnd) { Alert.alert('Required', 'Lease end date is required'); return }
    if (leaseEnd <= leaseStart) { Alert.alert('Invalid', 'Lease end must be after lease start'); return }

    setCreating(true)
    const result = await createTenancy(supabase as any, {
      property_label: label,
      landlord_id: user.id,
      monthly_rent: rent,
      deposit_amount: deposit ? parseInt(deposit) : null,
      landlord_upi_id: upi,
      lease_start: toYMD(leaseStart),
      lease_end: toYMD(leaseEnd),
    })
    setCreating(false)

    if (result.error) { Alert.alert('Error', result.error); return }
    if (result.data) setCreated(result.data)
  }, [user?.id, propertyLabel, monthlyRent, deposit, upiId, leaseStart, leaseEnd])

  const inviteUrl = created?.invite_token
    ? `https://rent-right-seven.vercel.app/tenancy/join/${created.invite_token}`
    : ''

  const copyLink = async () => {
    await Clipboard.setStringAsync(inviteUrl)
    Alert.alert('Copied!', 'Invite link copied to clipboard.')
  }

  const shareWhatsApp = async () => {
    try {
      await Share.share({
        message: `Join my property "${created?.property_label}" on Rent Right:\n${inviteUrl}`,
      })
    } catch { /* cancelled */ }
  }

  const canCreate = propertyLabel.trim() && monthlyRent && upiId.trim() && leaseStart && leaseEnd

  const s = styles(c)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <Text style={[Typography.subtitle, { color: c.text1, marginLeft: Spacing.md }]}>
          Create Tenancy
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {created ? (
          /* ── Success view ── */
          <View style={s.successSection}>
            <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: Spacing.md }}>🎉</Text>
            <Text style={[Typography.title, { color: c.text1, textAlign: 'center' }]}>
              Tenancy Created!
            </Text>
            <Text style={[Typography.body, { color: c.text3, textAlign: 'center', marginTop: Spacing.sm }]}>
              Share the invite link with your tenant so they can join.
            </Text>

            <View style={s.linkBox}>
              <Text style={[Typography.caption, { color: c.text2, fontSize: 12 }]} selectable>
                {inviteUrl}
              </Text>
            </View>

            <View style={s.shareRow}>
              <Pressable style={[s.shareBtn, { backgroundColor: c.accent }]} onPress={copyLink}>
                <Text style={[Typography.subtitle, { color: '#fff', fontSize: 13 }]}>📋 Copy Link</Text>
              </Pressable>
              <Pressable style={[s.shareBtn, { backgroundColor: '#25D366' }]} onPress={shareWhatsApp}>
                <Text style={[Typography.subtitle, { color: '#fff', fontSize: 13 }]}>💬 WhatsApp</Text>
              </Pressable>
            </View>

            <Pressable style={[s.outlineBtn, { borderColor: c.border, marginTop: Spacing.xl }]} onPress={() => router.back()}>
              <Text style={[Typography.subtitle, { color: c.text2 }]}>Done</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Form ── */
          <>
            <Field label="PROPERTY LABEL *">
              <TextInput
                style={s.input}
                value={propertyLabel} onChangeText={setPropertyLabel}
                placeholder="e.g., Green Towers 2BHK" placeholderTextColor={c.text4}
              />
            </Field>

            <Field label="MONTHLY RENT (₹) *">
              <TextInput
                style={s.input}
                value={monthlyRent} onChangeText={setMonthlyRent}
                placeholder="25000" placeholderTextColor={c.text4}
                keyboardType="number-pad"
              />
            </Field>

            <Field label="DEPOSIT AMOUNT (₹)">
              <TextInput
                style={s.input}
                value={deposit} onChangeText={setDeposit}
                placeholder="100000" placeholderTextColor={c.text4}
                keyboardType="number-pad"
              />
            </Field>

            <Field label="YOUR UPI ID *">
              <TextInput
                style={s.input}
                value={upiId} onChangeText={setUpiId}
                placeholder="name@upi" placeholderTextColor={c.text4}
                autoCapitalize="none" autoCorrect={false}
              />
              <Text style={s.hint}>Tenant will pay rent to this UPI ID directly from the app.</Text>
            </Field>

            <Field label="LEASE START *">
              <Pressable style={s.datePicker} onPress={() => openPicker('start')}>
                <Text style={leaseStart ? s.dateText : s.datePlaceholder}>
                  {leaseStart ? displayDate(leaseStart) : 'Select date'}
                </Text>
                <Text style={s.calIcon}>📅</Text>
              </Pressable>
            </Field>

            <Field label="LEASE END *">
              <Pressable style={s.datePicker} onPress={() => openPicker('end')}>
                <Text style={leaseEnd ? s.dateText : s.datePlaceholder}>
                  {leaseEnd ? displayDate(leaseEnd) : 'Select date'}
                </Text>
                <Text style={s.calIcon}>📅</Text>
              </Pressable>
            </Field>

            <Pressable
              style={[s.createBtn, { backgroundColor: canCreate ? c.accent : c.bgSubtle }]}
              onPress={handleCreate}
              disabled={creating || !canCreate}
            >
              {creating ? <ActivityIndicator color="#fff" /> : (
                <Text style={[Typography.subtitle, { color: canCreate ? '#fff' : c.text4 }]}>
                  Create Tenancy
                </Text>
              )}
            </Pressable>

            <View style={{ height: 80 }} />
          </>
        )}
      </ScrollView>

      {/* Date picker — iOS inline sheet, Android modal */}
      {pickerOpen !== null && (
        Platform.OS === 'ios' ? (
          <View style={s.iosPickerSheet}>
            <View style={s.iosPickerHeader}>
              <Text style={[Typography.subtitle, { color: c.text3 }]}>
                {pickerOpen === 'start' ? 'Lease Start' : 'Lease End'}
              </Text>
              <Pressable onPress={() => setPickerOpen(null)}>
                <Text style={[Typography.subtitle, { color: c.accent }]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              onChange={onPickerChange}
              minimumDate={pickerOpen === 'end' && leaseStart ? leaseStart : undefined}
              themeVariant="dark"
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={onPickerChange}
            minimumDate={pickerOpen === 'end' && leaseStart ? leaseStart : undefined}
          />
        )
      )}
    </SafeAreaView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const fieldLabel: object = {
  fontSize: 10, fontWeight: '700' as const, letterSpacing: 1,
  color: '#7896b4', marginBottom: 6,
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgPage },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  content: { padding: Spacing.base },

  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 15, color: c.text1, backgroundColor: c.bgSubtle,
  },
  hint: { fontSize: 10, color: '#4a6685', marginTop: 4 },

  datePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: c.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: c.bgSubtle,
  },
  dateText: { fontSize: 15, color: '#f0f6ff' },
  datePlaceholder: { fontSize: 15, color: '#4a6685' },
  calIcon: { fontSize: 16 },

  createBtn: {
    borderRadius: Radius.lg, paddingVertical: Spacing.base,
    alignItems: 'center', marginTop: Spacing.lg,
  },

  successSection: { paddingTop: Spacing['2xl'] },
  linkBox: {
    borderWidth: 1, borderColor: '#1e3a5f', borderRadius: Radius.md,
    padding: Spacing.md, marginTop: Spacing.lg, backgroundColor: '#162240',
  },
  shareRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  shareBtn: { flex: 1, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  outlineBtn: { borderWidth: 2, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center' },

  iosPickerSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0f1f35',
    borderTopWidth: 1, borderTopColor: '#1e3a5f',
    paddingBottom: 24,
  },
  iosPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#1e3a5f',
  },
})
