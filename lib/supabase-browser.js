'use client'

import { createClient } from '@supabase/supabase-js'

// Cliente do Supabase para uso no navegador (Login com Google + upload de vídeo).
// Usa apenas a chave pública (anon) - segura para expor no browser.
let _client = null

export function getBrowserSupabase() {
  if (typeof window === 'undefined') return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  if (!_client) {
    _client = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return _client
}

export const VIDEO_BUCKET = 'lesson-videos'
