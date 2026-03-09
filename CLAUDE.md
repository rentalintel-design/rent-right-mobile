# Rent Right Mobile — Development Plan

## Project Overview
React Native (Expo SDK 54) mobile app for Rent Right — a rental intelligence platform for Indian cities. Mirrors the Next.js web app at `../rent-right/` using shared types/logic from `rent-right-shared`.

## Architecture Decisions
- **Navigation**: Expo Router (file-based) with tab layout
- **State**: React Context (AuthContext) + custom hooks — matches web app pattern, no Redux
- **Backend**: Supabase (same project as web — shared DB, auth, storage)
- **Maps**: `react-native-maps` (Google Maps on both platforms via `PROVIDER_GOOGLE`) — MapLibre GL Native has poor Expo compatibility
- **Styling**: StyleSheet.create with dark theme matching web (`#0a1628` bg, `#2563eb` accent)
- **Shared code**: `rent-right-shared` package via `file:../rent-right-shared` in package.json
- **Map overlays**: Fixed-pool pattern — all Polygons/Markers are always mounted, props updated in-place. Never mount/unmount native map views during gestures (causes Google Maps iOS SDK crash).
- **Clustering**: Grid-based with power-of-2 step sizes for hierarchical stability. Opacity-only visibility toggling — marker coordinates never change after initial assignment.

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

### Phase 1: Project Foundation ✅ COMPLETE
**Goal**: Supabase client, auth flow, navigation skeleton, theme system

**Implemented:**
- `lib/supabase.ts` — Supabase client with `expo-secure-store` token persistence
- `context/AuthContext.tsx` — Session + profile loading, `refreshProfile()`, phone OTP
- `app/(auth)/login.tsx` — Phone input → OTP verify (two-step)
- `app/(auth)/onboarding.tsx` — Role selection (tenant/landlord) + city picker (6 cities: Bengaluru, Pune, Hyderabad, Gurugram, Chennai, Mumbai)
- `app/_layout.tsx` — Root layout with AuthProvider, route guard (no session → auth; no role → onboarding; else → tabs)
- `constants/theme.ts` — Dark palette matching web
- Navigation: `(auth)` stack, `(tabs)` bottom tabs, modal routes for vacancy/vault/chat

---

### Phase 2: Map Screen (Tenant Home) ✅ COMPLETE
**Goal**: Interactive map with vacancy pins, rent layers, clustering

**Implemented:**
- `app/(tabs)/index.tsx` — Full-screen map (tenant) / Dashboard (landlord)
- `components/map/VacancyMarkerPool.tsx` — Pool of 300 permanent marker slots. Coordinates set once, never changed. Clustering via opacity toggle + `tracksViewChanges` bitmap re-capture. Key is stable (`vm-${i}`), no unmount/remount.
- `lib/clusterVacancies.ts` — Grid-based clustering with power-of-2 step sizes (0.002–0.064°). Returns `ClusterResult { clusterMap, clusterMembers, atFinestZoom }`. Cluster tap zooms in; at finest zoom shows Alert picker for co-located vacancies.
- `components/map/RentPolygons.tsx` — Fixed pool of 120 Polygon slots for street rent grid
- `components/map/LocalityPolygons.tsx` — Locality Voronoi polygons, always mounted, toggle via fill color
- `components/map/CityMask.tsx` — Always mounted with `visible` prop, no unmount
- `components/map/LayerToggleBar.tsx` — None / Locality / Street layer buttons
- `components/map/FiltersSheet.tsx` — BHK, rent range, furnishing filters
- `components/map/MapSearchBar.tsx` — Google Places search
- `components/map/LocateButton.tsx` — GPS locate via `expo-location`
- `components/map/VacancyDetailSheet.tsx` — Vacancy summary bottom sheet
- `components/map/RentSlider.tsx` — Rent range filter slider
- `hooks/useVacancies.ts` — Fetches all city vacancies via `.eq('city', cityName)`, filters by BHK/rent/furnishing/source/favorites
- `lib/mapUtils.ts` — `formatRentShort()`, `rentRatioColor()`, zoom calculation
- `constants/mapStyles.ts` — `BHK_COLORS` for marker coloring

---

### Phase 3: Vacancy & Vault Features ✅ COMPLETE
**Goal**: Vacancy list/detail, vault creation wizard, chat stubs, contribution

**Implemented:**
- `app/(tabs)/vacancies.tsx` — FlatList with filter chips, pull-to-refresh
- `app/vacancy/[id].tsx` — Detail screen with photo carousel + lightbox
- `app/(tabs)/vault.tsx` — Vault records list with status badges
- `app/vault/create.tsx` — 5-step wizard (property type → floor → room photos → furnishings → review)
- `app/vault/[id].tsx` — Vault detail view (room-by-room photos)
- `app/chat/inbox.tsx` — Chat list (stub)
- `app/chat/[conversationId].tsx` — Chat screen (stub)
- `app/contribution/submit.tsx` — Rent/deposit data submission screen
- `app/(tabs)/profile.tsx` — Profile view, membership status, sign out

---

### Phase 4: Dashboard & Tenancy Management 🔲 NEXT
**Goal**: Landlord & tenant dashboards matching web, tenancy lifecycle

#### 4.1 Landlord Dashboard (enhance existing)
Current: Shows stats + recent listings on map screen. Enhance to match web:
- **Tenancy list**: Active tenancies with tenant name, property label, monthly rent
- **Rent payment tracking**: Current month status per tenancy (pending/paid/confirmed/overdue)
- **Payment history**: 6-month history per tenancy with status badges
- **Utility accounts**: Electricity, water, gas, internet per tenancy with account numbers
- **Utility bills**: Bills linked to accounts with status (pending/paid)
- **Create tenancy**: Form to create new tenancy (tenant phone, property, rent, start date)
- **End tenancy**: Confirmation flow to end active tenancy

Supabase tables: `tenancies`, `rent_payments`, `utility_accounts`, `utility_bills`, `profiles`

#### 4.2 Tenant Dashboard
Not yet implemented. Port from web `TenantDashboard.tsx`:
- **Current month rent**: Payment card with status, "Mark as Paid" button
- **Landlord info**: Name from `profiles` table
- **Payment history**: 6-month history (expandable)
- **Utility accounts/bills**: Same as landlord view but tenant-side
- Dashboard shown on map screen when `profile.role === 'tenant'` and has active tenancy

#### 4.3 Tenancy Hooks
- `useTenancies()` — Fetch active tenancies for user (as landlord or tenant)
- `useRentPayments(tenancyId)` — Current + historical payments
- `useUtilities(tenancyId)` — Utility accounts + bills

---

### Phase 5: Landlord Vacancy Management 🔲
**Goal**: Post vacancies, manage listings (matching web `LandlordOnboarding.tsx` flow)

#### 5.1 Post Vacancy
Port landlord vacancy creation from web:
- Map-based pin drop for location (societies + localities search)
- Detailed form: BHK, property type, furnishing status, area sqft, parking (bike/car with N/A toggle), landmark, description, WhatsApp number, tenant preference, notes
- Photo upload (up to 8 photos) via `expo-image-picker` to Supabase Storage
- Furnishing items (if shared + furnished): select from `FURNISHING_CATALOG`
- Market rate nudge: fetch median rent for nearby same-BHK properties
- Save as draft (30 days) or post live (90 days, requires membership)

#### 5.2 Manage Listings
- List of user's vacancies with status badges (Draft/Active/Booked/Rented)
- Edit vacancy details + photos
- Deactivate, mark as booked/rented
- Renew expired listings

---

### Phase 6: Profile, Membership & Contribution 🔲
**Goal**: Full profile management, membership gating, data contribution

#### 6.1 Profile Screen (enhance existing)
- Edit name, city
- Switch role (tenant ↔ landlord) — uses `alt_role` + `alt_city` from Profile
- Phone display via `maskPhone()` from shared

#### 6.2 Membership
- Show active plan status (core + vault expiry dates)
- Membership-gated feature indicators throughout app
- In-app purchase or Razorpay WebView for payment
- `useMembership()` hook matching web

#### 6.3 Data Contribution (enhance existing)
- Current: basic submission form at `/contribution/submit`
- Enhance: map-based location picker (matching web onboarding flow)
- BHK → shared flat → furnished items → rent → deposit fields → deposit outcome
- Market rate nudge (fetch median rent for nearby properties)
- Contribution history
- Unlock fine rent grid on contribution

---

### Phase 7: Chat & Real-time 🔲
**Goal**: Real-time messaging between tenants and landlords

#### 7.1 Chat System
- `chat/inbox.tsx` — Conversation list with last message preview, unread count
- `chat/[conversationId].tsx` — Full messaging UI
- Supabase Realtime subscription for new messages
- Message input with send button
- Initiate chat from vacancy detail (membership gated)

#### 7.2 Contact Reveal
- Reveal landlord phone from vacancy detail (membership gated)
- Call/WhatsApp action buttons

---

### Phase 8: Polish & Platform 🔲
**Goal**: Deep linking, push notifications, offline, performance, app store

- Deep links for vault sharing (`/vault/review/[token]`)
- Push notifications (Expo Push + Supabase Edge Functions)
- Offline caching for recently viewed vacancies
- Image caching and optimization
- Favorites sync (Supabase `favorites` table)
- City switcher in map screen (currently fixed to profile city)
- "Other city" option with free-form geocode search (web has it, mobile doesn't)
- App Store / Play Store submission prep

---

## Key Libraries Installed

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
expo-image-picker
```

### Phase 5 (when needed)
```
expo-camera expo-file-system
```

---

## Conventions
- Import shared code: `import { VaultRecord, CITY_BOUNDS } from 'rent-right-shared'`
- File structure mirrors web where possible for easy porting
- All Supabase queries match web app's table/column names exactly
- Same RLS policies apply — no backend changes needed
- Dark theme by default (match web's color system)
- Use `StyleSheet.create()` — no external CSS-in-JS library
- City names: stored lowercase in DB ("bengaluru"), displayed capitalized ("Bengaluru")
- Map overlays: NEVER conditionally mount/unmount — always mounted, toggle via props (opacity, fill color, visible flag)
- Clustering: power-of-2 grid steps only — guarantees hierarchical stability (no rejoin bug)

---

## Supabase Tables Reference

| Table | Used By | Purpose |
|-------|---------|---------|
| `profiles` | Auth, Dashboard | User profile (role, city, name, phone) |
| `vacancies` | Map, Listings | Rental listings with photos, status |
| `properties` | Contribution | Locations for rent data |
| `rent_submissions` | Contribution | User-submitted rent data |
| `deposit_submissions` | Contribution | User-submitted deposit data |
| `tenancies` | Dashboard | Active rental agreements |
| `rent_payments` | Dashboard | Monthly rent payment tracking |
| `utility_accounts` | Dashboard | Electricity/water/gas/internet |
| `utility_bills` | Dashboard | Bills per utility account |
| `localities` | Map layers | Locality polygons + rent stats |
| `locality_rent_stats` | Map layers | Pre-computed locality rent data |
| `street_grid_stats` | Map layers | Pre-computed 250m grid rent data |
| `societies` | Map, Onboarding | Society/apartment complex pins |
| `favorites` | Vacancies | User's saved vacancies |
