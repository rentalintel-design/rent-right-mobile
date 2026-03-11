import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRent } from '@/lib/vacancyUtils'
import {
  fetchMyProperties,
  fetchPropertyTimeline,
  fetchPropertyUtilityAccounts,
  updatePropertyStatus,
  type LandlordProperty,
  type Tenancy,
  type UtilityAccount,
} from 'rent-right-shared'

const PROVIDER_ICONS: Record<string, string> = {
  electricity: '⚡',
  water: '💧',
  gas: '🔥',
  internet: '📶',
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const c = useColors()

  const [property, setProperty] = useState<LandlordProperty | null>(null)
  const [tenancies, setTenancies] = useState<Tenancy[]>([])
  const [vacancies, setVacancies] = useState<Record<string, unknown>[]>([])
  const [utilities, setUtilities] = useState<UtilityAccount[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      // Fetch property info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const propResult = await fetchMyProperties(db, user?.id ?? '')
      const found = propResult.data?.find(p => p.id === id) ?? null
      setProperty(found)

      // Fetch timeline
      const timelineResult = await fetchPropertyTimeline(db, id)
      if (timelineResult.data) {
        setTenancies(timelineResult.data.tenancies as unknown as Tenancy[])
        setVacancies(timelineResult.data.vacancies)
      }

      // Fetch utility accounts
      const utilResult = await fetchPropertyUtilityAccounts(db, id)
      if (utilResult.data) setUtilities(utilResult.data)
    } finally {
      setLoading(false)
    }
  }, [id, user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const handleRepost = () => {
    // Navigate to vacancy creation with property prefilled
    router.push({ pathname: '/dashboard/create', params: { propertyId: id } })
  }

  const handleUnlist = async () => {
    if (!id) return
    Alert.alert('Unlist Property', 'Mark this property as unlisted?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlist',
        style: 'destructive',
        onPress: async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updatePropertyStatus(supabase as any, id, 'unlisted')
          load()
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!property) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
        <View style={s.center}>
          <Text style={{ color: c.text3 }}>Property not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const statusColor = property.status === 'tenanted' ? '#22c55e' : property.status === 'unlisted' ? '#4a6685' : '#60a5fa'
  const statusLabel = property.status === 'tenanted' ? 'Tenanted' : property.status === 'unlisted' ? 'Unlisted' : 'Vacant'
  const activeTenancy = tenancies.find(t => t.status === 'active')

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={[Typography.subtitle, { color: c.text1 }]} numberOfLines={1}>{property.name}</Text>
        </View>
        <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Property info */}
        <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <Text style={[s.sectionLabel, { color: c.text3 }]}>PROPERTY</Text>
          <Text style={[Typography.body, { color: c.text1, marginTop: 2 }]}>{property.name}</Text>
          <Text style={[Typography.caption, { color: c.text3, marginTop: 2, textTransform: 'capitalize' }]}>
            {property.city}{property.bhk_type ? ` · ${property.bhk_type}` : ''}
          </Text>
        </View>

        {/* Active tenancy */}
        {activeTenancy && (
          <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
            <Text style={[s.sectionLabel, { color: c.text3 }]}>CURRENT TENANT</Text>
            <Text style={[Typography.body, { color: c.text1, marginTop: 2 }]}>
              {property.active_tenancy?.tenant_name ?? 'Tenant joined'}
            </Text>
            <Text style={[Typography.caption, { color: c.text3, marginTop: 2 }]}>
              ₹{formatRent(activeTenancy.monthly_rent)}/mo
              {activeTenancy.lease_start ? ` · Since ${new Date(activeTenancy.lease_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}
            </Text>
            <Pressable
              style={{ marginTop: Spacing.sm }}
              onPress={() => router.push(`/dashboard/${activeTenancy.id}`)}
            >
              <Text style={{ color: c.accent, fontSize: 12, fontWeight: '600' }}>View tenancy →</Text>
            </Pressable>
          </View>
        )}

        {/* Utility accounts (persistent, property-level) */}
        <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <Text style={[s.sectionLabel, { color: c.text3 }]}>UTILITY ACCOUNTS</Text>
          {utilities.length === 0 ? (
            <Text style={[Typography.caption, { color: c.text4, marginTop: 4 }]}>No utility accounts yet</Text>
          ) : utilities.map((u, i) => (
            <View key={u.id ?? i} style={{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>{PROVIDER_ICONS[u.provider_type] ?? '📋'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.caption, { color: c.text1, fontWeight: '600' }]}>{u.provider_name}</Text>
                <Text style={[Typography.caption, { color: c.text3 }]}>{u.consumer_number}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Timeline */}
        {tenancies.length > 0 && (
          <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
            <Text style={[s.sectionLabel, { color: c.text3 }]}>TENANCY HISTORY</Text>
            {tenancies.map((t, i) => (
              <Pressable
                key={t.id ?? i}
                style={{ marginTop: Spacing.sm, paddingTop: i > 0 ? Spacing.sm : 0, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.border }}
                onPress={() => t.id && router.push(`/dashboard/${t.id}`)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[Typography.caption, { color: c.text2, fontWeight: '600' }]}>
                    ₹{formatRent(t.monthly_rent)}/mo
                  </Text>
                  <View style={{ backgroundColor: (t.status === 'active' ? '#22c55e' : '#4a6685') + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: t.status === 'active' ? '#22c55e' : '#9ca3af', fontSize: 9, fontWeight: '700' }}>
                      {t.status === 'active' ? 'Active' : 'Ended'}
                    </Text>
                  </View>
                </View>
                {t.lease_start && (
                  <Text style={[Typography.caption, { color: c.text4, marginTop: 2 }]}>
                    {new Date(t.lease_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    {t.ended_at ? ` → ${new Date(t.ended_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ' → present'}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Vacancies timeline */}
        {vacancies.length > 0 && (
          <View style={[s.card, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
            <Text style={[s.sectionLabel, { color: c.text3 }]}>VACANCY HISTORY</Text>
            {vacancies.map((v, i) => (
              <View
                key={(v.id as string) ?? i}
                style={{ marginTop: Spacing.sm, paddingTop: i > 0 ? Spacing.sm : 0, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.border }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[Typography.caption, { color: c.text2, fontWeight: '600' }]}>
                    ₹{formatRent(v.asking_rent as number)}/mo
                  </Text>
                  <Text style={[Typography.caption, { color: c.text4 }]}>{v.status as string}</Text>
                </View>
                {typeof v.created_at === 'string' && (
                  <Text style={[Typography.caption, { color: c.text4, marginTop: 2 }]}>
                    Posted {new Date(v.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {property.status === 'vacant' && (
            <Pressable
              style={[s.btn, { backgroundColor: c.accent }]}
              onPress={handleRepost}
            >
              <Text style={[Typography.subtitle, { color: '#fff' }]}>🔁 Repost Vacancy</Text>
            </Pressable>
          )}
          {property.status !== 'unlisted' && (
            <Pressable
              style={[s.btn, { backgroundColor: c.bgSubtle, borderColor: c.border, borderWidth: 1 }]}
              onPress={handleUnlist}
            >
              <Text style={[Typography.subtitle, { color: c.text3 }]}>Unlist Property</Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.base, gap: Spacing.sm },
  card: {
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md,
  },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
  },
  btn: {
    borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center',
  },
})
