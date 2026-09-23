'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { api, getSession, youtubeEmbed } from '@/lib/api-client'
import { FloatingWhatsApp, LockedModule } from '@/components/whatsapp'
import { ArrowLeft, PlayCircle } from 'lucide-react'

function Player({ url, title }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [loadingSigned, setLoadingSigned] = useState(false)
  const isStorage = url && !/^https?:\/\//i.test(url)

  useEffect(() => {
    let alive = true
    if (isStorage) {
      setLoadingSigned(true)
      setSignedUrl(null)
      api('/storage/playback-url', { method: 'POST', body: JSON.stringify({ objectPath: url }) })
        .then((d) => { if (alive) setSignedUrl(d.url) })
        .catch(() => { if (alive) setSignedUrl(null) })
        .finally(() => { if (alive) setLoadingSigned(false) })
    }
    return () => { alive = false }
  }, [url])

  if (isStorage) {
    if (loadingSigned) {
      return <div className="aspect-video w-full animate-pulse rounded-xl border border-border bg-black/40" />
    }
    if (!signedUrl) {
      return <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-black/40 text-sm text-muted-foreground">Não foi possível carregar o vídeo</div>
    }
    return <video src={signedUrl} controls preload="metadata" className="aspect-video w-full rounded-xl border border-border bg-black" />
  }

  const embed = youtubeEmbed(url)
  if (!embed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-black/40 text-sm text-muted-foreground">
        Sem vídeo disponível para esta aula
      </div>
    )
  }
  if (/youtube\.com\/embed\//.test(embed)) {
    return (
      <iframe
        src={embed}
        title={title}
        className="aspect-video w-full rounded-xl border border-border bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }
  return <video src={embed} controls className="aspect-video w-full rounded-xl border border-border bg-black" />
}

export default function CoursePage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(null) // { course, support } quando a API responde 403 locked
  const [support, setSupport] = useState(null)
  const [selected, setSelected] = useState(null)

  const { id } = useParams()

  useEffect(() => {
    if (!getSession()) { router.replace('/'); return }
    let active = true
    api('/support').then((s) => { if (active) setSupport(s) }).catch(() => {})
    api(`/courses/${id}`)
      .then((d) => {
        if (!active) return
        setData(d)
        setSelected(d.lessons?.[0]?.id ?? null)
      })
      .catch((e) => {
        if (!active) return
        if (e.status === 401) { router.replace('/'); return }
        if (e.status === 403 && e.data?.locked) { setLocked({ course: e.data.course, support: e.data.support }); return }
        setError(e.message)
      })
    return () => { active = false }
  }, [id])

  const header = (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href="/home"><ArrowLeft className="h-4 w-4" /> Meus cursos</Link>
        </Button>
      </div>
    </header>
  )

  if (locked) {
    return (
      <main className="min-h-screen pb-24">
        {header}
        <div className="container py-16">
          <LockedModule support={locked.support || support} course={locked.course} />
        </div>
        <FloatingWhatsApp support={locked.support || support} />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline"><Link href="/home">Voltar para a Home</Link></Button>
      </main>
    )
  }

  if (!data) {
    return <main className="container py-10"><div className="h-96 animate-pulse rounded-xl border border-border bg-card" /></main>
  }

  const lesson = data.lessons?.find((l) => l.id === selected) || data.lessons?.[0]

  return (
    <main className="min-h-screen pb-24">
      {header}

      <div className="container py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Curso</p>
        <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{data.course?.title}</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Aulas ({data.lessons?.length || 0})</p>
            {(data.lessons || []).map((l, i) => {
              const active = l.id === lesson?.id
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelected(l.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                    active ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {i + 1}
                  </span>
                  <span className={`line-clamp-2 text-sm ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{l.title}</span>
                </button>
              )
            })}
            {!(data.lessons || []).length && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                <PlayCircle className="h-4 w-4" /> Este curso ainda não tem aulas.
              </div>
            )}
          </aside>

          <section className="space-y-4">
            {lesson ? (
              <>
                <Player url={lesson.video_url} title={lesson.title} />
                <div className="space-y-2">
                  <h2 className="text-xl font-bold md:text-2xl">{lesson.title}</h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-base">{lesson.description}</p>
                </div>
              </>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Selecione uma aula para começar
              </div>
            )}
          </section>
        </div>
      </div>

      <FloatingWhatsApp support={support} />
    </main>
  )
}
