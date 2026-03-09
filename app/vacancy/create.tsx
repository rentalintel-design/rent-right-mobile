import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Dimensions, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useMembership } from '@/hooks/useMembership'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { CITY_BOUNDS, FURNISHING_CATALOG } from 'rent-right-shared'
import { uploadVacancyPhoto } from '@/lib/vacancyStorage'
import LocationPickerSheet from '@/components/map/LocationPickerSheet'
import PaywallSheet from '@/components/PaywallSheet'

// Furnishing rooms: Living Room, Kitchen, Bedroom only (matching web)
const _LR = FURNISHING_CATALOG.find(c => c.id === 'living_room')!
const _KT = FURNISHING_CATALOG.find(c => c.id === 'kitchen')!
const _BD = FURNISHING_CATALOG.find(c => c.id === 'bedroom')!
const FURNISHING_ROOMS = [
  { id: 'living_room', name: 'Living Room / Hall', icon: '🛋️', items: _LR?.items ?? [] },
  { id: 'kitchen',     name: 'Kitchen',             icon: '🍳',  items: _KT?.items ?? [] },
  { id: 'bedroom',     name: 'Bedroom',             icon: '🛏️', items: _BD?.items ?? [] },
]

const CITIES = Object.keys(CITY_BOUNDS)
const BHK_OPTIONS = ['1BHK', '2BHK', '3BHK', '4BHK+']
const PROPERTY_TYPES = [
  { value: 'apartment',         label: '🏢 Apartment' },
  { value: 'villa',             label: '🏡 Villa' },
  { value: 'independent_house', label: '🏠 Indep. House' },
  { value: 'pg_hostel',         label: '🛏 PG / Hostel' },
]
const FURNISHING_OPTIONS = [
  { value: 'furnished',      label: '✨ Furnished' },
  { value: 'semi_furnished', label: '🪑 Semi-Furnished' },
  { value: 'unfurnished',    label: '📦 Unfurnished' },
]
const PREFERENCE_OPTIONS = ['Family', 'Bachelors', 'Working professionals', 'Any']

const MAX_PHOTOS = 8
const PHOTO_SIZE = (Dimensions.get('window').width - Spacing.base * 2 - Spacing.xs * 4) / 3

type LocalPhoto = { uri: string; storagePath?: string; url?: string }
type Pin = { lat: number; lng: number }
type ParkingVal = number | 'na' | null

function toYMD(d: Date): string { return d.toISOString().split('T')[0] }
function displayDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CreateVacancyScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>()
  const c = useColors()
  const { user, profile } = useAuth()
  const { canPostAsLandlord, refresh: refreshMembership } = useMembership(user?.id)

  // City
  const [city, setCity] = useState(profile?.city ?? 'Bengaluru')

  // Location
  const [pin, setPin] = useState<Pin | null>(null)
  const [societyName, setSocietyName] = useState<string | null>(null)
  const [societyId, setSocietyId] = useState<string | null>(null)
  const [pickerVisible, setPickerVisible] = useState(false)

  // Core
  const [bhkType, setBhkType] = useState<string | null>(null)
  const [askingRent, setAskingRent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [availableFrom, setAvailableFrom] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [contactPhone, setContactPhone] = useState(profile?.phone ?? '')

  // Details
  const [propertyType, setPropertyType] = useState<string | null>(null)
  const [furnishing, setFurnishing] = useState<string | null>(null)
  const [areaSqft, setAreaSqft] = useState('')
  const [parkingBike, setParkingBike] = useState<ParkingVal>(null)
  const [parkingCar, setParkingCar] = useState<ParkingVal>(null)
  const [landmark, setLandmark] = useState('')
  const [preference, setPreference] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')

  // Shared flat + furnishing items
  const [isSharedFlat, setIsSharedFlat] = useState(false)
  const [isFurnished, setIsFurnished] = useState(false)
  const [furnishings, setFurnishings] = useState<string[]>([])

  // Photos
  const [photos, setPhotos] = useState<LocalPhoto[]>([])

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitStage, setSubmitStage] = useState<'idle' | 'posting' | 'uploading'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)

  // Market rate nudge
  const [medianRent, setMedianRent] = useState<number | null>(null)
  const [medianCount, setMedianCount] = useState(0)

  // Check if user already has a draft
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('vacancies').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'draft')
      .then(({ count }) => setHasDraft((count ?? 0) >= 1))
  }, [user?.id])

  // Load existing vacancy for edit mode
  useEffect(() => {
    if (!editId) return
    supabase.from('vacancies').select('*').eq('id', editId).single()
      .then(({ data, error }) => {
        if (error || !data) { Alert.alert('Error', 'Could not load vacancy'); setLoadingEdit(false); return }
        setCity(data.city ?? city)
        setBhkType(data.bhk_type)
        setAskingRent(String(data.asking_rent))
        if (data.deposit) setDeposit(String(data.deposit))
        setContactPhone(data.contact_phone ?? '')
        setPropertyType(data.property_type ?? null)
        setFurnishing(data.furnishing ?? null)
        if (data.area_sqft) setAreaSqft(String(data.area_sqft))
        // Parking: 0 stored as 'na' (N/A means no parking)
        setParkingBike(data.parking_bike === 0 ? 'na' : (data.parking_bike ?? null))
        setParkingCar(data.parking_car === 0 ? 'na' : (data.parking_car ?? null))
        setLandmark(data.landmark ?? '')
        setPreference(data.preference ?? null)
        setDescription(data.description ?? '')
        setNotes(data.notes ?? '')
        if (data.lat && data.lng) setPin({ lat: data.lat, lng: data.lng })
        if (data.society_name) setSocietyName(data.society_name)
        if (data.society_id) setSocietyId(data.society_id)
        if (data.is_shared_flat) setIsSharedFlat(true)
        if (data.is_furnished) setIsFurnished(true)
        if (data.furnishing_items) setFurnishings(data.furnishing_items)
        if (data.available_from) setAvailableFrom(new Date(data.available_from))
        if (data.photos && Array.isArray(data.photos)) {
          setPhotos(data.photos.map((url: string) => ({ uri: url, url })))
        }
        setLoadingEdit(false)
      })
  }, [editId])

  // Market rate nudge
  useEffect(() => {
    setMedianRent(null); setMedianCount(0)
    if (!pin || !bhkType) return
    let cancelled = false
    const fetchMedian = async () => {
      const { data: nearbyProps } = await supabase.from('properties').select('id')
        .gte('lat', pin.lat - 0.009).lte('lat', pin.lat + 0.009)
        .gte('lng', pin.lng - 0.012).lte('lng', pin.lng + 0.012)
      if (cancelled || !nearbyProps || nearbyProps.length === 0) return
      const { data: subs } = await supabase.from('rent_submissions').select('rent_amount')
        .in('property_id', nearbyProps.map(p => p.id)).eq('bhk_type', bhkType)
      if (cancelled || !subs || subs.length < 5) return
      const sorted = subs.map(s => s.rent_amount).sort((a: number, b: number) => a - b)
      if (!cancelled) { setMedianRent(sorted[Math.floor(sorted.length / 2)]); setMedianCount(subs.length) }
    }
    fetchMedian()
    return () => { cancelled = true }
  }, [pin, bhkType])

  const rentNudge = useMemo(() => {
    if (!medianRent || !askingRent) return null
    const rent = parseInt(askingRent)
    if (!rent || rent <= 0) return null
    const diff = ((rent - medianRent) / medianRent) * 100
    const absDiff = Math.abs(diff)
    const formatted = `₹${medianRent.toLocaleString('en-IN')}`
    const dir = diff > 0 ? 'above' : 'below'
    if (absDiff <= 10) return { color: '#22c55e', label: `✓ Right at market rate · ${formatted}` }
    if (absDiff <= 25) return { color: '#eab308', label: `↑ ${Math.round(absDiff)}% ${dir} market · ${formatted}` }
    return { color: '#ef4444', label: `↑ ${Math.round(absDiff)}% ${dir} market · ${formatted}` }
  }, [medianRent, askingRent])

  // Validate
  const validate = (): boolean => {
    if (!pin)                       { setError('Pin your property location on the map'); return false }
    if (!bhkType)                   { setError('Select BHK type'); return false }
    if (!propertyType)              { setError('Select property type'); return false }
    if (!furnishing)                { setError('Select furnishing status'); return false }
    if (!askingRent || parseInt(askingRent) <= 0) { setError('Enter a valid asking rent'); return false }
    if (!preference)                { setError('Select tenant preference'); return false }
    if (!areaSqft || parseInt(areaSqft) <= 0)    { setError('Enter area in sq ft'); return false }
    if (parkingBike === null)       { setError('Select bike parking (tap N/A if none)'); return false }
    if (parkingCar === null)        { setError('Select car parking (tap N/A if none)'); return false }
    if (!landmark.trim())           { setError('Enter a nearby landmark'); return false }
    if (!description.trim())        { setError('Write a description'); return false }
    if (!contactPhone.trim())       { setError('Enter a WhatsApp number'); return false }
    if (photos.length === 0)        { setError('Add at least one photo'); return false }
    return true
  }

  // Photo handlers
  const pickPhotos = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) { Alert.alert('Limit', `Maximum ${MAX_PHOTOS} photos`); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length, quality: 0.8,
    })
    if (!result.canceled) setPhotos(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri }))])
  }, [photos.length])

  const takePhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) { Alert.alert('Limit', `Maximum ${MAX_PHOTOS} photos`); return }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera permission is required'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled) setPhotos(prev => [...prev, { uri: result.assets[0].uri }])
  }, [photos.length])

  const removePhoto = useCallback((i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i)), [])

  // Submit
  const handleSubmit = useCallback(async (status: 'active' | 'draft') => {
    if (!validate()) return
    setError(null)
    setSubmitStage('posting')
    setSubmitting(true)

    try {
      const now = Date.now()
      const vacancyData = {
        city,
        bhk_type: bhkType,
        asking_rent: parseInt(askingRent),
        deposit: deposit ? parseInt(deposit) : null,
        available_from: availableFrom ? toYMD(availableFrom) : null,
        contact_phone: contactPhone.trim(),
        notes: notes.trim() || null,
        lat: pin!.lat,
        lng: pin!.lng,
        is_shared_flat: isSharedFlat,
        is_furnished: isSharedFlat ? isFurnished : false,
        furnishing_items: isSharedFlat && isFurnished ? furnishings : [],
        society_id: societyId,
        society_name: societyName || null,
        source: 'user',
        user_id: user!.id,
        status,
        expires_at:       status === 'active' ? new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString() : null,
        draft_expires_at: status === 'draft'  ? new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        property_type: propertyType,
        furnishing,
        area_sqft: areaSqft ? parseInt(areaSqft) : null,
        parking_bike: parkingBike === 'na' ? 0 : (typeof parkingBike === 'number' ? parkingBike : null),
        parking_car:  parkingCar  === 'na' ? 0 : (typeof parkingCar  === 'number' ? parkingCar  : null),
        landmark: landmark.trim() || null,
        preference,
        description: description.trim() || null,
      }

      let vacancyId: string

      if (editId) {
        const { error: dbErr } = await supabase.from('vacancies').update(vacancyData)
          .eq('id', editId).eq('user_id', user!.id)
        if (dbErr) { setError(dbErr.message); return }
        vacancyId = editId
      } else {
        const { data, error: dbErr } = await supabase.from('vacancies')
          .insert(vacancyData).select('id').single()
        if (dbErr || !data) { setError(dbErr?.message ?? 'Failed to create vacancy'); return }
        vacancyId = data.id
        if (status === 'draft') setHasDraft(true)
        if (status === 'active') await refreshMembership?.()
      }

      // Upload new photos
      setSubmitStage('uploading')
      const newPhotos = photos.filter(p => !p.url)
      const existingUrls = photos.filter(p => p.url).map(p => p.url!)
      const uploadedUrls: string[] = [...existingUrls]
      for (const photo of newPhotos) {
        const result = await uploadVacancyPhoto(vacancyId, photo.uri)
        if (result) uploadedUrls.push(result.url)
      }
      if (uploadedUrls.length > 0) {
        await supabase.from('vacancies').update({ photos: uploadedUrls }).eq('id', vacancyId)
      }

      const msg = editId
        ? 'Vacancy updated successfully.'
        : status === 'draft'
          ? 'Saved as draft for 30 days. Publish from My Listings.'
          : 'Your vacancy is now live on the map!'
      Alert.alert(editId ? 'Updated' : status === 'draft' ? 'Draft Saved' : '🎉 Live!', msg,
        [{ text: 'OK', onPress: () => router.back() }])
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
      setSubmitStage('idle')
    }
  }, [user?.id, city, pin, bhkType, askingRent, deposit, availableFrom, contactPhone, notes,
      isSharedFlat, isFurnished, furnishings, societyId, societyName, propertyType, furnishing,
      areaSqft, parkingBike, parkingCar, landmark, preference, description, photos, editId])

  const handlePostClick = () => {
    if (!validate()) return
    setError(null)
    if (canPostAsLandlord) {
      handleSubmit('active')
    } else {
      setShowPaywall(true)
    }
  }

  const submitLabel =
    submitStage === 'uploading' ? `Uploading photos… (${photos.length})` :
    submitStage === 'posting'   ? 'Posting vacancy…' : ''

  // Date picker handler
  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false)
    if (event.type === 'dismissed') { setShowDatePicker(false); return }
    if (date) setAvailableFrom(date)
    if (Platform.OS === 'android') setShowDatePicker(false)
  }

  if (loadingEdit) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]}>
        <View style={s.center}><ActivityIndicator color={c.accent} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Cancel</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={[Typography.subtitle, { color: c.text1 }]}>{editId ? 'Edit Vacancy' : 'Post Vacancy'}</Text>
          {pin && societyName && (
            <Text style={[Typography.caption, { color: c.green, fontSize: 10 }]}>📍 {societyName}</Text>
          )}
        </View>
        {canPostAsLandlord && (
          <View style={[s.memberBadge, { backgroundColor: '#22c55e20' }]}>
            <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '700' }}>✓ Member</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.form} showsVerticalScrollIndicator={false}>

          {/* ── City ── */}
          <Field label="City" c={c}>
            <View style={s.chipRow}>
              {CITIES.map(ct => (
                <Chip key={ct} label={ct} selected={city === ct} onPress={() => setCity(ct)} c={c} small />
              ))}
            </View>
          </Field>

          {/* ── Location ── */}
          <Field label="Property Location *" c={c}>
            <Pressable
              style={[s.locationBtn, { backgroundColor: c.bgSurface, borderColor: pin ? c.accent : c.border }]}
              onPress={() => setPickerVisible(true)}
            >
              {pin ? (
                <View>
                  <Text style={[Typography.body, { color: c.text1, fontSize: 14 }]}>
                    📍 {societyName ?? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`}
                  </Text>
                  <Text style={[Typography.caption, { color: c.text4, fontSize: 10, marginTop: 2 }]}>Tap to change</Text>
                </View>
              ) : (
                <Text style={[Typography.body, { color: c.text4, fontSize: 14 }]}>📍 Tap to pin on map</Text>
              )}
            </Pressable>
          </Field>

          {/* ── BHK ── */}
          <Field label="BHK Type *" c={c}>
            <View style={s.chipRow}>
              {BHK_OPTIONS.map(opt => (
                <Chip key={opt} label={opt} selected={bhkType === opt} onPress={() => setBhkType(opt)} c={c} />
              ))}
            </View>
          </Field>

          {/* ── Property type ── */}
          <Field label="Property Type *" c={c}>
            <View style={s.chipRow}>
              {PROPERTY_TYPES.map(opt => (
                <Chip key={opt.value} label={opt.label}
                  selected={propertyType === opt.value}
                  onPress={() => setPropertyType(propertyType === opt.value ? null : opt.value)}
                  c={c} />
              ))}
            </View>
          </Field>

          {/* ── Furnishing status ── */}
          <Field label="Furnishing Status *" c={c}>
            <View style={s.chipRow}>
              {FURNISHING_OPTIONS.map(opt => (
                <Chip key={opt.value} label={opt.label}
                  selected={furnishing === opt.value}
                  onPress={() => setFurnishing(furnishing === opt.value ? null : opt.value)}
                  c={c} flex />
              ))}
            </View>
          </Field>

          {/* ── Shared flat ── */}
          <Field label="" c={c}>
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
              onPress={() => { setIsSharedFlat(!isSharedFlat); if (isSharedFlat) { setIsFurnished(false); setFurnishings([]) } }}
            >
              <View style={[s.checkbox, { backgroundColor: isSharedFlat ? c.accent : 'transparent', borderColor: isSharedFlat ? c.accent : c.border }]}>
                {isSharedFlat && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={[Typography.body, { color: c.text2, fontSize: 14 }]}>This is a shared flat</Text>
            </Pressable>
          </Field>

          {/* ── Shared flat: furnished? ── */}
          {isSharedFlat && (
            <Field label="Shared flat furnished?" c={c}>
              <View style={s.chipRow}>
                <Chip label="📦 Unfurnished" selected={!isFurnished}
                  onPress={() => { setIsFurnished(false); setFurnishings([]) }} c={c} flex />
                <Chip label="🛋️ Furnished" selected={isFurnished}
                  onPress={() => setIsFurnished(true)} c={c} flex />
              </View>
            </Field>
          )}

          {/* ── Asking rent + nudge ── */}
          <Field label="Asking Rent ₹/month *" c={c}>
            <View style={[s.inputRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              <Text style={[Typography.body, { color: c.text4 }]}>₹</Text>
              <TextInput
                style={[s.inputInline, { color: c.text1 }]}
                value={askingRent}
                onChangeText={t => setAskingRent(t.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 28000" placeholderTextColor={c.text4}
                keyboardType="numeric"
              />
            </View>
            {rentNudge && (
              <View style={[s.nudgeRow, { borderColor: rentNudge.color + '40' }]}>
                <View style={[s.nudgeDot, { backgroundColor: rentNudge.color }]} />
                <Text style={{ color: rentNudge.color, fontSize: 11, fontWeight: '600' }}>{rentNudge.label}</Text>
                <Text style={{ color: c.text4, fontSize: 10 }}>· {medianCount} nearby</Text>
              </View>
            )}
          </Field>

          {/* ── Deposit ── */}
          <Field label="Security Deposit ₹ (optional)" c={c}>
            <View style={[s.inputRow, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              <Text style={[Typography.body, { color: c.text4 }]}>₹</Text>
              <TextInput
                style={[s.inputInline, { color: c.text1 }]}
                value={deposit}
                onChangeText={t => setDeposit(t.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 84000" placeholderTextColor={c.text4}
                keyboardType="numeric"
              />
            </View>
          </Field>

          {/* ── Available from (date picker) ── */}
          <Field label="Available From (optional)" c={c}>
            <Pressable
              style={[s.dateTrigger, { backgroundColor: c.bgSurface, borderColor: c.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[Typography.body, { color: availableFrom ? c.text1 : c.text4, fontSize: 14 }]}>
                {availableFrom ? displayDate(availableFrom) : 'Select date'}
              </Text>
              <Text style={{ fontSize: 16 }}>📅</Text>
            </Pressable>
            {availableFrom && (
              <Pressable onPress={() => setAvailableFrom(null)}>
                <Text style={[Typography.caption, { color: c.text4, fontSize: 10, marginTop: 3 }]}>✕ Clear date</Text>
              </Pressable>
            )}
          </Field>

          {/* ── WhatsApp number ── */}
          <Field label="WhatsApp Number *" c={c}>
            <TextInput
              style={[s.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={contactPhone} onChangeText={setContactPhone}
              placeholder="+91 98765 43210" placeholderTextColor={c.text4}
              keyboardType="phone-pad"
            />
          </Field>

          {/* ── Tenant preference ── */}
          <Field label="Tenant Preference *" c={c}>
            <View style={s.chipRow}>
              {PREFERENCE_OPTIONS.map(opt => (
                <Chip key={opt} label={opt} selected={preference === opt}
                  onPress={() => setPreference(preference === opt ? null : opt)} c={c} />
              ))}
            </View>
          </Field>

          {/* ── Area ── */}
          <Field label="Area (sq ft) *" c={c}>
            <TextInput
              style={[s.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={areaSqft} onChangeText={t => setAreaSqft(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 1200" placeholderTextColor={c.text4}
              keyboardType="numeric"
            />
          </Field>

          {/* ── Parking (N/A + stepper) ── */}
          <Field label="Parking *" c={c}>
            <View style={{ flexDirection: 'row', gap: Spacing.xl }}>
              <ParkingRow label="🏍 Bike spots" value={parkingBike} onChange={setParkingBike} c={c} />
              <ParkingRow label="🚗 Car spots" value={parkingCar} onChange={setParkingCar} c={c} />
            </View>
          </Field>

          {/* ── Landmark ── */}
          <Field label="Nearby Landmark *" c={c}>
            <TextInput
              style={[s.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={landmark} onChangeText={setLandmark}
              placeholder="e.g. Near Phoenix Mall, 200m from metro"
              placeholderTextColor={c.text4}
            />
          </Field>

          {/* ── Description ── */}
          <Field label="Description *" c={c}>
            <TextInput
              style={[s.input, s.multiline, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={description}
              onChangeText={t => setDescription(t.slice(0, 600))}
              placeholder="e.g. Spacious 2BHK on 4th floor, great cross ventilation, modular kitchen…"
              placeholderTextColor={c.text4}
              multiline numberOfLines={4}
            />
            <Text style={[Typography.caption, { color: c.text4, textAlign: 'right', fontSize: 10, marginTop: 2 }]}>
              {description.length}/600
            </Text>
          </Field>

          {/* ── Notes ── */}
          <Field label="Notes (optional, max 200)" c={c}>
            <TextInput
              style={[s.input, s.multiline, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1, minHeight: 60 }]}
              value={notes}
              onChangeText={t => setNotes(t.slice(0, 200))}
              placeholder="e.g. Parking available, no pets, society has gym…"
              placeholderTextColor={c.text4}
              multiline numberOfLines={3}
            />
            <Text style={[Typography.caption, { color: c.text4, textAlign: 'right', fontSize: 10, marginTop: 2 }]}>
              {notes.length}/200
            </Text>
          </Field>

          {/* ── Photos ── */}
          <Field label={`Photos * (at least 1, max ${MAX_PHOTOS})`} c={c}>
            {photos.length > 0 && (
              <View style={s.photoGrid}>
                {photos.map((photo, i) => (
                  <View key={i} style={{ position: 'relative' }}>
                    <Image source={{ uri: photo.url ?? photo.uri }}
                      style={[s.photo, { width: PHOTO_SIZE, height: PHOTO_SIZE }]} resizeMode="cover" />
                    <Pressable style={s.removePhoto} onPress={() => removePhoto(i)}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {photos.length < MAX_PHOTOS && (
              <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: photos.length > 0 ? Spacing.xs : 0 }}>
                <Pressable style={[s.addPhotoBtn, { flex: 1, backgroundColor: c.bgSubtle, borderColor: c.border }]} onPress={pickPhotos}>
                  <Text style={[Typography.caption, { color: c.text3, fontSize: 12 }]}>📁 Gallery</Text>
                </Pressable>
                <Pressable style={[s.addPhotoBtn, { flex: 1, backgroundColor: c.bgSubtle, borderColor: c.border }]} onPress={takePhoto}>
                  <Text style={[Typography.caption, { color: c.text3, fontSize: 12 }]}>📷 Camera</Text>
                </Pressable>
              </View>
            )}
          </Field>

          {/* ── Furnishing items (shared flat + furnished only) ── */}
          {isSharedFlat && isFurnished && (
            <Field label="Furnishings Available" c={c}>
              {FURNISHING_ROOMS.map(room => (
                <View key={room.id} style={{ marginBottom: Spacing.md }}>
                  <Text style={[Typography.caption, { color: c.text3, fontSize: 11, fontWeight: '700', marginBottom: Spacing.xs }]}>
                    {room.icon} {room.name}
                  </Text>
                  <View style={s.chipRow}>
                    {room.items.map(item => {
                      const sel = furnishings.includes(item.id)
                      return (
                        <Pressable
                          key={item.id}
                          style={[s.itemChip, {
                            backgroundColor: sel ? c.accent + '22' : c.bgSubtle,
                            borderColor: sel ? c.accent : c.border,
                          }]}
                          onPress={() => setFurnishings(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                        >
                          <Text style={{ fontSize: 11, color: sel ? c.accent : c.text3, fontWeight: sel ? '700' : '500' }}>
                            {item.icon} {item.name}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ))}
            </Field>
          )}

          {/* ── Error ── */}
          {error && (
            <View style={[s.errorBox, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]}>
              <Text style={{ color: '#ef4444', fontSize: 13 }}>⚠️ {error}</Text>
            </View>
          )}

          {/* ── Actions ── */}
          <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
            <Pressable
              style={[s.primaryBtn, { backgroundColor: submitting ? c.bgSubtle : c.accent, opacity: submitting ? 0.6 : 1 }]}
              onPress={handlePostClick}
              disabled={submitting}
            >
              {submitting ? (
                <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[Typography.subtitle, { color: '#fff' }]}>{submitLabel}</Text>
                </View>
              ) : (
                <Text style={[Typography.subtitle, { color: '#fff' }]}>
                  {canPostAsLandlord ? '🚀 Post Vacancy' : '🔒 Post Vacancy · Membership required'}
                </Text>
              )}
            </Pressable>

            {!editId && (
              <Pressable
                style={[s.secondaryBtn, { backgroundColor: c.bgSubtle, borderColor: c.border, opacity: (submitting || hasDraft) ? 0.5 : 1 }]}
                onPress={() => handleSubmit('draft')}
                disabled={submitting || hasDraft}
              >
                <Text style={[Typography.subtitle, { color: hasDraft ? c.text4 : c.text3, fontSize: 14 }]}>
                  {hasDraft ? '📋 Draft limit reached' : '💾 Save as Draft'}
                </Text>
              </Pressable>
            )}

            <Text style={[Typography.caption, { color: c.text4, textAlign: 'center', fontSize: 10 }]}>
              {hasDraft
                ? 'You already have a draft. Post it to save a new one.'
                : 'Drafts saved for 30 days · pay anytime to go live'}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location picker modal */}
      <LocationPickerSheet
        visible={pickerVisible}
        city={city}
        initialPin={pin}
        onConfirm={(p, sName, sId) => { setPin(p); setSocietyName(sName); setSocietyId(sId); setPickerVisible(false) }}
        onClose={() => setPickerVisible(false)}
      />

      {/* Date picker — Available from */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <View style={[s.iosDateSheet, { backgroundColor: c.bgSurface, borderTopColor: c.border }]}>
            <View style={[s.iosDateHeader, { borderBottomColor: c.border }]}>
              <Text style={[Typography.subtitle, { color: c.text3 }]}>Available From</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Text style={[Typography.subtitle, { color: c.accent }]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={availableFrom ?? new Date()}
              mode="date" display="spinner"
              onChange={onDateChange}
              minimumDate={new Date()}
              themeVariant="dark"
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : (
          <DateTimePicker
            value={availableFrom ?? new Date()}
            mode="date" display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )
      )}
      <PaywallSheet
        visible={showPaywall}
        feature="Posting vacancies"
        role="landlord"
        city={city}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => {
          setShowPaywall(false)
          refreshMembership()
          // After payment success, auto-post
          handleSubmit('active')
        }}
      />
    </SafeAreaView>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children, c }: { label: string; children: React.ReactNode; c: any }) {
  if (!label) return <View style={{ marginBottom: Spacing.lg }}>{children}</View>
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.text2, marginBottom: Spacing.xs }}>
        {label}
      </Text>
      {children}
    </View>
  )
}

function Chip({ label, selected, onPress, c, small, flex }: {
  label: string; selected: boolean; onPress: () => void; c: any; small?: boolean; flex?: boolean
}) {
  return (
    <Pressable
      style={[{
        borderRadius: Radius.full, borderWidth: 2,
        paddingHorizontal: small ? Spacing.sm : Spacing.md,
        paddingVertical: small ? 4 : Spacing.xs,
        backgroundColor: selected ? c.accent + '22' : c.bgSubtle,
        borderColor: selected ? c.accent : c.border,
        flex: flex ? 1 : undefined,
        alignItems: flex ? 'center' : undefined,
      }]}
      onPress={onPress}
    >
      <Text style={{ fontSize: small ? 11 : 13, fontWeight: '600', color: selected ? c.accent : c.text3 }}>
        {label}
      </Text>
    </Pressable>
  )
}

function ParkingRow({ label, value, onChange, c }: {
  label: string; value: ParkingVal; onChange: (v: ParkingVal) => void; c: any
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: c.text4, marginBottom: Spacing.xs }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        <Pressable
          style={[s.naBtn, {
            backgroundColor: value === 'na' ? c.accent + '22' : c.bgSubtle,
            borderColor: value === 'na' ? c.accent : c.border,
          }]}
          onPress={() => onChange(value === 'na' ? 0 : 'na')}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: value === 'na' ? c.accent : c.text3 }}>N/A</Text>
        </Pressable>
        <Pressable
          style={[s.stepBtn, { backgroundColor: c.bgSubtle, opacity: (value === 'na' || value === null || value === 0) ? 0.3 : 1 }]}
          onPress={() => typeof value === 'number' && onChange(Math.max(0, value - 1))}
          disabled={value === 'na' || value === null || value === 0}
        >
          <Text style={{ color: c.text2, fontWeight: '700' }}>−</Text>
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text1, minWidth: 22, textAlign: 'center' }}>
          {value === null ? '—' : value === 'na' ? 'N/A' : value}
        </Text>
        <Pressable
          style={[s.stepBtn, { backgroundColor: c.bgSubtle, opacity: value === 'na' ? 0.3 : 1 }]}
          onPress={() => onChange(typeof value === 'number' ? value + 1 : 1)}
          disabled={value === 'na'}
        >
          <Text style={{ color: c.text2, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
  memberBadge: { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  form: { padding: Spacing.base, paddingBottom: 40 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },

  input: { borderWidth: 2, borderRadius: Radius.md, padding: Spacing.md, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs,
  },
  inputInline: { flex: 1, fontSize: 15, paddingVertical: 2 },

  locationBtn: { borderWidth: 2, borderRadius: Radius.md, padding: Spacing.md },
  dateTrigger: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 2, borderRadius: Radius.md, padding: Spacing.md,
  },

  nudgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginTop: Spacing.xs, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  nudgeDot: { width: 7, height: 7, borderRadius: 4 },

  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  naBtn: { borderWidth: 2, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  stepBtn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  photo: { borderRadius: Radius.sm },
  removePhoto: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  addPhotoBtn: {
    borderWidth: 1, borderRadius: Radius.sm, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md,
  },

  itemChip: {
    borderWidth: 1.5, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 5, marginBottom: 2,
  },

  errorBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },

  primaryBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.base, alignItems: 'center' },
  secondaryBtn: {
    borderRadius: Radius.lg, paddingVertical: Spacing.md,
    alignItems: 'center', borderWidth: 1,
  },

  iosDateSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, paddingBottom: 24,
  },
  iosDateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
})
