import { isSupabaseConfigured, publicClient, adminClient } from '@/lib/supabase'
import * as local from '@/lib/local'
import { SUPPORT_DEFAULTS, normalizeSupport } from '@/lib/support'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

const VIDEO_BUCKET = 'lesson-videos'

function fail(e) {
  const status = e?.status || 500
  if (status === 500) console.error('[api]', e)
  return json({ error: e?.message || 'Erro interno do servidor', ...(e?.extra || {}) }, status)
}

function readToken(request) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function requireToken(request) {
  const token = readToken(request)
  if (!token) throw { status: 401, message: 'Não autenticado' }
  return token
}

// Valida o token no servidor e devolve user/profile. NUNCA confia em dados do navegador.
async function requireAuth(request, { admin = false } = {}) {
  const token = requireToken(request)
  if (isSupabaseConfigured()) {
    const sb = publicClient(token)
    const { data: userData, error } = await sb.auth.getUser(token)
    if (error || !userData?.user) throw { status: 401, message: 'Sessão expirada. Faça login novamente.' }
    const { data: profile } = await sb.from('profiles').select('*').eq('id', userData.user.id).maybeSingle()
    if (!profile) throw { status: 401, message: 'Perfil não encontrado' }
    if (admin && profile.role !== 'admin') throw { status: 403, message: 'Acesso restrito a administradores' }
    return { token, user: { id: userData.user.id, email: userData.user.email }, profile, isAdmin: profile.role === 'admin' }
  }
  const res = await local.me(token)
  if (admin && res.profile.role !== 'admin') throw { status: 403, message: 'Acesso restrito a administradores' }
  return { token, ...res, isAdmin: res.profile.role === 'admin' }
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''))

function reqStr(v, msg) {
  const s = String(v || '').trim()
  if (!s) throw { status: 400, message: msg }
  return s
}

// ---------- Modo Supabase ----------

async function signupSupabase(body) {
  const a = adminClient()
  const email = reqStr(body.email, 'Informe o e-mail').toLowerCase()
  if (!isEmail(email)) throw { status: 400, message: 'E-mail inválido' }
  const password = reqStr(body.password, 'Informe a senha')
  if (password.length < 6) throw { status: 400, message: 'A senha deve ter pelo menos 6 caracteres' }
  const full_name = String(body.full_name || '').trim()
  const { data: created, error: createError } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (createError) {
    const msg = /already|registered|exists/i.test(createError.message) ? 'E-mail já cadastrado' : createError.message
    throw { status: 400, message: msg }
  }
  const user = created.user
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  let makeAdmin = adminEmail === email
  if (!makeAdmin) {
    const { count } = await a.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    makeAdmin = !count
  }
  const update = { full_name }
  if (makeAdmin) update.role = 'admin'
  await a.from('profiles').update(update).eq('id', user.id)
  const { data: sess, error: loginError } = await publicClient().auth.signInWithPassword({ email, password })
  const profile = { id: user.id, email, full_name, role: makeAdmin ? 'admin' : 'student' }
  if (loginError || !sess?.session) return { session: null, user: { id: user.id, email }, profile }
  return { session: sess.session, user: { id: user.id, email }, profile }
}

async function loginSupabase(body) {
  const email = reqStr(body.email, 'Informe o e-mail').toLowerCase()
  const password = reqStr(body.password, 'Informe a senha')
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password })
  if (error || !data?.session) throw { status: 401, message: 'E-mail ou senha inválidos' }
  const { data: profile } = await publicClient(data.session.access_token).from('profiles').select('*').eq('id', data.user.id).maybeSingle()
  return {
    session: data.session,
    user: { id: data.user.id, email: data.user.email },
    profile: profile || { id: data.user.id, email: data.user.email, full_name: data.user.user_metadata?.full_name || '', role: 'student' },
  }
}

async function meSupabase(token) {
  const sb = publicClient(token)
  const { data: userData, error } = await sb.auth.getUser(token)
  if (error || !userData?.user) throw { status: 401, message: 'Sessão expirada. Faça login novamente.' }
  const { data: profile } = await sb.from('profiles').select('*').eq('id', userData.user.id).maybeSingle()
  if (!profile) throw { status: 401, message: 'Perfil não encontrado' }
  return { user: { id: userData.user.id, email: userData.user.email }, profile }
}

async function listCoursesSupabase(token, studentId, isAdmin) {
  const sb = publicClient(token)
  const { data: courses, error } = await sb.from('courses').select('*').order('created_at', { ascending: false })
  if (error) throw { status: 400, message: error.message }
  const { data: lessons } = await adminClient().from('lessons').select('course_id')
  const counts = {}
  ;(lessons || []).forEach((l) => { counts[l.course_id] = (counts[l.course_id] || 0) + 1 })
  const revoked = isAdmin ? new Set() : await revokedIdsSupabase(studentId)
  return (courses || []).map((c) => ({ ...c, lessons_count: counts[c.id] || 0, locked: revoked.has(c.id) }))
}

async function getCourseSupabase(token, id) {
  const sb = publicClient(token)
  const { data: course, error } = await sb.from('courses').select('*').eq('id', id).maybeSingle()
  if (error) throw { status: 400, message: error.message }
  if (!course) throw { status: 404, message: 'Curso não encontrado' }
  const { data: lessons, error: lErr } = await sb.from('lessons').select('*').eq('course_id', id).order('position', { ascending: true })
  if (lErr) throw { status: 400, message: lErr.message }
  return { course, lessons: lessons || [] }
}

async function homeSupabase() {
  const { data } = await publicClient().from('home_settings').select('*').eq('id', true).maybeSingle()
  return data
    ? { logo_url: data.logo_url || '', main_title: data.main_title || 'LAGARTES ACADEMY', main_text: data.main_text || '' }
    : { logo_url: '', main_title: 'LAGARTES ACADEMY', main_text: '' }
}

async function saveHomeSupabase(body) {
  const a = adminClient()
  const row = { id: true, logo_url: body.logo_url || '', main_title: body.main_title || '', main_text: body.main_text || '', updated_at: new Date().toISOString() }
  const { data, error } = await a.from('home_settings').upsert(row).select().single()
  if (error) throw { status: 400, message: error.message }
  return { logo_url: data.logo_url || '', main_title: data.main_title || '', main_text: data.main_text || '' }
}

async function listUsersSupabase() {
  const a = adminClient()
  const { data: list, error } = await a.auth.admin.listUsers({ perPage: 200 })
  if (error) throw { status: 400, message: error.message }
  const { data: profiles } = await a.from('profiles').select('*')
  const pmap = {}
  ;(profiles || []).forEach((p) => { pmap[p.id] = p })
  return (list.users || [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: pmap[u.id]?.full_name ?? u.user_metadata?.full_name ?? '',
      role: pmap[u.id]?.role ?? 'student',
      created_at: u.created_at,
    }))
    .sort((x, y) => String(y.created_at || '').localeCompare(String(x.created_at || '')))
}

async function createUserSupabase(body) {
  const a = adminClient()
  const email = reqStr(body.email, 'Informe o e-mail do aluno').toLowerCase()
  if (!isEmail(email)) throw { status: 400, message: 'E-mail inválido' }
  const password = reqStr(body.password, 'Informe a senha do aluno')
  if (password.length < 6) throw { status: 400, message: 'A senha deve ter pelo menos 6 caracteres' }
  const full_name = String(body.full_name || '').trim()
  const { data: created, error } = await a.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })
  if (error) {
    const msg = /already|registered|exists/i.test(error.message) ? 'E-mail já cadastrado' : error.message
    throw { status: 400, message: msg }
  }
  await a.from('profiles').update({ full_name }).eq('id', created.user.id)
  return { id: created.user.id, email, full_name, role: 'student', created_at: created.user.created_at }
}

async function createCourseSupabase(token, input) {
  const { data, error } = await publicClient(token).from('courses').insert(input).select().single()
  if (error) throw { status: 400, message: error.message }
  return data
}

async function updateCourseSupabase(token, id, input) {
  const { data, error } = await publicClient(token).from('courses').update(input).eq('id', id).select().single()
  if (error) throw { status: 400, message: error.message }
  return data
}

async function deleteCourseSupabase(token, id) {
  const { error } = await publicClient(token).from('courses').delete().eq('id', id)
  if (error) throw { status: 400, message: error.message }
  return { ok: true }
}

async function createLessonSupabase(token, input) {
  const { data, error } = await publicClient(token).from('lessons').insert(input).select().single()
  if (error) throw { status: 400, message: error.message }
  return data
}

async function updateLessonSupabase(token, id, input) {
  const { data, error } = await publicClient(token).from('lessons').update(input).eq('id', id).select().single()
  if (error) throw { status: 400, message: error.message }
  return data
}

async function deleteLessonSupabase(token, id) {
  const { error } = await publicClient(token).from('lessons').delete().eq('id', id)
  if (error) throw { status: 400, message: error.message }
  return { ok: true }
}

// ---------- Permissões por aluno + Suporte (modo Supabase) ----------
// Todas as verificações usam o service role no servidor, com o id do usuário obtido do token validado.

async function supportSupabase() {
  const { data } = await adminClient().from('support_settings').select('*').eq('id', true).maybeSingle()
  return normalizeSupport(data)
}

async function saveSupportSupabase(input) {
  const a = adminClient()
  const row = { id: true, ...input, updated_at: new Date().toISOString() }
  const { data, error } = await a.from('support_settings').upsert(row).select().single()
  if (error) throw { status: 400, message: error.message }
  return normalizeSupport(data)
}

async function revokedIdsSupabase(studentId) {
  const { data, error } = await adminClient().from('course_access').select('course_id').eq('student_id', studentId).eq('status', 'revoked')
  if (error) throw { status: 400, message: error.message }
  return new Set((data || []).map((r) => r.course_id))
}

async function isBlockedSupabase(studentId, courseId) {
  const { data, error } = await adminClient().from('course_access').select('status').eq('student_id', studentId).eq('course_id', courseId).maybeSingle()
  if (error) throw { status: 400, message: error.message }
  return data?.status === 'revoked'
}

async function courseBasicSupabase(id) {
  const { data } = await adminClient().from('courses').select('id,title,description').eq('id', id).maybeSingle()
  return data
}

async function lessonCourseByVideoSupabase(objectPath) {
  const { data } = await adminClient().from('lessons').select('course_id').eq('video_url', objectPath).maybeSingle()
  return data?.course_id || null
}

async function studentAccessSupabase(studentId) {
  const a = adminClient()
  const [{ data: courses }, { data: access }, { data: log }, { data: profile }] = await Promise.all([
    a.from('courses').select('id,title,published').order('created_at', { ascending: false }),
    a.from('course_access').select('*').eq('student_id', studentId),
    a.from('course_access_log').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(50),
    a.from('profiles').select('id,full_name,role').eq('id', studentId).maybeSingle(),
  ])
  const amap = {}
  ;(access || []).forEach((r) => { amap[r.course_id] = r })
  const titles = {}
  ;(courses || []).forEach((c) => { titles[c.id] = c.title })
  return {
    student: profile || { id: studentId },
    courses: (courses || []).map((c) => ({ id: c.id, title: c.title, published: c.published, status: amap[c.id]?.status || 'granted', updated_at: amap[c.id]?.updated_at || null })),
    log: (log || []).map((l) => ({ ...l, course_title: titles[l.course_id] || 'Curso removido' })),
  }
}

async function setStudentAccessSupabase(studentId, items, adminId) {
  const a = adminClient()
  const { data: existing } = await a.from('course_access').select('course_id,status').eq('student_id', studentId)
  const emap = {}
  ;(existing || []).forEach((r) => { emap[r.course_id] = r.status })
  const now = new Date().toISOString()
  for (const it of items) {
    const prev = emap[it.course_id] || 'granted'
    if (prev === it.status && emap[it.course_id]) continue // idempotente: nada mudou
    const { error } = await a.from('course_access').upsert(
      { student_id: studentId, course_id: it.course_id, status: it.status, granted_by: adminId, updated_at: now },
      { onConflict: 'student_id,course_id' }
    )
    if (error) throw { status: 400, message: error.message }
    if (prev !== it.status) {
      await a.from('course_access_log').insert({ student_id: studentId, course_id: it.course_id, action: it.status, changed_by: adminId })
    }
  }
  return studentAccessSupabase(studentId)
}

// ---------- Helpers comuns ----------

function parseAccessItems(body) {
  const raw = Array.isArray(body.access) ? body.access : (body.course_id ? [{ course_id: body.course_id, status: body.status }] : [])
  const items = raw
    .map((x) => ({ course_id: String(x.course_id || '').trim(), status: x.status === 'revoked' || x.granted === false ? 'revoked' : 'granted' }))
    .filter((x) => x.course_id)
  if (!items.length) throw { status: 400, message: 'Informe ao menos um módulo (course_id + status)' }
  // remove duplicados (último vence)
  const map = {}
  items.forEach((x) => { map[x.course_id] = x })
  return Object.values(map)
}

function parseSupport(body) {
  const digits = String(body.whatsapp_number || '').replace(/\D/g, '')
  return {
    whatsapp_number: digits,
    default_message: String(body.default_message ?? SUPPORT_DEFAULTS.default_message),
    button_text: String(body.button_text || SUPPORT_DEFAULTS.button_text),
    locked_message: String(body.locked_message || SUPPORT_DEFAULTS.locked_message),
    float_text: String(body.float_text ?? SUPPORT_DEFAULTS.float_text),
    show_float: body.show_float !== false,
  }
}

async function getSupport() {
  return isSupabaseConfigured() ? supportSupabase() : local.getSupport()
}

async function isBlocked(studentId, courseId) {
  return isSupabaseConfigured() ? isBlockedSupabase(studentId, courseId) : local.isCourseBlocked(studentId, courseId)
}

async function lockedError(courseId) {
  const [support, course] = await Promise.all([
    getSupport(),
    isSupabaseConfigured() ? courseBasicSupabase(courseId) : local.getCourseBasic(courseId),
  ])
  return { status: 403, message: support.locked_message, extra: { locked: true, course: course || { id: courseId }, support } }
}

// ---------- Handlers ----------

export async function GET(request, { params }) {
  const path = (await params).path ?? []
  const p = path.join('/')
  try {
    if (p === '' || p === 'health') {
      return json({ ok: true, service: 'LAGARTES ACADEMY API', mode: isSupabaseConfigured() ? 'supabase' : 'local' })
    }
    if (p === 'home') return json(isSupabaseConfigured() ? await homeSupabase() : await local.getHome())
    const token = requireToken(request)
    if (p === 'auth/me') {
      return json(isSupabaseConfigured() ? await meSupabase(token) : await local.me(token))
    }
    if (p === 'support') {
      await requireAuth(request)
      return json(await getSupport())
    }
    if (p === 'courses') {
      const { user, isAdmin } = await requireAuth(request)
      return json(isSupabaseConfigured() ? await listCoursesSupabase(token, user.id, isAdmin) : await local.listCourses(isAdmin, user.id))
    }
    if (path[0] === 'courses' && path.length === 2) {
      const { user, isAdmin } = await requireAuth(request)
      // Bloqueio no servidor: aluno com módulo revogado recebe 403 + dados de suporte, sem as aulas.
      if (!isAdmin && (await isBlocked(user.id, path[1]))) throw await lockedError(path[1])
      return json(isSupabaseConfigured() ? await getCourseSupabase(token, path[1]) : await local.getCourse(path[1], isAdmin))
    }
    if (p === 'users') {
      await requireAuth(request, { admin: true })
      return json(isSupabaseConfigured() ? await listUsersSupabase() : await local.listUsers())
    }
    if (path[0] === 'users' && path.length === 3 && path[2] === 'access') {
      await requireAuth(request, { admin: true })
      return json(isSupabaseConfigured() ? await studentAccessSupabase(path[1]) : await local.getStudentAccess(path[1]))
    }
    throw { status: 404, message: 'Rota não encontrada' }
  } catch (e) {
    return fail(e)
  }
}

export async function POST(request, { params }) {
  const path = (await params).path ?? []
  const p = path.join('/')
  try {
    const body = await request.json().catch(() => ({}))
    if (p === 'auth/signup') {
      return json(isSupabaseConfigured() ? await signupSupabase(body) : await local.signup(body), 201)
    }
    if (p === 'auth/login') {
      return json(isSupabaseConfigured() ? await loginSupabase(body) : await local.login(body))
    }
    if (p === 'storage/playback-url') {
      if (!isSupabaseConfigured()) throw { status: 400, message: 'Armazenamento de vídeo requer Supabase configurado' }
      const { user, isAdmin } = await requireAuth(request)
      const objectPath = String(body.objectPath || body.path || '').trim()
      if (!objectPath) throw { status: 400, message: 'Caminho do vídeo ausente' }
      if (!isAdmin) {
        // O vídeo só é liberado se pertencer a uma aula de um módulo que o aluno pode acessar.
        const courseId = await lessonCourseByVideoSupabase(objectPath)
        if (!courseId) throw { status: 403, message: 'Vídeo não disponível' }
        if (await isBlocked(user.id, courseId)) throw await lockedError(courseId)
      }
      const { data, error } = await adminClient().storage.from(VIDEO_BUCKET).createSignedUrl(objectPath, 60 * 60)
      if (error) throw { status: 400, message: error.message }
      return json({ url: data.signedUrl, expiresIn: 3600 })
    }
    if (p === 'storage/upload-url') {
      if (!isSupabaseConfigured()) throw { status: 400, message: 'Upload de vídeo requer Supabase configurado' }
      await requireAuth(request, { admin: true })
      const objectPath = String(body.objectPath || '').trim()
      if (!/^lessons\/[\w-]+\/[\w-]+\.mp4$/i.test(objectPath)) throw { status: 400, message: 'Caminho inválido' }
      const a = adminClient()
      await a.storage.createBucket(VIDEO_BUCKET, { public: false, allowedMimeTypes: ['video/mp4'] }).catch(() => {})
      const { data, error } = await a.storage.from(VIDEO_BUCKET).createSignedUploadUrl(objectPath, { upsert: true })
      if (error) throw { status: 400, message: error.message }
      return json({ path: objectPath, token: data.token, signedUrl: data.signedUrl })
    }
    const { token } = await requireAuth(request, { admin: true })
    if (p === 'courses') {
      const input = { title: reqStr(body.title, 'Informe o título do curso'), description: String(body.description || ''), published: !!body.published }
      return json(isSupabaseConfigured() ? await createCourseSupabase(token, input) : await local.createCourse(input), 201)
    }
    if (p === 'lessons') {
      const input = {
        course_id: reqStr(body.course_id, 'Escolha o curso da aula'),
        title: reqStr(body.title, 'Informe o título da aula'),
        description: String(body.description || ''),
        video_url: String(body.video_url || ''),
        position: Number(body.position) || 0,
      }
      return json(isSupabaseConfigured() ? await createLessonSupabase(token, input) : await local.createLesson(input), 201)
    }
    if (p === 'users') {
      return json(isSupabaseConfigured() ? await createUserSupabase(body) : await local.createUser(body), 201)
    }
    throw { status: 404, message: 'Rota não encontrada' }
  } catch (e) {
    return fail(e)
  }
}

export async function PATCH(request, { params }) {
  const path = (await params).path ?? []
  try {
    const body = await request.json().catch(() => ({}))
    const { token } = await requireAuth(request, { admin: true })
    const resource = path[0]
    const id = path[1]
    if (!id) throw { status: 404, message: 'Rota não encontrada' }
    if (resource === 'courses') {
      const input = {}
      if ('title' in body) input.title = reqStr(body.title, 'Informe o título do curso')
      if ('description' in body) input.description = String(body.description || '')
      if ('published' in body) input.published = !!body.published
      if (!Object.keys(input).length) throw { status: 400, message: 'Nada para atualizar' }
      return json(isSupabaseConfigured() ? await updateCourseSupabase(token, id, input) : await local.updateCourse(id, input))
    }
    if (resource === 'lessons') {
      const input = {}
      if ('course_id' in body) input.course_id = reqStr(body.course_id, 'Escolha o curso da aula')
      if ('title' in body) input.title = reqStr(body.title, 'Informe o título da aula')
      if ('description' in body) input.description = String(body.description || '')
      if ('video_url' in body) input.video_url = String(body.video_url || '')
      if ('position' in body) input.position = Number(body.position) || 0
      if (!Object.keys(input).length) throw { status: 400, message: 'Nada para atualizar' }
      return json(isSupabaseConfigured() ? await updateLessonSupabase(token, id, input) : await local.updateLesson(id, input))
    }
    throw { status: 404, message: 'Rota não encontrada' }
  } catch (e) {
    return fail(e)
  }
}

export async function PUT(request, { params }) {
  const path = (await params).path ?? []
  const p = path.join('/')
  try {
    const body = await request.json().catch(() => ({}))
    const { user } = await requireAuth(request, { admin: true })
    if (p === 'home') {
      const input = { logo_url: String(body.logo_url || ''), main_title: String(body.main_title || ''), main_text: String(body.main_text || '') }
      return json(isSupabaseConfigured() ? await saveHomeSupabase(input) : await local.updateHome(input))
    }
    if (p === 'support') {
      const input = parseSupport(body)
      return json(isSupabaseConfigured() ? await saveSupportSupabase(input) : await local.updateSupport(input))
    }
    if (path[0] === 'users' && path.length === 3 && path[2] === 'access') {
      const studentId = path[1]
      const items = parseAccessItems(body)
      return json(isSupabaseConfigured() ? await setStudentAccessSupabase(studentId, items, user.id) : await local.setStudentAccess(studentId, items, user.id))
    }
    throw { status: 404, message: 'Rota não encontrada' }
  } catch (e) {
    return fail(e)
  }
}

export async function DELETE(request, { params }) {
  const path = (await params).path ?? []
  try {
    await requireAuth(request, { admin: true })
    const resource = path[0]
    const id = path[1]
    if (!id) throw { status: 404, message: 'Rota não encontrada' }
    if (resource === 'users') {
      if (isSupabaseConfigured()) {
        const { error } = await adminClient().auth.admin.deleteUser(id)
        if (error) throw { status: 400, message: error.message }
        return json({ ok: true })
      }
      return json(await local.deleteUser(id))
    }
    if (resource === 'courses') return json(isSupabaseConfigured() ? await deleteCourseSupabase(readToken(request), id) : await local.deleteCourse(id))
    if (resource === 'lessons') return json(isSupabaseConfigured() ? await deleteLessonSupabase(readToken(request), id) : await local.deleteLesson(id))
    throw { status: 404, message: 'Rota não encontrada' }
  } catch (e) {
    return fail(e)
  }
}
