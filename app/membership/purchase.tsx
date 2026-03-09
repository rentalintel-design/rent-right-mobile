import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { WebView } from 'react-native-webview'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useMembership } from '@/hooks/useMembership'
import { Typography, Spacing, Radius } from '@/constants/theme'
import {
  PLAN_PRICES, PLAN_FEATURES, PLAN_CITIES, CITY_LABELS,
  type PlanRole,
} from 'rent-right-shared'

const WEB_BASE = 'https://rent-right-seven.vercel.app'

export default function PurchaseScreen() {
  const c = useColors()
  const { user } = useAuth()
  const membership = useMembership(user?.id)
  const params = useLocalSearchParams<{ role?: string; city?: string }>()

  const [selectedRole, setSelectedRole] = useState<PlanRole>((params.role as PlanRole) ?? 'tenant')
  const [selectedCity, setSelectedCity] = useState(params.city ?? '')
  const [loading, setLoading] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  const plan = PLAN_PRICES[selectedRole]
  const features = PLAN_FEATURES[selectedRole]

  const startPayment = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        Alert.alert('Error', 'Please sign in again')
        setLoading(false)
        return
      }

      // Create Razorpay order via web API
      const res = await fetch(`${WEB_BASE}/api/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: selectedRole, userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.orderId) {
        Alert.alert('Error', data.error ?? 'Failed to create order')
        setLoading(false)
        return
      }

      // Build Razorpay checkout HTML
      const html = buildCheckoutHtml({
        keyId: data.keyId,
        orderId: data.orderId,
        amount: data.amount,
        currency: data.currency,
        role: selectedRole,
        city: selectedCity,
        userId: user.id,
        token: session.access_token,
        phone: session.user?.phone ?? '',
      })
      setCheckoutUrl(html)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Payment failed')
    } finally {
      setLoading(false)
    }
  }, [user?.id, selectedRole, selectedCity])

  const handleWebViewMessage = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'payment_success') {
        // Verify payment via web API
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${WEB_BASE}/api/razorpay/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            razorpay_order_id: msg.razorpay_order_id,
            razorpay_payment_id: msg.razorpay_payment_id,
            razorpay_signature: msg.razorpay_signature,
            userId: user?.id,
            role: selectedRole,
            city: selectedCity || null,
          }),
        })
        if (res.ok) {
          await membership.refresh()
          setCheckoutUrl(null)
          Alert.alert('Payment Successful!', 'Your plan is now active.', [
            { text: 'OK', onPress: () => router.back() },
          ])
        } else {
          Alert.alert('Verification Failed', 'Payment was received but verification failed. Contact support.')
          setCheckoutUrl(null)
        }
      } else if (msg.type === 'payment_error') {
        Alert.alert('Payment Failed', msg.description ?? 'Please try again.')
        setCheckoutUrl(null)
      } else if (msg.type === 'payment_dismissed') {
        setCheckoutUrl(null)
      }
    } catch {
      // Ignore non-JSON messages
    }
  }, [user?.id, selectedRole, selectedCity, membership])

  // ── Razorpay WebView ──
  if (checkoutUrl) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
        <View style={[st.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={() => setCheckoutUrl(null)}>
            <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
          </Pressable>
          <Text style={[Typography.subtitle, { color: c.text1 }]}>Payment</Text>
          <View style={{ width: 60 }} />
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html: checkoutUrl }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          style={{ flex: 1, backgroundColor: c.bgPage }}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      <View style={[st.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <Text style={[Typography.subtitle, { color: c.text1 }]}>Buy a Plan</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        {/* Plan selector */}
        <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Select Plan</Text>
        <View style={st.planRow}>
          {(['tenant', 'landlord'] as PlanRole[]).map(role => {
            const active = selectedRole === role
            const p = PLAN_PRICES[role]
            return (
              <Pressable key={role}
                style={[st.planOption, { backgroundColor: active ? c.accent : c.bgSurface, borderColor: active ? c.accent : c.border }]}
                onPress={() => setSelectedRole(role)}>
                <Text style={[Typography.subtitle, { color: active ? '#fff' : c.text1, textTransform: 'capitalize' }]}>{role}</Text>
                <Text style={[Typography.caption, { color: active ? 'rgba(255,255,255,0.7)' : c.accent, fontWeight: '700' }]}>{p.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Features */}
        <View style={[st.featureCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm, textTransform: 'capitalize' }]}>
            {selectedRole} Plan — {plan.label}
          </Text>
          {features.map(f => (
            <Text key={f} style={[Typography.caption, { color: c.text3, marginBottom: 3 }]}>{f}</Text>
          ))}
        </View>

        {/* City selector */}
        <Text style={[Typography.caption, { color: c.text2, marginTop: Spacing.lg, marginBottom: Spacing.xs }]}>City (optional)</Text>
        <View style={st.cityGrid}>
          {PLAN_CITIES.map(ct => {
            const active = selectedCity === ct.name
            return (
              <Pressable key={ct.name}
                style={[st.cityChip, { backgroundColor: active ? c.accent : c.bgSubtle, borderColor: active ? c.accent : c.border }]}
                onPress={() => setSelectedCity(active ? '' : ct.name)}>
                <Text style={{ fontSize: 12 }}>{ct.emoji}</Text>
                <Text style={[Typography.caption, { color: active ? '#fff' : c.text3, fontSize: 10 }]}>{ct.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Buy button */}
        <Pressable
          style={[st.buyBtn, { backgroundColor: loading ? c.bgSubtle : c.accent }]}
          onPress={startPayment}
          disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={[Typography.subtitle, { color: '#fff' }]}>Pay {plan.label}</Text>
          }
        </Pressable>

        <Text style={[Typography.caption, { color: c.text4, textAlign: 'center', marginTop: Spacing.md }]}>
          Secured by Razorpay. Payments are encrypted and safe.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

// Build Razorpay checkout HTML to load in WebView
function buildCheckoutHtml({ keyId, orderId, amount, currency, role, city, userId, token, phone }: {
  keyId: string; orderId: string; amount: number; currency: string
  role: string; city: string; userId: string; token: string; phone: string
}) {
  return `
<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#0a1628;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif}
.msg{color:#b8ccdf;text-align:center;padding:20px}</style>
</head><body>
<div class="msg">Loading payment gateway...</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var options = {
  key: '${keyId}',
  amount: ${amount},
  currency: '${currency}',
  name: 'Rent Right',
  description: '${role.charAt(0).toUpperCase() + role.slice(1)} Plan',
  order_id: '${orderId}',
  prefill: { contact: '${phone}' },
  theme: { color: '#2563eb' },
  handler: function(response) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'payment_success',
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    }));
  },
  modal: {
    ondismiss: function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_dismissed' }));
    }
  }
};
var rzp = new Razorpay(options);
rzp.on('payment.failed', function(response) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'payment_error',
    description: response.error.description,
  }));
});
rzp.open();
</script></body></html>
`
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
  body: { padding: Spacing.base, paddingBottom: 60 },
  planRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  planOption: {
    flex: 1, borderWidth: 1, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  featureCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  cityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1,
  },
  buyBtn: {
    borderRadius: Radius.lg, paddingVertical: Spacing.md,
    alignItems: 'center', marginTop: Spacing.xl,
  },
})
