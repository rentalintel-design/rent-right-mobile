// Dark Google Maps style JSON for Android
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a1628' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a6685' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#7896b4' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#b8ccdf' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#4a6685' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1f35' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#22c55e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#162240' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7896b4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2563eb' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0f1f35' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#7896b4' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1f35' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2563eb' }] },
]

// BHK colors for vacancy markers
export const BHK_COLORS: Record<string, string> = {
  '1BHK': '#3b82f6',  // blue
  '1RK': '#3b82f6',
  '2BHK': '#22c55e',  // green
  '3BHK': '#f97316',  // orange
  '4BHK': '#ef4444',  // red
  '4BHK+': '#ef4444',
  '5BHK': '#ef4444',
}
