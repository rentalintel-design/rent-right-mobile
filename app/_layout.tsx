import 'react-native-url-polyfill/auto'
import { useEffect } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import 'react-native-reanimated'
import { supabase } from '@/lib/supabase'

// Required for iOS OAuth redirect to complete properly
WebBrowser.maybeCompleteAuthSession()

import { AuthProvider, useAuth } from '@/context/AuthContext'
import { usePushToken } from '@/hooks/usePushToken'

SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { session, profile, loading, user } = useAuth()
  const segments = useSegments()

  usePushToken(user?.id)

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync()
  }, [loading])

  // Auth guard
  useEffect(() => {
    if (loading) return

    const inAuth = segments[0] === '(auth)'

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login')
    } else if (!profile?.role) {
      router.replace('/(auth)/onboarding')
    } else {
      if (inAuth) router.replace('/(tabs)')
    }
  }, [session, profile, loading, segments])

  // Deep link handler
  useEffect(() => {
    async function handleDeepLink(event: { url: string }) {
      const url = event.url
      try {
        // Handle OAuth callback (code exchange for session)
        if (url.includes('code=')) {
          const codeMatch = url.match(/[?&]code=([^&]+)/)
          if (codeMatch) {
            await supabase.auth.exchangeCodeForSession(codeMatch[1])
            return
          }
        }

        const parsed = new URL(url)
        const path = parsed.pathname

        const vacancyMatch = path.match(/^\/vacancy\/([a-zA-Z0-9-]+)$/)
        if (vacancyMatch) { router.push(`/vacancy/${vacancyMatch[1]}`); return }

        const vaultMatch = path.match(/^\/vault\/review\/([a-zA-Z0-9]+)$/)
        if (vaultMatch) { router.push(`/vault/review/${vaultMatch[1]}`); return }
      } catch { /* invalid URL */ }
    }

    const sub = Linking.addEventListener('url', handleDeepLink)
    Linking.getInitialURL().then(url => { if (url) handleDeepLink({ url }) })
    return () => sub.remove()
  }, [session])

  if (loading) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="vacancy/[id]" />
      <Stack.Screen name="vacancy/create" />
      <Stack.Screen name="vault/create" />
      <Stack.Screen name="vault/[id]" />
      <Stack.Screen name="vault/review/[token]" />
      <Stack.Screen name="contribution/submit" />
      <Stack.Screen name="chat/inbox" />
      <Stack.Screen name="chat/[conversationId]" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  )
}
