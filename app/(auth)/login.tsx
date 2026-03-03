import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/hooks/use-theme-color'
import { Spacing, Typography, Radius } from '@/constants/theme'

type Step = 'phone' | 'otp'

export default function LoginScreen() {
  const c = useColors()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const e164 = () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
    if (digits.length === 10) return `+91${digits}`
    return null
  }

  const sendOtp = async () => {
    const formatted = e164()
    if (!formatted) {
      setError('Enter a valid 10-digit Indian mobile number')
      return
    }
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setStep('otp')
    setResendCooldown(30)
  }

  const verifyOtp = async () => {
    const formatted = e164()
    if (!formatted || otp.length !== 6) {
      setError('Enter the 6-digit OTP')
      return
    }
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    // Auth state change in AuthContext handles navigation
  }

  const s = styles(c)

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.logoRow}>
            <View style={s.logoBox}>
              <Text style={s.logoIcon}>{'⌂'}</Text>
            </View>
            <Text style={s.logoText}>Rent Right</Text>
          </View>
          <Text style={s.heroTitle}>
            Rental intelligence{'\n'}for Indian cities
          </Text>
          <Text style={s.heroSub}>
            Real rent data · Vacancy listings · Move-in protection
          </Text>
        </View>

        {/* Form */}
        <View style={s.card}>
          {step === 'phone' ? (
            <>
              <Text style={s.heading}>Sign in with your phone</Text>
              <Text style={s.subtext}>We'll send a one-time password via SMS</Text>

              <Text style={s.label}>MOBILE NUMBER</Text>
              <View style={s.phoneRow}>
                <View style={s.prefix}>
                  <Text style={s.prefixText}>+91</Text>
                </View>
                <TextInput
                  style={s.phoneInput}
                  placeholder="98765 43210"
                  placeholderTextColor={c.text4}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={t => {
                    setPhone(t.replace(/\D/g, ''))
                    setError(null)
                  }}
                  onSubmitEditing={sendOtp}
                />
              </View>

              {error && <Text style={s.error}>{error}</Text>}

              <Pressable
                style={[s.btn, (loading || phone.length < 10) && s.btnDisabled]}
                onPress={sendOtp}
                disabled={loading || phone.length < 10}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>Send OTP</Text>
                )}
              </Pressable>

              <Text style={s.terms}>
                By continuing you agree to our Terms of Service.
              </Text>
            </>
          ) : (
            <>
              <Pressable onPress={() => { setStep('phone'); setOtp(''); setError(null) }}>
                <Text style={s.back}>← Back</Text>
              </Pressable>

              <Text style={s.heading}>Enter the OTP</Text>
              <Text style={s.subtext}>Sent to +91 {phone}</Text>

              <Text style={s.label}>6-DIGIT OTP</Text>
              <TextInput
                style={s.otpInput}
                placeholder="• • • • • •"
                placeholderTextColor={c.text4}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={t => {
                  setOtp(t.replace(/\D/g, ''))
                  setError(null)
                }}
                onSubmitEditing={verifyOtp}
                autoFocus
              />

              {error && <Text style={s.error}>{error}</Text>}

              <Pressable
                style={[s.btn, (loading || otp.length !== 6) && s.btnDisabled]}
                onPress={verifyOtp}
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>Verify OTP</Text>
                )}
              </Pressable>

              <View style={s.resendRow}>
                {resendCooldown > 0 ? (
                  <Text style={s.subtext}>Resend in {resendCooldown}s</Text>
                ) : (
                  <Pressable onPress={sendOtp}>
                    <Text style={s.resendText}>Resend OTP</Text>
                  </Pressable>
                )}
              </View>

              <View style={s.devHint}>
                <Text style={s.devHintText}>
                  Dev mode: If SMS isn't configured, check Supabase Dashboard → Authentication → Logs for the OTP.
                </Text>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bgPage },
    flex: { flex: 1 },
    hero: { paddingHorizontal: Spacing.xl, paddingTop: Spacing['3xl'], paddingBottom: Spacing['2xl'] },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.base },
    logoBox: {
      width: 36,
      height: 36,
      borderRadius: 9,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
    logoText: { ...Typography.subtitle, color: c.text1, fontWeight: '800' },
    heroTitle: { ...Typography.display, color: c.text1, marginBottom: Spacing.sm },
    heroSub: { ...Typography.body, color: c.text4 },

    card: {
      flex: 1,
      backgroundColor: c.bgSurface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing['2xl'],
    },
    heading: { ...Typography.title, color: c.text1, marginBottom: Spacing.xs },
    subtext: { ...Typography.body, color: c.text4, marginBottom: Spacing.xl },
    label: { ...Typography.label, color: c.text3, marginBottom: Spacing.sm },

    phoneRow: {
      flexDirection: 'row',
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: Radius.md,
      overflow: 'hidden',
      marginBottom: Spacing.base,
    },
    prefix: {
      paddingHorizontal: Spacing.base,
      justifyContent: 'center',
      backgroundColor: c.bgSubtle,
      borderRightWidth: 2,
      borderRightColor: c.border,
    },
    prefixText: { ...Typography.body, color: c.text2, fontWeight: '600' },
    phoneInput: {
      flex: 1,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      ...Typography.body,
      color: c.text1,
      letterSpacing: 1,
    },

    otpInput: {
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      ...Typography.display,
      color: c.text1,
      textAlign: 'center',
      letterSpacing: 8,
      backgroundColor: c.bgSubtle,
      marginBottom: Spacing.base,
    },

    error: { ...Typography.body, color: c.red, marginBottom: Spacing.md },

    btn: {
      backgroundColor: c.accent,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.base,
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    btnDisabled: { opacity: 0.4 },
    btnText: { ...Typography.subtitle, color: '#fff' },

    terms: { ...Typography.caption, color: c.text4, textAlign: 'center' },
    back: { ...Typography.body, color: c.text3, marginBottom: Spacing.lg },

    resendRow: { alignItems: 'center', marginBottom: Spacing.lg },
    resendText: { ...Typography.body, color: c.accent, fontWeight: '600' },

    devHint: {
      backgroundColor: '#22c55e15',
      borderRadius: Radius.sm,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: '#22c55e40',
    },
    devHintText: { ...Typography.caption, color: c.green, lineHeight: 18 },
  })
