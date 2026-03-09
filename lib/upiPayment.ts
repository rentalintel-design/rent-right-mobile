// UPI deep link payment helper for rent payments
// Opens the user's installed UPI app (GPay, PhonePe, Paytm, etc.)

import * as Linking from 'expo-linking'
import { Alert } from 'react-native'

type UpiPaymentParams = {
  upiId: string          // Landlord's UPI ID (e.g., "name@upi")
  payeeName: string      // Landlord's name
  amount: number         // Rent amount in INR
  txnNote: string        // e.g., "Rent Mar 2026 · Green Towers"
  txnRef: string         // Unique ref (payment ID)
}

/**
 * Build a UPI deep link URI.
 * Spec: https://www.npci.org.in/what-we-do/upi/upi-common-library
 */
export function buildUpiUri(params: UpiPaymentParams): string {
  const query = new URLSearchParams({
    pa: params.upiId,
    pn: params.payeeName,
    tn: params.txnNote,
    am: params.amount.toFixed(2),
    cu: 'INR',
    tr: params.txnRef,
  })
  return `upi://pay?${query.toString()}`
}

/**
 * Open UPI payment app with the given params.
 * Returns true if the UPI app was opened, false otherwise.
 */
export async function openUpiPayment(params: UpiPaymentParams): Promise<boolean> {
  const uri = buildUpiUri(params)

  const canOpen = await Linking.canOpenURL(uri)
  if (!canOpen) {
    Alert.alert(
      'No UPI App Found',
      'Please install a UPI app (Google Pay, PhonePe, Paytm, etc.) to pay rent directly.',
    )
    return false
  }

  try {
    await Linking.openURL(uri)
    return true
  } catch {
    Alert.alert('Error', 'Could not open UPI app. Please try again.')
    return false
  }
}

/**
 * Format month string (YYYY-MM) to display format (Mar 2026).
 */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const date = new Date(parseInt(year), parseInt(m) - 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
