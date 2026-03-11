import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator, Alert, TextInput, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useTenancies } from '@/hooks/useTenancies'
import { useRentPayments } from '@/hooks/useRentPayments'
import { useUtilities } from '@/hooks/useUtilities'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRent } from '@/lib/vacancyUtils'
import { openUpiPayment, formatMonth } from '@/lib/upiPayment'
import { markRentPaid, fetchMyProperties, type RentPayment, type Tenancy, type LandlordProperty } from 'rent-right-shared'
import SetuBillPaySheet from '@/components/SetuBillPaySheet'

const WEB_BASE = 'https://rent-right-seven.vercel.app'

// ─── Status helpers ─────────────────────────────────────────────────────────

const PAYMENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed ✓', color: '#22c55e', bg: '#14532d' },
  paid:      { label: 'Paid · Awaiting confirmation', color: '#2563eb', bg: '#1e3a5f' },
  overdue:   { label: 'Overdue', color: '#ef4444', bg: '#7f1d1d' },
  pending:   { label: 'Pending', color: '#9ca3af', bg: '#374151' },
}

const TENANCY_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#22c55e' },
  vacant: { label: 'Vacant', color: '#fb923c' },
  ended:  { label: 'Ended', color: '#9ca3af' },
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const c = useColors()
  const { user, profile } = useAuth()
  const { tenancies, loading, refresh } = useTenancies(user?.id)

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const isLandlord = profile?.role === 'landlord'

  // For tenant: find active tenancy where user is tenant
  const activeTenancy = tenancies.find(
    t => t.tenant_id === user?.id && t.status === 'active'
  )

  // For landlord: all tenancies
  const landlordTenancies = tenancies.filter(t => t.landlord_id === user?.id)

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <Text style={[Typography.subtitle, { color: c.text1, marginLeft: Spacing.md }]}>
          Dashboard
        </Text>
        <View style={{ flex: 1 }} />
        <View style={[s.roleBadge, { backgroundColor: isLandlord ? '#1e3a5f' : '#14532d' }]}>
          <Text style={{ color: isLandlord ? '#60a5fa' : '#4ade80', fontSize: 10, fontWeight: '700' }}>
            {isLandlord ? 'Landlord' : 'Tenant'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      ) : isLandlord ? (
        <LandlordView tenancies={landlordTenancies} c={c} />
      ) : activeTenancy ? (
        <TenantView tenancy={activeTenancy} userId={user!.id} c={c} />
      ) : (
        <EmptyState
          emoji={isLandlord ? '🏗️' : '🔍'}
          message={
            isLandlord
              ? 'No properties yet.\nCreate a tenancy to start tracking rent.'
              : 'No active tenancy.\nAsk your landlord for an invite link.'
          }
          c={c}
          showCreate={isLandlord}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Tenant View ────────────────────────────────────────────────────────────

function TenantView({ tenancy, userId, c }: { tenancy: Tenancy; userId: string; c: any }) {
  const { currentPayment, history, loading: payLoading, refresh: refreshPay } =
    useRentPayments(tenancy.id, tenancy.monthly_rent)
  const { accounts, bills, loading: utilLoading, refresh: refreshUtil } = useUtilities(tenancy.id)

  const [showHistory, setShowHistory] = useState(false)
  const [showTxnInput, setShowTxnInput] = useState(false)
  const [txnId, setTxnId] = useState('')
  const [marking, setMarking] = useState(false)
  const [payingBillId, setPayingBillId] = useState<string | null>(null)
  const [setuLink, setSetuLink] = useState<string | null>(null)
  const [showSetuPay, setShowSetuPay] = useState(false)

  const handlePayBill = async (billId: string) => {
    setPayingBillId(billId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${WEB_BASE}/api/billpay/create-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          billId,
          tenancyId: tenancy.id,
          userId,
          mobileNumber: session?.user?.phone ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.paymentLink) {
        Alert.alert('Error', data.error ?? 'Could not create payment link')
        setPayingBillId(null)
        return
      }
      setSetuLink(data.paymentLink)
      setShowSetuPay(true)
      setPayingBillId(null)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Payment failed')
      setPayingBillId(null)
    }
  }

  // Fetch landlord name
  const [landlordName, setLandlordName] = useState<string | null>(null)
  React.useEffect(() => {
    supabase.from('profiles').select('name').eq('user_id', tenancy.landlord_id).single()
      .then(({ data }) => { if (data) setLandlordName((data as any).name) })
  }, [tenancy.landlord_id])

  const handlePayRent = async () => {
    if (!tenancy.landlord_upi_id || !currentPayment?.id) return
    const opened = await openUpiPayment({
      upiId: tenancy.landlord_upi_id,
      payeeName: landlordName ?? 'Landlord',
      amount: tenancy.monthly_rent,
      txnNote: `Rent ${formatMonth(currentPayment.month)} · ${tenancy.property_label}`,
      txnRef: currentPayment.id,
    })
    if (opened) setShowTxnInput(true)
  }

  const handleMarkPaid = async () => {
    if (!currentPayment?.id || !tenancy.id) return
    setMarking(true)
    const result = await markRentPaid(supabase as any, currentPayment.id, tenancy.id, userId, txnId || undefined)
    if (result.error) Alert.alert('Error', result.error)
    else {
      Alert.alert('Rent marked as paid', 'Your landlord will be notified.')
      setShowTxnInput(false)
      setTxnId('')
    }
    await refreshPay()
    setMarking(false)
  }

  const status = currentPayment?.status ?? 'pending'
  const st = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.pending

  const unpaidBills = bills.filter(b => b.status === 'unpaid')

  return (
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Tenancy info */}
      <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
        <Text style={[Typography.subtitle, { color: c.text1 }]}>{tenancy.property_label}</Text>
        <Text style={[Typography.caption, { color: c.text3, marginTop: 2 }]}>
          Landlord: {landlordName ?? '—'} · ₹{formatRent(tenancy.monthly_rent)}/mo
        </Text>
        {tenancy.lease_start && (
          <Text style={[Typography.caption, { color: c.text4, marginTop: 2, fontSize: 10 }]}>
            Lease: {tenancy.lease_start} → {tenancy.lease_end ?? 'Ongoing'}
          </Text>
        )}
      </View>

      {/* Current month rent */}
      <Text style={[Typography.subtitle, { color: c.text1, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
        This Month's Rent
      </Text>

      {payLoading ? (
        <ActivityIndicator color={c.accent} />
      ) : currentPayment ? (
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
            <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={{ color: st.color, fontSize: 10, fontWeight: '700' }}>{st.label}</Text>
            </View>
          </View>

          {/* Pay / Mark as Paid buttons */}
          {(status === 'pending' || status === 'overdue') && (
            <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
              {tenancy.landlord_upi_id ? (
                <Pressable style={[s.payBtn, { backgroundColor: c.accent }]} onPress={handlePayRent}>
                  <Text style={[Typography.subtitle, { color: '#fff' }]}>Pay Rent via UPI</Text>
                </Pressable>
              ) : (
                <View style={[s.infoBox, { backgroundColor: '#7f1d1d20', borderColor: '#7f1d1d' }]}>
                  <Text style={[Typography.caption, { color: c.text3 }]}>
                    Landlord has not added UPI ID. Ask them to update it in their dashboard.
                  </Text>
                </View>
              )}

              {showTxnInput ? (
                <View style={s.txnRow}>
                  <TextInput
                    style={[s.txnInput, { color: c.text1, borderColor: c.border, backgroundColor: c.bgSubtle }]}
                    value={txnId}
                    onChangeText={setTxnId}
                    placeholder="UPI Transaction ID (optional)"
                    placeholderTextColor={c.text4}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    style={[s.payBtn, { backgroundColor: '#22c55e', paddingHorizontal: Spacing.md }]}
                    onPress={handleMarkPaid}
                    disabled={marking}
                  >
                    {marking ? <ActivityIndicator color="#fff" size="small" /> : (
                      <Text style={[Typography.caption, { color: '#fff', fontWeight: '700' }]}>Confirm</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[s.outlineBtn, { borderColor: c.border }]}
                  onPress={() => setShowTxnInput(true)}
                >
                  <Text style={[Typography.caption, { color: c.text2 }]}>Mark as Paid Manually</Text>
                </Pressable>
              )}
            </View>
          )}

          {currentPayment.upi_txn_id && (
            <Text style={[Typography.caption, { color: c.text4, marginTop: Spacing.sm, fontSize: 10 }]}>
              TXN: {currentPayment.upi_txn_id}
            </Text>
          )}
        </View>
      ) : null}

      {/* Utility bills */}
      {unpaidBills.length > 0 && (
        <>
          <Text style={[Typography.subtitle, { color: c.text1, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
            Unpaid Bills ({unpaidBills.length})
          </Text>
          {unpaidBills.map(bill => {
            const acct = accounts.find(a => a.id === bill.utility_account_id)
            const ICONS: Record<string, string> = { electricity: '⚡', water: '💧', gas: '🔥', internet: '📶' }
            return (
              <View key={bill.id} style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border, marginBottom: Spacing.xs }]}>
                <View style={s.row}>
                  <Text style={{ fontSize: 16 }}>{ICONS[acct?.provider_type ?? ''] ?? '📄'}</Text>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={[Typography.caption, { color: c.text1, fontWeight: '600' }]}>
                      {acct?.provider_name ?? 'Bill'}
                    </Text>
                    <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>
                      ₹{formatRent(bill.amount)} · Due {bill.due_date ?? '—'}
                    </Text>
                  </View>
                  <Pressable
                    style={[s.billPayBtn, { backgroundColor: c.accent, opacity: payingBillId === bill.id ? 0.5 : 1 }]}
                    onPress={() => handlePayBill(bill.id!)}
                    disabled={!!payingBillId}
                  >
                    {payingBillId === bill.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[Typography.caption, { color: '#fff', fontWeight: '700', fontSize: 11 }]}>Pay</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )
          })}
        </>
      )}

      {/* Payment history */}
      {history.length > 0 && (
        <>
          <Pressable
            style={s.row}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Text style={[Typography.subtitle, { color: c.text1, flex: 1, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
              Payment History
            </Text>
            <Text style={[Typography.caption, { color: c.text4, marginTop: Spacing.lg }]}>
              {showHistory ? '▲' : '▼'}
            </Text>
          </Pressable>
          {showHistory && history.map(p => {
            const pst = PAYMENT_STATUS[p.status ?? 'pending'] ?? PAYMENT_STATUS.pending
            return (
              <View key={p.id} style={[s.historyRow, { borderBottomColor: c.border }]}>
                <Text style={[Typography.caption, { color: c.text2, flex: 1 }]}>
                  {formatMonth(p.month)}
                </Text>
                <Text style={[Typography.caption, { color: c.text1, marginRight: Spacing.md }]}>
                  ₹{formatRent(p.amount)}
                </Text>
                <View style={[s.statusBadge, { backgroundColor: pst.bg }]}>
                  <Text style={{ color: pst.color, fontSize: 9, fontWeight: '700' }}>{pst.label}</Text>
                </View>
              </View>
            )
          })}
        </>
      )}

      <View style={{ height: 80 }} />

      <SetuBillPaySheet
        visible={showSetuPay}
        paymentLink={setuLink}
        providerName={
          payingBillId
            ? accounts.find(a => a.id === bills.find(b => b.id === payingBillId)?.utility_account_id)?.provider_name
            : undefined
        }
        onClose={() => { setShowSetuPay(false); setSetuLink(null) }}
        onSuccess={() => {
          setShowSetuPay(false)
          setSetuLink(null)
          refreshUtil()
          Alert.alert('Payment Submitted', 'Your payment is being processed. It may take a moment to update.')
        }}
      />
    </ScrollView>
  )
}

// ─── Landlord View ──────────────────────────────────────────────────────────

function LandlordView({ tenancies, c }: { tenancies: Tenancy[]; c: any }) {
  const { user } = useAuth()
  const [myProperties, setMyProperties] = useState<LandlordProperty[]>([])

  useEffect(() => {
    if (!user?.id) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchMyProperties(supabase as any, user.id).then(result => {
      if (result.data) setMyProperties(result.data)
    })
  }, [user?.id])

  if (tenancies.length === 0 && myProperties.length === 0) {
    return (
      <EmptyState
        emoji="🏗️"
        message={'No properties yet.\nCreate a tenancy to start tracking rent.'}
        c={c}
        showCreate
      />
    )
  }

  return (
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* My Properties — persistent property cards */}
      {myProperties.length > 0 && (
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ color: c.text3, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.sm }}>
            My Properties
          </Text>
          <FlatList
            data={myProperties}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={p => p.id}
            ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
            renderItem={({ item: p }) => {
              const statusColor = p.status === 'tenanted' ? '#22c55e' : p.status === 'unlisted' ? '#4a6685' : '#60a5fa'
              const statusLabel = p.status === 'tenanted' ? 'Tenanted' : p.status === 'unlisted' ? 'Unlisted' : 'Vacant'
              return (
                <Pressable
                  style={{ backgroundColor: c.bgSubtle, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 12, width: 160 }}
                  onPress={() => router.push(`/property/${p.id}`)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{statusLabel}</Text>
                    {p.bhk_type && <Text style={{ color: c.text4, fontSize: 9 }}>{p.bhk_type}</Text>}
                  </View>
                  <Text style={{ color: c.text1, fontSize: 12, fontWeight: '600', lineHeight: 16, marginBottom: 2 }} numberOfLines={2}>{p.name}</Text>
                  <Text style={{ color: c.text3, fontSize: 10, textTransform: 'capitalize', marginBottom: 4 }}>{p.city}</Text>
                  {p.active_tenancy ? (
                    <Text style={{ color: c.text2, fontSize: 10 }}>
                      {p.active_tenancy.tenant_name ?? 'Tenant joined'} · ₹{p.active_tenancy.monthly_rent.toLocaleString('en-IN')}
                    </Text>
                  ) : p.last_vacancy ? (
                    <Text style={{ color: c.text4, fontSize: 10 }}>Last: ₹{p.last_vacancy.asking_rent.toLocaleString('en-IN')}</Text>
                  ) : null}
                  {(p.utility_account_count ?? 0) > 0 && (
                    <Text style={{ color: c.text4, fontSize: 10, marginTop: 2 }}>
                      {p.utility_account_count} {p.utility_account_count === 1 ? 'utility' : 'utilities'}
                    </Text>
                  )}
                </Pressable>
              )
            }}
          />
        </View>
      )}

      <Pressable
        style={[s.payBtn, { backgroundColor: c.accent, marginBottom: Spacing.lg }]}
        onPress={() => router.push('/dashboard/create')}
      >
        <Text style={[Typography.subtitle, { color: '#fff' }]}>+ Create Tenancy</Text>
      </Pressable>

      {tenancies.map(t => {
        const tst = TENANCY_STATUS[t.status ?? 'active'] ?? TENANCY_STATUS.active
        return (
          <Pressable
            key={t.id}
            style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border, marginBottom: Spacing.sm }]}
            onPress={() => router.push(`/dashboard/${t.id}`)}
          >
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.subtitle, { color: c.text1, fontSize: 14 }]}>
                  {t.property_label}
                </Text>
                <Text style={[Typography.caption, { color: c.text3, marginTop: 2, fontSize: 11 }]}>
                  ₹{formatRent(t.monthly_rent)}/mo
                  {t.tenant_id ? '' : ' · No tenant yet'}
                </Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: tst.color + '20' }]}>
                <Text style={{ color: tst.color, fontSize: 10, fontWeight: '700' }}>{tst.label}</Text>
              </View>
            </View>
          </Pressable>
        )
      })}

      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ emoji, message, c, showCreate }: { emoji: string; message: string; c: any; showCreate?: boolean }) {
  return (
    <View style={s.center}>
      <Text style={{ fontSize: 40, marginBottom: Spacing.md }}>{emoji}</Text>
      <Text style={[Typography.body, { color: c.text3, textAlign: 'center', lineHeight: 22 }]}>
        {message}
      </Text>
      {showCreate && (
        <Pressable
          style={[s.payBtn, { backgroundColor: c.accent, marginTop: Spacing.lg }]}
          onPress={() => router.push('/dashboard/create')}
        >
          <Text style={[Typography.subtitle, { color: '#fff' }]}>+ Create Tenancy</Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  content: { padding: Spacing.base },
  card: {
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  payBtn: {
    borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center',
  },
  billPayBtn: {
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6,
    minWidth: 50, alignItems: 'center', justifyContent: 'center',
  },
  outlineBtn: {
    borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Spacing.sm, alignItems: 'center',
  },
  infoBox: {
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
  },
  txnRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  txnInput: {
    flex: 1, borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
})
