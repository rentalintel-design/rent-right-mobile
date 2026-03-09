import React, { useState, useMemo } from 'react'
import {
  View, Text, Pressable, Modal, StyleSheet,
  TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useColors } from '@/hooks/use-theme-color'
import { Typography, Spacing, Radius } from '@/constants/theme'

export type Biller = {
  id: string          // BBPS biller ID e.g. "BESCOM000KAR01"
  name: string        // Display name e.g. "BESCOM"
  category: 'electricity' | 'water' | 'gas' | 'internet'
  state?: string
}

// Common Indian utility billers (BBPS directory subset)
const BILLERS: Biller[] = [
  // Electricity
  { id: 'BESCOM000KAR01', name: 'BESCOM', category: 'electricity', state: 'Karnataka' },
  { id: 'GESCOM000KAR01', name: 'GESCOM', category: 'electricity', state: 'Karnataka' },
  { id: 'HESCOM000KAR01', name: 'HESCOM', category: 'electricity', state: 'Karnataka' },
  { id: 'MESCOM000KAR01', name: 'MESCOM', category: 'electricity', state: 'Karnataka' },
  { id: 'CHESCOM00KAR01', name: 'CHESCOM', category: 'electricity', state: 'Karnataka' },
  { id: 'MSEDCL00MAHA01', name: 'MSEDCL', category: 'electricity', state: 'Maharashtra' },
  { id: 'BEST0000MAHA01', name: 'BEST', category: 'electricity', state: 'Maharashtra' },
  { id: 'APEPDCL0ANDH01', name: 'APEPDCL', category: 'electricity', state: 'Andhra Pradesh' },
  { id: 'APSPDCL0ANDH01', name: 'APSPDCL', category: 'electricity', state: 'Andhra Pradesh' },
  { id: 'TSSPDCL0TELA01', name: 'TSSPDCL', category: 'electricity', state: 'Telangana' },
  { id: 'TSNPDCL0TELA01', name: 'TSNPDCL', category: 'electricity', state: 'Telangana' },
  { id: 'TNEB0000TAMI01', name: 'TNEB / TANGEDCO', category: 'electricity', state: 'Tamil Nadu' },
  { id: 'CESC0000WEST01', name: 'CESC', category: 'electricity', state: 'West Bengal' },
  { id: 'WBSEDCL0WEST01', name: 'WBSEDCL', category: 'electricity', state: 'West Bengal' },
  { id: 'TPDDL000DELH01', name: 'TPDDL (Tata Power Delhi)', category: 'electricity', state: 'Delhi' },
  { id: 'BSES0000DELH01', name: 'BSES Rajdhani', category: 'electricity', state: 'Delhi' },
  { id: 'BSESYAMU0DELH01', name: 'BSES Yamuna', category: 'electricity', state: 'Delhi' },
  { id: 'DHBVN000HARY01', name: 'DHBVN', category: 'electricity', state: 'Haryana' },
  { id: 'UHBVN000HARY01', name: 'UHBVN', category: 'electricity', state: 'Haryana' },
  { id: 'PSPCL000PUNJ01', name: 'PSPCL', category: 'electricity', state: 'Punjab' },
  { id: 'JVVNL000RAJA01', name: 'JVVNL', category: 'electricity', state: 'Rajasthan' },
  { id: 'AVVNL000RAJA01', name: 'AVVNL', category: 'electricity', state: 'Rajasthan' },
  { id: 'UPPCL000UTPR01', name: 'UPPCL', category: 'electricity', state: 'Uttar Pradesh' },
  { id: 'PVVNL000UTPR01', name: 'PVVNL', category: 'electricity', state: 'Uttar Pradesh' },
  { id: 'MVVNL000UTPR01', name: 'MVVNL', category: 'electricity', state: 'Uttar Pradesh' },
  { id: 'KESC0000KERA01', name: 'KSEB', category: 'electricity', state: 'Kerala' },
  { id: 'GUVNL000GUJA01', name: 'UGVCL / DGVCL / MGVCL / PGVCL', category: 'electricity', state: 'Gujarat' },
  // Water
  { id: 'BWSSB000KAR01', name: 'BWSSB', category: 'water', state: 'Karnataka' },
  { id: 'HMWSSB00TELA01', name: 'HMWSSB', category: 'water', state: 'Telangana' },
  { id: 'CMWSSB00TAMI01', name: 'Chennai Metrowater (CMWSSB)', category: 'water', state: 'Tamil Nadu' },
  { id: 'DJB00000DELH01', name: 'Delhi Jal Board (DJB)', category: 'water', state: 'Delhi' },
  { id: 'MCGM0000MAHA01', name: 'BMC / MCGM', category: 'water', state: 'Maharashtra' },
  { id: 'PCMC0000MAHA01', name: 'PCMC Water', category: 'water', state: 'Maharashtra' },
  { id: 'BWWB0000KAR01', name: 'KUWSDB / Town Panchayat', category: 'water', state: 'Karnataka' },
  // Gas
  { id: 'IGL00000DELH01', name: 'Indraprastha Gas (IGL)', category: 'gas', state: 'Delhi / NCR' },
  { id: 'MGL00000MAHA01', name: 'Mahanagar Gas (MGL)', category: 'gas', state: 'Maharashtra' },
  { id: 'GAILGAS0MULT01', name: 'GAIL Gas', category: 'gas', state: 'Multiple' },
  { id: 'GUJARAT0GAS001', name: 'Gujarat Gas', category: 'gas', state: 'Gujarat' },
  { id: 'ADANIGAS0MULT1', name: 'Adani Gas', category: 'gas', state: 'Multiple' },
  { id: 'TORRENT0GAS01', name: 'Torrent Gas', category: 'gas', state: 'Gujarat / Rajasthan' },
  { id: 'SABARMATI0GAS1', name: 'Sabarmati Gas', category: 'gas', state: 'Gujarat' },
  // Internet / Broadband
  { id: 'JIOFIBR0MULT01', name: 'JioFiber', category: 'internet', state: 'Pan India' },
  { id: 'AIRTELBB0MULT1', name: 'Airtel Broadband', category: 'internet', state: 'Pan India' },
  { id: 'BSNL0000MULT01', name: 'BSNL Broadband', category: 'internet', state: 'Pan India' },
  { id: 'ACTFIBER0MULT1', name: 'ACT Fibernet', category: 'internet', state: 'Multiple' },
  { id: 'HATHWAY0MULT01', name: 'Hathway Broadband', category: 'internet', state: 'Multiple' },
  { id: 'TIKONA00MULT01', name: 'Tikona', category: 'internet', state: 'Multiple' },
  { id: 'EXCITEL0DELH01', name: 'Excitel', category: 'internet', state: 'Delhi / NCR' },
]

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

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return BILLERS.filter(b => {
      const matchesCat = !q && b.category === activeCategory
      const matchesSearch = q && (
        b.name.toLowerCase().includes(q) ||
        b.state?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      )
      return matchesCat || matchesSearch
    })
  }, [query, activeCategory])

  const categories = ['electricity', 'water', 'gas', 'internet'] as const

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

          {/* Category tabs (shown when not searching) */}
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

          {/* Biller list */}
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
                  {CATEGORY_ICONS[item.category]}
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
