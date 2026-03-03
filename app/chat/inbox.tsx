import React, { useCallback, useState } from 'react'
import {
  View, Text, FlatList, Pressable,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { formatRent } from '@/lib/vacancyUtils'

type ConversationRow = {
  id: string
  tenant_id: string
  landlord_id: string
  tenant_name: string | null
  tenant_phone: string | null
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string
  vacancy: { bhk_type: string; asking_rent: number; city: string } | null
}

export default function InboxScreen() {
  const c = useColors()
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('conversations')
      .select('*, vacancy:vacancy_id(bhk_type, asking_rent, city)')
      .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
    if (data) setConversations(data as ConversationRow[])
    setLoading(false)
  }, [user?.id])

  useFocusEffect(useCallback(() => { fetchConversations() }, [fetchConversations]))

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const renderItem = ({ item }: { item: ConversationRow }) => {
    const isLandlord = item.landlord_id === user?.id
    const otherName = isLandlord ? (item.tenant_name ?? 'Tenant') : 'Landlord'
    const subtitle = item.vacancy
      ? `${item.vacancy.bhk_type} · ${formatRent(item.vacancy.asking_rent)}/mo · ${item.vacancy.city}`
      : ''

    return (
      <Pressable
        style={[styles.row, { backgroundColor: c.bgSurface, borderColor: c.border }]}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={[styles.avatar, { backgroundColor: c.bgSubtle }]}>
          <Text style={{ fontSize: 18 }}>{isLandlord ? '👤' : '🏠'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={[Typography.subtitle, { color: c.text1, flex: 1 }]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={[Typography.caption, { color: c.text4, fontSize: 11 }]}>
              {formatTime(item.last_message_at)}
            </Text>
          </View>
          {subtitle ? (
            <Text style={[Typography.caption, { color: c.accent, fontSize: 11 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {item.last_message_preview ? (
            <Text style={[Typography.caption, { color: c.text3 }]} numberOfLines={1}>
              {item.last_message_preview}
            </Text>
          ) : (
            <Text style={[Typography.caption, { color: c.text4, fontStyle: 'italic' }]}>
              No messages yet
            </Text>
          )}
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <Text style={[Typography.subtitle, { color: c.text1, marginLeft: Spacing.md }]}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
                No conversations yet.{'\n'}Contact a landlord to start chatting.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  list: { padding: Spacing.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
