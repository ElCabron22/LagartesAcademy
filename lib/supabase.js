import { createClient } from '@supabase/supabase-js'

// Clientes Supabase - só usados no servidor (Node runtime).
// Quando as 3 variáveis estiverem preenchidas no .env, o modo Supabase ativa automaticamente.
const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

export function isSupabaseConfigured() {
  return Boolean(url && anon && service)
}

export function publicClient(accessToken) {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  })
}

export function adminClient() {
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
