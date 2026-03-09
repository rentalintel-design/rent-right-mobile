import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'
import {
  CITY_BOUNDS, FURNISHING_CATALOG, PLAN_CITIES, CITY_LABELS,
} from 'rent-right-shared'
import LocationPickerSheet from '@/components/map/LocationPickerSheet'

const CITIES = PLAN_CITIES.map(c => c.name)
const BHK_OPTIONS = ['1BHK', '2BHK', '3BHK', '4BHK+']
const DEPOSIT_OPTIONS = [
  { value: 'full', label: 'Full returned', emoji: '✅', color: '#22c55e' },
  { value: 'partial', label: 'Partial returned', emoji: '🤝', color: '#eab308' },
  { value: 'none', label: 'Not returned', emoji: '❌', color: '#ef4444' },
]

const STEPS = ['Location', 'Rent', 'Flat Details', 'Deposit', 'Review']

export default function SubmitContributionScreen() {
  const c = useColors()
  const { user, profile, refreshProfile } = useAuth()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Step 0: Location
  const [city, setCity] = useState(profile?.city ?? 'bengaluru')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [societyName, setSocietyName] = useState<string | null>(null)
  const [societyId, setSocietyId] = useState<string | null>(null)
  const [propertyName, setPropertyName] = useState('')
  const [mapPickerVisible, setMapPickerVisible] = useState(false)

  // Step 1: BHK & Rent
  const [bhkType, setBhkType] = useState<string | null>(null)
  const [rentAmount, setRentAmount] = useState('')
  const [marketRate, setMarketRate] = useState<{ median: number; count: number } | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)

  // Step 2: Shared flat & furnishing
  const [isSharedFlat, setIsSharedFlat] = useState(false)
  const [isFurnished, setIsFurnished] = useState(false)
  const [furnishings, setFurnishings] = useState<string[]>([]) // item IDs
  const [activeCat, setActiveCat] = useState(FURNISHING_CATALOG[0]?.id ?? '')

  // Step 3: Deposit
  const [depositPaid, setDepositPaid] = useState('')
  const [depositReturned, setDepositReturned] = useState('')
  const [depositOutcome, setDepositOutcome] = useState<string | null>(null)

  // Market rate nudge
  useEffect(() => {
    if (!lat || !lng || !bhkType) { setMarketRate(null); return }
    setLoadingRate(true)
    const delta = 0.009
    supabase
      .from('properties')
      .select('id')
      .gte('lat', lat - delta).lte('lat', lat + delta)
      .gte('lng', lng - delta).lte('lng', lng + delta)
      .limit(200)
      .then(({ data: props }) => {
        if (!props?.length) { setMarketRate(null); setLoadingRate(false); return }
        const ids = props.map(p => p.id)
        supabase
          .from('rent_submissions')
          .select('rent_amount')
          .in('property_id', ids)
          .eq('bhk_type', bhkType)
          .then(({ data: subs }) => {
            if (subs && subs.length >= 5) {
              const sorted = subs.map(s => s.rent_amount).sort((a, b) => a - b)
              const median = sorted[Math.floor(sorted.length / 2)]
              setMarketRate({ median, count: subs.length })
            } else {
              setMarketRate(null)
            }
            setLoadingRate(false)
          })
      })
  }, [lat, lng, bhkType])

  const canNext = () => {
    if (step === 0) return (lat !== null && lng !== null) || propertyName.trim().length > 0
    if (step === 1) return !!bhkType && !!rentAmount && parseInt(rentAmount) >= 1000
    return true
  }

  const toggleFurnishing = (itemId: string) => {
    setFurnishings(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    )
  }

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !bhkType || !rentAmount) return
    const rent = parseInt(rentAmount)
    if (rent < 1000 || rent > 500000) {
      Alert.alert('Invalid rent', 'Rent must be between ₹1,000 and ₹5,00,000')
      return
    }

    setSubmitting(true)
    try {
      // 1. Find or create property
      let propertyId: string
      const name = societyName ?? propertyName.trim()

      if (lat && lng) {
        // Try to find existing property nearby with same name
        const { data: existing } = await supabase
          .from('properties')
          .select('id')
          .ilike('name', name || '%')
          .eq('city', city)
          .limit(1)
          .maybeSingle()

        if (existing) {
          propertyId = existing.id
        } else {
          const { data: newProp, error: propErr } = await supabase
            .from('properties')
            .insert({ name: name || `${bhkType} near ${city}`, city, lat, lng })
            .select('id')
            .single()
          if (propErr || !newProp) { Alert.alert('Error', propErr?.message ?? 'Failed'); setSubmitting(false); return }
          propertyId = newProp.id
        }
      } else {
        // Fallback: name-based lookup with city center
        const { data: existing } = await supabase
          .from('properties')
          .select('id')
          .ilike('name', name)
          .eq('city', city)
          .limit(1)
          .maybeSingle()

        if (existing) {
          propertyId = existing.id
        } else {
          const bounds = CITY_BOUNDS[city as keyof typeof CITY_BOUNDS]
          const cLat = bounds ? (bounds.south + bounds.north) / 2 : 0
          const cLng = bounds ? (bounds.west + bounds.east) / 2 : 0
          const { data: newProp, error: propErr } = await supabase
            .from('properties')
            .insert({ name, city, lat: cLat, lng: cLng })
            .select('id')
            .single()
          if (propErr || !newProp) { Alert.alert('Error', propErr?.message ?? 'Failed'); setSubmitting(false); return }
          propertyId = newProp.id
        }
      }

      // 2. Insert rent submission
      // Build furnishing items array with names
      const furnishingItems = isSharedFlat && isFurnished
        ? FURNISHING_CATALOG.flatMap(cat =>
            cat.items.filter(item => furnishings.includes(item.id)).map(item => ({
              id: item.id, name: item.name, icon: item.icon, categoryId: cat.id,
            }))
          )
        : []

      const { error: subErr } = await supabase.from('rent_submissions').insert({
        property_id: propertyId,
        city,
        bhk_type: bhkType,
        rent_amount: rent,
        is_shared_flat: isSharedFlat,
        is_furnished: isSharedFlat ? isFurnished : false,
        furnishing_items: furnishingItems,
        user_id: user.id,
      })
      if (subErr) { Alert.alert('Error', subErr.message); setSubmitting(false); return }

      // 3. Insert deposit submission (if answered)
      if (depositOutcome) {
        await supabase.from('deposit_submissions').insert({
          property_id: propertyId,
          outcome: depositOutcome,
          deposit_paid: depositPaid ? Number(depositPaid) : null,
          deposit_returned: depositReturned ? Number(depositReturned) : null,
        })
      }

      // 4. Mark as contributor
      if (!profile?.has_contributed) {
        await supabase.from('profiles').update({ has_contributed: true }).eq('user_id', user.id)
        await refreshProfile()
      }

      setSuccess(true)
    } catch {
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [user?.id, city, lat, lng, societyName, propertyName, bhkType, rentAmount,
      isSharedFlat, isFurnished, furnishings, depositOutcome, depositPaid, depositReturned,
      profile, refreshProfile])

  // ── Success screen ──
  if (success) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: c.bgPage }]}>
        <View style={st.successContainer}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={[Typography.title, { color: c.text1, textAlign: 'center' }]}>Thank you!</Text>
          <Text style={[Typography.body, { color: c.text3, textAlign: 'center' }]}>
            Your rent data has been submitted and will appear on the map shortly.
          </Text>
          {!profile?.has_contributed && (
            <Text style={[Typography.caption, { color: c.green, textAlign: 'center' }]}>
              Fine rent grid is now unlocked for you!
            </Text>
          )}
          <Pressable style={[st.doneBtn, { backgroundColor: c.accent }]} onPress={() => router.back()}>
            <Text style={[Typography.subtitle, { color: '#fff' }]}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const rent = parseInt(rentAmount) || 0
  const ratePct = marketRate && rent > 0
    ? Math.round(((rent - marketRate.median) / marketRate.median) * 100)
    : null

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
          <Text style={[Typography.subtitle, { color: c.text2 }]}>{step > 0 ? '← Back' : '← Cancel'}</Text>
        </Pressable>
        <Text style={[Typography.caption, { color: c.text3 }]}>Step {step + 1} of {STEPS.length}</Text>
      </View>

      {/* Progress */}
      <View style={[st.progressBg, { backgroundColor: c.bgSubtle }]}>
        <View style={[st.progressFill, { backgroundColor: c.accent, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.bodyContent} showsVerticalScrollIndicator={false}>

        {/* ── STEP 0: Location ── */}
        {step === 0 && (
          <View>
            <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Where did you stay?</Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
              Pin your property on the map or enter the society name.
            </Text>

            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>City</Text>
            <View style={st.chipRow}>
              {CITIES.map(ct => (
                <Pressable key={ct}
                  style={[st.chip, { backgroundColor: city === ct ? c.accent : c.bgSubtle, borderColor: city === ct ? c.accent : c.border }]}
                  onPress={() => setCity(ct)}>
                  <Text style={[Typography.caption, { color: city === ct ? '#fff' : c.text3, fontSize: 11, textTransform: 'capitalize' }]}>
                    {CITY_LABELS[ct] ?? ct}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Map pin */}
            <Pressable
              style={[st.mapPinBtn, { backgroundColor: c.bgSurface, borderColor: lat ? c.green : c.border }]}
              onPress={() => setMapPickerVisible(true)}
            >
              <Text style={{ fontSize: 20 }}>🗺</Text>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.caption, { color: lat ? c.green : c.accent, fontWeight: '600' }]}>
                  {societyName ? `📍 ${societyName}` : lat ? `📍 ${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Pin location on map'}
                </Text>
                <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>
                  {lat ? 'Tap to change location' : 'Search or tap on map'}
                </Text>
              </View>
              <Text style={[Typography.caption, { color: c.text3 }]}>›</Text>
            </Pressable>

            {/* Property name fallback */}
            <Text style={[Typography.caption, { color: c.text2, marginTop: Spacing.base, marginBottom: Spacing.xs }]}>
              Society / Property Name {!lat && '*'}
            </Text>
            <TextInput
              style={[st.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={propertyName}
              onChangeText={setPropertyName}
              placeholder="e.g. Prestige Lakeside Habitat"
              placeholderTextColor={c.text4}
            />
          </View>
        )}

        {/* ── STEP 1: BHK & Rent ── */}
        {step === 1 && (
          <View>
            <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Rent Details</Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
              Select BHK type and enter the monthly rent you paid.
            </Text>

            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>BHK Type *</Text>
            <View style={st.chipRow}>
              {BHK_OPTIONS.map(opt => (
                <Pressable key={opt}
                  style={[st.chip, { backgroundColor: bhkType === opt ? c.accent : c.bgSubtle, borderColor: bhkType === opt ? c.accent : c.border }]}
                  onPress={() => setBhkType(opt)}>
                  <Text style={[Typography.caption, { color: bhkType === opt ? '#fff' : c.text2 }]}>{opt}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[Typography.caption, { color: c.text2, marginTop: Spacing.base, marginBottom: Spacing.xs }]}>Monthly Rent (₹) *</Text>
            <TextInput
              style={[st.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={rentAmount}
              onChangeText={t => setRentAmount(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 25000"
              placeholderTextColor={c.text4}
              keyboardType="numeric"
            />

            {/* Market rate nudge */}
            {loadingRate && (
              <View style={[st.nudgeBox, { backgroundColor: c.bgSubtle, borderColor: c.border }]}>
                <ActivityIndicator color={c.accent} size="small" />
                <Text style={[Typography.caption, { color: c.text3 }]}>Checking market rate...</Text>
              </View>
            )}
            {!loadingRate && marketRate && ratePct !== null && (
              <View style={[st.nudgeBox, {
                backgroundColor: Math.abs(ratePct) <= 10 ? '#14532d' : Math.abs(ratePct) <= 25 ? '#422006' : '#450a0a',
                borderColor: Math.abs(ratePct) <= 10 ? '#166534' : Math.abs(ratePct) <= 25 ? '#854d0e' : '#991b1b',
              }]}>
                <Text style={[Typography.caption, {
                  color: Math.abs(ratePct) <= 10 ? '#4ade80' : Math.abs(ratePct) <= 25 ? '#fbbf24' : '#f87171',
                }]}>
                  {Math.abs(ratePct) <= 10
                    ? `✅ Matches market rate (₹${marketRate.median.toLocaleString('en-IN')}/mo)`
                    : `${ratePct > 0 ? '↑' : '↓'} ${Math.abs(ratePct)}% ${ratePct > 0 ? 'above' : 'below'} market (₹${marketRate.median.toLocaleString('en-IN')}/mo)`}
                </Text>
                <Text style={[Typography.caption, { color: c.text4, fontSize: 9 }]}>
                  Based on {marketRate.count} submissions nearby
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 2: Shared Flat & Furnishing ── */}
        {step === 2 && (
          <View>
            <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Flat Details</Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
              Tell us about the flat setup. This is optional.
            </Text>

            {/* Shared flat toggle */}
            <View style={[st.toggleRow, { borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.subtitle, { color: c.text1, fontSize: 14 }]}>Shared flat?</Text>
                <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>Did you share the flat with others?</Text>
              </View>
              <Switch
                value={isSharedFlat}
                onValueChange={v => { setIsSharedFlat(v); if (!v) { setIsFurnished(false); setFurnishings([]) } }}
                trackColor={{ false: c.bgSubtle, true: c.accent + '60' }}
                thumbColor={isSharedFlat ? c.accent : c.text4}
              />
            </View>

            {/* Furnished toggle */}
            {isSharedFlat && (
              <View style={[st.toggleRow, { borderColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.subtitle, { color: c.text1, fontSize: 14 }]}>Furnished?</Text>
                  <Text style={[Typography.caption, { color: c.text4, fontSize: 10 }]}>Was the flat furnished when you moved in?</Text>
                </View>
                <Switch
                  value={isFurnished}
                  onValueChange={v => { setIsFurnished(v); if (!v) setFurnishings([]) }}
                  trackColor={{ false: c.bgSubtle, true: c.accent + '60' }}
                  thumbColor={isFurnished ? c.accent : c.text4}
                />
              </View>
            )}

            {/* Furnishing items catalog */}
            {isSharedFlat && isFurnished && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={[Typography.subtitle, { color: c.text1, marginBottom: Spacing.xs }]}>
                  Furnishing Items ({furnishings.length} selected)
                </Text>

                {/* Category tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  <View style={st.chipRow}>
                    {FURNISHING_CATALOG.map(cat => (
                      <Pressable key={cat.id}
                        style={[st.catChip, { backgroundColor: activeCat === cat.id ? c.accent : c.bgSubtle, borderColor: activeCat === cat.id ? c.accent : c.border }]}
                        onPress={() => setActiveCat(cat.id)}>
                        <Text style={{ fontSize: 12 }}>{cat.icon}</Text>
                        <Text style={[Typography.caption, { color: activeCat === cat.id ? '#fff' : c.text3, fontSize: 9 }]}>{cat.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                {/* Items grid */}
                {(() => {
                  const cat = FURNISHING_CATALOG.find(c => c.id === activeCat)
                  if (!cat) return null
                  return (
                    <View style={st.itemGrid}>
                      {cat.items.map(item => {
                        const sel = furnishings.includes(item.id)
                        return (
                          <Pressable key={item.id}
                            style={[st.itemCard, { backgroundColor: sel ? c.accent : c.bgSurface, borderColor: sel ? c.accent : c.border }]}
                            onPress={() => toggleFurnishing(item.id)}>
                            <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                            <Text style={[Typography.caption, { color: sel ? '#fff' : c.text2, fontSize: 9 }]} numberOfLines={1}>{item.name}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  )
                })()}
              </View>
            )}
          </View>
        )}

        {/* ── STEP 3: Deposit ── */}
        {step === 3 && (
          <View>
            <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Deposit Details</Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
              Help future tenants know about deposit outcomes. All fields are optional.
            </Text>

            <Text style={[Typography.caption, { color: c.text2, marginBottom: Spacing.xs }]}>Deposit Paid (₹)</Text>
            <TextInput
              style={[st.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={depositPaid}
              onChangeText={t => setDepositPaid(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 75000"
              placeholderTextColor={c.text4}
              keyboardType="numeric"
            />

            <Text style={[Typography.caption, { color: c.text2, marginTop: Spacing.base, marginBottom: Spacing.xs }]}>Deposit Returned (₹)</Text>
            <TextInput
              style={[st.input, { backgroundColor: c.bgSurface, borderColor: c.border, color: c.text1 }]}
              value={depositReturned}
              onChangeText={t => setDepositReturned(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 60000"
              placeholderTextColor={c.text4}
              keyboardType="numeric"
            />

            <Text style={[Typography.caption, { color: c.text2, marginTop: Spacing.base, marginBottom: Spacing.xs }]}>Outcome</Text>
            <View style={st.chipRow}>
              {DEPOSIT_OPTIONS.map(opt => (
                <Pressable key={opt.value}
                  style={[st.depositChip, {
                    backgroundColor: depositOutcome === opt.value ? opt.color + '20' : c.bgSubtle,
                    borderColor: depositOutcome === opt.value ? opt.color : c.border,
                  }]}
                  onPress={() => setDepositOutcome(depositOutcome === opt.value ? null : opt.value)}>
                  <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                  <Text style={[Typography.caption, { color: depositOutcome === opt.value ? opt.color : c.text3, fontSize: 11 }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 4: Review ── */}
        {step === 4 && (
          <View>
            <Text style={[Typography.title, { color: c.text1, marginBottom: Spacing.sm }]}>Review & Submit</Text>
            <Text style={[Typography.caption, { color: c.text3, marginBottom: Spacing.lg }]}>
              Please verify the details before submitting.
            </Text>

            <View style={[st.reviewCard, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              <ReviewRow label="City" value={CITY_LABELS[city] ?? city} c={c} />
              <ReviewRow label="Location" value={(societyName ?? propertyName) || '—'} c={c} />
              {lat && <ReviewRow label="Coordinates" value={`${lat.toFixed(4)}, ${lng!.toFixed(4)}`} c={c} />}
              <ReviewRow label="BHK" value={bhkType ?? '—'} c={c} />
              <ReviewRow label="Monthly Rent" value={rent > 0 ? `₹${rent.toLocaleString('en-IN')}` : '—'} c={c} />
              <ReviewRow label="Shared Flat" value={isSharedFlat ? 'Yes' : 'No'} c={c} />
              {isSharedFlat && <ReviewRow label="Furnished" value={isFurnished ? 'Yes' : 'No'} c={c} />}
              {isSharedFlat && isFurnished && furnishings.length > 0 && (
                <ReviewRow label="Furnishing Items" value={`${furnishings.length} items`} c={c} />
              )}
              {depositPaid && <ReviewRow label="Deposit Paid" value={`₹${parseInt(depositPaid).toLocaleString('en-IN')}`} c={c} />}
              {depositReturned && <ReviewRow label="Deposit Returned" value={`₹${parseInt(depositReturned).toLocaleString('en-IN')}`} c={c} />}
              {depositOutcome && (
                <ReviewRow label="Outcome" value={DEPOSIT_OPTIONS.find(d => d.value === depositOutcome)?.label ?? depositOutcome} c={c} />
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Map picker */}
      <LocationPickerSheet
        visible={mapPickerVisible}
        city={city}
        initialPin={lat && lng ? { lat, lng } : null}
        onConfirm={(pin, sName, sId) => {
          setLat(pin.lat); setLng(pin.lng)
          setSocietyName(sName); setSocietyId(sId)
          if (sName && !propertyName.trim()) setPropertyName(sName)
          setMapPickerVisible(false)
        }}
        onClose={() => setMapPickerVisible(false)}
      />

      {/* Footer */}
      <View style={[st.footer, { borderTopColor: c.border, backgroundColor: c.bgPage }]}>
        {step < STEPS.length - 1 ? (
          <Pressable
            style={[st.nextBtn, { backgroundColor: canNext() ? c.accent : c.bgSubtle }]}
            onPress={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}>
            <Text style={[Typography.subtitle, { color: canNext() ? '#fff' : c.text4 }]}>
              {step === 2 || step === 3 ? 'Skip / Next' : 'Next'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[st.nextBtn, { backgroundColor: submitting ? c.bgSubtle : c.accent }]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={[Typography.subtitle, { color: '#fff' }]}>Submit</Text>
            }
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

function ReviewRow({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={st.reviewRow}>
      <Text style={[Typography.caption, { color: c.text4, width: 120 }]}>{label}</Text>
      <Text style={[Typography.caption, { color: c.text1, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
  progressBg: { height: 3 },
  progressFill: { height: 3 },
  bodyContent: { padding: Spacing.base, paddingBottom: 100 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.base, borderTopWidth: 1 },
  nextBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  // Inputs
  input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1 },
  depositChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1,
  },
  // Map pin
  mapPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.base,
  },
  // Toggles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderBottomWidth: 1, paddingVertical: Spacing.md,
  },
  // Furnishing catalog
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1,
  },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  itemCard: {
    width: '23%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4,
  },
  // Market rate nudge
  nudgeBox: {
    flexDirection: 'column', gap: 2, borderWidth: 1, borderRadius: Radius.md,
    padding: Spacing.md, marginTop: Spacing.md,
  },
  // Review
  reviewCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.xs, gap: Spacing.sm,
  },
  // Success
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.base },
  doneBtn: { borderRadius: Radius.lg, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, marginTop: Spacing.base },
})
