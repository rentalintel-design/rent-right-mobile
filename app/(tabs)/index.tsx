import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { View, StyleSheet, Pressable, Text, ScrollView, ActivityIndicator } from 'react-native'
import MapView, { Region, PROVIDER_GOOGLE, Polygon } from 'react-native-maps'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { router } from 'expo-router'
import { CITY_BOUNDS, GRID_STEP_250 } from 'rent-right-shared'
import type { ActiveLayer } from 'rent-right-shared'

import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useVacancies } from '@/hooks/useVacancies'
import { useRentData } from '@/hooks/useRentData'
import { useMembership } from '@/hooks/useMembership'
import { buildLocalityRentFromStats, buildStreetGridFromStats } from '@/lib/rentGrid'
import { getCityClipPolygon } from '@/lib/mapUtils'
import { DARK_MAP_STYLE } from '@/constants/mapStyles'
import { Spacing, Typography, Radius } from '@/constants/theme'
import { supabase } from '@/lib/supabase'
import { formatRent } from '@/lib/vacancyUtils'

import { VacancyMarker } from '@/components/map/VacancyMarker'
import VacancyDetailSheet from '@/components/map/VacancyDetailSheet'
import { RentPolygons } from '@/components/map/RentPolygons'
import { LocalityPolygons } from '@/components/map/LocalityPolygons'
import { CityMask } from '@/components/map/CityMask'
import LayerToggleBar from '@/components/map/LayerToggleBar'
import RentSlider from '@/components/map/RentSlider'
import MapSearchBar from '@/components/map/MapSearchBar'
import FiltersSheet from '@/components/map/FiltersSheet'
import LocateButton from '@/components/map/LocateButton'

import type { BhkFilter, RentFilter, SourceFilter, FurnishingFilter, Vacancy } from '@/hooks/useVacancies'

// ─── Landlord Dashboard ───────────────────────────────────────────────────────

type LandlordStats = {
  total: number
  active: number
  draft: number
  booked: number
}

function LandlordDashboard() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { user, profile } = useAuth()
  const { canPostAsLandlord } = useMembership(user?.id)
  const [stats, setStats] = useState<LandlordStats>({ total: 0, active: 0, draft: 0, booked: 0 })
  const [recentListings, setRecentListings] = useState<Vacancy[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('vacancies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) {
      setRecentListings(data as Vacancy[])
      const all = data as Vacancy[]
      setStats({
        total: all.length,
        active: all.filter(v => (v as any).status === 'active').length,
        draft: all.filter(v => (v as any).status === 'draft').length,
        booked: all.filter(v => (v as any).status === 'booked').length,
      })
    }
    setLoading(false)
  }, [user?.id])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))

  const STATUS_COLORS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: '#9ca3af' },
    active: { label: 'Active', color: '#22c55e' },
    booked: { label: 'Booked', color: '#fb923c' },
    rented_out: { label: 'Rented', color: '#3b82f6' },
  }

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: c.bgPage }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={[Typography.title, { color: c.text1 }]}>Dashboard</Text>
          <Text style={[Typography.caption, { color: c.text3, marginTop: 2 }]}>
            {profile?.city ?? 'Your city'} · Landlord
          </Text>
        </View>

        {/* Quick action */}
        <Pressable
          style={[dashStyles.postBtn, { backgroundColor: c.accent }]}
          onPress={() => router.push('/vacancy/create')}
        >
          <Text style={[Typography.subtitle, { color: '#fff' }]}>+ Post a Vacancy</Text>
        </Pressable>

        {/* Stats */}
        <View style={dashStyles.statsGrid}>
          {[
            { label: 'Total', value: stats.total, color: c.text1 },
            { label: 'Active', value: stats.active, color: '#22c55e' },
            { label: 'Draft', value: stats.draft, color: '#9ca3af' },
            { label: 'Booked', value: stats.booked, color: '#fb923c' },
          ].map(s => (
            <View key={s.label} style={[dashStyles.statCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              <Text style={[Typography.title, { color: s.color, fontSize: 28 }]}>{s.value}</Text>
              <Text style={[Typography.caption, { color: c.text3 }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Recent listings */}
        <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm, marginTop: Spacing.lg }]}>
          Recent Listings
        </Text>

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: Spacing.lg }} />
        ) : recentListings.length === 0 ? (
          <View style={[dashStyles.emptyCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
            <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
              No listings yet.{'\n'}Post your first vacancy to get started.
            </Text>
          </View>
        ) : (
          recentListings.map(v => {
            const anyV = v as any
            const statusInfo = STATUS_COLORS[anyV.status ?? 'draft'] ?? STATUS_COLORS.draft
            return (
              <Pressable
                key={v.id}
                style={[dashStyles.listingRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}
                onPress={() => router.push(`/vacancy/${v.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.subtitle, { color: c.text1 }]} numberOfLines={1}>
                    {anyV.bhk_type ?? anyV.property_type ?? 'Listing'}
                  </Text>
                  <Text style={[Typography.caption, { color: c.text3 }]} numberOfLines={1}>
                    {anyV.locality ?? anyV.property_address ?? v.city}
                  </Text>
                  {anyV.asking_rent && (
                    <Text style={[Typography.caption, { color: c.accent, marginTop: 2 }]}>
                      {formatRent(anyV.asking_rent)}/mo
                    </Text>
                  )}
                </View>
                <View style={[dashStyles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                  <Text style={[Typography.caption, { color: statusInfo.color, fontSize: 11 }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </Pressable>
            )
          })
        )}

        {recentListings.length > 0 && (
          <Pressable
            style={[dashStyles.viewAllBtn, { borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/vacancies')}
          >
            <Text style={[Typography.caption, { color: c.accent }]}>View all listings →</Text>
          </Pressable>
        )}

        {/* Membership status */}
        <View style={[dashStyles.memberCard, { backgroundColor: c.bgSurface, borderColor: c.border, marginTop: Spacing.lg }]}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.xs }]}>Membership</Text>
          <Text style={[Typography.caption, { color: canPostAsLandlord ? '#22c55e' : c.text3 }]}>
            {canPostAsLandlord ? '✓ Active — can post vacancies' : 'No active plan — contribute rent data to unlock'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const dashStyles = StyleSheet.create({
  postBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  emptyCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.xl ?? Spacing.lg,
    alignItems: 'center',
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  viewAllBtn: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  memberCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
})

// ─── Home Screen entry point ──────────────────────────────────────────────────

export default function HomeScreen() {
  const { profile } = useAuth()
  if (profile?.role === 'landlord') return <LandlordDashboard />
  return <MapScreen />
}

function MapScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { user, profile } = useAuth()
  const mapRef = useRef<MapView>(null)

  const cityName = (profile?.city ?? 'bengaluru').toLowerCase()
  const bounds = CITY_BOUNDS[cityName]

  const initialRegion: Region = bounds ? {
    latitude: (bounds.latMin + bounds.latMax) / 2,
    longitude: (bounds.lngMin + bounds.lngMax) / 2,
    latitudeDelta: bounds.latMax - bounds.latMin,
    longitudeDelta: bounds.lngMax - bounds.lngMin,
  } : {
    latitude: 12.97, longitude: 77.59, latitudeDelta: 0.15, longitudeDelta: 0.15,
  }

  // Map state
  const [region, setRegion] = useState<Region>(initialRegion)
  const zoom = useMemo(
    () => Math.log2(360 / (region.longitudeDelta || 0.01)),
    [region.longitudeDelta]
  )

  // Layer state + switching queue
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('none')
  const [isSwitching, setIsSwitching] = useState(false)
  const pendingLayer = useRef<ActiveLayer | null>(null)
  const [rentMin, setRentMin] = useState(5000)
  const [rentMax, setRentMax] = useState(100000)

  // Filter state
  const [bhkFilter, setBhkFilter] = useState<BhkFilter>('All')
  const [rentFilter, setRentFilter] = useState<RentFilter>('All')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All')
  const [furnishingFilter, setFurnishingFilter] = useState<FurnishingFilter>('All')
  const [filtersVisible, setFiltersVisible] = useState(false)

  // Vacancy detail
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)

  // Data hooks
  const { filteredVacancies, favoriteIds, toggleFavorite } = useVacancies({
    cityName,
    bounds,
    bhkFilter,
    rentFilter,
    sourceFilter,
    furnishingFilter,
    userId: user?.id,
  })

  const { localities, localityStats, streetGridStats } = useRentData(cityName, bounds)

  // Rent features
  const cityHull = useMemo(() => getCityClipPolygon(cityName, localities), [cityName, localities])

  const STREET_MIN_ZOOM = 14

  // Auto-zoom to 14 when street layer activated below minimum zoom
  useEffect(() => {
    if (activeLayer !== 'rent-street') return
    if (zoom >= STREET_MIN_ZOOM) return
    const delta = 360 / Math.pow(2, STREET_MIN_ZOOM)
    mapRef.current?.animateToRegion({
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: delta * 1.5,
      longitudeDelta: delta,
    }, 500)
  }, [activeLayer])

  // Debounced viewport region — recomputes street grid 300ms after panning/zooming stops
  const [viewportRegion, setViewportRegion] = useState<Region>(initialRegion)
  useEffect(() => {
    const t = setTimeout(() => setViewportRegion(region), 300)
    return () => clearTimeout(t)
  }, [region])

  // Locality features — loaded once from DB, static. Always computed regardless of layer
  // so LocalityPolygons stays mounted with stable features (just toggles visibility via activeLayer prop).
  const localityFeatures = useMemo(() => {
    return buildLocalityRentFromStats(localities, localityStats, cityHull)
  }, [localities, localityStats, cityHull])

  // Street grid features — viewport-filtered, pool-based rendering.
  const rentFeatures = useMemo(() => {
    if (activeLayer !== 'rent-street') return []
    if (!cityHull || !bounds) return []
    const vpZoom = Math.log2(360 / (viewportRegion.longitudeDelta || 0.01))
    if (vpZoom < STREET_MIN_ZOOM) return []
    // 1.5× buffer so cells stay visible beyond viewport edges while panning (no blink).
    const latHalf = (viewportRegion.latitudeDelta / 2) * 1.5
    const lngHalf = (viewportRegion.longitudeDelta / 2) * 1.5
    const vLatMin = viewportRegion.latitude - latHalf
    const vLatMax = viewportRegion.latitude + latHalf
    const vLngMin = viewportRegion.longitude - lngHalf
    const vLngMax = viewportRegion.longitude + lngHalf
    const viewportStats = streetGridStats.filter(s => {
      const cellLat = bounds.latMin + s.grid_lat * GRID_STEP_250
      const cellLng = bounds.lngMin + s.grid_lng * GRID_STEP_250
      return cellLat >= vLatMin && cellLat <= vLatMax
          && cellLng >= vLngMin && cellLng <= vLngMax
    })
    return buildStreetGridFromStats(cityName, viewportStats, cityHull)
  }, [activeLayer, viewportRegion, streetGridStats, cityName, cityHull, bounds])

  // Pool-based rendering: no mount/unmount on layer switch or viewport pan.
  // isSwitching just drives the spinner and queued layer processing.
  const prevLayerRef = useRef<ActiveLayer>('none')
  useEffect(() => {
    const layerChanged = prevLayerRef.current !== activeLayer
    prevLayerRef.current = activeLayer
    if (!layerChanged) return

    setIsSwitching(true)
    const t = setTimeout(() => {
      if (pendingLayer.current !== null) {
        const next = pendingLayer.current
        pendingLayer.current = null
        setActiveLayer(next)
      } else {
        setIsSwitching(false)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [activeLayer])

  // Coordinates are stable — only depend on cityHull/bounds, NOT zoom.
  // Zoom gate is handled in JSX so coordinates don't recompute on every pan.
  const streetGreyRingCoords = useMemo(() => {
    if (cityHull && cityHull.length >= 3) {
      return cityHull.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
    }
    if (bounds) {
      return [
        { latitude: bounds.latMin, longitude: bounds.lngMin },
        { latitude: bounds.latMin, longitude: bounds.lngMax },
        { latitude: bounds.latMax, longitude: bounds.lngMax },
        { latitude: bounds.latMax, longitude: bounds.lngMin },
      ]
    }
    return null
  }, [cityHull, bounds])
  const showStreetRing = activeLayer === 'rent-street' && zoom >= STREET_MIN_ZOOM

  // Debounce showLabels so many Markers don't mount/unmount simultaneously on zoom.
  // Street layer labels also gated on STREET_MIN_ZOOM to match polygon visibility.
  const [showLabels, setShowLabels] = useState(false)
  useEffect(() => {
    const streetOk = activeLayer !== 'rent-street' || zoom >= STREET_MIN_ZOOM
    const t = setTimeout(() => {
      setShowLabels(zoom > 10 && streetOk)
    }, 200)
    return () => clearTimeout(t)
  }, [zoom, activeLayer])

  // Queued layer change — if switching in progress, queue the latest request
  const handleLayerChange = useCallback((layer: ActiveLayer) => {
    if (isSwitching) {
      pendingLayer.current = layer
      return
    }
    setActiveLayer(layer)
  }, [isSwitching])

  // Handlers
  const handleVacancyPress = useCallback((v: Vacancy) => {
    router.push(`/vacancy/${v.id}`)
  }, [])

  const handleSearchResult = useCallback((lat: number, lng: number) => {
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 500)
  }, [])

  const handleLocate = useCallback((lat: number, lng: number) => {
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500)
  }, [])

  const clearFilters = useCallback(() => {
    setBhkFilter('All')
    setRentFilter('All')
    setSourceFilter('All')
    setFurnishingFilter('All')
  }, [])

  const hasActiveFilters = bhkFilter !== 'All' || rentFilter !== 'All' || sourceFilter !== 'All' || furnishingFilter !== 'All'
  const showRentLayer = activeLayer === 'rent-locality' || activeLayer === 'rent-street'

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View style={styles.flex}>
        <MapView
          ref={mapRef}
          style={styles.flex}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          onRegionChangeComplete={setRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          customMapStyle={DARK_MAP_STYLE}
        >
          {/* Layer 1: City hull background — single always-mounted polygon (never add/remove).
               Locality: subtle grey so Voronoi gaps show grey not transparent.
               Street: stronger grey for empty grid areas.
               None / switching: transparent. */}
          {streetGreyRingCoords && (
            <Polygon
              coordinates={streetGreyRingCoords}
              fillColor={
                showStreetRing ? 'rgba(148, 163, 184, 0.35)'
                : activeLayer === 'rent-locality' ? 'rgba(148, 163, 184, 0.18)'
                : 'rgba(0,0,0,0)'
              }
              strokeColor={showStreetRing ? 'rgba(148, 163, 184, 0.4)' : 'rgba(0,0,0,0)'}
              strokeWidth={1}
            />
          )}

          {/* Layer 2a: Locality polygons — static, always mounted, <200 polygons from DB.
               Visibility toggled via activeLayer prop (color → transparent when inactive). */}
          <LocalityPolygons
            features={localityFeatures}
            activeLayer={activeLayer}
            rentMin={rentMin}
            rentMax={rentMax}
          />

          {/* Layer 2b: Street grid — pool-based (120 slots), viewport-filtered. */}
          <RentPolygons
            features={rentFeatures}
            rentMin={rentMin}
            rentMax={rentMax}
            showLabels={showLabels}
            zoom={zoom}
          />

          {/* Layer 3: Outside city dim — always mounted, transparent when not on rent layer. */}
          <CityMask cityHull={cityHull} bounds={bounds} visible={showRentLayer} />

          {/* Vacancy markers — always mounted (never add/remove native views).
               Hidden by moving to null island + opacity 0 when rent layer is active. */}
          {filteredVacancies.map(v => (
            <VacancyMarker key={v.id} vacancy={v} onPress={handleVacancyPress} hidden={showRentLayer} />
          ))}
        </MapView>

        {/* Layer switching spinner */}
        {isSwitching && (
          <View style={styles.switchingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        )}

        {/* Floating UI */}
        <View style={[styles.topOverlay, { top: insets.top + Spacing.sm }]}>
          <MapSearchBar cityBounds={bounds ?? null} onSelectResult={handleSearchResult} />
        </View>

        {/* Layer toggle + slider */}
        <View style={[styles.layerOverlay, { bottom: insets.bottom + 100 }]}>
          <LayerToggleBar
            activeLayer={activeLayer}
            onChangeLayer={handleLayerChange}
            hasContributed={profile?.has_contributed ?? false}
            disabled={isSwitching}
          />
          {showRentLayer && (
            <RentSlider
              rentMin={rentMin}
              rentMax={rentMax}
              onChangeMin={setRentMin}
              onChangeMax={setRentMax}
            />
          )}
        </View>

        {/* Bottom-right: zoom, locate + filter buttons */}
        <View style={[styles.bottomRight, { bottom: insets.bottom + 100 }]}>
          <Pressable
            style={[styles.zoomBtn, { backgroundColor: c.bgSurface, borderColor: c.border }]}
            onPress={() => {
              if (!region || !mapRef.current) return
              mapRef.current.animateToRegion({
                ...region,
                latitudeDelta: region.latitudeDelta / 2,
                longitudeDelta: region.longitudeDelta / 2,
              }, 300)
            }}
          >
            <Text style={[styles.zoomText, { color: c.text1 }]}>＋</Text>
          </Pressable>
          <Pressable
            style={[styles.zoomBtn, { backgroundColor: c.bgSurface, borderColor: c.border }]}
            onPress={() => {
              if (!region || !mapRef.current) return
              mapRef.current.animateToRegion({
                ...region,
                latitudeDelta: region.latitudeDelta * 2,
                longitudeDelta: region.longitudeDelta * 2,
              }, 300)
            }}
          >
            <Text style={[styles.zoomText, { color: c.text1 }]}>ー</Text>
          </Pressable>
          <LocateButton onLocate={handleLocate} />
          <Pressable
            style={[styles.filterBtn, { backgroundColor: c.bgSurface, borderColor: c.border }]}
            onPress={() => setFiltersVisible(true)}
          >
            <Text style={styles.filterIcon}>⚙️</Text>
            {hasActiveFilters && <View style={[styles.filterBadge, { backgroundColor: c.accent }]} />}
          </Pressable>
        </View>

        {/* Zoom level indicator — bottom left */}
        <View style={[styles.zoomBadge, { backgroundColor: c.bgSurface, borderColor: c.border, bottom: insets.bottom + 60 }]}>
          <Text style={[Typography.caption, { color: c.text3, fontVariant: ['tabular-nums'] }]}>
            z{zoom.toFixed(1)}
          </Text>
        </View>

        {/* Count badge */}
        <View style={[styles.countBadge, { backgroundColor: c.bgSurface, borderColor: c.border, bottom: insets.bottom + 60 }]}>
          <Text style={[Typography.caption, { color: c.text2 }]}>
            {filteredVacancies.length} listings
          </Text>
        </View>

        {/* Bottom sheets */}
        <VacancyDetailSheet
          vacancy={selectedVacancy}
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          isFavorite={selectedVacancy ? favoriteIds.has(selectedVacancy.id) : false}
          onToggleFavorite={toggleFavorite}
        />

        <FiltersSheet
          visible={filtersVisible}
          onClose={() => setFiltersVisible(false)}
          bhkFilter={bhkFilter}
          rentFilter={rentFilter}
          sourceFilter={sourceFilter}
          furnishingFilter={furnishingFilter}
          onBhk={setBhkFilter}
          onRent={setRentFilter}
          onSource={setSourceFilter}
          onFurnishing={setFurnishingFilter}
          onClearAll={clearFilters}
        />
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 10,
  },
  layerOverlay: {
    position: 'absolute',
    left: Spacing.base,
    right: 70,
    gap: Spacing.sm,
  },
  bottomRight: {
    position: 'absolute',
    right: Spacing.base,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  zoomText: { fontSize: 22, fontWeight: '700' },
  filterIcon: { fontSize: 20 },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  switchingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBadge: {
    position: 'absolute',
    left: Spacing.base,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  countBadge: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
  },
})
