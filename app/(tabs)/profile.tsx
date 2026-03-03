import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useMembership } from '@/hooks/useMembership'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { maskPhone, CITY_BOUNDS } from 'rent-right-shared'
import { formatRent } from '@/lib/vacancyUtils'

const CITIES = Object.keys(CITY_BOUNDS)

type RentSubmission = {
  id: string
  bhk_type: string
  rent_amount: number
  submitted_at: string
  property_id: string
  properties?: { name: string } | null
}

export default function ProfileScreen() {
  const c = useColors()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const membership = useMembership(user?.id)

  // Edit state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.name ?? '')
  const [addingAltRole, setAddingAltRole] = useState(false)
  const [altRolePick, setAltRolePick] = useState<'tenant' | 'landlord' | null>(null)
  const [altCityPick, setAltCityPick] = useState(CITIES[0])

  // Contributions
  const [submissions, setSubmissions] = useState<RentSubmission[]>([])
  const [loadingSubs, setLoadingSubs] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('rent_submissions')
      .select('id, bhk_type, rent_amount, submitted_at, property_id, properties(name)')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setSubmissions(data as RentSubmission[])
        setLoadingSubs(false)
      })
  }, [user?.id])

  const saveName = useCallback(async () => {
    if (!user?.id || !nameInput.trim()) return
    await supabase.from('profiles').update({ name: nameInput.trim() }).eq('user_id', user.id)
    await refreshProfile()
    setEditingName(false)
  }, [user?.id, nameInput, refreshProfile])

  const switchRole = useCallback(async () => {
    if (!user?.id || !profile?.alt_role) return
    const { role, city, alt_role, alt_city } = profile
    await supabase.from('profiles').update({
      role: alt_role, city: alt_city, alt_role: role, alt_city: city,
    }).eq('user_id', user.id)
    await refreshProfile()
  }, [user?.id, profile, refreshProfile])

  const saveAltRole = useCallback(async () => {
    if (!user?.id || !altRolePick) return
    await supabase.from('profiles').update({
      alt_role: altRolePick, alt_city: altCityPick,
    }).eq('user_id', user.id)
    await refreshProfile()
    setAddingAltRole(false)
  }, [user?.id, altRolePick, altCityPick, refreshProfile])

  const roleEmoji = profile?.role === 'landlord' ? '🏗️' : '🔍'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity Header */}
        <View style={[styles.section, styles.identityCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <View style={[styles.avatar, { backgroundColor: c.bgSubtle }]}>
            <Text style={{ fontSize: 32 }}>{roleEmoji}</Text>
          </View>

          {/* Name */}
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={[styles.nameInput, { color: c.text1, borderColor: c.border }]}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                placeholder="Your name"
                placeholderTextColor={c.text4}
              />
              <Pressable onPress={saveName}>
                <Text style={[Typography.caption, { color: c.accent, fontWeight: '600' }]}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditingName(false)}>
                <Text style={[Typography.caption, { color: c.text4 }]}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => { setNameInput(profile?.name ?? ''); setEditingName(true) }}>
              <Text style={[Typography.title, { color: c.text1 }]}>
                {profile?.name ?? 'Tap to set name'}{' '}
                <Text style={[Typography.caption, { color: c.text4 }]}>✏️</Text>
              </Text>
            </Pressable>
          )}

          <Text style={[Typography.caption, { color: c.text3 }]}>
            {profile?.phone ? maskPhone(profile.phone) : '—'}
          </Text>

          {/* Role + City */}
          <View style={styles.roleBadgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: c.accent }]}>
              <Text style={[Typography.caption, { color: '#fff', fontWeight: '600', textTransform: 'capitalize' }]}>
                {profile?.role ?? '—'}
              </Text>
            </View>
            <Text style={[Typography.caption, { color: c.text3 }]}>{profile?.city ?? ''}</Text>
          </View>

          {/* Role switch / add alt */}
          {profile?.alt_role ? (
            <Pressable style={[styles.switchBtn, { borderColor: c.border }]} onPress={switchRole}>
              <Text style={[Typography.caption, { color: c.text2, textTransform: 'capitalize' }]}>
                Switch to {profile.alt_role} ({profile.alt_city})
              </Text>
            </Pressable>
          ) : !addingAltRole ? (
            <Pressable onPress={() => setAddingAltRole(true)}>
              <Text style={[Typography.caption, { color: c.accent }]}>+ Add second role</Text>
            </Pressable>
          ) : (
            <View style={styles.altRoleForm}>
              <View style={styles.altRoleRow}>
                {(['tenant', 'landlord'] as const).filter(r => r !== profile?.role).map(r => (
                  <Pressable
                    key={r}
                    style={[styles.roleOption, { backgroundColor: altRolePick === r ? c.accent : c.bgSubtle, borderColor: altRolePick === r ? c.accent : c.border }]}
                    onPress={() => setAltRolePick(r)}
                  >
                    <Text style={[Typography.caption, { color: altRolePick === r ? '#fff' : c.text2, textTransform: 'capitalize' }]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.cityRow}>
                {CITIES.map(ct => (
                  <Pressable
                    key={ct}
                    style={[styles.cityChip, { backgroundColor: altCityPick === ct ? c.accent : c.bgSubtle, borderColor: altCityPick === ct ? c.accent : c.border }]}
                    onPress={() => setAltCityPick(ct)}
                  >
                    <Text style={[Typography.caption, { color: altCityPick === ct ? '#fff' : c.text3, fontSize: 10 }]}>{ct}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.altRoleActions}>
                <Pressable onPress={saveAltRole} style={[styles.saveAltBtn, { backgroundColor: altRolePick ? c.accent : c.bgSubtle }]} disabled={!altRolePick}>
                  <Text style={[Typography.caption, { color: altRolePick ? '#fff' : c.text4 }]}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setAddingAltRole(false)}>
                  <Text style={[Typography.caption, { color: c.text4 }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* has_contributed badge */}
          {profile?.has_contributed && (
            <View style={[styles.contributedBadge, { backgroundColor: '#14532d' }]}>
              <Text style={[Typography.caption, { color: '#4ade80', fontSize: 10 }]}>✓ Contributor — Fine rent grid unlocked</Text>
            </View>
          )}
        </View>

        {/* Membership Section */}
        <View style={styles.section}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Membership</Text>
          {membership.loading ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <View style={styles.planCards}>
              <PlanCard
                title="Tenant Plan"
                emoji="🔍"
                isActive={membership.isTenantCoreActive}
                membership={membership.tenantMembership}
                features={['📞 10 landlord contacts', '🗝️ Vault access (27mo)', '📊 Full rent history']}
                c={c}
              />
              <PlanCard
                title="Landlord Plan"
                emoji="🏗️"
                isActive={membership.isLandlordCoreActive}
                membership={membership.landlordMembership}
                features={['📋 Post vacancies', '🗝️ Vault access (27mo)', '📊 Full rent history']}
                c={c}
              />
              {membership.isVaultActive && (
                <View style={[styles.vaultBadge, { backgroundColor: '#14532d', borderColor: '#166534' }]}>
                  <Text style={[Typography.caption, { color: '#4ade80' }]}>🗝️ Vault access active</Text>
                </View>
              )}
              {!membership.isTenantCoreActive && !membership.isLandlordCoreActive && (
                <Text style={[Typography.caption, { color: c.text4, textAlign: 'center' }]}>
                  No active plan — contribute rent data to unlock features
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Contribution Section */}
        <View style={styles.section}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Data Contribution</Text>
          <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.md }]}>
            Submit rent data to help others and unlock the fine rent grid.
          </Text>
          <Pressable
            style={[styles.contributeBtn, { backgroundColor: c.accent }]}
            onPress={() => router.push('/contribution/submit')}
          >
            <Text style={[Typography.subtitle, { color: '#fff' }]}>Submit Rent Data</Text>
          </Pressable>
        </View>

        {/* Contribution History */}
        {submissions.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>
              Your Submissions ({submissions.length})
            </Text>
            <Text style={[Typography.caption, { color: c.text4, marginBottom: Spacing.sm, fontStyle: 'italic' }]}>
              Submissions cannot be edited to maintain data integrity.
            </Text>
            {submissions.map(s => (
              <View key={s.id} style={[styles.subRow, { borderColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.caption, { color: c.text2 }]}>
                    {s.bhk_type} · {formatRent(s.rent_amount)}/mo
                  </Text>
                  <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>
                    {(s.properties as any)?.name ?? 'Unknown property'} · {new Date(s.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={[styles.subBadge, { backgroundColor: '#312e81' }]}>
                  <Text style={{ color: '#a5b4fc', fontSize: 9 }}>Submitted</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Messages */}
        <Pressable
          style={[styles.signOutBtn, { borderColor: c.border, marginBottom: Spacing.sm }]}
          onPress={() => router.push('/chat/inbox')}
        >
          <Text style={[Typography.subtitle, { color: c.text2 }]}>💬 Messages</Text>
        </Pressable>

        {/* Sign Out */}
        <Pressable style={[styles.signOutBtn, { borderColor: c.red }]} onPress={signOut}>
          <Text style={[Typography.subtitle, { color: c.red }]}>Sign Out</Text>
        </Pressable>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function PlanCard({ title, emoji, isActive, membership, features, c }: {
  title: string; emoji: string; isActive: boolean
  membership: any; features: string[]; c: any
}) {
  return (
    <View style={[styles.planCard, { backgroundColor: c.bgSurface, borderColor: isActive ? c.accent : c.border }]}>
      <View style={styles.planHeader}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
        <Text style={[Typography.subtitle, { color: c.text1, flex: 1 }]}>{title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? '#14532d' : '#374151' }]}>
          <Text style={[Typography.caption, { color: isActive ? '#4ade80' : '#9ca3af', fontSize: 10 }]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      {isActive && membership && (
        <Text style={[Typography.caption, { color: c.text4, marginTop: 4 }]}>
          Expires {new Date(membership.core_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      )}
      <View style={{ marginTop: Spacing.sm, gap: 4 }}>
        {features.map(f => (
          <Text key={f} style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>{f}</Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.base },
  section: { marginBottom: Spacing.lg },
  identityCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nameInput: {
    borderBottomWidth: 1,
    fontSize: 16,
    paddingVertical: 4,
    minWidth: 120,
  },
  roleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 3 },
  switchBtn: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  altRoleForm: { gap: Spacing.sm, width: '100%' },
  altRoleRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  roleOption: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderWidth: 1 },
  cityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' },
  cityChip: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1 },
  altRoleActions: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center', alignItems: 'center' },
  saveAltBtn: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  contributedBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  planCards: { gap: Spacing.sm },
  planCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  vaultBadge: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  contributeBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  subBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  signOutBtn: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
})
