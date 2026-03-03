import { supabase } from './supabase'

const BUCKET = 'vault-photos'

export async function uploadVaultPhoto(
  recordId: string,
  roomId: string,
  uri: string,
): Promise<{ url: string; storagePath: string } | null> {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const storagePath = `${recordId}/${roomId}/${timestamp}_${rand}.${ext}`

    const response = await fetch(uri)
    const blob = await response.blob()

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, blob, { cacheControl: '3600', contentType: `image/${ext}` })

    if (error) {
      console.error('[vaultStorage] upload failed:', error.message)
      return null
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return { url: urlData.publicUrl, storagePath }
  } catch (err) {
    console.error('[vaultStorage] upload error:', err)
    return null
  }
}

export async function deleteVaultPhoto(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) console.error('[vaultStorage] delete failed:', error.message)
}
