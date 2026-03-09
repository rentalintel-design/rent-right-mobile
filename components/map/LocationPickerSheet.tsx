import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, TextInput, Pressable, FlatList,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, PROVIDER_GOOGLE, Region, MapPressEvent } from 'react-native-maps'
import { supabase } from '@/lib/supabase'
import { CITY_BOUNDS, haversineKm } from 'rent-right-shared'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'

type Pin = { lat: number; lng: number }
type Society = { id: string; name: string; lat: number; lng: number }
type AreaResult = { name: string; lat: number; lng: number; level: number }
type SearchResult =
  | { kind: 'area'; name: string; lat: number; lng: number; level: number }
  | { kind: 'society'; id: string; name: string; lat: number; lng: number }

type Props = {
  visible: boolean
  city: string
  initialPin?: Pin | null
  onConfirm: (pin: Pin, societyName: string | null, societyId: string | null) => void
  onClose: () => void
}

export default function LocationPickerSheet({ visible, city, initialPin, onConfirm, onClose }: Props) {
  const c = useColors()
  const bounds = CITY_BOUNDS[city as keyof typeof CITY_BOUNDS]

  const centerLat = bounds ? (bounds.latMin + bounds.latMax) / 2 : 12.97
  const centerLng = bounds ? (bounds.lngMin + bounds.lngMax) / 2 : 77.59

  const [pin, setPin] = useState<Pin | null>(initialPin ?? null)
  const [societies, setSocieties] = useState<Society[]>([])
  const [areas, setAreas] = useState<AreaResult[]>([])
  const [detectedSociety, setDetectedSociety] = useState<Society | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [mapRef, setMapRef] = useState<MapView | null>(null)

  // Load societies + localities for this city
  useEffect(() => {
    if (!visible) return
    setLoading(true)
    setPin(initialPin ?? null)
    setDetectedSociety(null)
    setSearchQuery('')

    const loadData = async () => {
      const [socRes, areaRes] = await Promise.all([
        supabase
          .from('societies')
          .select('id, name, lat, lng')
          .gte('lat', bounds?.latMin ?? 0).lte('lat', bounds?.latMax ?? 90)
          .gte('lng', bounds?.lngMin ?? 0).lte('lng', bounds?.lngMax ?? 180),
        supabase
          .from('localities')
          .select('name, lat, lng, level')
          .eq('city', city),
      ])
      if (socRes.data) setSocieties(socRes.data as Society[])
      if (areaRes.data) setAreas(areaRes.data as AreaResult[])
      setLoading(false)
    }
    loadData()
  }, [visible, city])

  // Detect nearest society when pin changes
  useEffect(() => {
    if (!pin || societies.length === 0) { setDetectedSociety(null); return }
    let nearest: Society | null = null
    let minDist = Infinity
    for (const s of societies) {
      const d = haversineKm(pin.lat, pin.lng, s.lat, s.lng)
      if (d < minDist) { minDist = d; nearest = s }
    }
    setDetectedSociety(minDist < 0.5 ? nearest : null)
  }, [pin, societies])

  // Search results
  const searchResults = useMemo((): SearchResult[] => {
    const q = searchQuery.trim().toLowerCase()
    if (q.length < 2) return []
    const areaResults: SearchResult[] = areas
      .filter(a => a.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(a => ({ kind: 'area', name: a.name, lat: a.lat, lng: a.lng, level: a.level }))
    const socResults: SearchResult[] = societies
      .filter(s => s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(s => ({ kind: 'society', id: s.id, name: s.name, lat: s.lat, lng: s.lng }))
    return [...areaResults, ...socResults].slice(0, 8)
  }, [searchQuery, areas, societies])

  const handleMapPress = useCallback((e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate
    setPin({ lat: latitude, lng: longitude })
  }, [])

  const handleSearchSelect = useCallback((r: SearchResult) => {
    setPin({ lat: r.lat, lng: r.lng })
    if (r.kind === 'society') {
      setDetectedSociety({ id: r.id, name: r.name, lat: r.lat, lng: r.lng })
    }
    setSearchQuery('')
    mapRef?.animateToRegion({
      latitude: r.lat, longitude: r.lng,
      latitudeDelta: r.kind === 'society' ? 0.005 : 0.02,
      longitudeDelta: r.kind === 'society' ? 0.005 : 0.02,
    }, 500)
  }, [mapRef])

  const handleConfirm = useCallback(() => {
    if (!pin) return
    onConfirm(pin, detectedSociety?.name ?? null, detectedSociety?.id ?? null)
  }, [pin, detectedSociety, onConfirm])

  const initialRegion: Region = {
    latitude: initialPin?.lat ?? centerLat,
    longitude: initialPin?.lng ?? centerLng,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={onClose}>
            <Text style={[Typography.subtitle, { color: c.text2 }]}>← Cancel</Text>
          </Pressable>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.subtitle, { color: c.text1 }]}>Pin property location</Text>
            <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>
              {pin
                ? (detectedSociety ? `📍 ${detectedSociety.name}` : `📍 ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`)
                : 'Tap on the map or search'}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={[s.searchContainer, { backgroundColor: c.bgPage }]}>
          <TextInput
            style={[s.searchInput, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
            placeholder="Search locality or society..."
            placeholderTextColor={c.text4}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchResults.length > 0 && (
            <View style={[s.searchDropdown, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              {searchResults.map((r, i) => (
                <Pressable
                  key={`${r.kind}-${r.name}-${i}`}
                  style={[s.searchRow, i < searchResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}
                  onPress={() => handleSearchSelect(r)}
                >
                  <Text style={{ fontSize: 14 }}>
                    {r.kind === 'society' ? '🏢' : r.level === 1 ? '📍' : '📌'}
                  </Text>
                  <View>
                    <Text style={[Typography.body, { color: c.text1, fontSize: 13 }]}>{r.name}</Text>
                    <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>
                      {r.kind === 'society' ? 'Society' : r.level === 1 ? 'Locality' : 'Sub-locality'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Map */}
        <View style={s.mapContainer}>
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={c.accent} size="large" />
            </View>
          ) : (
            <MapView
              ref={ref => setMapRef(ref)}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFillObject}
              initialRegion={initialRegion}
              onPress={handleMapPress}
            >
              {pin && (
                <Marker
                  coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate
                    setPin({ lat: latitude, lng: longitude })
                  }}
                />
              )}
            </MapView>
          )}
        </View>

        {/* Confirm button */}
        {pin && (
          <View style={[s.footer, { backgroundColor: c.bgPage, borderTopColor: c.border }]}>
            {detectedSociety && (
              <Text style={[Typography.caption, { color: c.green, textAlign: 'center', marginBottom: Spacing.xs }]}>
                Near {detectedSociety.name}
              </Text>
            )}
            <Pressable style={[s.confirmBtn, { backgroundColor: c.accent }]} onPress={handleConfirm}>
              <Text style={[Typography.subtitle, { color: '#fff' }]}>Confirm Location</Text>
            </Pressable>
          </View>
        )}

        {/* Hint */}
        {!pin && !loading && (
          <View style={[s.hintBar, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
            <Text style={[Typography.caption, { color: '#fff' }]}>
              Tap on the map to pin your property location
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    zIndex: 10,
  },
  searchInput: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  searchDropdown: {
    position: 'absolute', left: Spacing.base, right: Spacing.base,
    top: 48, borderWidth: 1, borderRadius: Radius.md,
    maxHeight: 240, zIndex: 20,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  mapContainer: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  confirmBtn: {
    borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center',
  },
  hintBar: {
    position: 'absolute', bottom: 32,
    alignSelf: 'center', borderRadius: 20,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
})
