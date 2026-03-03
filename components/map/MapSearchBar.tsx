import React, { useState, useRef, useCallback } from 'react'
import { View, TextInput, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { geocodeSearch } from 'rent-right-shared'
import type { GeoResult } from 'rent-right-shared'
import { useColors } from '@/hooks/use-theme-color'
import { Spacing, Radius, Typography } from '@/constants/theme'

type Props = {
  cityBounds: { latMin: number; latMax: number; lngMin: number; lngMax: number } | null
  onSelectResult: (lat: number, lng: number) => void
}

export default function MapSearchBar({ cityBounds, onSelectResult }: Props) {
  const c = useColors()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((text: string) => {
    setQuery(text)
    if (timer.current) clearTimeout(timer.current)
    if (text.length < 2) { setResults([]); return }

    timer.current = setTimeout(async () => {
      setLoading(true)
      const bounds = cityBounds
      const res = await geocodeSearch(text, bounds)
      setResults(res)
      setLoading(false)
    }, 350)
  }, [cityBounds])

  const selectResult = (r: GeoResult) => {
    setQuery(r.label)
    setResults([])
    onSelectResult(r.lat, r.lng)
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputContainer, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.input, { color: c.text1 }]}
          placeholder="Search locality..."
          placeholderTextColor={c.text4}
          value={query}
          onChangeText={search}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]) }}>
            <Text style={[styles.clear, { color: c.text4 }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {results.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <FlatList
            data={results}
            keyExtractor={r => String(r.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => selectResult(item)}>
                <Text style={[Typography.body, { color: c.text1 }]} numberOfLines={1}>{item.label}</Text>
                {item.sublabel && (
                  <Text style={[Typography.caption, { color: c.text4 }]} numberOfLines={1}>{item.sublabel}</Text>
                )}
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 10 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: { fontSize: 14, marginRight: Spacing.sm },
  input: { flex: 1, ...Typography.body },
  clear: { fontSize: 16, paddingLeft: Spacing.sm },
  dropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: Radius.md,
    maxHeight: 200,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
})
