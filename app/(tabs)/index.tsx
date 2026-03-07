import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { CITY_BOUNDS } from 'rent-right-shared'

import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useMembership } from '@/hooks/useMembership'
import { supabase } from '@/lib/supabase'
import { Spacing, Radius } from '@/constants/theme'

// ─── City data (mirrors web CITIES + CITY_META) ───────────────────────────────

type CityInfo = {
  name: string
  label: string
  abbr: string
  tagline: string
  accentColor: string   // border-top + abbr text + live dot
  accentBg: string      // abbr chip background
  active: boolean
}

const CITIES: CityInfo[] = [
  {
    name: 'bengaluru', label: 'Bengaluru', abbr: 'BLR',
    tagline: 'Silicon Valley of India',
    accentColor: '#22c55e', accentBg: 'rgba(16,185,129,0.15)', active: true,
  },
  {
    name: 'pune', label: 'Pune', abbr: 'PUN',
    tagline: 'Oxford of the East',
    accentColor: '#60a5fa', accentBg: 'rgba(37,99,235,0.18)', active: true,
  },
  {
    name: 'hyderabad', label: 'Hyderabad', abbr: 'HYD',
    tagline: 'City of Pearls',
    accentColor: '#f59e0b', accentBg: 'rgba(245,158,11,0.15)', active: true,
  },
  {
    name: 'gurugram', label: 'Gurugram', abbr: 'GGN',
    tagline: 'Millennium City',
    accentColor: '#7896b4', accentBg: 'rgba(120,150,180,0.15)', active: true,
  },
  {
    name: 'chennai', label: 'Chennai', abbr: 'CHN',
    tagline: 'Gateway of South India',
    accentColor: '#ef4444', accentBg: 'rgba(239,68,68,0.15)', active: true,
  },
  {
    name: 'mumbai', label: 'Mumbai', abbr: 'MUM',
    tagline: 'City of Dreams',
    accentColor: '#a78bfa', accentBg: 'rgba(139,92,246,0.15)', active: true,
  },
]

// ─── Colour constants matching web ────────────────────────────────────────────
const ACCENT_BG      = 'rgba(37,99,235,0.18)'
const ACCENT_TEXT    = '#60a5fa'
const GREEN_BG       = 'rgba(16,185,129,0.15)'
const PURPLE_BG      = 'rgba(139,92,246,0.15)'
const PURPLE_COLOR   = '#a78bfa'
const GREEN_COLOR    = '#22c55e'

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const c = useColors()
  const { user, profile, refreshProfile } = useAuth()
  const membership = useMembership(user?.id)

  const [totalSubmissions, setTotalSubmissions] = useState<number | null>(null)
  const [cityVacancyCounts, setCityVacancyCounts] = useState<Record<string, number>>({})
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const { count: rentCount } = await supabase
        .from('rent_submissions')
        .select('*', { count: 'exact', head: true })
      setTotalSubmissions(rentCount ?? 0)

      const now = new Date().toISOString()
      const counts: Record<string, number> = {}
      await Promise.all(
        CITIES.filter(ct => ct.active).map(async (city) => {
          const b = CITY_BOUNDS[city.name]
          if (!b) return
          const { count } = await supabase
            .from('vacancies')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('status', 'active')
            .gt('expires_at', now)
            .gte('lat', b.latMin).lte('lat', b.latMax)
            .gte('lng', b.lngMin).lte('lng', b.lngMax)
          counts[city.name] = count ?? 0
        })
      )
      setCityVacancyCounts(counts)
      setStatsLoading(false)
    }
    fetchStats()
  }, [])

  const handleCityPress = useCallback(async (cityName: string) => {
    if (user?.id && profile?.city !== cityName) {
      await supabase.from('profiles').update({ city: cityName }).eq('user_id', user.id)
      await refreshProfile()
    }
    router.push('/(tabs)/map')
  }, [user?.id, profile?.city, refreshProfile])

  const canPost      = membership.canPostAsLandlord
  const hasTenantPlan = membership.isTenantCoreActive

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero band — dot-pattern background ────────────────────────────── */}
        <View style={s.hero}>
          {/* Logo + wordmark */}
          <View style={s.heroRow}>
            <View style={[s.logoBox, { backgroundColor: c.accent }]}>
              {/* Simple home SVG approximated as text */}
              <Text style={s.logoGlyph}>⌂</Text>
            </View>
            <Text style={[s.wordmark, { color: c.text1 }]}>Rent Right</Text>
          </View>

          {/* Headline */}
          <Text style={[s.headline, { color: '#ffffff' }]}>
            Rental intelligence{'\n'}for Indian cities
          </Text>

          {/* Live data badge */}
          {totalSubmissions !== null && totalSubmissions > 0 && (
            <View style={[s.dataBadge, { backgroundColor: ACCENT_BG }]}>
              {/* Mini bar-chart icon */}
              <Text style={{ fontSize: 11 }}>📊</Text>
              <Text style={[s.dataBadgeText, { color: ACCENT_TEXT }]}>
                {totalSubmissions.toLocaleString()} rent data points
              </Text>
            </View>
          )}
        </View>

        {/* ── Dashboard card ────────────────────────────────────────────────── */}
        <View style={s.px}>
          <Pressable
            style={[s.rowCard, { backgroundColor: c.bgSubtle, borderColor: c.border }]}
            onPress={() => router.push('/dashboard')}
          >
            <View style={[s.rowIcon, { backgroundColor: ACCENT_BG, borderColor: 'rgba(37,99,235,0.25)', borderWidth: 1 }]}>
              <Text style={{ fontSize: 17 }}>📊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, { color: c.text1 }]}>Dashboard</Text>
              <Text style={[s.rowSub, { color: c.text4 }]}>Rent tracking &amp; tenancy</Text>
            </View>
            <Text style={[s.chevron, { color: c.text4 }]}>›</Text>
          </Pressable>
        </View>

        {/* ── Vault card ────────────────────────────────────────────────────── */}
        <View style={[s.px, { marginTop: Spacing.sm }]}>
          <Pressable
            style={[s.rowCard, { backgroundColor: c.bgSubtle, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/vault')}
          >
            <View style={[s.rowIcon, { backgroundColor: PURPLE_BG, borderColor: 'rgba(139,92,246,0.25)', borderWidth: 1 }]}>
              <Text style={{ fontSize: 17 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, { color: c.text1 }]}>The Vault</Text>
              <Text style={[s.rowSub, { color: c.text4 }]}>
                {membership.isVaultActive
                  ? 'Move-in records · document & protect'
                  : '🔒 Members only · 27-month access'}
              </Text>
            </View>
            <Text style={[s.chevron, { color: c.text4 }]}>›</Text>
          </Pressable>
        </View>

        {/* ── Action cards (2-col grid) ─────────────────────────────────────── */}
        <View style={[s.px, s.grid, { marginTop: Spacing.sm }]}>
          {/* Post a Vacancy */}
          <Pressable
            style={[s.gridCard, { backgroundColor: c.bgSubtle, borderColor: c.border }]}
            onPress={() => router.push('/vacancy/create')}
          >
            <View style={[s.gridIcon, { backgroundColor: ACCENT_BG, borderColor: 'rgba(37,99,235,0.25)', borderWidth: 1 }]}>
              <Text style={{ fontSize: 19 }}>🏗️</Text>
            </View>
            <Text style={[s.gridTitle, { color: c.text1 }]}>Post a Vacancy</Text>
            <Text style={[s.gridSub, { color: c.text4 }]}>
              {canPost ? 'List your property' : '🔒 Landlord plan'}
            </Text>
          </Pressable>

          {/* Contact Landlords */}
          <Pressable
            style={[s.gridCard, { backgroundColor: c.bgSubtle, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/vacancies')}
          >
            <View style={[s.gridIcon, { backgroundColor: GREEN_BG, borderColor: 'rgba(16,185,129,0.25)', borderWidth: 1 }]}>
              <Text style={{ fontSize: 19 }}>📞</Text>
            </View>
            <Text style={[s.gridTitle, { color: c.text1 }]}>Contact Landlords</Text>
            <Text style={[s.gridSub, { color: c.text4 }]}>
              {hasTenantPlan ? 'View contacts' : '🔒 Tenant plan'}
            </Text>
          </Pressable>
        </View>

        {/* ── City selection ────────────────────────────────────────────────── */}
        <View style={[s.px, { marginTop: Spacing.lg }]}>
          <Text style={[s.sectionLabel, { color: c.text4 }]}>CHOOSE A CITY</Text>
          <View style={s.cityGrid}>
            {CITIES.map((city) => {
              const vacCount = cityVacancyCounts[city.name] ?? 0
              return (
                <Pressable
                  key={city.name}
                  style={[
                    s.cityCard,
                    {
                      backgroundColor: c.bgSubtle,
                      borderColor: c.border,
                      borderTopColor: city.accentColor,
                      borderTopWidth: 3,
                    },
                  ]}
                  onPress={() => handleCityPress(city.name)}
                  disabled={!city.active}
                >
                  {/* Abbr chip */}
                  <View style={[s.abbrChip, { backgroundColor: city.accentBg }]}>
                    <Text style={[s.abbrText, { color: city.accentColor }]}>{city.abbr}</Text>
                  </View>

                  <Text style={[s.cityName, { color: c.text1 }]}>{city.label}</Text>
                  <Text style={[s.cityTagline, { color: c.text4 }]}>{city.tagline}</Text>

                  {/* Live indicator */}
                  <View style={s.cityStatus}>
                    {statsLoading ? (
                      <ActivityIndicator size="small" color={c.text4} style={{ transform: [{ scale: 0.6 }] }} />
                    ) : (
                      <View style={s.liveRow}>
                        <View style={[s.liveDot, { backgroundColor: GREEN_COLOR }]} />
                        <Text style={[s.liveText, { color: GREEN_COLOR }]}>
                          {vacCount > 0 ? `${vacCount} listings` : 'Live'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <Text style={[s.footer, { color: c.text4 }]}>
          Community-powered · your data is private
        </Text>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {},

  // Horizontal padding wrapper
  px: { paddingHorizontal: Spacing.base },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm + 2,
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  wordmark: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  dataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dataBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Row cards (dashboard / vault) ─────────────────────────────────────────
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  rowSub: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 1,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '400',
  },

  // ── Action grid (2-col) ───────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  gridCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  gridIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  gridSub: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 1,
  },

  // ── City grid ─────────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  cityCard: {
    width: '48%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    paddingBottom: 10,
  },
  abbrChip: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
  },
  abbrText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cityName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  cityTagline: {
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
    marginTop: 1,
  },
  cityStatus: {
    marginTop: 8,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.3,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
})
