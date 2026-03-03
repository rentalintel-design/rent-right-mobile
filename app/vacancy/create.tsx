import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { useMembership } from '@/hooks/useMembership'
import { Typography, Spacing, Radius } from '@/constants/theme'
import { CITY_BOUNDS } from 'rent-right-shared'
import { uploadVacancyPhoto, deleteVacancyPhoto } from '@/lib/vacancyStorage'

const CITIES = Object.keys(CITY_BOUNDS)
const BHK_OPTIONS = ['1BHK', '2BHK', '3BHK', '4BHK+']
const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'independent_house', label: 'Indep. House' },
  { value: 'pg_hostel', label: 'PG/Hostel' },
]
const FURNISHING_OPTIONS = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'semi_furnished', label: 'Semi' },
  { value: 'unfurnished', label: 'Unfurnished' },
]

const MAX_PHOTOS = 5
const PHOTO_SIZE = (Dimensions.get('window').width - Spacing.base * 2 - Spacing.xs * 3) / 4

type LocalPhoto = { uri: string; storagePath?: string; url?: string }

export default function CreateVacancyScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>()
  const c = useColors()
  const { user, profile } = useAuth()
  const { canPostAsLandlord, refresh: refreshMembership } = useMembership(user?.id)

  // Form state
  const [city, setCity] = useState(profile?.city ?? 'Bengaluru')
  const [address, setAddress] = useState('')
  const [bhkType, setBhkType] = useState<string | null>(null)
  const [askingRent, setAskingRent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [availableNow, setAvailableNow] = useState(true)
  const [availableFrom, setAvailableFrom] = useState('')
  const [contactPhone, setContactPhone] = useState(profile?.phone ?? '')
  const [propertyType, setPropertyType] = useState<string | null>(null)
  const [furnishing, setFurnishing] = useState<string | null>(null)
  const [areaSqft, setAreaSqft] = useState('')
  const [parkingBike, setParkingBike] = useState(0)
  const [parkingCar, setParkingCar] = useState(0)
  const [landmark, setLandmark] = useState('')
  const [preference, setPreference] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<LocalPhoto[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)

  // Load existing vacancy for edit mode
  useEffect(() => {
    if (!editId) return
    supabase
      .from('vacancies')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          Alert.alert('Error', 'Could not load vacancy')
          setLoadingEdit(false)
          return
        }
        setCity(data.city ?? city)
        setAddress(data.notes ?? '')
        setBhkType(data.bhk_type)
        setAskingRent(String(data.asking_rent))
        if (data.deposit) setDeposit(String(data.deposit))
        setContactPhone(data.contact_phone ?? '')
        setPropertyType(data.property_type ?? null)
        setFurnishing(data.furnishing ?? null)
        if (data.area_sqft) setAreaSqft(String(data.area_sqft))
        setParkingBike(data.parking_bike ?? 0)
        setParkingCar(data.parking_car ?? 0)
        setLandmark(data.landmark ?? '')
        setPreference(data.preference ?? '')
        setDescription(data.description ?? '')
        if (data.available_from) {
          setAvailableNow(false)
          setAvailableFrom(data.available_from)
        }
        if (data.photos && Array.isArray(data.photos)) {
          setPhotos(data.photos.map((url: string) => ({ uri: url, url })))
        }
        setLoadingEdit(false)
      })
  }, [editId])

  const canSubmit = bhkType && askingRent && parseInt(askingRent) >= 1000 && contactPhone.length >= 10

  const pickPhotos = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit', `Maximum ${MAX_PHOTOS} photos`)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    })
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri }))])
    }
  }, [photos.length])

  const takePhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit', `Maximum ${MAX_PHOTOS} photos`)
      return
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled) {
      setPhotos(prev => [...prev, { uri: result.assets[0].uri }])
    }
  }, [photos.length])

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !canSubmit) return
    const rent = parseInt(askingRent)
    if (rent < 1000 || rent > 500000) {
      Alert.alert('Invalid rent', 'Rent must be between ₹1,000 and ₹5,00,000')
      return
    }

    setSubmitting(true)
    try {
      const cityBounds = CITY_BOUNDS[city as keyof typeof CITY_BOUNDS]
      const lat = cityBounds ? (cityBounds.south + cityBounds.north) / 2 : 0
      const lng = cityBounds ? (cityBounds.west + cityBounds.east) / 2 : 0
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const vacancyData = {
        city,
        bhk_type: bhkType,
        asking_rent: rent,
        deposit: deposit ? parseInt(deposit) : null,
        available_from: availableNow ? null : availableFrom || null,
        contact_phone: contactPhone,
        property_type: propertyType,
        furnishing,
        area_sqft: areaSqft ? parseInt(areaSqft) : null,
        parking_bike: parkingBike || null,
        parking_car: parkingCar || null,
        landmark: landmark || null,
        preference: preference || null,
        description: description || null,
        notes: address || null,
        lat,
        lng,
        user_id: user.id,
        source: 'user',
      }

      let vacancyId: string

      if (editId) {
        const { error } = await supabase
          .from('vacancies')
          .update(vacancyData)
          .eq('id', editId)
          .eq('user_id', user.id)
        if (error) {
          Alert.alert('Error', error.message)
          setSubmitting(false)
          return
        }
        vacancyId = editId
      } else {
        const { data, error } = await supabase
          .from('vacancies')
          .insert({ ...vacancyData, status: 'draft', expires_at: expiresAt })
          .select('id')
          .single()
        if (error || !data) {
          Alert.alert('Error', error?.message ?? 'Failed to create vacancy')
          setSubmitting(false)
          return
        }
        vacancyId = data.id
      }

      // Upload new photos (those without a url already)
      const newPhotos = photos.filter(p => !p.url)
      const existingUrls = photos.filter(p => p.url).map(p => p.url!)
      const uploadedUrls: string[] = [...existingUrls]

      for (const photo of newPhotos) {
        const result = await uploadVacancyPhoto(vacancyId, photo.uri)
        if (result) uploadedUrls.push(result.url)
      }

      if (uploadedUrls.length > 0) {
        await supabase
          .from('vacancies')
          .update({ photos: uploadedUrls })
          .eq('id', vacancyId)
      }

      Alert.alert(
        editId ? 'Updated' : 'Saved as Draft',
        editId ? 'Vacancy updated successfully.' : 'Your vacancy has been saved as a draft. Publish it from My Listings.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch {
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [user?.id, canSubmit, city, address, bhkType, askingRent, deposit, availableNow, availableFrom, contactPhone, propertyType, furnishing, areaSqft, parkingBike, parkingCar, landmark, preference, description, photos, editId])

  if (loadingEdit) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]}>
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>← Cancel</Text>
        </Pressable>
        <Text style={[Typography.subtitle, { color: c.text1 }]}>{editId ? 'Edit Vacancy' : 'Post Vacancy'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          {/* City */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>City</Text>
            <View style={styles.chipRow}>
              {CITIES.map(ct => (
                <Pressable
                  key={ct}
                  style={[styles.chip, { backgroundColor: city === ct ? c.accent : c.bgSubtle, borderColor: city === ct ? c.accent : c.border }]}
                  onPress={() => setCity(ct)}
                >
                  <Text style={[Typography.caption, { color: city === ct ? '#fff' : c.text3, fontSize: 11 }]}>{ct}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Address */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Society / Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Prestige Lakeside Habitat"
              placeholderTextColor={c.text4}
            />
          </View>

          {/* BHK */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>BHK Type *</Text>
            <View style={styles.chipRow}>
              {BHK_OPTIONS.map(opt => (
                <Pressable
                  key={opt}
                  style={[styles.chip, { backgroundColor: bhkType === opt ? c.accent : c.bgSubtle, borderColor: bhkType === opt ? c.accent : c.border }]}
                  onPress={() => setBhkType(opt)}
                >
                  <Text style={[Typography.caption, { color: bhkType === opt ? '#fff' : c.text2 }]}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Rent */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Asking Rent (₹) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={askingRent}
              onChangeText={t => setAskingRent(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 25000"
              placeholderTextColor={c.text4}
              keyboardType="numeric"
            />
          </View>

          {/* Deposit */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Deposit (₹)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={deposit}
              onChangeText={t => setDeposit(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 100000"
              placeholderTextColor={c.text4}
              keyboardType="numeric"
            />
          </View>

          {/* Available from */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Available From</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, { backgroundColor: availableNow ? c.accent : c.bgSubtle, borderColor: availableNow ? c.accent : c.border }]}
                onPress={() => setAvailableNow(true)}
              >
                <Text style={[Typography.caption, { color: availableNow ? '#fff' : c.text2 }]}>Now</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, { backgroundColor: !availableNow ? c.accent : c.bgSubtle, borderColor: !availableNow ? c.accent : c.border }]}
                onPress={() => setAvailableNow(false)}
              >
                <Text style={[Typography.caption, { color: !availableNow ? '#fff' : c.text2 }]}>Pick Date</Text>
              </Pressable>
            </View>
            {!availableNow && (
              <TextInput
                style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1, marginTop: Spacing.xs }]}
                value={availableFrom}
                onChangeText={setAvailableFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={c.text4}
              />
            )}
          </View>

          {/* Contact phone */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Contact Phone *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="10-digit phone"
              placeholderTextColor={c.text4}
              keyboardType="phone-pad"
            />
          </View>

          {/* Property type */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Property Type</Text>
            <View style={styles.chipRow}>
              {PROPERTY_TYPES.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.chip, { backgroundColor: propertyType === opt.value ? c.accent : c.bgSubtle, borderColor: propertyType === opt.value ? c.accent : c.border }]}
                  onPress={() => setPropertyType(propertyType === opt.value ? null : opt.value)}
                >
                  <Text style={[Typography.caption, { color: propertyType === opt.value ? '#fff' : c.text2, fontSize: 11 }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Furnishing */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Furnishing</Text>
            <View style={styles.chipRow}>
              {FURNISHING_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.chip, { backgroundColor: furnishing === opt.value ? c.accent : c.bgSubtle, borderColor: furnishing === opt.value ? c.accent : c.border }]}
                  onPress={() => setFurnishing(furnishing === opt.value ? null : opt.value)}
                >
                  <Text style={[Typography.caption, { color: furnishing === opt.value ? '#fff' : c.text2 }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Area */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Area (sq ft)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={areaSqft}
              onChangeText={t => setAreaSqft(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 1200"
              placeholderTextColor={c.text4}
              keyboardType="numeric"
            />
          </View>

          {/* Parking */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Parking</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Text style={[Typography.caption, { color: c.text3 }]}>🏍️</Text>
                <Pressable style={[styles.stepperBtn, { backgroundColor: c.bgSubtle }]} onPress={() => setParkingBike(Math.max(0, parkingBike - 1))}>
                  <Text style={{ color: c.text2 }}>−</Text>
                </Pressable>
                <Text style={[Typography.body, { color: c.text1, minWidth: 20, textAlign: 'center' }]}>{parkingBike}</Text>
                <Pressable style={[styles.stepperBtn, { backgroundColor: c.bgSubtle }]} onPress={() => setParkingBike(parkingBike + 1)}>
                  <Text style={{ color: c.text2 }}>+</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Text style={[Typography.caption, { color: c.text3 }]}>🚗</Text>
                <Pressable style={[styles.stepperBtn, { backgroundColor: c.bgSubtle }]} onPress={() => setParkingCar(Math.max(0, parkingCar - 1))}>
                  <Text style={{ color: c.text2 }}>−</Text>
                </Pressable>
                <Text style={[Typography.body, { color: c.text1, minWidth: 20, textAlign: 'center' }]}>{parkingCar}</Text>
                <Pressable style={[styles.stepperBtn, { backgroundColor: c.bgSubtle }]} onPress={() => setParkingCar(parkingCar + 1)}>
                  <Text style={{ color: c.text2 }}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Landmark */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Landmark</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={landmark}
              onChangeText={setLandmark}
              placeholder="e.g. Near Manyata Tech Park"
              placeholderTextColor={c.text4}
            />
          </View>

          {/* Preference */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Tenant Preference</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={preference}
              onChangeText={setPreference}
              placeholder="e.g. Family preferred, No pets"
              placeholderTextColor={c.text4}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the property..."
              placeholderTextColor={c.text4}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Photos */}
          <View style={styles.field}>
            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <Image source={{ uri: photo.url ?? photo.uri }} style={[styles.photo, { width: PHOTO_SIZE, height: PHOTO_SIZE }]} resizeMode="cover" />
                  <Pressable style={styles.removePhoto} onPress={() => removePhoto(i)}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <View style={{ gap: Spacing.xs }}>
                  <Pressable style={[styles.addPhotoBtn, { width: PHOTO_SIZE, height: PHOTO_SIZE / 2 - 2, backgroundColor: c.bgSubtle, borderColor: c.border }]} onPress={pickPhotos}>
                    <Text style={[Typography.caption, { color: c.text3, fontSize: 10 }]}>📁 Gallery</Text>
                  </Pressable>
                  <Pressable style={[styles.addPhotoBtn, { width: PHOTO_SIZE, height: PHOTO_SIZE / 2 - 2, backgroundColor: c.bgSubtle, borderColor: c.border }]} onPress={takePhoto}>
                    <Text style={[Typography.caption, { color: c.text3, fontSize: 10 }]}>📷 Camera</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit */}
      <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bgPage }]}>
        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit ? c.accent : c.bgSubtle }]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[Typography.subtitle, { color: canSubmit ? '#fff' : c.text4 }]}>
              {editId ? 'Save Changes' : 'Save as Draft'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  form: { padding: Spacing.base, paddingBottom: 100 },
  field: { marginBottom: Spacing.lg },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  photo: { borderRadius: Radius.sm },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.base,
    borderTopWidth: 1,
  },
  submitBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
})
