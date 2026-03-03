import React, { useState, useRef, useCallback } from 'react'
import { View, TextInput, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useColors } from '@/hooks/use-theme-color'
import { Spacing, Radius, Typography } from '@/constants/theme'

const GOOGLE_API_KEY = 'AIzaSyBz-4Hjy23o_LFJ6214sTWE7WgoBI7F5MM'

type PlaceResult = {
  placeId: string
  mainText: string
  secondaryText: string
}

type Props = {
  cityBounds: { latMin: number; latMax: number; lngMin: number; lngMax: number } | null
  onSelectResult: (lat: number, lng: number) => void
}

export default function MapSearchBar({ cityBounds, onSelectResult }: Props) {
  const c = useColors()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((text: string) => {
    setQuery(text)
    if (timer.current) clearTimeout(timer.current)
    if (text.length < 2) { setResults([]); return }

    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        let locationBias = ''
        if (cityBounds) {
          const lat = (cityBounds.latMin + cityBounds.latMax) / 2
          const lng = (cityBounds.lngMin + cityBounds.lngMax) / 2
          locationBias = `&location=${lat},${lng}&radius=30000`
        }
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_API_KEY}&components=country:in&types=geocode|establishment${locationBias}`
        const res = await fetch(url)
        const json = await res.json()
        if (json.predictions) {
          setResults(json.predictions.map((p: any) => ({
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? '',
          })))
        }
      } catch (e) {
        console.warn('[places search]', e)
      }
      setLoading(false)
    }, 350)
  }, [cityBounds])

  const selectResult = useCallback(async (place: PlaceResult) => {
    setQuery(place.mainText)
    setResults([])
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.placeId}&fields=geometry&key=${GOOGLE_API_KEY}`
      const res = await fetch(url)
      const json = await res.json()
      const loc = json.result?.geometry?.location
      if (loc) onSelectResult(loc.lat, loc.lng)
    } catch (e) {
      console.warn('[place details]', e)
    }
  }, [onSelectResult])

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputContainer, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.input, { color: c.text1 }]}
          placeholder="Search locality or address..."
          placeholderTextColor={c.text4}
          value={query}
          onChangeText={search}
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={c.accent} style={{ marginRight: 4 }} />}
        {query.length > 0 && !loading && (
          <Pressable onPress={() => { setQuery(''); setResults([]) }}>
            <Text style={[styles.clear, { color: c.text4 }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {results.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
          <FlatList
            data={results}
            keyExtractor={r => r.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[styles.resultRow, { borderBottomColor: c.border }]}
                onPress={() => selectResult(item)}
              >
                <Text style={[Typography.body, { color: c.text1 }]} numberOfLines={1}>{item.mainText}</Text>
                {item.secondaryText ? (
                  <Text style={[Typography.caption, { color: c.text4 }]} numberOfLines={1}>{item.secondaryText}</Text>
                ) : null}
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
    maxHeight: 220,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  resultRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
