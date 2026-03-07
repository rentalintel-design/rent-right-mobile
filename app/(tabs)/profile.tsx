import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useMembership } from '@/hooks/useMembership'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { maskPhone, CITY_BOUNDS } from 'rent-right-shared'
import { formatRent } from '@/lib/vacancyUtils'

const CITIES = Object.keys(CITY_BOUNDS)

// ─── Types ────────────────────────────────────────────────────────────────────

type RentSubmission = {
  id: string; bhk_type: string; rent_amount: number
  submitted_at: string; property_id: string
  properties?: { name: string } | null
}

type SavedVacancy = {
  vacancy_id: string
  vacancies: { id: string; bhk_type: string; asking_rent: number; city: string; locality_name: string | null } | null
}

type ContactedConversation = {
  id: string
  vacancy: { bhk_type: string; asking_rent: number; city: string } | null
  last_message_preview: string | null
  last_message_at: string | null
}

type LandlordVacancy = {
  id: string; bhk_type: string; asking_rent: number; status: string; city: string
}

type Tab = 'plans' | 'messages' | 'activity' | 'settings'

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const c = useColors()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const membership = useMembership(user?.id)

  const [activeTab, setActiveTab] = useState<Tab>('plans')

  // Identity edit
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.name ?? '')
  const [addingAltRole, setAddingAltRole] = useState(false)
  const [altRolePick, setAltRolePick] = useState<'tenant' | 'landlord' | null>(null)
  const [altCityPick, setAltCityPick] = useState(CITIES[0])

  // Google linking
  const [googleLinking, setGoogleLinking] = useState(false)

  // Email edit
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  // Tab data
  const [submissions, setSubmissions] = useState<RentSubmission[]>([])
  const [savedVacancies, setSavedVacancies] = useState<SavedVacancy[]>([])
  const [conversations, setConversations] = useState<ContactedConversation[]>([])
  const [myVacancies, setMyVacancies] = useState<LandlordVacancy[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  // Load tab data on switch
  useEffect(() => {
    if (!user?.id) return
    setTabLoading(true)

    if (activeTab === 'plans') {
      supabase.from('rent_submissions')
        .select('id, bhk_type, rent_amount, submitted_at, property_id, properties(name)')
        .eq('user_id', user.id).order('submitted_at', { ascending: false }).limit(20)
        .then(({ data }) => { if (data) setSubmissions(data as RentSubmission[]); setTabLoading(false) })
    }

    if (activeTab === 'messages') {
      supabase.from('conversations')
        .select('id, last_message_preview, last_message_at, vacancy:vacancy_id(bhk_type, asking_rent, city)')
        .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })
        .then(({ data }) => { if (data) setConversations(data as ContactedConversation[]); setTabLoading(false) })
    }

    if (activeTab === 'activity') {
      if (profile?.role === 'landlord') {
        supabase.from('vacancies').select('id, bhk_type, asking_rent, status, city')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
          .then(({ data }) => { if (data) setMyVacancies(data as LandlordVacancy[]); setTabLoading(false) })
      } else {
        supabase.from('favorites')
          .select('vacancy_id, vacancies:vacancy_id(id, bhk_type, asking_rent, city, locality_name)')
          .eq('user_id', user.id)
          .then(({ data }) => { if (data) setSavedVacancies(data as SavedVacancy[]); setTabLoading(false) })
      }
    }

    if (activeTab === 'settings') setTabLoading(false)
  }, [activeTab, user?.id, profile?.role])

  const saveName = useCallback(async () => {
    if (!user?.id || !nameInput.trim()) return
    await supabase.from('profiles').update({ name: nameInput.trim() }).eq('user_id', user.id)
    await refreshProfile()
    setEditingName(false)
  }, [user?.id, nameInput, refreshProfile])

  const switchRole = useCallback(async () => {
    if (!user?.id || !profile?.alt_role) return
    const { role, city, alt_role, alt_city } = profile
    await supabase.from('profiles').update({ role: alt_role, city: alt_city, alt_role: role, alt_city: city }).eq('user_id', user.id)
    await refreshProfile()
  }, [user?.id, profile, refreshProfile])

  const saveAltRole = useCallback(async () => {
    if (!user?.id || !altRolePick) return
    await supabase.from('profiles').update({ alt_role: altRolePick, alt_city: altCityPick }).eq('user_id', user.id)
    await refreshProfile()
    setAddingAltRole(false)
  }, [user?.id, altRolePick, altCityPick, refreshProfile])

  const linkGoogle = useCallback(async () => {
    setGoogleLinking(true)
    try {
      const redirectTo = makeRedirectUri({ scheme: 'rentrightmobile' })
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error || !data?.url) {
        Alert.alert('Error', error?.message ?? 'Could not start Google sign-in')
        return
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success' && result.url?.includes('code=')) {
        const codeMatch = result.url.match(/[?&]code=([^&]+)/)
        if (codeMatch) await supabase.auth.exchangeCodeForSession(codeMatch[1])
        await refreshProfile()
        Alert.alert('Success', 'Google account linked!')
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Google linking failed')
    } finally {
      setGoogleLinking(false)
    }
  }, [refreshProfile])

  const saveEmail = useCallback(async () => {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed.includes('@')) { Alert.alert('Invalid email'); return }
    if (!user?.id) return
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    if (error) { Alert.alert('Error', error.message); return }
    await supabase.from('profiles').update({ email: trimmed }).eq('user_id', user.id)
    await refreshProfile()
    setEditingEmail(false)
    Alert.alert('Email saved', 'Check your inbox to confirm the new email.')
  }, [emailInput, user?.id, refreshProfile])

  const roleEmoji = profile?.role === 'landlord' ? '🏗️' : '🔍'
  const roleColor = profile?.role === 'landlord' ? 'rgba(37,99,235,0.18)' : 'rgba(16,185,129,0.15)'

  // Tab definitions — role-aware
  const TABS: { key: Tab; label: string }[] = [
    { key: 'plans',    label: 'Plans' },
    { key: 'messages', label: 'Messages' },
    { key: 'activity', label: profile?.role === 'landlord' ? 'Vacancies' : 'Saved' },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>

      {/* ── Identity header ─────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: c.bgSurface, borderBottomColor: c.border }]}>
        {/* Left: avatar + info */}
        <View style={s.headerLeft}>
          <View style={[s.avatar, { backgroundColor: roleColor }]}>
            <Text style={{ fontSize: 20 }}>{roleEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {editingName ? (
              <View style={s.nameEditRow}>
                <TextInput
                  style={[s.nameInput, { color: c.text1, borderColor: c.border }]}
                  value={nameInput} onChangeText={setNameInput}
                  autoFocus placeholder="Your name" placeholderTextColor={c.text4}
                />
                <Pressable onPress={saveName}>
                  <Text style={[Typography.caption, { color: c.accent, fontWeight: '600' }]}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setEditingName(false)}>
                  <Text style={[Typography.caption, { color: c.text4 }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => { setNameInput(profile?.name ?? ''); setEditingName(true) }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[s.nameText, { color: c.text1 }]} numberOfLines={1}>
                  {profile?.name ?? 'Tap to set name'}
                </Text>
                <Text style={{ color: c.text4, fontSize: 11 }}>✏️</Text>
              </Pressable>
            )}
            <Text style={[Typography.caption, { color: c.text3, marginTop: 1 }]}>
              {profile?.phone ? maskPhone(profile.phone) : '—'}
            </Text>
            <View style={s.badgeRow}>
              <View style={[s.roleBadge, { backgroundColor: c.accent }]}>
                <Text style={[s.roleBadgeText, { color: '#fff' }]}>
                  {profile?.role ?? '—'}
                </Text>
              </View>
              {profile?.city && (
                <Text style={[Typography.caption, { color: c.text4, textTransform: 'capitalize' }]}>
                  · {profile.city}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Role switch pill */}
        {profile?.alt_role ? (
          <Pressable style={[s.switchPill, { borderColor: c.border }]} onPress={switchRole}>
            <Text style={[Typography.caption, { color: c.text2, textTransform: 'capitalize', fontSize: 11 }]}>
              ⇄ Switch to {profile.alt_role}
            </Text>
          </Pressable>
        ) : !addingAltRole ? (
          <Pressable onPress={() => setAddingAltRole(true)}>
            <Text style={[Typography.caption, { color: c.accent, fontSize: 11 }]}>+ Role</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Alt role form */}
      {addingAltRole && (
        <View style={[s.altRoleForm, { backgroundColor: c.bgSurface, borderBottomColor: c.border }]}>
          <View style={s.altRoleRow}>
            {(['tenant', 'landlord'] as const).filter(r => r !== profile?.role).map(r => (
              <Pressable key={r}
                style={[s.roleOption, { backgroundColor: altRolePick === r ? c.accent : c.bgSubtle, borderColor: altRolePick === r ? c.accent : c.border }]}
                onPress={() => setAltRolePick(r)}>
                <Text style={[Typography.caption, { color: altRolePick === r ? '#fff' : c.text2, textTransform: 'capitalize' }]}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.cityRow}>
            {CITIES.map(ct => (
              <Pressable key={ct}
                style={[s.cityChip, { backgroundColor: altCityPick === ct ? c.accent : c.bgSubtle, borderColor: altCityPick === ct ? c.accent : c.border }]}
                onPress={() => setAltCityPick(ct)}>
                <Text style={[Typography.caption, { color: altCityPick === ct ? '#fff' : c.text3, fontSize: 10 }]}>{ct}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.altRoleActions}>
            <Pressable onPress={saveAltRole} style={[s.saveAltBtn, { backgroundColor: altRolePick ? c.accent : c.bgSubtle }]} disabled={!altRolePick}>
              <Text style={[Typography.caption, { color: altRolePick ? '#fff' : c.text4 }]}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setAddingAltRole(false)}>
              <Text style={[Typography.caption, { color: c.text4 }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <View style={[s.tabBar, { backgroundColor: c.bgSurface, borderBottomColor: c.border }]}>
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <Pressable key={tab.key} style={s.tabBtn} onPress={() => setActiveTab(tab.key)}>
              <Text style={[s.tabLabel, { color: active ? c.accent : c.text4 }]}>{tab.label}</Text>
              {active && <View style={[s.tabUnderline, { backgroundColor: c.accent }]} />}
            </Pressable>
          )
        })}
      </View>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
        {tabLoading && <ActivityIndicator color={c.accent} style={{ marginTop: Spacing.xl }} />}

        {/* PLANS TAB */}
        {!tabLoading && activeTab === 'plans' && (
          <>
            {/* Plan cards */}
            <PlanCard title="Tenant Plan" emoji="🔍"
              isActive={membership.isTenantCoreActive}
              membership={membership.tenantMembership}
              features={['📞 10 landlord contacts', '🗝️ Vault access (27mo)', '📊 Full rent history']}
              c={c} />
            <PlanCard title="Landlord Plan" emoji="🏗️"
              isActive={membership.isLandlordCoreActive}
              membership={membership.landlordMembership}
              features={['📋 Post vacancies', '🗝️ Vault access (27mo)', '📊 Full rent history']}
              c={c} />
            {membership.isVaultActive && (
              <View style={[s.vaultBadge, { backgroundColor: '#14532d', borderColor: '#166534' }]}>
                <Text style={[Typography.caption, { color: '#4ade80' }]}>🗝️ Vault access active</Text>
              </View>
            )}
            {!membership.isTenantCoreActive && !membership.isLandlordCoreActive && (
              <Text style={[Typography.caption, { color: c.text4, textAlign: 'center', marginTop: Spacing.sm }]}>
                No active plan — contribute rent data to unlock features
              </Text>
            )}

            {/* Contribute */}
            <View style={[s.divider, { borderColor: c.border }]} />
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.xs }]}>Data Contribution</Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.md }]}>
              Submit rent data to help others and unlock the fine rent grid.
            </Text>
            <Pressable style={[s.accentBtn, { backgroundColor: c.accent }]} onPress={() => router.push('/contribution/submit')}>
              <Text style={[Typography.subtitle, { color: '#fff' }]}>Submit Rent Data</Text>
            </Pressable>

            {/* Submission history */}
            {submissions.length > 0 && (
              <>
                <Text style={[Typography.subtitle, { color: c.text1, marginTop: Spacing.lg, marginBottom: Spacing.xs }]}>
                  Your Submissions ({submissions.length})
                </Text>
                <Text style={[Typography.caption, { color: c.text4, marginBottom: Spacing.sm, fontStyle: 'italic' }]}>
                  Submissions cannot be edited to maintain data integrity.
                </Text>
                {submissions.map(sub => (
                  <View key={sub.id} style={[s.subRow, { borderColor: c.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.caption, { color: c.text2 }]}>
                        {sub.bhk_type} · {formatRent(sub.rent_amount)}/mo
                      </Text>
                      <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>
                        {(sub.properties as any)?.name ?? 'Unknown property'} · {new Date(sub.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <View style={[s.subBadge, { backgroundColor: '#312e81' }]}>
                      <Text style={{ color: '#a5b4fc', fontSize: 9 }}>Submitted</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* MESSAGES TAB */}
        {!tabLoading && activeTab === 'messages' && (
          conversations.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: Spacing.sm }}>💬</Text>
              <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
                No conversations yet.{'\n'}Contact a landlord from a vacancy to start chatting.
              </Text>
            </View>
          ) : (
            conversations.map(conv => (
              <Pressable key={conv.id}
                style={[s.convRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}
                onPress={() => router.push(`/chat/${conv.id}`)}>
                <View style={[s.convAvatar, { backgroundColor: c.bgSubtle }]}>
                  <Text style={{ fontSize: 16 }}>🏠</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.subtitle, { color: c.text1, fontSize: 13 }]} numberOfLines={1}>
                    {conv.vacancy ? `${conv.vacancy.bhk_type} · ${conv.vacancy.city}` : 'Chat'}
                  </Text>
                  {conv.vacancy && (
                    <Text style={[Typography.caption, { color: c.accent, fontSize: 11 }]}>
                      ₹{formatRent(conv.vacancy.asking_rent)}/mo
                    </Text>
                  )}
                  <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]} numberOfLines={1}>
                    {conv.last_message_preview ?? 'No messages yet'}
                  </Text>
                </View>
                <Text style={{ color: c.text4, fontSize: 14 }}>›</Text>
              </Pressable>
            ))
          )
        )}

        {/* ACTIVITY TAB — Vacancies (landlord) or Saved (tenant) */}
        {!tabLoading && activeTab === 'activity' && profile?.role === 'landlord' && (
          myVacancies.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: Spacing.sm }}>🏗️</Text>
              <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
                No vacancies yet.
              </Text>
              <Pressable style={[s.accentBtn, { backgroundColor: c.accent, marginTop: Spacing.md }]}
                onPress={() => router.push('/vacancy/create')}>
                <Text style={[Typography.subtitle, { color: '#fff' }]}>+ Post a Vacancy</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable style={[s.accentBtn, { backgroundColor: c.accent, marginBottom: Spacing.md }]}
                onPress={() => router.push('/vacancy/create')}>
                <Text style={[Typography.subtitle, { color: '#fff' }]}>+ Post a Vacancy</Text>
              </Pressable>
              {myVacancies.map(v => {
                const STATUS: Record<string, { label: string; color: string }> = {
                  draft:      { label: 'Draft',   color: '#9ca3af' },
                  active:     { label: 'Active',  color: '#22c55e' },
                  booked:     { label: 'Booked',  color: '#fb923c' },
                  rented_out: { label: 'Rented',  color: '#3b82f6' },
                }
                const st = STATUS[v.status] ?? STATUS.draft
                return (
                  <Pressable key={v.id}
                    style={[s.convRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}
                    onPress={() => router.push(`/vacancy/${v.id}`)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.subtitle, { color: c.text1, fontSize: 13 }]}>{v.bhk_type}</Text>
                      <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>
                        {formatRent(v.asking_rent)}/mo · {v.city}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: st.color + '20' }]}>
                      <Text style={[Typography.caption, { color: st.color, fontSize: 10 }]}>{st.label}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </>
          )
        )}

        {!tabLoading && activeTab === 'activity' && profile?.role === 'tenant' && (
          savedVacancies.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: Spacing.sm }}>❤️</Text>
              <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
                No saved properties yet.{'\n'}Tap the heart on any vacancy to save it.
              </Text>
            </View>
          ) : (
            savedVacancies.map(fav => {
              const v = fav.vacancies
              if (!v) return null
              return (
                <Pressable key={fav.vacancy_id}
                  style={[s.convRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}
                  onPress={() => router.push(`/vacancy/${v.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.subtitle, { color: c.text1, fontSize: 13 }]}>{v.bhk_type}</Text>
                    <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>
                      {formatRent(v.asking_rent)}/mo · {v.locality_name ?? v.city}
                    </Text>
                  </View>
                  <Text style={{ color: c.red, fontSize: 16 }}>❤️</Text>
                </Pressable>
              )
            })
          )
        )}

        {/* SETTINGS TAB */}
        {!tabLoading && activeTab === 'settings' && (
          <>
            {/* Account info */}
            <View style={[s.settingsCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              <Text style={[s.settingsLabel, { color: c.text4 }]}>NAME</Text>
              <Text style={[Typography.body, { color: c.text1 }]}>{profile?.name ?? '—'}</Text>
              <View style={[s.settingsDivider, { borderColor: c.border }]} />
              <Text style={[s.settingsLabel, { color: c.text4 }]}>PHONE</Text>
              <Text style={[Typography.body, { color: c.text1 }]}>{profile?.phone ? maskPhone(profile.phone) : '—'}</Text>
              <View style={[s.settingsDivider, { borderColor: c.border }]} />
              <Text style={[s.settingsLabel, { color: c.text4 }]}>CITY</Text>
              <Text style={[Typography.body, { color: c.text1, textTransform: 'capitalize' }]}>{profile?.city ?? '—'}</Text>
              <View style={[s.settingsDivider, { borderColor: c.border }]} />
              <Text style={[s.settingsLabel, { color: c.text4 }]}>ROLE</Text>
              <Text style={[Typography.body, { color: c.text1, textTransform: 'capitalize' }]}>{profile?.role ?? '—'}</Text>
            </View>

            <View style={{ height: Spacing.lg }} />

            {/* ── Google account linking ── */}
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.xs }]}>
              Linked Accounts
            </Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.md }]}>
              Link your Google account before purchasing a plan. Used for billing & account recovery.
            </Text>

            {profile?.email ? (
              <View style={[s.linkedRow, { backgroundColor: c.bgSurface, borderColor: c.accent }]}>
                <View style={[s.googleIcon, { backgroundColor: '#fff' }]}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#4285F4' }}>G</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.caption, { color: c.text2, fontWeight: '600' }]}>Google</Text>
                  <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>{profile.email}</Text>
                </View>
                <View style={[s.linkedBadge, { backgroundColor: '#14532d' }]}>
                  <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '700' }}>Linked ✓</Text>
                </View>
              </View>
            ) : (
              <Pressable
                style={[s.linkedRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}
                onPress={linkGoogle}
                disabled={googleLinking}
              >
                <View style={[s.googleIcon, { backgroundColor: '#fff' }]}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#4285F4' }}>G</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.caption, { color: c.text2, fontWeight: '600' }]}>Google</Text>
                  <Text style={[Typography.caption, { color: c.text4, fontSize: 11 }]}>Not linked · required for plans</Text>
                </View>
                {googleLinking
                  ? <ActivityIndicator color={c.accent} size="small" />
                  : <Text style={[Typography.caption, { color: c.accent, fontWeight: '600' }]}>Link →</Text>
                }
              </Pressable>
            )}

            {/* ── Email (optional, editable) ── */}
            <View style={{ height: Spacing.lg }} />
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.xs }]}>Email Address</Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.md }]}>
              Optional — used for receipts and plan notifications.
            </Text>

            {editingEmail ? (
              <View style={s.emailEditRow}>
                <TextInput
                  style={[s.emailInput, { color: c.text1, borderColor: c.border, backgroundColor: c.bgSubtle }]}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="you@example.com"
                  placeholderTextColor={c.text4}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <Pressable style={[s.saveEmailBtn, { backgroundColor: c.accent }]} onPress={saveEmail}>
                  <Text style={[Typography.caption, { color: '#fff', fontWeight: '600' }]}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setEditingEmail(false)}>
                  <Text style={[Typography.caption, { color: c.text4 }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[s.linkedRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}
                onPress={() => { setEmailInput(profile?.email ?? ''); setEditingEmail(true) }}
              >
                <Text style={[Typography.body, { color: profile?.email ? c.text1 : c.text4, flex: 1 }]}>
                  {profile?.email ?? 'Tap to add email'}
                </Text>
                <Text style={[Typography.caption, { color: c.accent }]}>Edit</Text>
              </Pressable>
            )}

            <View style={{ height: Spacing.xl }} />

            <Pressable style={[s.outlineBtn, { borderColor: c.border }]} onPress={signOut}>
              <Text style={[Typography.subtitle, { color: c.text2 }]}>Sign Out</Text>
            </Pressable>

            <Pressable
              style={[s.outlineBtn, { borderColor: c.red, marginTop: Spacing.sm }]}
              onPress={() => {
                Alert.alert(
                  'Delete your account?',
                  'Your profile and login will be permanently removed. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Yes, delete', style: 'destructive',
                      onPress: async () => {
                        if (!user?.id) return
                        await supabase.from('profiles').delete().eq('user_id', user.id)
                        signOut()
                      },
                    },
                  ],
                )
              }}
            >
              <Text style={[Typography.subtitle, { color: c.red }]}>Delete Account</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ title, emoji, isActive, membership, features, c }: {
  title: string; emoji: string; isActive: boolean; membership: any; features: string[]; c: any
}) {
  return (
    <View style={[s.planCard, { backgroundColor: c.bgSurface, borderColor: isActive ? c.accent : c.border }]}>
      <View style={s.planHeader}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
        <Text style={[Typography.subtitle, { color: c.text1, flex: 1 }]}>{title}</Text>
        <View style={[s.statusBadge, { backgroundColor: isActive ? '#14532d' : '#374151' }]}>
          <Text style={[Typography.caption, { color: isActive ? '#4ade80' : '#9ca3af', fontSize: 10 }]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      {isActive && membership?.core_expires_at && (
        <Text style={[Typography.caption, { color: c.text4, marginTop: 4 }]}>
          Expires {new Date(membership.core_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      )}
      <View style={{ marginTop: Spacing.sm, gap: 3 }}>
        {features.map(f => (
          <Text key={f} style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>{f}</Text>
        ))}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1, minWidth: 0 },
  avatar: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  nameText: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nameInput: { borderBottomWidth: 1, fontSize: 15, paddingVertical: 2, minWidth: 100, flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  switchPill: {
    borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 5, flexShrink: 0,
  },

  // Alt role form
  altRoleForm: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
  altRoleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleOption: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderWidth: 1 },
  cityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  cityChip: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1 },
  altRoleActions: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  saveAltBtn: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.base,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, position: 'relative' },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },

  // Tab content
  tabContent: { padding: Spacing.base },

  // Plans tab
  planCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  vaultBadge: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm },
  divider: { borderTopWidth: 1, marginVertical: Spacing.lg },
  accentBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: Spacing.sm, gap: Spacing.sm },
  subBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },

  // Messages / Activity tab
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingHorizontal: Spacing.xl },
  convRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xs,
  },
  convAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  // Settings tab
  settingsCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, gap: 4 },
  settingsLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  settingsDivider: { borderTopWidth: 1, marginVertical: Spacing.sm },
  outlineBtn: { borderWidth: 2, borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center' },

  // Google linking
  linkedRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  googleIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  linkedBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },

  // Email edit
  emailEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  emailInput: {
    flex: 1, borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  saveEmailBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
})
