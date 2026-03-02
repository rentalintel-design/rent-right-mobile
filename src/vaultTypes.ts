// Vault (Move-In Record) types and constants
// Translated from Flutter flutter-app-reference/lib/models/vault_models.dart
// and flutter-app-reference/lib/models/furnishing_models.dart

// ─────────────────────────────────────────────────────────────────────────────
// Property Types
// ─────────────────────────────────────────────────────────────────────────────

export type PropertyType = '1RK' | '1BHK' | '2BHK' | '3BHK' | '4BHK'

export const PROPERTY_TYPES: { id: PropertyType; label: string; bedrooms: number }[] = [
  { id: '1RK',  label: '1 RK',  bedrooms: 0 },
  { id: '1BHK', label: '1 BHK', bedrooms: 1 },
  { id: '2BHK', label: '2 BHK', bedrooms: 2 },
  { id: '3BHK', label: '3 BHK', bedrooms: 3 },
  { id: '4BHK', label: '4 BHK', bedrooms: 4 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Room Config
// ─────────────────────────────────────────────────────────────────────────────

export type RoomConfig = {
  id: string
  name: string
  icon: string
  isOptional?: boolean
  isExtra?: boolean
}

// Template rooms per BHK type (from Flutter PropertyRooms class)
export const ROOMS_BY_TYPE: Record<PropertyType, RoomConfig[]> = {
  '1RK': [
    { id: 'room',     name: 'Room',     icon: '🚪' },
    { id: 'kitchen',  name: 'Kitchen',  icon: '🍳' },
    { id: 'bathroom', name: 'Bathroom', icon: '🚿' },
  ],
  '1BHK': [
    { id: 'bedroom1',  name: 'Bedroom',      icon: '🛏️' },
    { id: 'hall',      name: 'Hall/Living',   icon: '🛋️' },
    { id: 'kitchen',   name: 'Kitchen',       icon: '🍳' },
    { id: 'bathroom1', name: 'Bathroom',      icon: '🚿' },
  ],
  '2BHK': [
    { id: 'bedroom1',  name: 'Bedroom 1',    icon: '🛏️' },
    { id: 'bedroom2',  name: 'Bedroom 2',    icon: '🛏️' },
    { id: 'hall',      name: 'Hall/Living',  icon: '🛋️' },
    { id: 'kitchen',   name: 'Kitchen',      icon: '🍳' },
    { id: 'bathroom1', name: 'Bathroom 1',   icon: '🚿' },
    { id: 'bathroom2', name: 'Bathroom 2',   icon: '🚿', isOptional: true },
  ],
  '3BHK': [
    { id: 'bedroom1',  name: 'Master Bedroom', icon: '🛏️' },
    { id: 'bedroom2',  name: 'Bedroom 2',      icon: '🛏️' },
    { id: 'bedroom3',  name: 'Bedroom 3',      icon: '🛏️' },
    { id: 'hall',      name: 'Hall/Living',    icon: '🛋️' },
    { id: 'dining',    name: 'Dining',         icon: '🍽️' },
    { id: 'kitchen',   name: 'Kitchen',        icon: '🍳' },
    { id: 'bathroom1', name: 'Bathroom 1',     icon: '🚿' },
    { id: 'bathroom2', name: 'Bathroom 2',     icon: '🚿' },
  ],
  '4BHK': [
    { id: 'bedroom1',  name: 'Master Bedroom', icon: '🛏️' },
    { id: 'bedroom2',  name: 'Bedroom 2',      icon: '🛏️' },
    { id: 'bedroom3',  name: 'Bedroom 3',      icon: '🛏️' },
    { id: 'bedroom4',  name: 'Bedroom 4',      icon: '🛏️' },
    { id: 'hall',      name: 'Hall/Living',    icon: '🛋️' },
    { id: 'dining',    name: 'Dining',         icon: '🍽️' },
    { id: 'kitchen',   name: 'Kitchen',        icon: '🍳' },
    { id: 'bathroom1', name: 'Bathroom 1',     icon: '🚿' },
    { id: 'bathroom2', name: 'Bathroom 2',     icon: '🚿' },
    { id: 'bathroom3', name: 'Bathroom 3',     icon: '🚿', isOptional: true },
  ],
}

// Extra features (can add multiple instances per floor)
export const EXTRA_FEATURES: RoomConfig[] = [
  { id: 'balcony',       name: 'Balcony',       icon: '🏗️', isExtra: true },
  { id: 'garden',        name: 'Garden',        icon: '🌿', isExtra: true },
  { id: 'parking',       name: 'Parking',       icon: '🅿️', isExtra: true },
  { id: 'terrace',       name: 'Terrace',       icon: '🏠', isExtra: true },
  { id: 'pool',          name: 'Swimming Pool', icon: '🏊', isExtra: true },
  { id: 'gym',           name: 'Gym',           icon: '💪', isExtra: true },
  { id: 'study',         name: 'Study Room',    icon: '📚', isExtra: true },
  { id: 'kids_room',     name: 'Kids Room',     icon: '🧸', isExtra: true },
  { id: 'store',         name: 'Store Room',    icon: '📦', isExtra: true },
  { id: 'servant_room',  name: 'Servant Room',  icon: '🛖', isExtra: true },
  { id: 'puja_room',     name: 'Puja Room',     icon: '🪔', isExtra: true },
  { id: 'other',         name: 'Other',         icon: '➕', isExtra: true },
]

// ─────────────────────────────────────────────────────────────────────────────
// Core Data Types
// ─────────────────────────────────────────────────────────────────────────────

export type DeletableRoom = {
  instanceId: string
  config: RoomConfig
  isFromTemplate: boolean
  floorIndex: number
}

export type AddedExtraRoom = {
  instanceId: string
  featureId: string
  config: RoomConfig
  floorIndex: number
}

export type VaultFloor = {
  index: number
  name: string
  propertyType: PropertyType
  rooms: DeletableRoom[]
  extraRooms: AddedExtraRoom[]
}

export type VaultMedia = {
  id: string
  roomId: string
  url: string
  storagePath?: string
  note?: string
  capturedAt: string
  isVideo: boolean
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed'
}

export type VaultRoom = {
  config: RoomConfig
  media: VaultMedia[]
}

export type AddedFurnishing = {
  id: string
  itemId: string
  itemName: string
  itemIcon: string
  categoryId: string
  quantity: number
  condition?: string
  notes?: string
  roomId?: string
}

export type SharedParty = {
  name?: string
  phone?: string
  email?: string
  role: 'landlord' | 'tenant'
  acceptedAt?: string
}

export type VaultRecord = {
  id?: string
  user_id: string
  property_type: PropertyType
  property_address?: string
  city?: string
  floors: VaultFloor[]
  furnishings: AddedFurnishing[]
  room_data: Record<string, VaultRoom>
  is_locked: boolean
  creator_role: 'landlord' | 'tenant'
  sharing_status: 'draft' | 'shared' | 'changes_requested' | 'accepted'
  other_party?: SharedParty
  // Mutual agreement fields
  share_token?: string
  other_party_user_id?: string
  change_request_note?: string
  expires_at?: string
  extended_at?: string
  created_at?: string
  updated_at?: string
  shared_at?: string
  accepted_at?: string
}

export type VaultComment = {
  id: string
  record_id: string
  author_name: string
  author_user_id?: string
  room_id?: string       // null = general comment on whole record
  content: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Get all rooms from all floors (template + extra) as DeletableRoom[] */
export function getAllRooms(floors: VaultFloor[]): DeletableRoom[] {
  const result: DeletableRoom[] = []
  for (const floor of floors) {
    result.push(...floor.rooms)
    for (const extra of floor.extraRooms) {
      result.push({
        instanceId: extra.instanceId,
        config: extra.config,
        isFromTemplate: false,
        floorIndex: extra.floorIndex,
      })
    }
  }
  return result
}

/** Build initial floor with template rooms from BHK type */
export function buildInitialFloor(propertyType: PropertyType, floorIndex: number): VaultFloor {
  const templateRooms = ROOMS_BY_TYPE[propertyType]
  const rooms: DeletableRoom[] = templateRooms.map(config => ({
    instanceId: `template_${config.id}_floor${floorIndex}`,
    config,
    isFromTemplate: true,
    floorIndex,
  }))
  return {
    index: floorIndex,
    name: `Floor ${floorIndex + 1}`,
    propertyType,
    rooms,
    extraRooms: [],
  }
}

/** Count total photos across all rooms */
export function countPhotos(roomData: Record<string, VaultRoom>): number {
  return Object.values(roomData).reduce((sum, room) => sum + room.media.filter(m => !m.isVideo).length, 0)
}

/** Count rooms that have at least one photo */
export function countDocumentedRooms(floors: VaultFloor[], roomData: Record<string, VaultRoom>): number {
  return getAllRooms(floors).filter(r => (roomData[r.instanceId]?.media ?? []).length > 0).length
}

/** Strip File/Blob references from room_data for Supabase JSON serialization */
export function serializeRoomData(roomData: Record<string, VaultRoom>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, room] of Object.entries(roomData)) {
    result[key] = {
      config: room.config,
      media: room.media.map(m => ({
        id: m.id,
        roomId: m.roomId,
        url: m.url,
        storagePath: m.storagePath,
        note: m.note,
        capturedAt: m.capturedAt,
        isVideo: m.isVideo,
        uploadStatus: m.uploadStatus,
      })),
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Furnishing Catalog (8 categories, 60+ items)
// Translated from Flutter FurnishingsCatalog in furnishing_models.dart
// ─────────────────────────────────────────────────────────────────────────────

export type FurnishingItem = { id: string; name: string; icon: string }
export type FurnishingCategory = { id: string; name: string; icon: string; items: FurnishingItem[] }

export const FURNISHING_CATALOG: FurnishingCategory[] = [
  {
    id: 'living_room', name: 'Living Room', icon: '🛋️',
    items: [
      { id: 'sofa',           name: 'Sofa',             icon: '🛋️' },
      { id: 'sofa_set',       name: 'Sofa Set',         icon: '🛋️' },
      { id: 'coffee_table',   name: 'Coffee Table',     icon: '🪑' },
      { id: 'side_table',     name: 'Side Table',       icon: '🪑' },
      { id: 'tv_unit',        name: 'TV Unit',          icon: '📺' },
      { id: 'showcase',       name: 'Showcase/Cabinet', icon: '🗄️' },
      { id: 'bean_bag',       name: 'Bean Bag',         icon: '🪑' },
      { id: 'rug',            name: 'Rug/Carpet',       icon: '🟫' },
      { id: 'curtains_living',name: 'Curtains',         icon: '🪟' },
      { id: 'wall_clock',     name: 'Wall Clock',       icon: '🕐' },
      { id: 'mirror',         name: 'Mirror',           icon: '🪞' },
      { id: 'lamp',           name: 'Floor Lamp',       icon: '💡' },
    ],
  },
  {
    id: 'bedroom', name: 'Bedroom', icon: '🛏️',
    items: [
      { id: 'bed_single',      name: 'Single Bed',     icon: '🛏️' },
      { id: 'bed_double',      name: 'Double Bed',     icon: '🛏️' },
      { id: 'bed_king',        name: 'King Size Bed',  icon: '🛏️' },
      { id: 'mattress',        name: 'Mattress',       icon: '🛏️' },
      { id: 'wardrobe',        name: 'Wardrobe',       icon: '🚪' },
      { id: 'dresser',         name: 'Dresser',        icon: '🪞' },
      { id: 'bedside_table',   name: 'Bedside Table',  icon: '🪑' },
      { id: 'study_table',     name: 'Study Table',    icon: '🖥️' },
      { id: 'chair_bedroom',   name: 'Chair',          icon: '🪑' },
      { id: 'curtains_bedroom',name: 'Curtains',       icon: '🪟' },
      { id: 'bedside_lamp',    name: 'Bedside Lamp',   icon: '💡' },
      { id: 'blanket',         name: 'Blanket/Quilt',  icon: '🛏️' },
    ],
  },
  {
    id: 'kitchen', name: 'Kitchen', icon: '🍳',
    items: [
      { id: 'refrigerator',   name: 'Refrigerator',    icon: '❄️' },
      { id: 'microwave',      name: 'Microwave',       icon: '📡' },
      { id: 'stove',          name: 'Gas Stove',       icon: '🔥' },
      { id: 'oven',           name: 'Oven',            icon: '🫙' },
      { id: 'chimney',        name: 'Chimney/Hood',    icon: '💨' },
      { id: 'dishwasher',     name: 'Dishwasher',      icon: '🫧' },
      { id: 'water_purifier', name: 'Water Purifier',  icon: '💧' },
      { id: 'kitchen_rack',   name: 'Kitchen Rack',    icon: '🗄️' },
      { id: 'dining_table',   name: 'Dining Table',    icon: '🍽️' },
      { id: 'dining_chairs',  name: 'Dining Chairs',   icon: '🪑' },
      { id: 'crockery_set',   name: 'Crockery Set',   icon: '🍽️' },
      { id: 'pressure_cooker',name: 'Pressure Cooker', icon: '🍲' },
    ],
  },
  {
    id: 'bathroom', name: 'Bathroom', icon: '🚿',
    items: [
      { id: 'geyser',          name: 'Water Heater/Geyser', icon: '🌡️' },
      { id: 'exhaust_fan',     name: 'Exhaust Fan',         icon: '💨' },
      { id: 'bathroom_rack',   name: 'Bathroom Rack',       icon: '🗄️' },
      { id: 'mirror_bathroom', name: 'Mirror',              icon: '🪞' },
      { id: 'shower_curtain',  name: 'Shower Curtain',      icon: '🚿' },
      { id: 'towel_rack',      name: 'Towel Rack',          icon: '🪝' },
      { id: 'soap_dispenser',  name: 'Soap Dispenser',      icon: '🧴' },
      { id: 'bathroom_mat',    name: 'Bathroom Mat',        icon: '🟫' },
    ],
  },
  {
    id: 'electronics', name: 'Electronics', icon: '📺',
    items: [
      { id: 'television',      name: 'Television',       icon: '📺' },
      { id: 'ac',              name: 'Air Conditioner',  icon: '❄️' },
      { id: 'ceiling_fan',     name: 'Ceiling Fan',      icon: '🌀' },
      { id: 'air_cooler',      name: 'Air Cooler',       icon: '💨' },
      { id: 'inverter',        name: 'Inverter/UPS',     icon: '🔋' },
      { id: 'washing_machine', name: 'Washing Machine',  icon: '🫧' },
      { id: 'dryer',           name: 'Clothes Dryer',    icon: '🫧' },
      { id: 'iron',            name: 'Iron',             icon: '🪝' },
      { id: 'vacuum',          name: 'Vacuum Cleaner',   icon: '🧹' },
      { id: 'water_heater',    name: 'Water Heater',     icon: '🌡️' },
      { id: 'router',          name: 'WiFi Router',      icon: '📶' },
      { id: 'set_top_box',     name: 'Set Top Box',      icon: '📡' },
    ],
  },
  {
    id: 'outdoor', name: 'Outdoor/Balcony', icon: '🌿',
    items: [
      { id: 'outdoor_chairs', name: 'Outdoor Chairs', icon: '🪑' },
      { id: 'outdoor_table',  name: 'Outdoor Table',  icon: '🪑' },
      { id: 'swing',          name: 'Swing/Jhula',    icon: '🪂' },
      { id: 'plant_stand',    name: 'Plant Stand',    icon: '🌱' },
      { id: 'drying_rack',    name: 'Drying Rack',    icon: '🪝' },
      { id: 'outdoor_light',  name: 'Outdoor Light',  icon: '💡' },
    ],
  },
  {
    id: 'safety', name: 'Safety & Security', icon: '🔒',
    items: [
      { id: 'smoke_detector',    name: 'Smoke Detector',     icon: '🚨' },
      { id: 'fire_extinguisher', name: 'Fire Extinguisher',  icon: '🧯' },
      { id: 'video_doorbell',    name: 'Video Doorbell',     icon: '🔔' },
      { id: 'security_camera',   name: 'Security Camera',    icon: '📹' },
      { id: 'door_lock',         name: 'Smart Door Lock',    icon: '🔐' },
      { id: 'safety_deposit',    name: 'Safety Deposit Box', icon: '🗄️' },
    ],
  },
  {
    id: 'other', name: 'Other Items', icon: '📦',
    items: [
      { id: 'ladder',        name: 'Ladder',         icon: '🪜' },
      { id: 'toolkit',       name: 'Tool Kit',       icon: '🔧' },
      { id: 'step_stool',    name: 'Step Stool',     icon: '🪜' },
      { id: 'storage_boxes', name: 'Storage Boxes',  icon: '📦' },
      { id: 'shoe_rack',     name: 'Shoe Rack',      icon: '👟' },
      { id: 'coat_hanger',   name: 'Coat Hanger',    icon: '🪝' },
      { id: 'other_item',    name: 'Other Item',     icon: '➕' },
    ],
  },
]
