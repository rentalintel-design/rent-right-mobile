import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const supabaseUrl = 'https://xzhxfobnaeyknvpzetsr.supabase.co'
const supabaseAnonKey = 'sb_publishable_0Gin_KlpnjE7dRI3AHXJcQ_lOfPIyUE'

/**
 * SecureStore adapter for Supabase auth token persistence.
 * Falls back to no-op on web (Supabase uses localStorage there).
 */
const SecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key)
      return null
    }
    return SecureStore.getItemAsync(key)
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
      return
    }
    return SecureStore.setItemAsync(key, value)
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
      return
    }
    return SecureStore.deleteItemAsync(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
