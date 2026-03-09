import React, { useRef } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet,
  ActivityIndicator, Linking, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView, WebViewNavigation } from 'react-native-webview'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing } from '@/constants/theme'

type Props = {
  visible: boolean
  paymentLink: string | null
  providerName?: string
  amount?: number
  onClose: () => void
  onSuccess: () => void
}

// Injected into the WebView so Setu's 'unload' postMessage is forwarded to RN
const INJECTED_JS = `
  (function() {
    var origPostMessage = window.postMessage;
    window.postMessage = function(msg) {
      if (typeof msg === 'string' && msg === 'unload') {
        window.ReactNativeWebView.postMessage('unload');
      } else {
        origPostMessage.apply(window, arguments);
      }
    };
    // Also listen for Setu's event-based dismiss
    window.addEventListener('message', function(e) {
      if (e.data === 'unload' || (e.data && e.data.type === 'unload')) {
        window.ReactNativeWebView.postMessage('unload');
      }
    });
  })();
  true;
`

// UPI and payment app deep link schemes
const UPI_SCHEMES = ['upi://', 'phonepe://', 'gpay://', 'paytm://', 'bhim://', 'amazonpay://']

export default function SetuBillPaySheet({ visible, paymentLink, providerName, amount, onClose, onSuccess }: Props) {
  const c = useColors()
  const webviewRef = useRef<WebView>(null)

  const handleNavigationChange = (navState: WebViewNavigation) => {
    const url = navState.url ?? ''
    if (url.includes('/transactions') || url.includes('payment-complete') || url.includes('success')) {
      onSuccess()
    }
  }

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    const data = event.nativeEvent.data
    try {
      const msg = JSON.parse(data)
      if (msg === 'unload' || msg.type === 'unload' || msg.action === 'unload') {
        onClose()
      }
    } catch {
      if (data === 'unload') onClose()
    }
  }

  const handleShouldStartLoad = (request: { url: string }) => {
    const url = request.url
    // Hand UPI deep links off to the OS so the native payment apps open
    if (UPI_SCHEMES.some(s => url.startsWith(s))) {
      Linking.openURL(url).catch(() => {})
      return false  // don't load in WebView
    }
    return true
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[st.container, { backgroundColor: c.bgPage }]} edges={['top']}>
        {/* Header */}
        <View style={[st.header, { backgroundColor: c.bgSurface, borderBottomColor: c.border }]}>
          <Pressable onPress={onClose} style={st.backBtn} hitSlop={12}>
            <Text style={[Typography.subtitle, { color: c.text3 }]}>✕</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[Typography.subtitle, { color: c.text1 }]}>
              {providerName ? `Pay ${providerName}` : 'Pay Bill'}
            </Text>
            {amount != null && (
              <Text style={[Typography.caption, { color: c.text3, fontSize: 11 }]}>
                ₹{amount.toLocaleString('en-IN')}
              </Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* WebView */}
        {paymentLink ? (
          <WebView
            ref={webviewRef}
            source={{ uri: paymentLink }}
            style={{ flex: 1 }}
            // JS & storage — required for Setu's React app to run
            javaScriptEnabled
            domStorageEnabled
            // Forward Setu's postMessage('unload') to React Native
            injectedJavaScript={INJECTED_JS}
            // Input / keyboard fixes
            keyboardDisplayRequiresUserAction={false}
            allowsInlineMediaPlayback
            // Android: allow mixed content (Setu loads scripts from CDN)
            mixedContentMode="always"
            // Show spinner while Setu's page loads
            startInLoadingState
            renderLoading={() => (
              <View style={st.loading}>
                <ActivityIndicator color={c.accent} size="large" />
                <Text style={[Typography.caption, { color: c.text3, marginTop: Spacing.md }]}>
                  Loading payment...
                </Text>
              </View>
            )}
            originWhitelist={['https://*', 'http://*', 'upi://*', 'phonepe://*', 'gpay://*', 'paytm://*', 'bhim://*']}
            onNavigationStateChange={handleNavigationChange}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            // Keep WebView alive when JS navigates (don't reload on back)
            setSupportMultipleWindows={false}
          />
        ) : (
          <View style={st.loading}>
            <ActivityIndicator color={c.accent} size="large" />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'center' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
