/**
 * Mask a phone number, showing only the last 4 digits.
 * e.g. "9876543210" → "••••••3210"
 */
export function maskPhone(phone: string): string {
  if (!phone) return '••••'
  if (phone.length <= 4) return phone
  return '•'.repeat(phone.length - 4) + phone.slice(-4)
}
