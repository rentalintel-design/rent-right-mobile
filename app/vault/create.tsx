import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator, Image,
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

const STEPS = ['Type', 'Address', 'Rooms', 'Photos', 'Furnishings']
const CITIES = Object.keys(CITY_BOUNDS)

export default function VaultCreateScreen() {
  const c = useColors()
  const { user, profile } = useAuth()
  const { id: editId } = useLocalSearchParams<{ id?: string }>()
  const isEditing = !!editId
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEditing)

  // Wizard state
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState(profile?.city ?? 'Bengaluru')
  const [floors, setFloors] = useState<VaultFloor[]>([])
  const [roomData, setRoomData] = useState<Record<string, VaultRoom>>({})
  const [furnishings, setFurnishings] = useState<AddedFurnishing[]>([])

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
        setPropertyType(rec.property_type as PropertyType)
        setAddress(rec.property_address ?? '')
        setCity(rec.city ?? profile?.city ?? 'Bengaluru')
        setFloors((rec.floors ?? []) as VaultFloor[])
        setRoomData((rec.room_data ?? {}) as Record<string, VaultRoom>)
        setFurnishings((rec.furnishings ?? []) as AddedFurnishing[])
        setLoadingEdit(false)
      })
  }, [editId])

  const canNext = () => {
    if (step === 0) return !!propertyType
    if (step === 1) return address.trim().length > 0
    return true
  }

  const selectType = (pt: PropertyType) => {
    setPropertyType(pt)
    const floor = buildInitialFloor(pt, 0)
    setFloors([floor])
    // Init empty room data
    const rd: Record<string, VaultRoom> = {}
    for (const room of [...floor.rooms, ...floor.extraRooms]) {
      rd[room.instanceId] = { config: room.config, media: [] }
    }
    setRoomData(rd)
    setFurnishings([])
  }

  const addFloor = () => {
    if (!propertyType) return
    const idx = floors.length
    const floor = buildInitialFloor(propertyType, idx)
    setFloors(prev => [...prev, floor])
    setRoomData(prev => {
      const rd = { ...prev }
      for (const room of [...floor.rooms, ...floor.extraRooms]) {
        rd[room.instanceId] = { config: room.config, media: [] }
      }
      return rd
    })
  }

  const removeFloor = (idx: number) => {
    if (idx === 0) return
    setFloors(prev => {
      const removed = prev[idx]
      if (removed) {
        setRoomData(rd => {
          const newRd = { ...rd }
          for (const r of [...removed.rooms, ...removed.extraRooms]) {
            delete newRd[r.instanceId]
          }
          return newRd
        })
      }
      return prev.filter((_, i) => i !== idx)
    })
  }

  const addExtraFeature = (feature: typeof EXTRA_FEATURES[number], floorIdx: number) => {
    const instanceId = `${feature.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const extra: AddedExtraRoom = {
      instanceId,
      featureId: feature.id,
      config: feature,
      floorIndex: floorIdx,
    }
    setFloors(prev => prev.map((f, i) =>
      i === floorIdx ? { ...f, extraRooms: [...f.extraRooms, extra] } : f
    ))
    setRoomData(prev => ({
      ...prev,
      [instanceId]: { config: feature, media: [] },
    }))
  }

  const removeExtraRoom = (instanceId: string, floorIdx: number) => {
    setFloors(prev => prev.map((f, i) =>
      i === floorIdx ? { ...f, extraRooms: f.extraRooms.filter(r => r.instanceId !== instanceId) } : f
    ))
    setRoomData(prev => {
      const rd = { ...prev }
      delete rd[instanceId]
      return rd
    })
  }

  const pickPhotos = async (roomId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled) return
    const newMedia: VaultMedia[] = result.assets.map(a => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      url: a.uri,
      capturedAt: new Date().toISOString(),
      isVideo: false,
      uploadStatus: 'pending' as const,
    }))
    setRoomData(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        media: [...(prev[roomId]?.media ?? []), ...newMedia],
      },
    }))
  }

  const takePhoto = async (roomId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (result.canceled) return
    const a = result.assets[0]
    const media: VaultMedia = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      url: a.uri,
      capturedAt: new Date().toISOString(),
      isVideo: false,
      uploadStatus: 'pending',
    }
    setRoomData(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        media: [...(prev[roomId]?.media ?? []), media],
      },
    }))
  }

  const removePhoto = (roomId: string, mediaId: string) => {
    setRoomData(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        media: prev[roomId].media.filter(m => m.id !== mediaId),
      },
    }))
  }

  const toggleFurnishing = (item: { id: string; name: string; icon: string }, categoryId: string) => {
    setFurnishings(prev => {
      const exists = prev.find(f => f.itemId === item.id)
      if (exists) return prev.filter(f => f.itemId !== item.id)
      return [...prev, {
        id: `${item.id}_${Date.now()}`,
        itemId: item.id,
        itemName: item.name,
        itemIcon: item.icon,
        categoryId,
        quantity: 1,
      }]
    })
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setFurnishings(prev => prev.map(f =>
      f.itemId === itemId ? { ...f, quantity: Math.max(1, f.quantity + delta) } : f
    ))
  }

  const saveRecord = async () => {
    if (!user?.id || !propertyType) return
    setSaving(true)
    try {
      let recordId: string

      if (isEditing && editId) {
        // Update existing record
        const { error } = await supabase
          .from('vault_records')
          .update({
            property_type: propertyType,
            property_address: address,
            city,
            floors,
            furnishings,
            room_data: serializeRoomData(roomData),
          })
          .eq('id', editId)
        if (error) {
          Alert.alert('Error', error.message ?? 'Failed to update record')
          setSaving(false)
          return
        }
        recordId = editId
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('vault_records')
          .insert({
            user_id: user.id,
            property_type: propertyType,
            property_address: address,
            city,
            floors,
            furnishings,
            room_data: serializeRoomData(roomData),
            is_locked: false,
            creator_role: profile?.role ?? 'tenant',
            sharing_status: 'draft',
          })
          .select('id')
          .single()
        if (error || !data) {
          Alert.alert('Error', error?.message ?? 'Failed to save record')
          setSaving(false)
          return
        }
        recordId = data.id
      }

      // Upload all pending photos
      const allRooms = getAllRooms(floors)
      for (const room of allRooms) {
        const rd = roomData[room.instanceId]
        if (!rd?.media?.length) continue
        const uploads = await Promise.all(
          rd.media
            .filter(m => m.uploadStatus === 'pending')
            .map(m => uploadVaultPhoto(recordId, room.instanceId, m.url).then(result => ({ mediaId: m.id, result })))
        )
        for (const { mediaId, result } of uploads) {
          if (result) {
            const media = rd.media.find(m => m.id === mediaId)
            if (media) {
              media.url = result.url
              media.storagePath = result.storagePath
              media.uploadStatus = 'uploaded'
            }
          }
        }
      }

      // Final update with uploaded photo URLs
      await supabase
        .from('vault_records')
        .update({ room_data: serializeRoomData(roomData) })
        .eq('id', recordId)

      if (isEditing) {
        router.replace(`/vault/${recordId}`)
      } else {
        router.replace('/(tabs)/vault')
      }
    } catch (err) {
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
          <Text style={[Typography.subtitle, { color: c.text2 }]}>
            {step > 0 ? '← Back' : '← Cancel'}
          </Text>
        </Pressable>
        <Text style={[Typography.caption, { color: c.text3 }]}>
          {isEditing ? 'Edit Record · ' : ''}Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: c.bgSubtle }]}>
        <View style={[styles.progressFill, { backgroundColor: c.accent, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {step === 0 && <StepPropertyType selected={propertyType} onSelect={selectType} c={c} />}
        {step === 1 && <StepAddress address={address} setAddress={setAddress} city={city} setCity={setCity} c={c} />}
        {step === 2 && (
          <StepRooms
            floors={floors}
            onAddFloor={addFloor}
            onRemoveFloor={removeFloor}
            onAddExtra={addExtraFeature}
            onRemoveExtra={removeExtraRoom}
            roomData={roomData}
            c={c}
          />
        )}
        {step === 3 && (
          <StepPhotos
            floors={floors}
            roomData={roomData}
            onPickPhotos={pickPhotos}
            onTakePhoto={takePhoto}
            onRemovePhoto={removePhoto}
            c={c}
          />
        )}
        {step === 4 && (
          <StepFurnishings
            furnishings={furnishings}
            onToggle={toggleFurnishing}
            onUpdateQty={updateQuantity}
            c={c}
          />
        )}
      </ScrollView>

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
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[Typography.subtitle, { color: '#fff' }]}>{isEditing ? 'Save Changes' : 'Save as Draft'}</Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

// --- Step 1: Property Type ---
function StepPropertyType({ selected, onSelect, c }: { selected: PropertyType | null; onSelect: (t: PropertyType) => void; c: any }) {
  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Property Type</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
        Select the type of property you're documenting.
      </Text>
      <View style={styles.typeGrid}>
        {PROPERTY_TYPES.map(pt => (
          <Pressable
            key={pt.id}
            style={[
              styles.typeCard,
              { backgroundColor: selected === pt.id ? c.accent : c.bgSurface, borderColor: selected === pt.id ? c.accent : c.border },
            ]}
            onPress={() => onSelect(pt.id)}
          >
            <Text style={[Typography.title, { color: selected === pt.id ? '#fff' : c.text1 }]}>{pt.label}</Text>
            <Text style={[Typography.caption, { color: selected === pt.id ? 'rgba(255,255,255,0.7)' : c.text4 }]}>
              {pt.bedrooms === 0 ? 'Room + Kitchen' : `${pt.bedrooms} Bedroom${pt.bedrooms > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

// --- Step 2: Address ---
function StepAddress({ address, setAddress, city, setCity, c }: {
  address: string; setAddress: (s: string) => void
  city: string; setCity: (s: string) => void; c: any
}) {
  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Property Address</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
        Enter the address and select the city.
      </Text>
      <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Address</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. Flat 302, Tower B, Prestige Lakeside..."
        placeholderTextColor={c.text4}
        multiline
      />
      <Text style={[Typography.caption, { color: c.text2, marginTop: Spacing.base, marginBottom: Spacing.xs }]}>City</Text>
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
    </View>
  )
}

// --- Step 3: Rooms & Floors ---
function StepRooms({ floors, onAddFloor, onRemoveFloor, onAddExtra, onRemoveExtra, roomData, c }: {
  floors: VaultFloor[]
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
        Review rooms and add extra features like balcony, parking, etc.
      </Text>

      {floors.map((floor, fi) => (
        <View key={fi} style={[styles.floorSection, { borderColor: c.border }]}>
          <View style={styles.floorHeader}>
            <Text style={[Typography.subtitle, { color: c.text1 }]}>Floor {floor.index}</Text>
            {fi > 0 && (
              <Pressable onPress={() => onRemoveFloor(fi)}>
                <Text style={[Typography.caption, { color: c.red }]}>Remove</Text>
              </Pressable>
            )}
          </View>

          {/* Template rooms */}
          <View style={styles.roomGrid}>
            {floor.rooms.map(room => {
              const photoCount = roomData[room.instanceId]?.media?.length ?? 0
              return (
                <View key={room.instanceId} style={[styles.roomCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
                  <Text style={{ fontSize: 24 }}>{room.config.icon}</Text>
                  <Text style={[Typography.caption, { color: c.text2 }]} numberOfLines={1}>{room.config.name}</Text>
                  {photoCount > 0 && (
                    <View style={[styles.photoBadge, { backgroundColor: c.accent }]}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{photoCount}</Text>
                    </View>
                  )}
                </View>
              )
            })}
            {floor.extraRooms.map(room => (
              <View key={room.instanceId} style={[styles.roomCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
                <Pressable style={styles.removeRoom} onPress={() => onRemoveExtra(room.instanceId, fi)}>
                  <Text style={{ color: c.red, fontSize: 12, fontWeight: '700' }}>✕</Text>
                </Pressable>
                <Text style={{ fontSize: 24 }}>{room.config.icon}</Text>
                <Text style={[Typography.caption, { color: c.text2 }]} numberOfLines={1}>{room.config.name}</Text>
              </View>
            ))}
          </View>

          {/* Add extras */}
          <Text style={[Typography.caption, { color: c.text3, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>Add extra:</Text>
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
      ))}

      <Pressable style={[styles.addFloorBtn, { borderColor: c.border }]} onPress={onAddFloor}>
        <Text style={[Typography.caption, { color: c.accent }]}>+ Add Floor</Text>
      </Pressable>
    </View>
  )
}

// --- Step 4: Photos ---
function StepPhotos({ floors, roomData, onPickPhotos, onTakePhoto, onRemovePhoto, c }: {
  floors: VaultFloor[]
  roomData: Record<string, VaultRoom>
  onPickPhotos: (roomId: string) => void
  onTakePhoto: (roomId: string) => void
  onRemovePhoto: (roomId: string, mediaId: string) => void
  c: any
}) {
  const allRooms = getAllRooms(floors)
  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Room Photos</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
        Add photos for each room. You can use camera or pick from gallery.
      </Text>

      {allRooms.map(room => {
        const media = roomData[room.instanceId]?.media ?? []
        return (
          <View key={room.instanceId} style={[styles.photoSection, { borderColor: c.border }]}>
            <View style={styles.photoHeader}>
              <Text style={{ fontSize: 18 }}>{room.config.icon}</Text>
              <Text style={[Typography.subtitle, { color: c.text1, flex: 1 }]}>
                {room.config.name}
                <Text style={[Typography.caption, { color: c.text4 }]}> · Floor {room.floorIndex}</Text>
              </Text>
              <Text style={[Typography.caption, { color: c.text3 }]}>{media.length} photo{media.length !== 1 ? 's' : ''}</Text>
            </View>

            {/* Photo grid */}
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

            {/* Add photo buttons */}
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

// --- Step 5: Furnishings ---
function StepFurnishings({ furnishings, onToggle, onUpdateQty, c }: {
  furnishings: AddedFurnishing[]
  onToggle: (item: { id: string; name: string; icon: string }, categoryId: string) => void
  onUpdateQty: (itemId: string, delta: number) => void
  c: any
}) {
  const [activeCat, setActiveCat] = useState(FURNISHING_CATALOG[0].id)
  const selectedIds = new Set(furnishings.map(f => f.itemId))
  const category = FURNISHING_CATALOG.find(cat => cat.id === activeCat)

  return (
    <View>
      <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Furnishings & Assets</Text>
      <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.md }]}>
        Select items present in the property. {furnishings.length} item{furnishings.length !== 1 ? 's' : ''} selected.
      </Text>

      {/* Category tabs */}
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

      {/* Items grid */}
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
                <Text style={[Typography.caption, { color: isSelected ? '#fff' : c.text2, fontSize: 10 }]} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      {/* Selected items with quantity */}
      {furnishings.length > 0 && (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.sm }]}>Selected Items</Text>
          {furnishings.map(f => (
            <View key={f.id} style={[styles.selectedItem, { borderColor: c.border }]}>
              <Text style={{ fontSize: 16 }}>{f.itemIcon}</Text>
              <Text style={[Typography.caption, { color: c.text2, flex: 1 }]}>{f.itemName}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  progressBg: { height: 3 },
  progressFill: { height: 3 },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.base, paddingBottom: 100 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.base,
    borderTopWidth: 1,
  },
  nextBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  // Step 1
  typeGrid: { gap: Spacing.sm },
  typeCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.base,
    gap: 4,
  },
  // Step 2
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  cityChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  // Step 3
  floorSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  floorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  roomCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  photoBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: Radius.full,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeRoom: { position: 'absolute', top: 4, left: 4 },
  extraRow: { flexDirection: 'row', gap: Spacing.xs },
  extraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  addFloorBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  // Step 4
  photoSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  photoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  photoThumb: { width: 72, height: 72, borderRadius: Radius.sm, overflow: 'hidden', position: 'relative' },
  photoImg: { width: 72, height: 72 },
  photoDelete: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flexDirection: 'row', gap: Spacing.sm },
  photoBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1 },
  // Step 5
  catRow: { flexDirection: 'row', gap: Spacing.xs },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  itemCard: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: 4,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    paddingVertical: Spacing.sm,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
