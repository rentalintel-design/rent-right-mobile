import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Spacing, Typography, Radius } from '@/constants/theme'

type Step = 'role' | 'city'

const ROLES = [
  { value: 'tenant' as const, label: 'Tenant', icon: '🔍', desc: 'Find rentals, check rents & deposits' },
  { value: 'landlord' as const, label: 'Landlord', icon: '🏠', desc: 'List your property for tenants' },
]

const CITIES = [
  { value: 'Bengaluru', icon: '🏙️' },
  { value: 'Pune', icon: '🌆' },
  { value: 'Hyderabad', icon: '🕌' },
  { value: 'Gurugram', icon: '🏢' },
  { value: 'Chennai', icon: '🛕' },
  { value: 'Mumbai', icon: '🌊' },
]

export default function OnboardingScreen() {
  const c = useColors()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState<Step>('role')
  const [role, setRole] = useState<'tenant' | 'landlord' | null>(null)
  const [loading, setLoading] = useState(false)

  const selectCity = async (city: string) => {
    if (!user || !role) return
    setLoading(true)
    await supabase
      .from('profiles')
      .update({ role, city })
      .eq('user_id', user.id)
    await refreshProfile()
    setLoading(false)
    // AuthContext refresh triggers navigation via root layout
  }

  const s = styles(c)

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {step === 'role' ? (
          <>
            <Text style={s.heading}>I am a...</Text>
            <Text style={s.subtext}>You can switch roles anytime later</Text>
            <View style={s.cardList}>
              {ROLES.map(r => (
                <Pressable
                  key={r.value}
                  style={[s.card, role === r.value && s.cardActive]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={s.cardIcon}>{r.icon}</Text>
                  <Text style={s.cardLabel}>{r.label}</Text>
                  <Text style={s.cardDesc}>{r.desc}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[s.btn, !role && s.btnDisabled]}
              onPress={() => role && setStep('city')}
              disabled={!role}
            >
              <Text style={s.btnText}>Continue</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => setStep('role')}>
              <Text style={s.back}>← Back</Text>
            </Pressable>
            <Text style={s.heading}>Select your city</Text>
            <Text style={s.subtext}>We'll show data for this city</Text>
            <View style={s.cityGrid}>
              {CITIES.map(city => (
                <Pressable
                  key={city.value}
                  style={s.cityCard}
                  onPress={() => selectCity(city.value)}
                >
                  <Text style={s.cityIcon}>{city.icon}</Text>
                  <Text style={s.cityLabel}>{city.value}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bgPage },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing['3xl'] },
    heading: { ...Typography.display, color: c.text1, marginBottom: Spacing.xs },
    subtext: { ...Typography.body, color: c.text4, marginBottom: Spacing['2xl'] },
    back: { ...Typography.body, color: c.text3, marginBottom: Spacing.lg },

    cardList: { gap: Spacing.base, marginBottom: Spacing['2xl'] },
    card: {
      backgroundColor: c.bgSurface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      borderWidth: 2,
      borderColor: c.border,
    },
    cardActive: { borderColor: c.accent },
    cardIcon: { fontSize: 28, marginBottom: Spacing.sm },
    cardLabel: { ...Typography.title, color: c.text1, marginBottom: Spacing.xs },
    cardDesc: { ...Typography.body, color: c.text3 },

    btn: {
      backgroundColor: c.accent,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.base,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    btnText: { ...Typography.subtitle, color: '#fff' },

    cityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    cityCard: {
      width: '47%',
      backgroundColor: c.bgSurface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: c.border,
    },
    cityIcon: { fontSize: 32, marginBottom: Spacing.sm },
    cityLabel: { ...Typography.subtitle, color: c.text1 },
  })
