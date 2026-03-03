import AsyncStorage from '@react-native-async-storage/async-storage'

type CacheEntry<T> = {
  data: T
  timestamp: number
}

export async function getCached<T>(key: string, ttlMs: number): Promise<{ data: T; stale: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    const age = Date.now() - entry.timestamp
    return { data: entry.data, stale: age > ttlMs }
  } catch {
    return null
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(entry))
  } catch {
    // silently fail
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`cache:${key}`)
  } catch {
    // silently fail
  }
}
