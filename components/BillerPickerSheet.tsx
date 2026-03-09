import React, { useState, useMemo, useEffect } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet,
  TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'

const WEB_BASE = 'https://rent-right-seven.vercel.app'

export type Biller = {
  id: string
  name: string
  category: string
  state?: string
}

const CATEGORY_ICONS: Record<string, string> = {
  electricity: '⚡',
  water: '💧',
  gas: '🔥',
  internet: '📶',
}

type Props = {
  visible: boolean
  initialCategory?: string
  onSelect: (biller: Biller) => void
  onClose: () => void
}

export default function BillerPickerSheet({ visible, initialCategory, onSelect, onClose }: Props) {
  const c = useColors()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory ?? 'electricity')
  const [billers, setBillers] = useState<Biller[]>([])
  const [loading, setLoading] = useState(false)

  const categories = ['electricity', 'water', 'gas', 'internet'] as const

  // Fetch billers from Setu (via web API) when category changes or sheet opens
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    setBillers([])
    fetch(`${WEB_BASE}/api/billpay/billers?category=${activeCategory}`)
      .then(r => r.json())
      .then((data: { billers?: Biller[] }) => {
        if (!cancelled) setBillers(data.billers ?? [])
      })
      .catch(() => { if (!cancelled) setBillers([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [visible, activeCategory])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return billers
    return billers.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.state?.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q)
    )
  }, [query, billers])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={st.kvContainer}
      >
        <View style={[st.sheet, { backgroundColor: c.bgSurface }]}>
          {/* Handle */}
          <View style={[st.handle, { backgroundColor: c.border }]} />

          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.md }]}>
            Select Utility Provider
          </Text>

          {/* Search input */}
          <View style={[st.searchRow, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
            <Text style={{ fontSize: 16, marginRight: Spacing.sm }}>🔍</Text>
            <TextInput
              style={[st.searchInput, { color: c.text1 }]}
              placeholder="Search provider or city..."
              placeholderTextColor={c.text4}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Text style={[Typography.caption, { color: c.text4 }]}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Category tabs */}
          {!query && (
            <View style={st.tabs}>
              {categories.map(cat => (
                <Pressable
                  key={cat}
                  style={[
                    st.tab,
                    { backgroundColor: activeCategory === cat ? c.accent : c.bgSubtle },
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={{ fontSize: 12 }}>{CATEGORY_ICONS[cat]}</Text>
                  <Text style={[
                    { fontSize: 11, fontWeight: '600', marginLeft: 4 },
                    { color: activeCategory === cat ? '#fff' : c.text3 },
                  ]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Loading */}
          {loading ? (
            <View style={st.loadingBox}>
              <ActivityIndicator color={c.accent} />
              <Text style={[Typography.caption, { color: c.text4, marginTop: Spacing.sm }]}>
                Loading providers…
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={b => b.id}
              style={{ maxHeight: 340 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[st.billerRow, { borderBottomColor: c.border }]}
                  onPress={() => { onSelect(item); setQuery('') }}
                >
                  <Text style={{ fontSize: 18, marginRight: Spacing.md }}>
                    {CATEGORY_ICONS[item.category] ?? '🔌'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.caption, { color: c.text1, fontWeight: '600' }]}>
                      {item.name}
                    </Text>
                    {item.state && (
                      <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>
                        {item.state}
                      </Text>
                    )}
                  </View>
                  <Text style={[Typography.caption, { color: c.text4 }]}>›</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={st.empty}>
                  <Text style={[Typography.caption, { color: c.text4, textAlign: 'center' }]}>
                    {query ? `No providers found for "${query}"` : 'No providers in this category'}
                  </Text>
                </View>
              }
            />
          )}

          <Pressable style={[st.cancelBtn, { borderColor: c.border }]} onPress={onClose}>
            <Text style={[Typography.caption, { color: c.text3 }]}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kvContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.base,
    paddingTop: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  billerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  empty: {
    paddingVertical: Spacing.xl,
  },
  cancelBtn: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
})
