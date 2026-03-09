import React, { useState, useCallback } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useMembership } from '@/hooks/useMembership'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { PLAN_PRICES, PLAN_FEATURES, type PlanRole } from 'rent-right-shared'

const WEB_BASE = 'https://rent-right-seven.vercel.app'

type Props = {
  visible: boolean
  feature: string          // e.g. "landlord contact details"
  role: PlanRole
  city?: string
  onClose: () => void
  onSuccess: () => void
}

export default function PaywallSheet({ visible, feature, role, city, onClose, onSuccess }: Props) {
  const c = useColors()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutHtml, setCheckoutHtml] = useState<string | null>(null)

  const plan = PLAN_PRICES[role]
  const features = PLAN_FEATURES[role]

  const handlePay = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Please sign in again')
        setLoading(false)
        return
      }

      const res = await fetch(`${WEB_BASE}/api/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role, userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.orderId) {
        setError(data.error ?? 'Failed to create order')
        setLoading(false)
        return
      }

      setCheckoutHtml(buildCheckoutHtml({
        keyId: data.keyId,
        orderId: data.orderId,
        amount: data.amount,
        currency: data.currency,
        role,
        userId: user.id,
        token: session.access_token,
        phone: session.user?.phone ?? '',
      }))
    } catch (e: any) {
      setError(e?.message ?? 'Payment failed')
      setLoading(false)
    }
  }, [user?.id, role])

  const handleWebViewMessage = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'payment_success') {
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
            role,
            city: city ?? null,
          }),
        })
        setCheckoutHtml(null)
        setLoading(false)
        if (res.ok) {
          onSuccess()
        } else {
          setError('Payment recorded but verification failed. Contact support.')
        }
      } else if (msg.type === 'payment_error') {
        setCheckoutHtml(null)
        setLoading(false)
        setError(msg.description ?? 'Payment failed. Please try again.')
      } else if (msg.type === 'payment_dismissed') {
        setCheckoutHtml(null)
        setLoading(false)
      }
    } catch {
      // ignore non-JSON
    }
  }, [user?.id, role, city, onSuccess])

  const handleClose = () => {
    if (loading && !checkoutHtml) return
    setCheckoutHtml(null)
    setLoading(false)
    setError(null)
    onClose()
  }

  const accentColor = role === 'tenant' ? '#22c55e' : '#2563eb'
  const accentBg = role === 'tenant' ? 'rgba(34,197,94,0.15)' : 'rgba(37,99,235,0.15)'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* Backdrop */}
      <Pressable style={st.backdrop} onPress={handleClose} />

      {/* Sheet */}
      <View style={[st.sheet, { backgroundColor: c.bgSurface }]}>
        {/* Handle bar */}
        <View style={[st.handle, { backgroundColor: c.border }]} />

        {checkoutHtml ? (
          /* ── Razorpay WebView ── */
          <View style={{ flex: 1, minHeight: 400 }}>
            <View style={st.webviewHeader}>
              <Pressable onPress={handleClose}>
                <Text style={[Typography.caption, { color: c.text3 }]}>← Back</Text>
              </Pressable>
              <Text style={[Typography.subtitle, { color: c.text1 }]}>Payment</Text>
              <View style={{ width: 40 }} />
            </View>
            <WebView
              originWhitelist={['*']}
              source={{ html: checkoutHtml }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled
              style={{ flex: 1, backgroundColor: c.bgPage }}
            />
          </View>
        ) : (
          /* ── Paywall content ── */
          <>
            {/* Lock icon */}
            <View style={[st.lockIcon, { backgroundColor: accentBg }]}>
              <Text style={{ fontSize: 26 }}>🔒</Text>
            </View>

            <Text style={[st.title, { color: c.text1 }]}>Members only</Text>
            <Text style={[st.subtitle, { color: c.text3 }]}>
              {feature} requires a membership
            </Text>

            {city ? (
              <Text style={[st.cityNote, { color: c.accent }]}>
                🏙️ Plan for {city.charAt(0).toUpperCase() + city.slice(1)}
              </Text>
            ) : <View style={{ height: Spacing.md }} />}

            {/* Features */}
            <View style={[st.featureBox, { backgroundColor: c.bgSubtle }]}>
              {features.map((item, i) => (
                <View key={i} style={[
                  st.featureRow,
                  i < features.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 10, marginBottom: 10 },
                ]}>
                  <Text style={[Typography.caption, { color: c.text2 }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Vault note */}
            <View style={[st.vaultNote, { borderColor: 'rgba(234,179,8,0.25)' }]}>
              <Text style={[Typography.caption, { color: '#eab308', fontSize: 11 }]}>
                🗝️ <Text style={{ fontWeight: '700' }}>Vault access included for 27 months</Text> — document your move-in & protect your deposit
              </Text>
            </View>

            {error && (
              <Text style={[Typography.caption, { color: '#ef4444', textAlign: 'center', marginBottom: Spacing.sm }]}>
                {error}
              </Text>
            )}

            {/* CTA */}
            <Pressable
              style={[st.cta, { backgroundColor: loading ? `${accentColor}80` : accentColor }]}
              onPress={handlePay}
              disabled={loading}
            >
              {loading ? (
                <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[Typography.subtitle, { color: '#fff' }]}>Opening payment…</Text>
                </View>
              ) : (
                <Text style={[Typography.subtitle, { color: '#fff', fontWeight: '700' }]}>
                  Unlock for {plan.label} →
                </Text>
              )}
            </Pressable>

            <Pressable style={st.cancelBtn} onPress={handleClose} disabled={loading}>
              <Text style={[Typography.caption, { color: c.text4 }]}>Maybe later</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  )
}

function buildCheckoutHtml({ keyId, orderId, amount, currency, role, userId, token, phone }: {
  keyId: string; orderId: string; amount: number; currency: string
  role: string; userId: string; token: string; phone: string
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  webviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
  },
  lockIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  cityNote: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  featureBox: {
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  featureRow: {},
  vaultNote: {
    backgroundColor: 'rgba(234,179,8,0.1)',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  cta: {
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
})
