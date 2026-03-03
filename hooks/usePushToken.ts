import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export function usePushToken(userId?: string) {
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    if (!userId) return

    registerForPushNotifications(userId)

    // Handle notification tap → navigate
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      if (data?.type === 'vault' && data?.id) {
        router.push(`/vault/${data.id}`)
      } else if (data?.type === 'vacancy' && data?.id) {
        router.push(`/vacancy/${data.id}`)
      }
    })

    return () => {
      responseListener.current?.remove()
    }
  }, [userId])
}

async function registerForPushNotifications(userId: string) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') return

    // Android needs a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
      })
    }

    const tokenData = await Notifications.getExpoPushTokenAsync()
    const pushToken = tokenData.data

    // Save to profiles table
    await supabase
      .from('profiles')
      .update({ push_token: pushToken })
      .eq('user_id', userId)
  } catch (err) {
    console.error('[usePushToken] registration failed:', err)
  }
}
