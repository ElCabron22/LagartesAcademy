'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { setSession } from '@/lib/api-client'
import { Logo } from '@/components/logo'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function finish() {
      const supabase = getBrowserSupabase()
      if (!supabase) { if (alive) setError('Login com Google não configurado.'); return }
      // detectSessionInUrl consome o hash/código retornado pelo Google
      const { data, error: err } = await supabase.auth.getSession()
      if (err || !data?.session) {
        if (alive) setError(err?.message || 'Não foi possível concluir o login com Google.')
        return
      }
      const s = data.session
      // Salva no mesmo formato que o resto do app usa (Bearer token)
      setSession({
        access_token: s.access_token,
        user: { id: s.user.id, email: s.user.email },
        profile: {
          id: s.user.id,
          email: s.user.email,
          full_name: s.user.user_metadata?.full_name || s.user.user_metadata?.name || '',
          role: 'student',
        },
      })
      router.replace('/home')
    }
    finish()
    return () => { alive = false }
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo className="h-12" />
      {error ? (
        <div className="space-y-3">
          <p className="text-sm text-red-400">{error}</p>
          <a href="/" className="text-sm font-semibold text-primary hover:underline">Voltar para o login</a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Concluindo login com Google...</p>
      )}
    </main>
  )
}
