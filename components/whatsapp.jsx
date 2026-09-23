'use client'

import { Button } from '@/components/ui/button'
import { whatsappLink } from '@/lib/support'
import { Lock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function WhatsAppIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-1.9c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.9S23.2 3 16 3zm0 23.5c-2.1 0-4.1-.6-5.8-1.6l-.4-.2-3.8 1.1 1.1-3.6-.3-.4c-1.2-1.8-1.8-3.8-1.8-5.9C5 10 9.9 5.2 16 5.2S27 10 27 15.9 22.1 26.5 16 26.5zm6-8c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1.1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.1.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z" />
    </svg>
  )
}

// Botão de suporte via WhatsApp. Trata a falta de configuração (número vazio) sem quebrar a tela.
export function WhatsAppButton({ support, moduleTitle, className = '', size = 'default', testId = 'whatsapp-button' }) {
  const href = whatsappLink(support, moduleTitle)
  if (!href) {
    return (
      <Button variant="outline" size={size} disabled className={className} data-testid={`${testId}-disabled`}>
        <WhatsAppIcon className="h-4 w-4" /> Suporte indisponível no momento
      </Button>
    )
  }
  return (
    <Button asChild size={size} className={`bg-[#25D366] font-bold text-black hover:bg-[#1ebe5d] ${className}`} data-testid={testId}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon className="h-4 w-4" /> {support?.button_text || 'Falar no WhatsApp'}
      </a>
    </Button>
  )
}

// Botão flutuante, sempre visível na área do aluno (texto configurável no admin).
export function FloatingWhatsApp({ support }) {
  if (!support || support.show_float === false) return null
  const href = whatsappLink(support)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-float"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 font-bold text-black shadow-[0_8px_30px_rgba(37,211,102,0.45)] transition hover:scale-105 hover:bg-[#1ebe5d]"
    >
      <WhatsAppIcon className="h-6 w-6" />
      {support.float_text ? <span className="hidden text-sm sm:inline">{support.float_text}</span> : null}
    </a>
  )
}

// Tela de módulo bloqueado (usada em /curso/[id] quando a API responde 403 locked).
export function LockedModule({ support, course }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border border-border bg-card p-10 text-center" data-testid="locked-module">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Lock className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Módulo bloqueado</p>
        <h1 className="text-2xl font-extrabold">{course?.title || 'Módulo'}</h1>
        <p className="text-sm text-muted-foreground" data-testid="locked-message">{support?.locked_message}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <WhatsAppButton support={support} moduleTitle={course?.title} testId="locked-whatsapp" />
        <Button asChild variant="outline"><Link href="/home"><ArrowLeft className="h-4 w-4" /> Meus cursos</Link></Button>
      </div>
    </div>
  )
}
