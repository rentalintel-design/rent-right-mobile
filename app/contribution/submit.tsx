import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { CITY_BOUNDS } from 'rent-right-shared'

const CITIES = Object.keys(CITY_BOUNDS)
const BHK_OPTIONS = ['1BHK', '2BHK', '3BHK', '4BHK+']
const DEPOSIT_OPTIONS = [
  { value: 'full', label: '✅ Full returned', color: '#22c55e' },
  { value: 'partial', label: '🤝 Partial returned', color: '#eab308' },
  { value: 'none', label: '❌ Not returned', color: '#ef4444' },
]

export default function SubmitContributionScreen() {
  const c = useColors()
  const { user, profile, refreshProfile } = useAuth()

  const [propertyName, setPropertyName] = useState('')
  const [city, setCity] = useState(profile?.city ?? 'Bengaluru')
  const [bhkType, setBhkType] = useState<string | null>(null)
  const [rentAmount, setRentAmount] = useState('')
  const [depositOutcome, setDepositOutcome] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const canSubmit = propertyName.trim().length > 0 && bhkType && rentAmount && parseInt(rentAmount) >= 1000

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !canSubmit) return
    const rent = parseInt(rentAmount)
    if (rent < 1000 || rent > 500000) {
      Alert.alert('Invalid rent', 'Rent must be between ₹1,000 and ₹5,00,000')
      return
    }

    setSubmitting(true)
    try {
      // 1. Find or create property
      let propertyId: string
      const { data: existing } = await supabase
        .from('properties')
        .select('id')
        .ilike('name', propertyName.trim())
        .eq('city', city)
        .limit(1)
        .maybeSingle()

      if (existing) {
        propertyId = existing.id
      } else {
        const cityBounds = CITY_BOUNDS[city as keyof typeof CITY_BOUNDS]
        const lat = cityBounds ? (cityBounds.south + cityBounds.north) / 2 : 0
        const lng = cityBounds ? (cityBounds.west + cityBounds.east) / 2 : 0
        const { data: newProp, error: propErr } = await supabase
          .from('properties')
          .insert({ name: propertyName.trim(), city, lat, lng })
          .select('id')
          .single()
        if (propErr || !newProp) {
          Alert.alert('Error', propErr?.message ?? 'Failed to create property')
          setSubmitting(false)
          return
        }
        propertyId = newProp.id
      }

      // 2. Insert rent submission
      const { error: subErr } = await supabase.from('rent_submissions').insert({
        property_id: propertyId,
        bhk_type: bhkType,
        rent_amount: rent,
        is_shared_flat: false,
        is_furnished: false,
        furnishing_items: [],
        user_id: user.id,
      })
      if (subErr) {
        Alert.alert('Error', subErr.message)
        setSubmitting(false)
        return
      }

      // 3. Insert deposit submission (if answered)
      if (depositOutcome) {
        await supabase.from('deposit_submissions').insert({
          property_id: propertyId,
          outcome: depositOutcome,
        })
      }

      // 4. Mark as contributor
      if (!profile?.has_contributed) {
        await supabase.from('profiles').update({ has_contributed: true }).eq('user_id', user.id)
        await refreshProfile()
      }

      setSuccess(true)
    } catch {
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [user?.id, propertyName, city, bhkType, rentAmount, depositOutcome, canSubmit, profile, refreshProfile])

  if (success) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.successContainer}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={[Typography.title, { color: c.text1, textAlign: 'center' }]}>Thank you!</Text>
          <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
            Your rent data has been submitted. It will appear on the map shortly.
          </Text>
          {!profile?.has_contributed && (
            <Text style={[Typography.caption, { color: c.green, textAlign: 'center' }]}>
              Fine rent grid is now unlocked for you!
            </Text>
          )}
          <Pressable style={[styles.doneBtn, { backgroundColor: c.accent }]} onPress={() => router.back()}>
            <Text style={[Typography.subtitle, { color: '#fff' }]}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Cancel</Text>
        </Pressable>
        <Text style={[Typography.subtitle, { color: c.text1 }]}>Submit Rent Data</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          {/* Property name */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Property / Society Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={propertyName}
              onChangeText={setPropertyName}
              placeholder="e.g. Prestige Lakeside Habitat"
              placeholderTextColor={c.text4}
            />
          </View>

          {/* City */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>City</Text>
            <View style={styles.chipRow}>
              {CITIES.map(ct => (
                <Pressable
                  key={ct}
                  style={[styles.chip, { backgroundColor: city === ct ? c.accent : c.bgSubtle, borderColor: city === ct ? c.accent : c.border }]}
                  onPress={() => setCity(ct)}
                >
                  <Text style={[Typography.caption, { color: city === ct ? '#fff' : c.text3, fontSize: 11 }]}>{ct}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* BHK */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>BHK Type *</Text>
            <View style={styles.chipRow}>
              {BHK_OPTIONS.map(opt => (
                <Pressable
                  key={opt}
                  style={[styles.chip, { backgroundColor: bhkType === opt ? c.accent : c.bgSubtle, borderColor: bhkType === opt ? c.accent : c.border }]}
                  onPress={() => setBhkType(opt)}
                >
                  <Text style={[Typography.caption, { color: bhkType === opt ? '#fff' : c.text2 }]}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Rent */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Monthly Rent (₹) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={rentAmount}
              onChangeText={t => setRentAmount(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 25000"
              placeholderTextColor={c.text4}
              keyboardType="numeric"
            />
          </View>

          {/* Deposit outcome */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Deposit Outcome (optional)</Text>
            <View style={styles.chipRow}>
              {DEPOSIT_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.depositChip, {
                    backgroundColor: depositOutcome === opt.value ? opt.color + '20' : c.bgSubtle,
                    borderColor: depositOutcome === opt.value ? opt.color : c.border,
                  }]}
                  onPress={() => setDepositOutcome(depositOutcome === opt.value ? null : opt.value)}
                >
                  <Text style={[Typography.caption, { color: depositOutcome === opt.value ? opt.color : c.text3, fontSize: 11 }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit */}
      <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bgPage }]}>
        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit ? c.accent : c.bgSubtle }]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[Typography.subtitle, { color: canSubmit ? '#fff' : c.text4 }]}>Submit</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  form: { padding: Spacing.base, paddingBottom: 100 },
  field: { marginBottom: Spacing.lg },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  depositChip: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.base,
    borderTopWidth: 1,
  },
  submitBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.base,
  },
  doneBtn: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    marginTop: Spacing.base,
  },
})
