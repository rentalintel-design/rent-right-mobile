import { supabase } from './supabase'

const BUCKET = 'vacancy-photos'

export async function uploadVacancyPhoto(
  vacancyId: string,
  uri: string,
): Promise<{ url: string; storagePath: string } | null> {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const storagePath = `${vacancyId}/${timestamp}_${rand}.${ext}`

    const response = await fetch(uri)
    const blob = await response.blob()

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, blob, { cacheControl: '3600', contentType: `image/${ext}` })

    if (error) {
      console.error('[vacancyStorage] upload failed:', error.message)
      return null
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return { url: urlData.publicUrl, storagePath }
  } catch (err) {
    console.error('[vacancyStorage] upload error:', err)
    return null
  }
}

export async function deleteVacancyPhoto(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) console.error('[vacancyStorage] delete failed:', error.message)
}
