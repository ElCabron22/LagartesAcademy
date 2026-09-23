// Wrapper de fetch do frontend: anexa o token Bearer salvo no localStorage.
export const SESSION_KEY = 'lagartes_session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function setSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function api(path, options = {}) {
  const session = getSession()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  const r = await fetch(`/api${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(data.error || 'Falha na requisição')
    e.status = r.status
    e.data = data // ex.: { locked: true, course, support } quando o módulo está bloqueado
    throw e
  }
  return data
}

// Converte link do YouTube (watch, youtu.be, shorts) em URL de embed; mantém mp4 direto.
export function youtubeEmbed(url) {
  if (!url) return null
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  return String(url).startsWith('http') ? url : null
}
