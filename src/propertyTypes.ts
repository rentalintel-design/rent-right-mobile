// ── Property detail types ────────────────────────────────────────────────────

export type PropertyType = 'apartment' | 'villa' | 'independent_house' | 'pg_hostel'
export type FurnishingStatus = 'furnished' | 'semi_furnished' | 'unfurnished'

export type PhotoEntry = {
  url: string
  storagePath: string
}

export type PropertyDetail = {
  id: string
  property_id: string
  property_type: PropertyType | null
  area_sqft: number | null
  furnishing: FurnishingStatus | null
  bedrooms: number | null
  bathrooms: number | null
  floor_number: string | null
  facing: string | null
  parking: string | null
  contact_phone: string | null
  reddit_link: string | null
  photos: PhotoEntry[]
  amenities: string[]
  description: string | null
  updated_by: string | null
  updated_at: string
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string; icon: string }[] = [
  { value: 'apartment',        label: 'Apartment',        icon: '🏢' },
  { value: 'villa',            label: 'Villa',            icon: '🏡' },
  { value: 'independent_house', label: 'Independent House', icon: '🏠' },
  { value: 'pg_hostel',        label: 'PG / Hostel',      icon: '🏨' },
]

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  independent_house: 'Independent House',
  pg_hostel: 'PG / Hostel',
}

export const PROPERTY_TYPE_ICONS: Record<PropertyType, string> = {
  apartment: '🏢',
  villa: '🏡',
  independent_house: '🏠',
  pg_hostel: '🏨',
}

export const FURNISHING_OPTIONS: { value: FurnishingStatus; label: string; icon: string }[] = [
  { value: 'furnished',       label: 'Furnished',       icon: '🛋️' },
  { value: 'semi_furnished',  label: 'Semi-Furnished',  icon: '🪑' },
  { value: 'unfurnished',     label: 'Unfurnished',     icon: '📦' },
]

export const FURNISHING_LABELS: Record<FurnishingStatus, string> = {
  furnished: 'Furnished',
  semi_furnished: 'Semi-Furnished',
  unfurnished: 'Unfurnished',
}

export const FACING_OPTIONS = [
  'North', 'South', 'East', 'West',
  'North-East', 'North-West', 'South-East', 'South-West',
]

export const MAX_PROPERTY_PHOTOS = 10

// Template photo URL for reddit-sourced properties with no uploaded photos
export const REDDIT_PLACEHOLDER_PHOTO = '/images/reddit-property-placeholder.svg'
