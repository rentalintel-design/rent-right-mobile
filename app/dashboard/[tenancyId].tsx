import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useRentPayments } from '@/hooks/useRentPayments'
import { useUtilities } from '@/hooks/useUtilities'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRent } from '@/lib/vacancyUtils'
import { formatMonth } from '@/lib/upiPayment'
import {
  confirmRentPayment, endTenancy,
  addUtilityAccount, addUtilityBill,
  type Tenancy, type UtilityProviderType, type RentPayment,
} from 'rent-right-shared'

// ─── Status helpers ─────────────────────────────────────────────────────────

const PAYMENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed ✓', color: '#22c55e', bg: '#14532d' },
  paid:      { label: 'Paid · Confirm?', color: '#2563eb', bg: '#1e3a5f' },
  overdue:   { label: 'Overdue', color: '#ef4444', bg: '#7f1d1d' },
  pending:   { label: 'Pending', color: '#9ca3af', bg: '#374151' },
}

const PROVIDER_ICONS: Record<string, { icon: string; label: string }> = {
  electricity: { icon: '⚡', label: 'Electricity' },
  water:       { icon: '💧', label: 'Water' },
  gas:         { icon: '🔥', label: 'Gas' },
  internet:    { icon: '📶', label: 'Internet' },
}

// ─── Tenancy Detail Screen ──────────────────────────────────────────────────

export default function TenancyDetailScreen() {
  const c = useColors()
  const { tenancyId } = useLocalSearchParams<{ tenancyId: string }>()
  const { user } = useAuth()

  const [tenancy, setTenancy] = useState<Tenancy | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch tenancy
  const fetchTenancy = useCallback(async () => {
    if (!tenancyId) return
    const { data } = await supabase.from('tenancies').select('*').eq('id', tenancyId).single()
    if (data) setTenancy(data as unknown as Tenancy)
    setLoading(false)
  }, [tenancyId])

  useEffect(() => { fetchTenancy() }, [fetchTenancy])

  // Fetch tenant name
  useEffect(() => {
    if (!tenancy?.tenant_id) return
    supabase.from('profiles').select('name').eq('user_id', tenancy.tenant_id).single()
      .then(({ data }) => { if (data) setTenantName((data as any).name) })
  }, [tenancy?.tenant_id])

  const { currentPayment, history, loading: payLoading, refresh: refreshPay } =
    useRentPayments(tenancy?.id, tenancy?.monthly_rent ?? 0)
  const { accounts, bills, loading: utilLoading, refresh: refreshUtil } =
    useUtilities(tenancy?.id)

  // ── UPI ID edit ──
  const [editingUpi, setEditingUpi] = useState(false)
  const [upiInput, setUpiInput] = useState('')

  const saveUpi = useCallback(async () => {
    if (!tenancyId) return
    await supabase.from('tenancies').update({ landlord_upi_id: upiInput.trim() || null }).eq('id', tenancyId)
    await fetchTenancy()
    setEditingUpi(false)
  }, [tenancyId, upiInput, fetchTenancy])

  // ── Confirm payment ──
  const [confirming, setConfirming] = useState(false)
  const handleConfirm = async () => {
    if (!currentPayment?.id || !tenancy?.id || !user?.id) return
    setConfirming(true)
    const result = await confirmRentPayment(supabase as any, currentPayment.id, tenancy.id, user.id)
    if (result.error) Alert.alert('Error', result.error)
    else Alert.alert('Confirmed', 'Rent payment confirmed.')
    await refreshPay()
    setConfirming(false)
  }

  // ── End tenancy ──
  const handleEnd = () => {
    Alert.alert('End Tenancy?', 'This will mark the tenancy as ended. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Tenancy', style: 'destructive',
        onPress: async () => {
          if (!tenancy?.id || !user?.id) return
          const result = await endTenancy(supabase as any, tenancy.id, user.id)
          if (result.error) Alert.alert('Error', result.error)
          else { Alert.alert('Ended', 'Tenancy has been ended.'); router.back() }
        },
      },
    ])
  }

  // ── Add utility account ──
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newProviderType, setNewProviderType] = useState<UtilityProviderType>('electricity')
  const [newProviderName, setNewProviderName] = useState('')
  const [newConsumerNum, setNewConsumerNum] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)

  const handleAddAccount = async () => {
    if (!tenancy?.id || !user?.id || !newProviderName.trim() || !newConsumerNum.trim()) return
    setAddingAccount(true)
    const result = await addUtilityAccount(supabase as any, {
      tenancy_id: tenancy.id,
      provider_type: newProviderType,
      provider_name: newProviderName.trim(),
      consumer_number: newConsumerNum.trim(),
      added_by: user.id,
    })
    if (result.error) Alert.alert('Error', result.error)
    else {
      setShowAddAccount(false)
      setNewProviderName('')
      setNewConsumerNum('')
      await refreshUtil()
      // Fire-and-forget: auto-fetch bill from Setu BBPS
      if (result.data?.id) {
        fetch('https://rent-right-seven.vercel.app/api/billpay/fetch-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ utilityAccountId: result.data.id, tenancyId: tenancy.id }),
        }).then(() => refreshUtil()).catch(() => {})
      }
    }
    setAddingAccount(false)
  }

  // ── Add bill ──
  const [addBillFor, setAddBillFor] = useState<string | null>(null) // account ID
  const [billAmount, setBillAmount] = useState('')
  const [billDue, setBillDue] = useState('')
  const [addingBill, setAddingBill] = useState(false)

  const handleAddBill = async () => {
    if (!addBillFor || !tenancy?.id || !billAmount) return
    setAddingBill(true)
    const result = await addUtilityBill(supabase as any, {
      utility_account_id: addBillFor,
      tenancy_id: tenancy.id,
      amount: parseFloat(billAmount),
      due_date: billDue || null,
      source: 'manual',
    })
    if (result.error) Alert.alert('Error', result.error)
    else {
      setAddBillFor(null)
      setBillAmount('')
      setBillDue('')
      await refreshUtil()
    }
    setAddingBill(false)
  }

  // ── Invite link ──
  const inviteUrl = tenancy?.invite_token
    ? `https://rentright.in/join/${tenancy.invite_token}`
    : ''

  const [showHistory, setShowHistory] = useState(false)

  if (loading || !tenancy) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
        <View style={s.center}><ActivityIndicator color={c.accent} size="large" /></View>
      </SafeAreaView>
    )
  }

  const tst = { active: '#22c55e', vacant: '#fb923c', ended: '#9ca3af' }[tenancy.status ?? 'active'] ?? '#9ca3af'
  const payStatus = currentPayment?.status ?? 'pending'
  const pst = PAYMENT_STATUS[payStatus] ?? PAYMENT_STATUS.pending

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <Text style={[Typography.subtitle, { color: c.text1, flex: 1, marginLeft: Spacing.md }]} numberOfLines={1}>
          {tenancy.property_label}
        </Text>
        <View style={[s.badge, { backgroundColor: tst + '20' }]}>
          <Text style={{ color: tst, fontSize: 10, fontWeight: '700' }}>
            {(tenancy.status ?? 'active').toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Tenancy info */}
        <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: c.text4 }]}>Rent</Text>
            <Text style={[Typography.body, { color: c.text1 }]}>₹{formatRent(tenancy.monthly_rent)}/mo</Text>
          </View>
          {tenancy.deposit_amount ? (
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.text4 }]}>Deposit</Text>
              <Text style={[Typography.body, { color: c.text1 }]}>₹{formatRent(tenancy.deposit_amount)}</Text>
            </View>
          ) : null}
          {tenancy.lease_start && (
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.text4 }]}>Lease</Text>
              <Text style={[Typography.caption, { color: c.text2 }]}>
                {tenancy.lease_start} → {tenancy.lease_end ?? 'Ongoing'}
              </Text>
            </View>
          )}
        </View>

        {/* Tenant info or invite */}
        <Text style={[Typography.subtitle, { color: c.text1, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
          Tenant
        </Text>
        {tenancy.tenant_id ? (
          <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
            <Text style={[Typography.body, { color: c.text1 }]}>{tenantName ?? 'Tenant'}</Text>
          </View>
        ) : (
          <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.sm }]}>
              No tenant yet. Share the invite link:
            </Text>
            <Text style={[Typography.caption, { color: c.accent, fontSize: 11 }]} selectable>
              {inviteUrl}
            </Text>
            <View style={[s.shareRow, { marginTop: Spacing.sm }]}>
              <Pressable style={[s.shareBtn, { backgroundColor: c.accent }]}
                onPress={async () => { await Clipboard.setStringAsync(inviteUrl); Alert.alert('Copied!') }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>📋 Copy</Text>
              </Pressable>
              <Pressable style={[s.shareBtn, { backgroundColor: '#25D366' }]}
                onPress={() => Share.share({ message: `Join "${tenancy.property_label}" on Rent Right: ${inviteUrl}` })}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>💬 Share</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* UPI ID */}
        <Text style={[Typography.subtitle, { color: c.text1, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
          UPI ID
        </Text>
        {editingUpi ? (
          <View style={s.upiEditRow}>
            <TextInput
              style={[s.input, { flex: 1, color: c.text1, borderColor: c.border, backgroundColor: c.bgSubtle }]}
              value={upiInput} onChangeText={setUpiInput}
              placeholder="name@upi" placeholderTextColor={c.text4}
              autoCapitalize="none" autoFocus
            />
            <Pressable style={[s.smallBtn, { backgroundColor: c.accent }]} onPress={saveUpi}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditingUpi(false)}>
              <Text style={[Typography.caption, { color: c.text4 }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}
            onPress={() => { setUpiInput(tenancy.landlord_upi_id ?? ''); setEditingUpi(true) }}
          >
            <View style={s.row}>
              <Text style={[Typography.body, { color: tenancy.landlord_upi_id ? c.text1 : c.text4, flex: 1 }]}>
                {tenancy.landlord_upi_id ?? 'Tap to add UPI ID'}
              </Text>
              <Text style={[Typography.caption, { color: c.accent }]}>Edit</Text>
            </View>
          </Pressable>
        )}

        {/* Current month rent */}
        {tenancy.tenant_id && (
          <>
            <Text style={[Typography.subtitle, { color: c.text1, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
              This Month's Rent
            </Text>
            {payLoading ? <ActivityIndicator color={c.accent} /> : currentPayment ? (
              <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.body, { color: c.text1, fontWeight: '700' }]}>
                      ₹{formatRent(currentPayment.amount)}
                    </Text>
                    <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>
                      {formatMonth(currentPayment.month)}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: pst.bg }]}>
                    <Text style={{ color: pst.color, fontSize: 10, fontWeight: '700' }}>{pst.label}</Text>
                  </View>
                </View>

                {payStatus === 'paid' && (
                  <Pressable
                    style={[s.confirmBtn, { backgroundColor: '#22c55e', marginTop: Spacing.md }]}
                    onPress={handleConfirm}
                    disabled={confirming}
                  >
                    {confirming ? <ActivityIndicator color="#fff" size="small" /> : (
                      <Text style={[Typography.subtitle, { color: '#fff' }]}>Confirm Payment</Text>
                    )}
                  </Pressable>
                )}

                {currentPayment.upi_txn_id && (
                  <Text style={[Typography.caption, { color: c.text4, marginTop: Spacing.sm, fontSize: 10 }]}>
                    TXN: {currentPayment.upi_txn_id}
                  </Text>
                )}
              </View>
            ) : null}
          </>
        )}

        {/* Utility accounts */}
        <View style={[s.row, { marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
          <Text style={[Typography.subtitle, { color: c.text1, flex: 1 }]}>Utilities</Text>
          <Pressable onPress={() => setShowAddAccount(!showAddAccount)}>
            <Text style={[Typography.caption, { color: c.accent, fontWeight: '600' }]}>
              {showAddAccount ? 'Cancel' : '+ Add'}
            </Text>
          </Pressable>
        </View>

        {showAddAccount && (
          <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.accent, marginBottom: Spacing.sm }]}>
            <View style={s.providerRow}>
              {(Object.entries(PROVIDER_ICONS) as [UtilityProviderType, { icon: string; label: string }][]).map(([key, val]) => (
                <Pressable key={key}
                  style={[s.providerBtn, { backgroundColor: newProviderType === key ? c.accent : c.bgSubtle, borderColor: newProviderType === key ? c.accent : c.border }]}
                  onPress={() => setNewProviderType(key)}>
                  <Text style={{ fontSize: 14 }}>{val.icon}</Text>
                  <Text style={[Typography.caption, { color: newProviderType === key ? '#fff' : c.text3, fontSize: 9 }]}>
                    {val.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[s.input, { color: c.text1, borderColor: c.border, backgroundColor: c.bgSubtle }]}
              value={newProviderName} onChangeText={setNewProviderName}
              placeholder="Provider name" placeholderTextColor={c.text4}
            />
            <TextInput
              style={[s.input, { color: c.text1, borderColor: c.border, backgroundColor: c.bgSubtle }]}
              value={newConsumerNum} onChangeText={setNewConsumerNum}
              placeholder="Consumer / Account number" placeholderTextColor={c.text4}
            />
            <Pressable
              style={[s.confirmBtn, { backgroundColor: (newProviderName && newConsumerNum) ? c.accent : c.bgSubtle }]}
              onPress={handleAddAccount}
              disabled={addingAccount || !newProviderName.trim() || !newConsumerNum.trim()}>
              {addingAccount ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={{ color: (newProviderName && newConsumerNum) ? '#fff' : c.text4, fontWeight: '600', fontSize: 13 }}>
                  Add Account
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {accounts.length === 0 && !showAddAccount ? (
          <Text style={[Typography.caption, { color: c.text4, fontStyle: 'italic' }]}>
            No utility accounts added yet.
          </Text>
        ) : (
          accounts.map(acct => {
            const pi = PROVIDER_ICONS[acct.provider_type] ?? { icon: '📄', label: acct.provider_type }
            const acctBills = bills.filter(b => b.utility_account_id === acct.id)
            return (
              <View key={acct.id} style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border, marginBottom: Spacing.sm }]}>
                <View style={s.row}>
                  <Text style={{ fontSize: 16 }}>{pi.icon}</Text>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={[Typography.caption, { color: c.text1, fontWeight: '600' }]}>{acct.provider_name}</Text>
                    <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>{acct.consumer_number}</Text>
                  </View>
                  <Pressable onPress={() => setAddBillFor(addBillFor === acct.id ? null : acct.id!)}>
                    <Text style={[Typography.caption, { color: c.accent, fontSize: 11 }]}>
                      {addBillFor === acct.id ? 'Cancel' : '+ Bill'}
                    </Text>
                  </Pressable>
                </View>

                {addBillFor === acct.id && (
                  <View style={{ marginTop: Spacing.sm, gap: Spacing.xs }}>
                    <TextInput
                      style={[s.input, { color: c.text1, borderColor: c.border, backgroundColor: c.bgSubtle, marginBottom: 0 }]}
                      value={billAmount} onChangeText={setBillAmount}
                      placeholder="Amount (₹)" placeholderTextColor={c.text4}
                      keyboardType="number-pad"
                    />
                    <TextInput
                      style={[s.input, { color: c.text1, borderColor: c.border, backgroundColor: c.bgSubtle, marginBottom: 0 }]}
                      value={billDue} onChangeText={setBillDue}
                      placeholder="Due date YYYY-MM-DD" placeholderTextColor={c.text4}
                    />
                    <Pressable
                      style={[s.smallBtn, { backgroundColor: billAmount ? c.accent : c.bgSubtle, alignSelf: 'flex-end' }]}
                      onPress={handleAddBill} disabled={addingBill || !billAmount}>
                      {addingBill ? <ActivityIndicator color="#fff" size="small" /> : (
                        <Text style={{ color: billAmount ? '#fff' : c.text4, fontSize: 11, fontWeight: '600' }}>Add Bill</Text>
                      )}
                    </Pressable>
                  </View>
                )}

                {acctBills.map(bill => (
                  <View key={bill.id} style={[s.billRow, { borderTopColor: c.border }]}>
                    <Text style={[Typography.caption, { color: c.text2, flex: 1 }]}>₹{formatRent(bill.amount)}</Text>
                    <Text style={[Typography.caption, { color: c.text4, fontSize: 10, marginRight: Spacing.sm }]}>
                      {bill.due_date ?? '—'}
                    </Text>
                    <View style={[s.badge, { backgroundColor: bill.status === 'paid' ? '#14532d' : '#374151' }]}>
                      <Text style={{ color: bill.status === 'paid' ? '#4ade80' : '#9ca3af', fontSize: 9 }}>
                        {bill.status ?? 'unpaid'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          })
        )}

        {/* Payment history */}
        {history.length > 0 && (
          <>
            <Pressable style={s.row} onPress={() => setShowHistory(!showHistory)}>
              <Text style={[Typography.subtitle, { color: c.text1, flex: 1, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
                Payment History
              </Text>
              <Text style={[Typography.caption, { color: c.text4, marginTop: Spacing.lg }]}>
                {showHistory ? '▲' : '▼'}
              </Text>
            </Pressable>
            {showHistory && history.map(p => {
              const ps = PAYMENT_STATUS[p.status ?? 'pending'] ?? PAYMENT_STATUS.pending
              return (
                <View key={p.id} style={[s.historyRow, { borderBottomColor: c.border }]}>
                  <Text style={[Typography.caption, { color: c.text2, flex: 1 }]}>{formatMonth(p.month)}</Text>
                  <Text style={[Typography.caption, { color: c.text1, marginRight: Spacing.md }]}>₹{formatRent(p.amount)}</Text>
                  <View style={[s.badge, { backgroundColor: ps.bg }]}>
                    <Text style={{ color: ps.color, fontSize: 9, fontWeight: '700' }}>{ps.label}</Text>
                  </View>
                </View>
              )
            })}
          </>
        )}

        {/* End tenancy */}
        {tenancy.status === 'active' && (
          <Pressable
            style={[s.endBtn, { borderColor: '#ef4444', marginTop: Spacing.xl }]}
            onPress={handleEnd}
          >
            <Text style={[Typography.subtitle, { color: '#ef4444' }]}>End Tenancy</Text>
          </Pressable>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  content: { padding: Spacing.base },
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  input: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, marginBottom: Spacing.sm,
  },
  confirmBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  shareRow: { flexDirection: 'row', gap: Spacing.sm },
  shareBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  upiEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  smallBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  providerRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  providerBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, gap: 2,
  },
  billRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, marginTop: Spacing.sm, paddingTop: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
  endBtn: {
    borderWidth: 2, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center',
  },
})
