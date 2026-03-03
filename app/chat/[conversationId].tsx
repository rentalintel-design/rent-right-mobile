import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

type ConversationMeta = {
  id: string
  tenant_id: string
  landlord_id: string
  vacancy: { bhk_type: string; asking_rent: number; city: string } | null
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
  const c = useColors()
  const { user } = useAuth()
  const flatListRef = useRef<FlatList>(null)

  const [meta, setMeta] = useState<ConversationMeta | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  // Fetch conversation meta
  useEffect(() => {
    if (!conversationId) return
    supabase
      .from('conversations')
      .select('id, tenant_id, landlord_id, vacancy:vacancy_id(bhk_type, asking_rent, city)')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => { if (data) setMeta(data as ConversationMeta) })
  }, [conversationId])

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data as Message[])
    setLoading(false)
  }, [conversationId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // Supabase Realtime subscription for new messages
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new as Message]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !user?.id || !conversationId || sending) return
    setSending(true)
    setInput('')
    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, content: text })
      .select('*')
      .single()
    if (data) {
      // Realtime will handle append; also update conversation preview
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 60) })
        .eq('id', conversationId)
    }
    setSending(false)
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  const isMe = (senderId: string) => senderId === user?.id

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const me = isMe(item.sender_id)
    const prevMsg = index > 0 ? messages[index - 1] : null
    const showDate = !prevMsg || formatDate(item.created_at) !== formatDate(prevMsg.created_at)

    return (
      <>
        {showDate && (
          <View style={styles.dateSep}>
            <Text style={[Typography.caption, { color: c.text4, fontSize: 11 }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        )}
        <View style={[styles.bubbleRow, me ? styles.bubbleRight : styles.bubbleLeft]}>
          <View style={[
            styles.bubble,
            me
              ? { backgroundColor: c.accent }
              : { backgroundColor: c.bgSurface, borderColor: c.border, borderWidth: 1 },
          ]}>
            <Text style={[Typography.body, { color: me ? '#fff' : c.text1 }]}>{item.content}</Text>
            <Text style={[Typography.caption, { color: me ? 'rgba(255,255,255,0.6)' : c.text4, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 }]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </>
    )
  }

  const title = meta?.vacancy
    ? `${meta.vacancy.bhk_type} · ${meta.vacancy.city}`
    : 'Chat'

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Back</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={[Typography.subtitle, { color: c.text1 }]} numberOfLines={1}>{title}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.accent} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={[Typography.caption, { color: c.text4, textAlign: 'center' }]}>
                  No messages yet.{'\n'}Say hello!
                </Text>
              </View>
            }
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: c.bgPage, borderTopColor: c.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message…"
            placeholderTextColor={c.text4}
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: input.trim() ? c.accent : c.bgSubtle }]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: input.trim() ? '#fff' : c.text4, fontSize: 18 }}>↑</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  listContent: { padding: Spacing.base, paddingBottom: Spacing.sm, flexGrow: 1 },
  dateSep: { alignItems: 'center', marginVertical: Spacing.sm },
  bubbleRow: { marginBottom: Spacing.xs },
  bubbleLeft: { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
