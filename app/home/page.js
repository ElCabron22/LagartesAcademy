'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/logo'
import { api, getSession, clearSession } from '@/lib/api-client'
import { FloatingWhatsApp, WhatsAppButton } from '@/components/whatsapp'
import { LogOut, LayoutDashboard, PlayCircle, ArrowRight, BookOpen, Lock } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [courses, setCourses] = useState(null)
  const [brand, setBrand] = useState({ logo_url: '' })
  const [support, setSupport] = useState(null)

  useEffect(() => {
    if (!getSession()) { router.replace('/'); return }
    api('/auth/me').then(setMe).catch(() => { clearSession(); router.replace('/') })
    api('/courses').then(setCourses).catch(() => setCourses([]))
    api('/support').then(setSupport).catch(() => setSupport(null))
    fetch('/api/home').then((r) => r.json()).then(setBrand).catch(() => {})
  }, [])

  function sair() {
    clearSession()
    router.replace('/')
  }

  const first = (me?.profile?.full_name || '').trim().split(/\s+/)[0] || 'aluno'

  return (
    <main className="min-h-screen pb-24">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo logoUrl={brand.logo_url} />
          <div className="flex items-center gap-2">
            {me?.profile?.role === 'admin' && (
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href="/admin"><LayoutDashboard className="h-4 w-4" /> Painel Admin</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={sair} data-testid="logout-button"><LogOut className="h-4 w-4" /> Sair</Button>
          </div>
        </div>
      </header>

      <div className="container py-10 md:py-14">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-extrabold md:text-4xl">Olá, {first}!</h1>
          <p className="text-muted-foreground">Bem-vindo de volta. Continue de onde parou.</p>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-bold">Meus Cursos</h2>
          {courses === null ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-xl border border-border bg-card" />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum curso disponível ainda.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((c) => c.locked ? (
                // ---- Módulo bloqueado: cadeado + mensagem configurável + WhatsApp ----
                <div
                  key={c.id}
                  data-testid={`course-card-locked-${c.id}`}
                  className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-6 opacity-95"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Lock className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Bloqueado</Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-muted-foreground">{c.title}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground/80">{support?.locked_message || 'Módulo não liberado.'}</p>
                  <div className="mt-5">
                    <WhatsAppButton support={support} moduleTitle={c.title} size="sm" className="w-full" testId={`whatsapp-course-${c.id}`} />
                  </div>
                </div>
              ) : (
                <Link
                  key={c.id}
                  href={`/curso/${c.id}`}
                  data-testid={`course-card-${c.id}`}
                  className="group flex flex-col rounded-xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-[0_0_36px_rgba(159,221,5,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <PlayCircle className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary">{c.lessons_count} {c.lessons_count === 1 ? 'aula' : 'aulas'}</Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{c.title}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                    Acessar curso <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <FloatingWhatsApp support={support} />
    </main>
  )
}
