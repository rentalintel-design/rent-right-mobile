import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator, Image, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { uploadVaultPhoto } from '@/lib/vaultStorage'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import {
  PROPERTY_TYPES, EXTRA_FEATURES, FURNISHING_CATALOG,
  buildInitialFloor, getAllRooms, serializeRoomData,
} from 'rent-right-shared'
import type {
  PropertyType, VaultFloor, VaultRoom, VaultMedia,
  AddedFurnishing, AddedExtraRoom, VaultRecord,
} from 'rent-right-shared'
import { CITY_BOUNDS } from 'rent-right-shared'
import LocationPickerSheet from '@/components/map/LocationPickerSheet'

const STEPS = ['Address', 'Rooms', 'Photos', 'Furnishings']
const CITIES = Object.keys(CITY_BOUNDS)

export default function VaultCreateScreen() {
  const c = useColors()
  const { user, profile } = useAuth()
  const { id: editId } = useLocalSearchParams<{ id?: string }>()
  const isEditing = !!editId
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEditing)

  // Step 0: Address
  const [address, setAddress] = useState('')
  const [city, setCity] = useState(profile?.city ?? 'Bengaluru')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [societyId, setSocietyId] = useState<string | null>(null)
  const [societyName, setSocietyName] = useState<string | null>(null)
  const [mapPickerVisible, setMapPickerVisible] = useState(false)

  // Step 1: Rooms & Floors
  // Each floor has its own BHK type selected inline
  // floors[i] starts with empty rooms until type is chosen
  const [floors, setFloors] = useState<VaultFloor[]>([{ index: 0, rooms: [], extraRooms: [] }])
  const [floorTypes, setFloorTypes] = useState<(PropertyType | null)[]>([null])
  const [roomData, setRoomData] = useState<Record<string, VaultRoom>>({})

  // Step 3: Furnishings
  const [furnishings, setFurnishings] = useState<AddedFurnishing[]>([])
  const [roomPickerItem, setRoomPickerItem] = useState<{ id: string; name: string; icon: string; categoryId: string } | null>(null)

  // Derived: primary property type = floor 0's type (for save/display)
  const propertyType = floorTypes[0] ?? null

  // Load existing record when editing
  useEffect(() => {
    if (!editId) return
    supabase.from('vault_records').select('*').eq('id', editId).single()
      .then(({ data, error }) => {
        if (error || !data) {
          Alert.alert('Error', 'Could not load record for editing.')
          router.back()
          return
        }
        const rec = data as VaultRecord
        const loadedFloors = (rec.floors ?? []) as VaultFloor[]
        setAddress(rec.property_address ?? '')
        setCity(rec.city ?? profile?.city ?? 'Bengaluru')
        setLat((rec as any).lat ?? null)
        setLng((rec as any).lng ?? null)
        setSocietyId((rec as any).society_id ?? null)
        setSocietyName((rec as any).society_name ?? null)
        setFloors(loadedFloors.length > 0 ? loadedFloors : [{ index: 0, rooms: [], extraRooms: [] }])
        // Re-derive floor types from saved data (property_type = floor 0's type)
        const savedType = rec.property_type as PropertyType | null
        setFloorTypes(loadedFloors.map((_, i) => i === 0 ? savedType : null))
        setRoomData((rec.room_data ?? {}) as Record<string, VaultRoom>)
        setFurnishings((rec.furnishings ?? []) as AddedFurnishing[])
        setLoadingEdit(false)
      })
  }, [editId])

  const canNext = () => {
    if (step === 0) return address.trim().length > 0
    if (step === 1) return floorTypes.every(t => t !== null)
    return true
  }

  // Select BHK type for a specific floor
  const selectFloorType = (floorIdx: number, type: PropertyType) => {
    const newFloor = buildInitialFloor(type, floorIdx)
    setFloors(prev => prev.map((f, i) => i === floorIdx ? newFloor : f))
    setFloorTypes(prev => prev.map((t, i) => i === floorIdx ? type : t))
    setRoomData(prev => {
      const rd = { ...prev }
      // Remove old rooms for this floor
      const oldFloor = floors[floorIdx]
      for (const r of [...(oldFloor?.rooms ?? []), ...(oldFloor?.extraRooms ?? [])]) {
        delete rd[r.instanceId]
      }
      // Add new rooms
      for (const room of [...newFloor.rooms, ...newFloor.extraRooms]) {
        rd[room.instanceId] = { config: room.config, media: [] }
      }
      return rd
    })
  }

  const addFloor = () => {
    const idx = floors.length
    setFloors(prev => [...prev, { index: idx, rooms: [], extraRooms: [] }])
    setFloorTypes(prev => [...prev, null])
  }

  const removeFloor = (idx: number) => {
    if (idx === 0) return
    const removed = floors[idx]
    setRoomData(prev => {
      const rd = { ...prev }
      for (const r of [...(removed?.rooms ?? []), ...(removed?.extraRooms ?? [])]) {
        delete rd[r.instanceId]
      }
      return rd
    })
    setFloors(prev => prev.filter((_, i) => i !== idx))
    setFloorTypes(prev => prev.filter((_, i) => i !== idx))
  }

  const addExtraFeature = (feature: typeof EXTRA_FEATURES[number], floorIdx: number) => {
    const instanceId = `${feature.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const extra: AddedExtraRoom = { instanceId, featureId: feature.id, config: feature, floorIndex: floorIdx }
    setFloors(prev => prev.map((f, i) =>
      i === floorIdx ? { ...f, extraRooms: [...f.extraRooms, extra] } : f
    ))
    setRoomData(prev => ({ ...prev, [instanceId]: { config: feature, media: [] } }))
  }

  const removeExtraRoom = (instanceId: string, floorIdx: number) => {
    setFloors(prev => prev.map((f, i) =>
      i === floorIdx ? { ...f, extraRooms: f.extraRooms.filter(r => r.instanceId !== instanceId) } : f
    ))
    setRoomData(prev => { const rd = { ...prev }; delete rd[instanceId]; return rd })
  }

  const pickPhotos = async (roomId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 })
    if (result.canceled) return
    const newMedia: VaultMedia[] = result.assets.map(a => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId, url: a.uri, capturedAt: new Date().toISOString(), isVideo: false, uploadStatus: 'pending' as const,
    }))
    setRoomData(prev => ({ ...prev, [roomId]: { ...prev[roomId], media: [...(prev[roomId]?.media ?? []), ...newMedia] } }))
  }

  const takePhoto = async (roomId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow camera access.'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (result.canceled) return
    const a = result.assets[0]
    const media: VaultMedia = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId, url: a.uri, capturedAt: new Date().toISOString(), isVideo: false, uploadStatus: 'pending',
    }
    setRoomData(prev => ({ ...prev, [roomId]: { ...prev[roomId], media: [...(prev[roomId]?.media ?? []), media] } }))
  }

  const removePhoto = (roomId: string, mediaId: string) => {
    setRoomData(prev => ({ ...prev, [roomId]: { ...prev[roomId], media: prev[roomId].media.filter(m => m.id !== mediaId) } }))
  }

  const toggleFurnishing = (item: { id: string; name: string; icon: string }, categoryId: string) => {
    setFurnishings(prev => {
      const exists = prev.find(f => f.itemId === item.id)
      if (exists) return prev.filter(f => f.itemId !== item.id)
      setRoomPickerItem({ ...item, categoryId })
      return [...prev, { id: `${item.id}_${Date.now()}`, itemId: item.id, itemName: item.name, itemIcon: item.icon, categoryId, quantity: 1, roomId: undefined }]
    })
  }

  const assignRoom = (itemId: string, roomId: string) => {
    setFurnishings(prev => prev.map(f => f.itemId === itemId ? { ...f, roomId } : f))
    setRoomPickerItem(null)
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setFurnishings(prev => prev.map(f => f.itemId === itemId ? { ...f, quantity: Math.max(1, f.quantity + delta) } : f))
  }

  const saveRecord = async () => {
    if (!user?.id || !propertyType) return
    setSaving(true)
    try {
      const payload = {
        property_type: propertyType,
        property_address: address,
        city, lat, lng, society_id: societyId, society_name: societyName,
        floors, furnishings, room_data: serializeRoomData(roomData),
      }
      let recordId: string
      if (isEditing && editId) {
        const { error } = await supabase.from('vault_records').update(payload).eq('id', editId)
        if (error) { Alert.alert('Error', error.message); setSaving(false); return }
        recordId = editId
      } else {
        const { data, error } = await supabase.from('vault_records')
          .insert({ user_id: user.id, ...payload, is_locked: false, creator_role: profile?.role ?? 'tenant', sharing_status: 'draft' })
          .select('id').single()
        if (error || !data) { Alert.alert('Error', error?.message ?? 'Failed to save'); setSaving(false); return }
        recordId = data.id
      }
      // Upload pending photos
      for (const room of getAllRooms(floors)) {
        const rd = roomData[room.instanceId]
        if (!rd?.media?.length) continue
        const uploads = await Promise.all(
          rd.media.filter(m => m.uploadStatus === 'pending')
            .map(m => uploadVaultPhoto(recordId, room.instanceId, m.url).then(r => ({ mediaId: m.id, result: r })))
        )
        for (const { mediaId, result } of uploads) {
          if (result) {
            const media = rd.media.find(m => m.id === mediaId)
            if (media) { media.url = result.url; media.storagePath = result.storagePath; media.uploadStatus = 'uploaded' }
          }
        }
      }
      await supabase.from('vault_records').update({ room_data: serializeRoomData(roomData) }).eq('id', recordId)
      router.replace(isEditing ? `/vault/${recordId}` : '/(tabs)/vault')
    } catch {
      Alert.alert('Error', 'Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>{step > 0 ? '← Back' : '← Cancel'}</Text>
        </Pressable>
        <Text style={[Typography.caption, { color: c.text3 }]}>
          {isEditing ? 'Edit · ' : ''}Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: c.bgSubtle }]}>
        <View style={[styles.progressFill, { backgroundColor: c.accent, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <StepAddress
            address={address} setAddress={setAddress}
            city={city} setCity={setCity}
            lat={lat} lng={lng} societyName={societyName}
            onOpenMap={() => setMapPickerVisible(true)}
            c={c}
          />
        )}
        {step === 1 && (
          <StepRooms
            floors={floors}
            floorTypes={floorTypes}
            onSelectFloorType={selectFloorType}
            onAddFloor={addFloor}
            onRemoveFloor={removeFloor}
            onAddExtra={addExtraFeature}
            onRemoveExtra={removeExtraRoom}
            roomData={roomData}
            c={c}
          />
        )}
        {step === 2 && (
          <StepPhotos
            floors={floors} roomData={roomData}
            onPickPhotos={pickPhotos} onTakePhoto={takePhoto} onRemovePhoto={removePhoto}
            c={c}
          />
        )}
        {step === 3 && (
          <StepFurnishings
            furnishings={furnishings} floors={floors} roomData={roomData}
            onToggle={toggleFurnishing} onUpdateQty={updateQuantity}
            onAssignRoom={(itemId) => {
              const item = furnishings.find(f => f.itemId === itemId)
              if (item) setRoomPickerItem({ id: item.itemId, name: item.itemName, icon: item.itemIcon, categoryId: item.categoryId })
            }}
            c={c}
          />
        )}
      </ScrollView>

      {/* Map Picker */}
      <LocationPickerSheet
        visible={mapPickerVisible}
        city={city}
        initialPin={lat && lng ? { lat, lng } : null}
        onConfirm={(pin, sName, sId) => {
          setLat(pin.lat); setLng(pin.lng)
          setSocietyName(sName); setSocietyId(sId)
          if (sName && !address.trim()) setAddress(sName)
          setMapPickerVisible(false)
        }}
        onClose={() => setMapPickerVisible(false)}
      />

      {/* Room Picker Modal for furnishing assignment */}
      <Modal visible={!!roomPickerItem} transparent animationType="slide" onRequestClose={() => setRoomPickerItem(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRoomPickerItem(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: c.bgSurface }]} onPress={e => e.stopPropagation()}>
            <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.xs }]}>
              {roomPickerItem?.icon} {roomPickerItem?.name}
            </Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.base }]}>
              Assign this item to a room (optional)
            </Text>
            {getAllRooms(floors).map(room => (
              <Pressable
                key={room.instanceId}
                style={[styles.modalOption, { borderColor: c.border }]}
                onPress={() => roomPickerItem && assignRoom(roomPickerItem.id, room.instanceId)}
              >
                <Text style={{ fontSize: 18 }}>{room.config.icon}</Text>
                <View>
                  <Text style={[Typography.caption, { color: c.text1 }]}>{room.config.name}</Text>
                  <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>Floor {room.floorIndex}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable style={[styles.modalCancel, { backgroundColor: c.bgSubtle }]} onPress={() => setRoomPickerItem(null)}>
              <Text style={[Typography.caption, { color: c.text3 }]}>Skip (no room assigned)</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bgPage }]}>
        {step < STEPS.length - 1 ? (
          <Pressable
            style={[styles.nextBtn, { backgroundColor: canNext() ? c.accent : c.bgSubtle }]}
            onPress={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
          >
            <Text style={[Typography.subtitle, { color: canNext() ? '#fff' : c.text4 }]}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.nextBtn, { backgroundColor: saving ? c.bgSubtle : c.accent }]}
            onPress={saveRecord}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={[Typography.subtitle, { color: '#fff' }]}>{isEditing ? 'Save Changes' : 'Save as Draft'}</Text>
            }
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

// ─── Step 1: Address + Map ────────────────────────────────────────────────────
function StepAddress({ address, setAddress, city, setCity, lat, lng, societyName, onOpenMap, c }: {
  address: string; setAddress: (s: string) => void
  city: string; setCity: (s: string) => void
  lat: number | null; lng: number | null; societyName: string | null
  onOpenMap: () => void; c: any
}) {
  const pinLabel = societyName
    ? `📍 ${societyName}`
    : lat && lng ? `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}` : null

  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Property Address</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
        Enter the address and pin the exact location on the map.
      </Text>

      <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>City</Text>
      <View style={styles.cityGrid}>
        {CITIES.map(ct => (
          <Pressable
            key={ct}
            style={[styles.cityChip, { backgroundColor: city === ct ? c.accent : c.bgSurface, borderColor: city === ct ? c.accent : c.border }]}
            onPress={() => setCity(ct)}
          >
            <Text style={[Typography.caption, { color: city === ct ? '#fff' : c.text2 }]}>{ct}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[Typography.caption, { color: c.text2, marginTop: Spacing.base, marginBottom: Spacing.xs }]}>Address</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. Flat 302, Tower B, Prestige Lakeside..."
        placeholderTextColor={c.text4}
        multiline
      />

      <Pressable
        style={[styles.mapPinBtn, { backgroundColor: c.bgSurface, borderColor: pinLabel ? c.green : c.border }]}
        onPress={onOpenMap}
      >
        <Text style={{ fontSize: 20 }}>🗺</Text>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.caption, { color: pinLabel ? c.green : c.accent, fontWeight: '600' }]}>
            {pinLabel ?? 'Pin location on map'}
          </Text>
          <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>
            {pinLabel ? 'Tap to change location' : 'Search locality or tap on map'}
          </Text>
        </View>
        <Text style={[Typography.caption, { color: c.text3 }]}>›</Text>
      </Pressable>
    </View>
  )
}

// ─── Step 2: Rooms & Floors (per-floor BHK selector inline) ──────────────────
function StepRooms({ floors, floorTypes, onSelectFloorType, onAddFloor, onRemoveFloor, onAddExtra, onRemoveExtra, roomData, c }: {
  floors: VaultFloor[]
  floorTypes: (PropertyType | null)[]
  onSelectFloorType: (floorIdx: number, type: PropertyType) => void
  onAddFloor: () => void
  onRemoveFloor: (i: number) => void
  onAddExtra: (f: typeof EXTRA_FEATURES[number], floorIdx: number) => void
  onRemoveExtra: (instanceId: string, floorIdx: number) => void
  roomData: Record<string, VaultRoom>
  c: any
}) {
  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Rooms & Floors</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
        Select BHK type for each floor and add extras like balcony, parking, etc.
      </Text>

      {floors.map((floor, fi) => {
        const selectedType = floorTypes[fi]
        return (
          <View key={fi} style={[styles.floorBlock, { borderColor: c.border }]}>
            {/* Floor header */}
            <View style={styles.floorHeader}>
              <View style={styles.floorLabelRow}>
                <View style={[styles.floorBadge, { backgroundColor: c.accent }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>F{floor.index}</Text>
                </View>
                <Text style={[Typography.subtitle, { color: c.text1 }]}>Floor {floor.index}</Text>
                {selectedType && (
                  <View style={[styles.typePill, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
                    <Text style={[Typography.caption, { color: c.text3, fontSize: 10 }]}>{selectedType.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              {fi > 0 && (
                <Pressable onPress={() => onRemoveFloor(fi)}>
                  <Text style={[Typography.caption, { color: c.red }]}>Remove</Text>
                </Pressable>
              )}
            </View>

            {/* Inline BHK selector */}
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Unit type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.bhkRow}>
                {PROPERTY_TYPES.map(pt => {
                  const active = selectedType === pt.id
                  return (
                    <Pressable
                      key={pt.id}
                      style={[styles.bhkChip, { backgroundColor: active ? c.accent : c.bgSurface, borderColor: active ? c.accent : c.border }]}
                      onPress={() => onSelectFloorType(fi, pt.id)}
                    >
                      <Text style={[Typography.subtitle, { color: active ? '#fff' : c.text1, fontSize: 14 }]}>{pt.label}</Text>
                      <Text style={[Typography.caption, { color: active ? 'rgba(255,255,255,0.7)' : c.text4, fontSize: 9 }]}>
                        {pt.bedrooms === 0 ? 'Rm+Kit' : `${pt.bedrooms}Bed`}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>

            {/* Room components — shown only after BHK is selected */}
            {selectedType && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Rooms</Text>
                <View style={styles.roomGrid}>
                  {floor.rooms.map(room => {
                    const photoCount = roomData[room.instanceId]?.media?.length ?? 0
                    return (
                      <View key={room.instanceId} style={[styles.roomCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
                        <Text style={{ fontSize: 22 }}>{room.config.icon}</Text>
                        <Text style={[Typography.caption, { color: c.text2, fontSize: 10 }]} numberOfLines={1}>{room.config.name}</Text>
                        {photoCount > 0 && (
                          <View style={[styles.photoBadge, { backgroundColor: c.accent }]}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{photoCount}</Text>
                          </View>
                        )}
                      </View>
                    )
                  })}
                  {floor.extraRooms.map(room => (
                    <View key={room.instanceId} style={[styles.roomCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
                      <Pressable style={styles.removeRoom} onPress={() => onRemoveExtra(room.instanceId, fi)}>
                        <Text style={{ color: c.red, fontSize: 11, fontWeight: '700' }}>✕</Text>
                      </Pressable>
                      <Text style={{ fontSize: 22 }}>{room.config.icon}</Text>
                      <Text style={[Typography.caption, { color: c.text2, fontSize: 10 }]} numberOfLines={1}>{room.config.name}</Text>
                    </View>
                  ))}
                </View>

                {/* Add extras */}
                <Text style={[Typography.caption, { color: c.text3, marginTop: Spacing.sm, marginBottom: Spacing.xs }]}>Add extra space:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.extraRow}>
                    {EXTRA_FEATURES.map(feat => (
                      <Pressable
                        key={feat.id}
                        style={[styles.extraChip, { backgroundColor: c.bgSubtle, borderColor: c.border }]}
                        onPress={() => onAddExtra(feat, fi)}
                      >
                        <Text style={{ fontSize: 14 }}>{feat.icon}</Text>
                        <Text style={[Typography.caption, { color: c.text3, fontSize: 10 }]}>{feat.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )
      })}

      {/* Add Floor */}
      <Pressable style={[styles.addFloorBtn, { borderColor: c.border }]} onPress={onAddFloor}>
        <Text style={{ fontSize: 16 }}>+</Text>
        <Text style={[Typography.caption, { color: c.accent }]}>Add Floor</Text>
      </Pressable>
    </View>
  )
}

// ─── Step 3: Photos ───────────────────────────────────────────────────────────
function StepPhotos({ floors, roomData, onPickPhotos, onTakePhoto, onRemovePhoto, c }: {
  floors: VaultFloor[]; roomData: Record<string, VaultRoom>
  onPickPhotos: (roomId: string) => void; onTakePhoto: (roomId: string) => void
  onRemovePhoto: (roomId: string, mediaId: string) => void; c: any
}) {
  const allRooms = getAllRooms(floors)
  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Room Photos</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
        Add photos for each room using camera or gallery.
      </Text>
      {allRooms.map(room => {
        const media = roomData[room.instanceId]?.media ?? []
        return (
          <View key={room.instanceId} style={[styles.photoSection, { borderColor: c.border }]}>
            <View style={styles.photoHeader}>
              <Text style={{ fontSize: 18 }}>{room.config.icon}</Text>
              <Text style={[Typography.subtitle, { color: c.text1, flex: 1 }]}>
                {room.config.name}
                <Text style={[Typography.caption, { color: c.text4 }]}> · F{room.floorIndex}</Text>
              </Text>
              <Text style={[Typography.caption, { color: c.text3 }]}>{media.length} photo{media.length !== 1 ? 's' : ''}</Text>
            </View>
            {media.length > 0 && (
              <View style={styles.photoGrid}>
                {media.map(m => (
                  <View key={m.id} style={styles.photoThumb}>
                    <Image source={{ uri: m.url }} style={styles.photoImg} resizeMode="cover" />
                    <Pressable style={styles.photoDelete} onPress={() => onRemovePhoto(room.instanceId, m.id)}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.photoActions}>
              <Pressable style={[styles.photoBtn, { backgroundColor: c.bgSubtle, borderColor: c.border }]} onPress={() => onTakePhoto(room.instanceId)}>
                <Text style={[Typography.caption, { color: c.text2 }]}>📷 Camera</Text>
              </Pressable>
              <Pressable style={[styles.photoBtn, { backgroundColor: c.bgSubtle, borderColor: c.border }]} onPress={() => onPickPhotos(room.instanceId)}>
                <Text style={[Typography.caption, { color: c.text2 }]}>🖼 Gallery</Text>
              </Pressable>
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ─── Step 4: Furnishings ──────────────────────────────────────────────────────
function StepFurnishings({ furnishings, floors, roomData, onToggle, onUpdateQty, onAssignRoom, c }: {
  furnishings: AddedFurnishing[]; floors: VaultFloor[]; roomData: Record<string, VaultRoom>
  onToggle: (item: { id: string; name: string; icon: string }, categoryId: string) => void
  onUpdateQty: (itemId: string, delta: number) => void; onAssignRoom: (itemId: string) => void; c: any
}) {
  const [activeCat, setActiveCat] = useState(FURNISHING_CATALOG[0].id)
  const selectedIds = new Set(furnishings.map(f => f.itemId))
  const category = FURNISHING_CATALOG.find(cat => cat.id === activeCat)
  const allRooms = getAllRooms(floors)
  const roomNameMap: Record<string, string> = {}
  for (const r of allRooms) roomNameMap[r.instanceId] = `${r.config.icon} ${r.config.name} (F${r.floorIndex})`

  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Furnishings & Assets</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.md }]}>
        Select items present in the property. {furnishings.length} selected.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
        <View style={styles.catRow}>
          {FURNISHING_CATALOG.map(cat => (
            <Pressable
              key={cat.id}
              style={[styles.catChip, { backgroundColor: activeCat === cat.id ? c.accent : c.bgSubtle, borderColor: activeCat === cat.id ? c.accent : c.border }]}
              onPress={() => setActiveCat(cat.id)}
            >
              <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
              <Text style={[Typography.caption, { color: activeCat === cat.id ? '#fff' : c.text3, fontSize: 10 }]}>{cat.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {category && (
        <View style={styles.itemGrid}>
          {category.items.map(item => {
            const isSelected = selectedIds.has(item.id)
            return (
              <Pressable
                key={item.id}
                style={[styles.itemCard, { backgroundColor: isSelected ? c.accent : c.bgSurface, borderColor: isSelected ? c.accent : c.border }]}
                onPress={() => onToggle(item, category.id)}
              >
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                <Text style={[Typography.caption, { color: isSelected ? '#fff' : c.text2, fontSize: 10 }]} numberOfLines={1}>{item.name}</Text>
              </Pressable>
            )
          })}
        </View>
      )}
      {furnishings.length > 0 && (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Selected Items</Text>
          {furnishings.map(f => (
            <View key={f.id} style={[styles.selectedItem, { borderColor: c.border }]}>
              <Text style={{ fontSize: 16 }}>{f.itemIcon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.caption, { color: c.text2 }]}>{f.itemName}</Text>
                <Pressable onPress={() => onAssignRoom(f.itemId)}>
                  <Text style={[Typography.caption, { color: f.roomId ? c.green : c.accent, fontSize: 10 }]}>
                    {f.roomId ? roomNameMap[f.roomId] ?? 'Room assigned' : '+ Assign room'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.qtyRow}>
                <Pressable style={[styles.qtyBtn, { backgroundColor: c.bgSubtle }]} onPress={() => onUpdateQty(f.itemId, -1)}>
                  <Text style={[Typography.caption, { color: c.text2 }]}>−</Text>
                </Pressable>
                <Text style={[Typography.caption, { color: c.text1, minWidth: 24, textAlign: 'center' }]}>{f.quantity}</Text>
                <Pressable style={[styles.qtyBtn, { backgroundColor: c.bgSubtle }]} onPress={() => onUpdateQty(f.itemId, 1)}>
                  <Text style={[Typography.caption, { color: c.text2 }]}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
  progressBg: { height: 3 },
  progressFill: { height: 3 },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.base, paddingBottom: 100 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.base, borderTopWidth: 1 },
  nextBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  // Address
  input: {
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
    fontSize: 15, minHeight: 60, textAlignVertical: 'top',
  },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  cityChip: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1 },
  mapPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.base,
  },
  // Rooms & Floors
  floorBlock: {
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md, gap: Spacing.sm,
  },
  floorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  floorLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  floorBadge: { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typePill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  bhkRow: { flexDirection: 'row', gap: Spacing.xs },
  bhkChip: {
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center', minWidth: 56,
  },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  roomCard: {
    width: '30%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative',
  },
  photoBadge: {
    position: 'absolute', top: 4, right: 4, borderRadius: Radius.full,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  removeRoom: { position: 'absolute', top: 4, left: 4 },
  extraRow: { flexDirection: 'row', gap: Spacing.xs },
  extraChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1,
  },
  addFloorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    borderWidth: 1, borderRadius: Radius.md, borderStyle: 'dashed', paddingVertical: Spacing.md,
  },
  // Photos
  photoSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  photoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  photoThumb: { width: 72, height: 72, borderRadius: Radius.sm, overflow: 'hidden', position: 'relative' },
  photoImg: { width: 72, height: 72 },
  photoDelete: {
    position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  photoActions: { flexDirection: 'row', gap: Spacing.sm },
  photoBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1 },
  // Furnishings
  catRow: { flexDirection: 'row', gap: Spacing.xs },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1,
  },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  itemCard: {
    width: '23%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4,
  },
  selectedItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderBottomWidth: 1, paddingVertical: Spacing.sm,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.base, paddingBottom: 36, gap: Spacing.xs,
  },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
  modalCancel: { marginTop: Spacing.md, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
})
