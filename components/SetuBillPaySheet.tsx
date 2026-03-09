import React from 'react'
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator } from 'react-native'
import { WebView, WebViewNavigation } from 'react-native-webview'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'

type Props = {
  visible: boolean
  paymentLink: string | null
  providerName?: string
  amount?: number
  onClose: () => void
  onSuccess: () => void
}

/**
 * Modal WebView that loads a Setu BillPay pre-built screen link.
 * Setu handles the BBPS-compliant UI, biller selection, and payment.
 * On completion, Setu redirects or sends an 'unload' message.
 */
export default function SetuBillPaySheet({ visible, paymentLink, providerName, amount, onClose, onSuccess }: Props) {
  const c = useColors()

  const handleNavigationChange = (navState: WebViewNavigation) => {
    // Detect completion redirects (Setu redirects to /transactions or similar)
    const url = navState.url ?? ''
    if (url.includes('/transactions') || url.includes('payment-complete') || url.includes('success')) {
      onSuccess()
    }
  }

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'unload' || msg.action === 'unload') {
        onSuccess()
      }
    } catch {
      // Setu may also send plain string 'unload'
      if (event.nativeEvent.data === 'unload') {
        onSuccess()
      }
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[st.container, { backgroundColor: c.bgPage }]}>
        {/* Header */}
        <View style={[st.header, { backgroundColor: c.bgSurface, borderBottomColor: c.border }]}>
          <Pressable onPress={onClose} style={st.backBtn}>
            <Text style={[Typography.subtitle, { color: c.text3 }]}>← Close</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[Typography.subtitle, { color: c.text1 }]}>
              Pay {providerName ?? 'Bill'}
            </Text>
            {amount != null && (
              <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>
                ₹{amount.toLocaleString('en-IN')}
              </Text>
            )}
          </View>
          <View style={{ width: 60 }} />
        </View>

        {/* WebView */}
        {paymentLink ? (
          <WebView
            source={{ uri: paymentLink }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={st.loading}>
                <ActivityIndicator color={c.accent} size="large" />
                <Text style={[Typography.caption, { color: c.text3, marginTop: Spacing.md }]}>
                  Loading payment...
                </Text>
              </View>
            )}
            originWhitelist={['*']}
            onNavigationStateChange={handleNavigationChange}
            onMessage={handleMessage}
            // Allow UPI app launches
            onShouldStartLoadWithRequest={(request) => {
              const url = request.url
              // Allow UPI deep links to open native apps
              if (url.startsWith('upi://') || url.startsWith('phonepe://') || url.startsWith('gpay://') || url.startsWith('paytm://')) {
                return true
              }
              return true
            }}
          />
        ) : (
          <View style={st.loading}>
            <ActivityIndicator color={c.accent} size="large" />
          </View>
        )}
      </View>
    </Modal>
  )
}

const st = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    paddingTop: 50, // safe area
  },
  backBtn: {
    width: 60,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
