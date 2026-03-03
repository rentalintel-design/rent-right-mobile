# Rent Right Mobile — Development Plan

## Project Overview
React Native (Expo SDK 54) mobile app for Rent Right — a rental intelligence platform for Indian cities. Mirrors the Next.js web app at `../rent-right/` using shared types/logic from `rent-right-shared`.

## Architecture Decisions
- **Navigation**: Expo Router (file-based) with tab layout
- **State**: React Context (AuthContext) + custom hooks — matches web app pattern, no Redux
- **Backend**: Supabase (same project as web — shared DB, auth, storage)
- **Maps**: `react-native-maps` (uses Apple Maps on iOS, Google Maps on Android) — MapLibre GL Native has poor Expo compatibility
- **Styling**: StyleSheet.create with dark theme matching web (`#0a1628` bg, `#2563eb` accent)
- **Shared code**: `rent-right-shared` package via `file:../rent-right-shared` in package.json

## Theme (dark-first, matching web)
```
bg-page:    #0a1628      text-1:  #f0f6ff
bg-surface: #0f1f35      text-2:  #b8ccdf
bg-subtle:  #162240      text-3:  #7896b4
border:     #1e3a5f      text-4:  #4a6685
accent:     #2563eb      red:     #ef4444
green:      #22c55e      yellow:  #eab308
```

---

## Development Phases

### Phase 1: Project Foundation
**Goal**: Supabase client, auth flow, navigation skeleton, theme system

#### 1.1 Supabase Client Setup
- Install `@supabase/supabase-js` and `expo-secure-store`
- Create `lib/supabase.ts` — use `expo-secure-store` for token persistence (AsyncStorage fallback for web)
- Environment config via `app.config.ts` extras or `.env` with `expo-constants`

#### 1.2 Auth Context
- Port `AuthContext.tsx` from web — same Profile type, same Supabase queries
- Phone OTP flow: `signInWithOtp({ phone })` → `verifyOtp({ phone, token, type: 'sms' })`
- Session persistence via Supabase's `autoRefreshToken` + SecureStore adapter

#### 1.3 Auth Screens
- `app/(auth)/login.tsx` — phone input → OTP verify (two-step, same as web)
- `app/(auth)/onboarding.tsx` — role selection (tenant/landlord) + city picker
- Guarded routing: if no session → auth stack; if no profile.role → onboarding; else → tabs

#### 1.4 Navigation Structure
```
app/
  _layout.tsx              — Root: AuthProvider wrapper, route guard
  (auth)/
    _layout.tsx            — Stack for auth screens
    login.tsx              — Phone OTP login
    onboarding.tsx         — Role + city selection
  (tabs)/
    _layout.tsx            — Bottom tabs
    index.tsx              — Map screen (tenant) / Dashboard (landlord)
    vacancies.tsx          — Vacancy list + filters
    vault.tsx              — Vault records list
    profile.tsx            — Profile + settings
  vacancy/[id].tsx         — Vacancy detail (modal/push)
  vault/create.tsx         — Vault creation wizard
  vault/[id].tsx           — Vault detail view
  chat/[conversationId].tsx — Chat screen
```

#### 1.5 Theme System
- Update `constants/theme.ts` with Rent Right dark palette
- Create `constants/spacing.ts` for consistent sizing
- Utility: `useTheme()` hook returning colors object

---

### Phase 2: Map Screen (Tenant Home)
**Goal**: Interactive map with vacancy pins, rent layers, locality labels

#### 2.1 Map Setup
- Install `react-native-maps` (Expo-compatible, works on both platforms)
- Create `components/map/MapScreen.tsx` — full-screen map
- Initial view: user's selected city center from `CITY_BOUNDS`
- Map style: dark mode tile URL or provider-specific dark style

#### 2.2 Vacancy Pins
- Port `useVacancies` hook — fetch vacancies from Supabase for user's city
- Custom map markers: colored pins by BHK type
- Marker clustering for performance (use `react-native-map-clustering` or manual)
- Tap marker → bottom sheet with vacancy summary

#### 2.3 Rent Heatmap Layer
- Port `buildRentGridGeoJSON()` logic — but render as colored markers/circles on react-native-maps (no GeoJSON fill layer support)
- Alternative: use `Polygon` components for rent grid cells colored by ratio
- Locality Voronoi polygons as `Polygon` overlays with rent labels
- Toggle between layers: none / rent-locality / rent-street

#### 2.4 Map Controls & Search
- Layer toggle bar (floating buttons)
- Search bar with `geocodeSearch()` from shared package
- City switcher
- GPS locate button (`expo-location`)
- Filter sheet (BHK, rent range, furnishing) — reuse filter types from shared

#### 2.5 Bottom Sheet System
- Install `@gorhom/bottom-sheet` for vacancy detail, filters, etc.
- Vacancy detail sheet: photos, rent, BHK, contact button
- Property detail sheet: rent history, deposit risk

---

### Phase 3: Vacancy Features
**Goal**: Vacancy list view, detail screen, favorites, landlord chat

#### 3.1 Vacancy List
- `(tabs)/vacancies.tsx` — FlatList of vacancies with filters
- Filter chips: BHK, rent range, furnishing, source
- Pull-to-refresh, infinite scroll

#### 3.2 Vacancy Detail
- `vacancy/[id].tsx` — full detail screen
- Photo carousel (horizontal ScrollView or FlatList)
- Property info, amenities, landlord info
- Contact button → initiate chat / reveal phone (membership gated)

#### 3.3 Favorites
- Heart icon on vacancy cards/markers
- Supabase `favorites` table (same as web)
- Favorites tab or filter in vacancy list

#### 3.4 Chat
- `chat/[conversationId].tsx` — real-time messaging
- Supabase Realtime subscription for new messages
- Message input with send button
- Chat list in profile or dedicated tab

---

### Phase 4: Vault (Move-in Records)
**Goal**: Create, view, and share vault records

#### 4.1 Vault List
- `(tabs)/vault.tsx` — user's vault records
- Status badges: draft, pending acceptance, locked

#### 4.2 Vault Creation Wizard
- `vault/create.tsx` — 5-step flow matching web:
  1. Property type (1RK–4BHK) using `PROPERTY_TYPES` from shared
  2. Floor management using `buildInitialFloor()` from shared
  3. Room documentation with camera (`expo-camera` / `expo-image-picker`)
  4. Furnishings from `FURNISHING_CATALOG`
  5. Review + submit
- Photo upload to Supabase Storage `vault-photos` bucket

#### 4.3 Vault Detail & Sharing
- `vault/[id].tsx` — room-by-room photo viewer
- Share via token URL (deep link)
- Accept/lock flow
- Room-level comments

---

### Phase 5: Profile & Settings
**Goal**: User profile, membership, contribution, settings

#### 5.1 Profile Screen
- Name, phone (masked via `maskPhone()`), role, city
- Switch role (tenant ↔ landlord)
- Edit profile

#### 5.2 Membership
- Show active plan status (core + vault expiry)
- In-app purchase or Razorpay webview for payment
- Membership-gated feature indicators

#### 5.3 Data Contribution
- Submit rent/deposit data (map-based location picker)
- Contribution history
- Unlock fine rent grid on contribution

---

### Phase 6: Landlord Features
**Goal**: Post vacancies, manage listings

#### 6.1 Post Vacancy
- Map-based pin drop for location
- Property detail form (BHK, rent, furnishing, photos)
- Draft → active flow

#### 6.2 Manage Listings
- List of user's vacancies with status (draft/active/booked/rented)
- Edit, deactivate, mark as rented

---

### Phase 7: Polish & Platform
**Goal**: Deep linking, push notifications, offline, performance

- Deep links for vault sharing (`/vault/review/[token]`)
- Push notifications (Expo Push + Supabase Edge Functions)
- Offline caching for recently viewed vacancies
- Image caching and optimization
- App Store / Play Store submission prep

---

## Key Libraries to Install (by phase)

### Phase 1
```
@supabase/supabase-js expo-secure-store expo-location
```

### Phase 2
```
react-native-maps @gorhom/bottom-sheet
```

### Phase 3
```
expo-image-picker (for vacancy photos viewing)
```

### Phase 4
```
expo-camera expo-image-picker expo-file-system
```

---

## Conventions
- Import shared code: `import { VaultRecord, CITY_BOUNDS } from 'rent-right-shared'`
- File structure mirrors web where possible for easy porting
- All Supabase queries match web app's table/column names exactly
- Same RLS policies apply — no backend changes needed
- Dark theme by default (match web's color system)
- Use `StyleSheet.create()` — no external CSS-in-JS library
