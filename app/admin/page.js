'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster, toast } from 'sonner'
import { Logo } from '@/components/logo'
import { api, getSession, clearSession } from '@/lib/api-client'
import { getBrowserSupabase, VIDEO_BUCKET } from '@/lib/supabase-browser'
import { Plus, Pencil, Trash2, LogOut, ShieldAlert, BookOpen, Video, Users, Home as HomeIcon, Upload, Loader2, CheckCircle2, Lock, LockOpen, MessageCircle, History } from 'lucide-react'
import { WhatsAppButton } from '@/components/whatsapp'

// ---------- Permissões por aluno (módulo = curso) ----------
function PermissionsSection({ students }) {
  const [studentId, setStudentId] = useState('')
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const alunos = students.filter((s) => s.role !== 'admin')

  function load(id) {
    if (!id) { setData(null); return }
    setLoading(true)
    api(`/users/${id}/access`)
      .then((d) => {
        setData(d)
        const map = {}
        ;(d.courses || []).forEach((c) => { map[c.id] = c.status === 'granted' })
        setDraft(map)
      })
      .catch((e) => { toast.error(e.message); setData(null) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(studentId) }, [studentId])

  const dirty = data ? (data.courses || []).some((c) => (c.status === 'granted') !== !!draft[c.id]) : false

  async function salvar() {
    if (!data) return
    setSaving(true)
    try {
      const access = (data.courses || []).map((c) => ({ course_id: c.id, status: draft[c.id] ? 'granted' : 'revoked' }))
      const d = await api(`/users/${studentId}/access`, { method: 'PUT', body: JSON.stringify({ access }) })
      setData(d)
      const map = {}
      ;(d.courses || []).forEach((c) => { map[c.id] = c.status === 'granted' })
      setDraft(map)
      toast.success('Permissões salvas! O aluno verá a mudança ao recarregar a tela.')
    } catch (e) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  function toggleAll(v) {
    const map = {}
    ;(data?.courses || []).forEach((c) => { map[c.id] = v })
    setDraft(map)
  }

  const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '')

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-96">
          <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Aluno</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger data-testid="perm-student-select"><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
            <SelectContent>
              {alunos.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || 'Sem nome'} — {s.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {data && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toggleAll(true)}><LockOpen className="h-4 w-4" /> Liberar todos</Button>
            <Button variant="outline" size="sm" onClick={() => toggleAll(false)}><Lock className="h-4 w-4" /> Bloquear todos</Button>
          </div>
        )}
      </div>

      {!studentId && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Selecione um aluno para liberar ou bloquear módulos. Por padrão, novos alunos têm todos os módulos liberados.
        </div>
      )}
      {loading && <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />}

      {data && !loading && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {(data.courses || []).map((c) => {
              const on = !!draft[c.id]
              return (
                <div key={c.id} data-testid={`perm-row-${c.id}`} className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition ${on ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      {on ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.published ? 'Publicado' : 'Rascunho'}{c.updated_at ? ` · alterado em ${fmt(c.updated_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${on ? 'text-primary' : 'text-muted-foreground'}`}>{on ? 'Liberado' : 'Bloqueado'}</span>
                    <Switch checked={on} onCheckedChange={(v) => setDraft((d) => ({ ...d, [c.id]: v }))} data-testid={`perm-switch-${c.id}`} />
                  </div>
                </div>
              )
            })}
            {!(data.courses || []).length && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum curso cadastrado ainda.</div>}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">{dirty ? 'Há alterações não salvas.' : 'Tudo salvo.'}</p>
              <Button onClick={salvar} disabled={saving || !dirty} className="font-bold" data-testid="perm-save">{saving ? 'Salvando...' : 'Salvar permissões'}</Button>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-dashed border-border p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><History className="h-3.5 w-3.5" /> Histórico</p>
            {!(data.log || []).length && <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
            <ul className="space-y-2">
              {(data.log || []).map((l) => (
                <li key={l.id} className="flex items-start gap-2 text-sm">
                  {l.action === 'granted' ? <LockOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> : <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                  <span className="min-w-0">
                    <span className="font-semibold">{l.action === 'granted' ? 'Liberado' : 'Bloqueado'}</span> · {l.course_title}
                    <span className="block text-xs text-muted-foreground">{fmt(l.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Suporte / WhatsApp ----------
function SupportSection() {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { api('/support').then(setForm).catch((e) => toast.error(e.message)) }, [])

  if (!form) return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />

  async function salvar() {
    setSaving(true)
    try {
      const d = await api('/support', { method: 'PUT', body: JSON.stringify(form) })
      setForm(d)
      toast.success('Configurações de suporte salvas!')
    } catch (e) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
  const digits = String(form.whatsapp_number || '').replace(/\D/g, '')

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="w-number">Número do WhatsApp (com DDI e DDD, só números)</Label>
          <Input id="w-number" placeholder="5511999999999" value={form.whatsapp_number} onChange={set('whatsapp_number')} data-testid="support-number" />
          {!digits ? (
            <p className="text-xs text-destructive">Sem número, os botões de WhatsApp ficam desativados para os alunos.</p>
          ) : digits.length < 10 ? (
            <p className="text-xs text-destructive">Número parece incompleto (ex.: 5511999999999).</p>
          ) : (
            <p className="text-xs text-muted-foreground">Link gerado: https://wa.me/{digits}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-msg">Mensagem padrão (use {'{modulo}'} para inserir o nome do módulo)</Label>
          <Textarea id="w-msg" rows={2} value={form.default_message} onChange={set('default_message')} data-testid="support-message" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-locked">Mensagem exibida no módulo bloqueado</Label>
          <Textarea id="w-locked" rows={2} value={form.locked_message} onChange={set('locked_message')} data-testid="support-locked-message" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="w-btn">Texto do botão</Label>
            <Input id="w-btn" value={form.button_text} onChange={set('button_text')} data-testid="support-button-text" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-float">Texto do botão flutuante</Label>
            <Input id="w-float" value={form.float_text} onChange={set('float_text')} data-testid="support-float-text" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <Label htmlFor="w-show" className="cursor-pointer">Exibir botão flutuante na área do aluno</Label>
          <Switch id="w-show" checked={form.show_float !== false} onCheckedChange={(v) => setForm((f) => ({ ...f, show_float: v }))} data-testid="support-show-float" />
        </div>
        <Button onClick={salvar} disabled={saving} className="font-bold" data-testid="support-save">{saving ? 'Salvando...' : 'Salvar configurações'}</Button>
      </div>
      <div className="space-y-4 rounded-xl border border-dashed border-border p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pré-visualização</p>
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground"><Lock className="h-4 w-4" /><span className="font-bold">Módulo bloqueado</span></div>
          <p className="text-sm text-muted-foreground">{form.locked_message}</p>
          <WhatsAppButton support={{ ...form, whatsapp_number: digits }} moduleTitle="Nome do módulo" size="sm" className="w-full" />
        </div>
        <p className="text-xs text-muted-foreground">O botão flutuante aparece no canto inferior direito de todas as telas do aluno.</p>
      </div>
    </div>
  )
}

function VideoField({ value, onChange, courseId }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const isStorage = value && !/^https?:\/\//i.test(value)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'video/mp4') { setMsg('Envie um arquivo .mp4'); return }
    const supabase = getBrowserSupabase()
    if (!supabase) { setMsg('Upload indisponível (Supabase não configurado)'); return }
    setBusy(true); setMsg('Enviando vídeo... não feche esta janela')
    try {
      const objectPath = `lessons/${courseId || 'geral'}/${crypto.randomUUID()}.mp4`
      const signed = await api('/storage/upload-url', { method: 'POST', body: JSON.stringify({ objectPath, contentType: 'video/mp4' }) })
      const { error } = await supabase.storage.from(VIDEO_BUCKET).uploadToSignedUrl(objectPath, signed.token, file, { contentType: 'video/mp4' })
      if (error) throw new Error(error.message)
      onChange(objectPath)
      setMsg('Vídeo enviado com sucesso!')
    } catch (err) {
      setMsg('Falha no upload: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>Vídeo da aula</Label>
      <Input placeholder="Cole a URL do YouTube (ex.: https://youtu.be/...)" value={isStorage ? '' : value} onChange={(e) => onChange(e.target.value)} disabled={busy} />
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" /><span className="text-xs uppercase text-muted-foreground">ou envie um arquivo</span><div className="h-px flex-1 bg-border" />
      </div>
      <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm ${busy ? 'opacity-60' : 'hover:border-primary/50'}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? 'Enviando...' : 'Enviar vídeo (.mp4)'}
        <input type="file" accept="video/mp4" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {isStorage && !busy && (
        <p className="flex items-center gap-1.5 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> Vídeo enviado ({value.split('/').pop()})</p>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      <p className="text-[11px] text-muted-foreground">Plano grátis do Supabase: máximo 50MB por arquivo. Para vídeos maiores use o link do YouTube.</p>
    </div>
  )
}

function CoursesSection({ courses, reload }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', published: true })

  function novo() { setEditing(null); setForm({ title: '', description: '', published: true }); setOpen(true) }
  function editar(c) { setEditing(c); setForm({ title: c.title, description: c.description || '', published: !!c.published }); setOpen(true) }

  async function salvar() {
    setSaving(true)
    try {
      if (editing) await api(`/courses/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      else await api('/courses', { method: 'POST', body: JSON.stringify(form) })
      toast.success(editing ? 'Curso atualizado!' : 'Curso criado!')
      setOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  async function excluir(c) {
    if (!window.confirm(`Excluir o curso "${c.title}" e todas as suas aulas?`)) return
    try {
      await api(`/courses/${c.id}`, { method: 'DELETE' })
      toast.success('Curso excluído!')
      reload()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{courses.length} curso(s) cadastrado(s)</p>
        <Button onClick={novo} className="font-bold"><Plus className="h-4 w-4" /> Novo curso</Button>
      </div>
      <div className="space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">{c.title}</h3>
                {c.published ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Publicado</Badge> : <Badge variant="secondary">Rascunho</Badge>}
                <Badge variant="secondary">{c.lessons_count} {c.lessons_count === 1 ? 'aula' : 'aulas'}</Badge>
              </div>
              {c.description && <p className="line-clamp-1 text-sm text-muted-foreground">{c.description}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => editar(c)}><Pencil className="h-4 w-4" /> Editar</Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => excluir(c)}><Trash2 className="h-4 w-4" /> Excluir</Button>
            </div>
          </div>
        ))}
        {!courses.length && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum curso criado ainda.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar curso' : 'Novo curso'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-title">Título</Label>
              <Input id="c-title" placeholder="Ex.: CorelDRAW do Zero" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">Descrição</Label>
              <Textarea id="c-desc" rows={3} placeholder="Sobre o que é o curso..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="c-pub" className="cursor-pointer">Publicado (visível para os alunos)</Label>
              <Switch id="c-pub" checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="font-bold">{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LessonsSection({ courses }) {
  const [courseId, setCourseId] = useState('')
  const [lessons, setLessons] = useState(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ course_id: '', title: '', description: '', video_url: '', position: 1 })

  function loadLessons(id) {
    if (!id) { setLessons([]); return }
    api(`/courses/${id}`).then((d) => setLessons(d.lessons || [])).catch(() => setLessons([]))
  }

  useEffect(() => {
    if (!courseId && courses.length) setCourseId(courses[0].id)
  }, [courses])

  useEffect(() => { loadLessons(courseId) }, [courseId])

  function nova() {
    if (!courses.length) { toast.error('Crie um curso primeiro'); return }
    setEditing(null)
    setForm({ course_id: courseId || courses[0].id, title: '', description: '', video_url: '', position: (lessons?.length || 0) + 1 })
    setOpen(true)
  }

  function editar(l) {
    setEditing(l)
    setForm({ course_id: l.course_id, title: l.title, description: l.description || '', video_url: l.video_url || '', position: l.position || 0 })
    setOpen(true)
  }

  async function salvar() {
    setSaving(true)
    try {
      if (editing) await api(`/lessons/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      else await api('/lessons', { method: 'POST', body: JSON.stringify(form) })
      toast.success(editing ? 'Aula atualizada!' : 'Aula criada!')
      setOpen(false)
      loadLessons(courseId)
    } catch (e) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  async function excluir(l) {
    if (!window.confirm(`Excluir a aula "${l.title}"?`)) return
    try {
      await api(`/lessons/${l.id}`, { method: 'DELETE' })
      toast.success('Aula excluída!')
      loadLessons(courseId)
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-72">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue placeholder="Escolha o curso" /></SelectTrigger>
            <SelectContent>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={nova} className="font-bold"><Plus className="h-4 w-4" /> Nova aula</Button>
      </div>

      <div className="space-y-3">
        {(lessons || []).map((l, i) => (
          <div key={l.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">{l.position || i + 1}</span>
              <div className="min-w-0">
                <h3 className="truncate font-bold">{l.title}</h3>
                <p className="truncate text-xs text-muted-foreground">{l.video_url || 'Sem vídeo'}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => editar(l)}><Pencil className="h-4 w-4" /> Editar</Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => excluir(l)}><Trash2 className="h-4 w-4" /> Excluir</Button>
            </div>
          </div>
        ))}
        {lessons !== null && !lessons.length && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhuma aula neste curso ainda.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar aula' : 'Nova aula'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Curso</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Escolha o curso" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-title">Título</Label>
              <Input id="l-title" placeholder="Ex.: Aula 1 — Conhecendo a interface" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-desc">Descrição</Label>
              <Textarea id="l-desc" rows={3} placeholder="O que será ensinado nesta aula..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <VideoField value={form.video_url} onChange={(v) => setForm((f) => ({ ...f, video_url: v }))} courseId={form.course_id} />
            <div className="space-y-2">
              <Label htmlFor="l-pos">Ordem (posição)</Label>
              <Input id="l-pos" type="number" min={0} value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="font-bold">{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StudentsSection({ students, reload, me }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })

  async function salvar() {
    setSaving(true)
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Aluno criado!')
      setOpen(false)
      setForm({ full_name: '', email: '', password: '' })
      reload()
    } catch (e) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  async function excluir(s) {
    if (!window.confirm(`Excluir o aluno "${s.full_name || s.email}"? A conta dele perde o acesso.`)) return
    try {
      await api(`/users/${s.id}`, { method: 'DELETE' })
      toast.success('Aluno excluído!')
      reload()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{students.length} aluno(s) cadastrado(s)</p>
        <Button onClick={() => setOpen(true)} className="font-bold"><Plus className="h-4 w-4" /> Novo aluno</Button>
      </div>
      <div className="space-y-3">
        {students.map((s) => (
          <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">{s.full_name || 'Sem nome'}</h3>
                {s.role === 'admin' ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Admin</Badge> : <Badge variant="secondary">Aluno</Badge>}
                {s.id === me?.user?.id && <Badge variant="secondary">Você</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{s.email}</p>
            </div>
            <Button
              variant="outline" size="sm" className="shrink-0 text-destructive hover:text-destructive"
              disabled={s.id === me?.user?.id}
              onClick={() => excluir(s)}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        ))}
        {!students.length && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum aluno cadastrado.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo aluno</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">Nome completo</Label>
              <Input id="s-name" placeholder="Nome do aluno" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">E-mail</Label>
              <Input id="s-email" type="email" placeholder="aluno@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-pass">Senha</Label>
              <Input id="s-pass" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="font-bold">{saving ? 'Salvando...' : 'Criar aluno'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HomeSection({ home }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (home && !form) setForm({ logo_url: home.logo_url || '', main_title: home.main_title || '', main_text: home.main_text || '' })
  }, [home])

  if (!form) return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />

  async function salvar() {
    setSaving(true)
    try {
      await api('/home', { method: 'PUT', body: JSON.stringify(form) })
      toast.success('Configurações da home salvas!')
    } catch (e) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="h-logo">Logo (URL da imagem)</Label>
          <Input id="h-logo" placeholder="https://.../logo.png (opcional)" value={form.logo_url} onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="h-title">Título principal</Label>
          <Input id="h-title" placeholder="LAGARTES ACADEMY" value={form.main_title} onChange={(e) => setForm((f) => ({ ...f, main_title: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="h-text">Texto principal</Label>
          <Textarea id="h-text" rows={3} placeholder="Frase de apresentação da plataforma..." value={form.main_text} onChange={(e) => setForm((f) => ({ ...f, main_text: e.target.value }))} />
        </div>
        <Button onClick={salvar} disabled={saving} className="font-bold">{saving ? 'Salvando...' : 'Salvar configurações'}</Button>
      </div>
      <div className="space-y-3 rounded-xl border border-dashed border-border p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pré-visualização</p>
        <Logo logoUrl={form.logo_url} className="h-12" />
        <h3 className="text-2xl font-extrabold">{form.main_title || 'Seu título aqui'}</h3>
        <p className="text-sm text-muted-foreground">{form.main_text || 'Seu texto principal aparece aqui na tela de login.'}</p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [denied, setDenied] = useState(false)
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [home, setHome] = useState(null)

  function loadAll() {
    api('/courses').then(setCourses).catch((e) => { if (e.status === 403) setDenied(true) })
    api('/users').then(setStudents).catch((e) => { if (e.status === 403) setDenied(true) })
    api('/home').then(setHome).catch(() => {})
  }

  useEffect(() => {
    if (!getSession()) { router.replace('/'); return }
    api('/auth/me')
      .then((r) => {
        setMe(r)
        if (r.profile?.role !== 'admin') setDenied(true)
        else loadAll()
      })
      .catch(() => { clearSession(); router.replace('/') })
  }, [])

  function sair() {
    clearSession()
    router.replace('/')
  }

  if (denied || (me && me.profile?.role !== 'admin')) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-4 p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-xl font-bold">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground">Somente o administrador pode acessar este painel.</p>
            <Button asChild className="w-full font-bold"><Link href="/home">Voltar para a Home</Link></Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <Toaster richColors theme="dark" position="top-right" />
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Painel Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/home"><HomeIcon className="h-4 w-4" /> Ver Home</Link></Button>
            <Button variant="outline" size="sm" onClick={sair}><LogOut className="h-4 w-4" /> Sair</Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Tabs defaultValue="cursos">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-card p-1 sm:w-auto">
            <TabsTrigger value="cursos" className="gap-2"><BookOpen className="h-4 w-4" /> Cursos</TabsTrigger>
            <TabsTrigger value="aulas" className="gap-2"><Video className="h-4 w-4" /> Aulas</TabsTrigger>
            <TabsTrigger value="alunos" className="gap-2"><Users className="h-4 w-4" /> Alunos</TabsTrigger>
            <TabsTrigger value="home" className="gap-2"><HomeIcon className="h-4 w-4" /> Home</TabsTrigger>
            <TabsTrigger value="permissoes" className="gap-2" data-testid="tab-permissoes"><Lock className="h-4 w-4" /> Permissões</TabsTrigger>
            <TabsTrigger value="suporte" className="gap-2" data-testid="tab-suporte"><MessageCircle className="h-4 w-4" /> Suporte</TabsTrigger>
          </TabsList>
          <TabsContent value="cursos" className="mt-6"><CoursesSection courses={courses} reload={loadAll} /></TabsContent>
          <TabsContent value="aulas" className="mt-6"><LessonsSection courses={courses} /></TabsContent>
          <TabsContent value="alunos" className="mt-6"><StudentsSection students={students} reload={loadAll} me={me} /></TabsContent>
          <TabsContent value="home" className="mt-6"><HomeSection home={home} /></TabsContent>
          <TabsContent value="permissoes" className="mt-6"><PermissionsSection students={students} /></TabsContent>
          <TabsContent value="suporte" className="mt-6"><SupportSection /></TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
