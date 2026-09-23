'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { api, getSession, setSession, clearSession } from '@/lib/api-client'
import { getBrowserSupabase } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [brand, setBrand] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/home').then((r) => r.json()).then(setBrand).catch(() => {})
    if (getSession()) {
      api('/auth/me').then(() => router.replace('/home')).catch(() => clearSession())
    }
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const isSignup = mode === 'signup'
      const data = await api(isSignup ? '/auth/signup' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(isSignup ? form : { email: form.email, password: form.password }),
      })
      if (!data.session) {
        setMode('login')
        setError('Conta criada! Agora entre com seu e-mail e senha.')
        return
      }
      setSession({ access_token: data.session.access_token, user: data.user, profile: data.profile })
      router.push('/home')
    } catch (e2) {
      setError(e2.message)
    } finally {
      setLoading(false)
    }
  }

  async function loginGoogle() {
    setError('')
    const supabase = getBrowserSupabase()
    if (!supabase) { setError('Login com Google indisponível no momento.'); return }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) setError(err.message)
  }

  const logoUrl = brand?.logo_url || ''
  const title = brand?.main_title || 'LAGARTES ACADEMY'
  const text = brand?.main_text || 'Cursos profissionais para você aprender do zero, no seu ritmo.'

  return (
    <main className="flex min-h-screen bg-background">
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <div className="pointer-events-none absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <Logo logoUrl={logoUrl} className="h-12" />
        <div className="relative max-w-lg space-y-5">
          <h1 className="text-4xl font-extrabold leading-tight xl:text-5xl">{title}</h1>
          <p className="text-lg text-muted-foreground">{text}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Aprenda no seu ritmo</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Aulas direto ao ponto</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LAGARTES ACADEMY</p>
      </section>

      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden"><Logo logoUrl={logoUrl} className="h-10" /></div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{mode === 'login' ? 'Bem-vindo de volta' : 'Criar sua conta'}</h2>
            <p className="text-sm text-muted-foreground">{mode === 'login' ? 'Entre para acessar seus cursos.' : 'É rápido — em um minuto você já está dentro.'}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input id="full_name" placeholder="Seu nome" value={form.full_name} onChange={set('full_name')} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="voce@email.com" value={form.email} onChange={set('email')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} minLength={6} required />
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="h-11 w-full text-sm font-bold uppercase tracking-wide">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" onClick={loginGoogle} className="h-11 w-full gap-2 text-sm font-semibold">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.66-.07-1.16-.16-1.66H12z"/></svg>
            Entrar com Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>Não tem conta? <button type="button" onClick={() => { setMode('signup'); setError('') }} className="font-semibold text-primary hover:underline">Criar conta</button></>
            ) : (
              <>Já tem conta? <button type="button" onClick={() => { setMode('login'); setError('') }} className="font-semibold text-primary hover:underline">Entrar</button></>
            )}
          </p>
          {mode === 'signup' && (
            <p className="text-center text-xs text-muted-foreground">A primeira conta criada se torna administradora da plataforma.</p>
          )}
        </div>
      </section>
    </main>
  )
}
