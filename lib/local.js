import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import { SUPPORT_DEFAULTS, normalizeSupport } from '@/lib/support'

// Adaptador LOCAL (MongoDB) usado enquanto as chaves do Supabase não estão no .env.
// Implementa exatamente o mesmo contrato REST do modo Supabase.
const dbName = process.env.DB_NAME || 'lagartes'

let _client = null
async function col(name) {
  if (!_client) {
    _client = await new MongoClient(process.env.MONGO_URL, { maxPoolSize: 10 }).connect()
  }
  return _client.db(dbName).collection(name)
}
const usersCol = () => col('la_users')
const sessionsCol = () => col('la_sessions')
const coursesCol = () => col('la_courses')
const lessonsCol = () => col('la_lessons')
const homeCol = () => col('la_home')
const accessCol = () => col('la_course_access')
const accessLogCol = () => col('la_access_log')
const supportCol = () => col('la_support')

const uuid = () => crypto.randomUUID()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':')
    const test = crypto.scryptSync(String(password), salt, 64)
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), test)
  } catch {
    return false
  }
}

const clean = (doc) => {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

const pub = (u) => ({ id: u.id, email: u.email, full_name: u.full_name || '', role: u.role, created_at: u.created_at })

let _seeded = false
export async function ensureSeed() {
  if (_seeded) return
  try {
    const c = await coursesCol()
    if ((await c.countDocuments()) === 0) {
      const course = {
        id: uuid(),
        title: 'CorelDRAW do Zero',
        description: 'Aprenda CorelDRAW do absoluto zero: interface, ferramentas, formas, cores e o seu primeiro projeto profissional, passo a passo.',
        published: true,
        created_at: new Date().toISOString(),
      }
      await c.insertOne(course)
      const l = await lessonsCol()
      const base = [
        { title: 'Aula 1 — Conhecendo a interface', description: 'Tour completo pela tela do CorelDRAW: barra de ferramentas, paletas de cores, páginas e zoom. Ao final você navega com total confiança.', position: 1 },
        { title: 'Aula 2 — Formas e ferramentas de desenho', description: 'Retângulos, elipses, curvas e a caneta: crie suas primeiras formas e entenda nós e contornos na prática.', position: 2 },
        { title: 'Aula 3 — Cores, preenchimentos e contornos', description: 'Paletas CMYK e RGB, preenchimento uniforme e degradê, espessura de contorno e como aplicar a identidade visual da sua marca.', position: 3 },
      ]
      for (const b of base) {
        await l.insertOne({ id: uuid(), course_id: course.id, video_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', ...b, created_at: new Date().toISOString() })
      }
    }
    const h = await homeCol()
    if ((await h.countDocuments()) === 0) {
      await h.insertOne({ id: 1, logo_url: '', main_title: 'LAGARTES ACADEMY', main_text: 'Cursos profissionais de design para você aprender do zero, no seu ritmo.' })
    }
    const sp = await supportCol()
    if ((await sp.countDocuments()) === 0) {
      await sp.insertOne({ id: 1, ...SUPPORT_DEFAULTS, updated_at: new Date().toISOString() })
    }
    const ac = await accessCol()
    await ac.createIndex({ student_id: 1, course_id: 1 }, { unique: true }).catch(() => {})
    _seeded = true
  } catch (e) {
    console.error('[seed]', e)
  }
}

export async function signup({ full_name, email, password }) {
  await ensureSeed()
  const emailN = String(email || '').trim().toLowerCase()
  if (!emailN || !password) throw { status: 400, message: 'Informe e-mail e senha' }
  if (String(password).length < 6) throw { status: 400, message: 'A senha deve ter pelo menos 6 caracteres' }
  const u = await usersCol()
  if (await u.findOne({ email: emailN })) throw { status: 400, message: 'E-mail já cadastrado' }
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  let role = 'student'
  if (adminEmail && emailN === adminEmail) role = 'admin'
  else if ((await u.countDocuments({ role: 'admin' })) === 0) role = 'admin'
  const user = { id: uuid(), email: emailN, full_name: String(full_name || '').trim(), role, password_hash: hashPassword(password), created_at: new Date().toISOString() }
  await u.insertOne(user)
  const token = uuid()
  const s = await sessionsCol()
  await s.insertOne({ token, user_id: user.id, created_at: new Date().toISOString() })
  return { session: { access_token: token, token_type: 'bearer' }, user: { id: user.id, email: user.email }, profile: pub(user) }
}

export async function login({ email, password }) {
  await ensureSeed()
  const emailN = String(email || '').trim().toLowerCase()
  const u = await usersCol()
  const user = await u.findOne({ email: emailN })
  if (!user || !verifyPassword(password, user.password_hash)) throw { status: 401, message: 'E-mail ou senha inválidos' }
  const token = uuid()
  const s = await sessionsCol()
  await s.insertOne({ token, user_id: user.id, created_at: new Date().toISOString() })
  return { session: { access_token: token, token_type: 'bearer' }, user: { id: user.id, email: user.email }, profile: pub(user) }
}

export async function me(token) {
  const sessions = await sessionsCol()
  const s = await sessions.findOne({ token })
  const users = await usersCol()
  const user = s ? await users.findOne({ id: s.user_id }) : null
  if (!s || !user) throw { status: 401, message: 'Sessão expirada. Faça login novamente.' }
  return { user: { id: user.id, email: user.email }, profile: pub(user) }
}

export async function listCourses(isAdmin, studentId) {
  await ensureSeed()
  const filter = isAdmin ? {} : { published: true }
  const courses = await coursesCol()
  const list = await courses.find(filter).sort({ created_at: -1 }).toArray()
  const lessons = await lessonsCol()
  const all = await lessons.find({}, { projection: { course_id: 1 } }).toArray()
  const counts = {}
  all.forEach((l) => { counts[l.course_id] = (counts[l.course_id] || 0) + 1 })
  const revoked = isAdmin || !studentId ? new Set() : await revokedCourseIds(studentId)
  return list.map((c) => ({ ...clean(c), lessons_count: counts[c.id] || 0, locked: revoked.has(c.id) }))
}

export async function getCourseBasic(id) {
  const courses = await coursesCol()
  const course = await courses.findOne({ id }, { projection: { _id: 0, id: 1, title: 1, description: 1 } })
  return course || null
}

export async function getCourse(id, isAdmin) {
  await ensureSeed()
  const courses = await coursesCol()
  const course = await courses.findOne({ id })
  if (!course || (!course.published && !isAdmin)) throw { status: 404, message: 'Curso não encontrado' }
  const lessons = await lessonsCol()
  const ls = await lessons.find({ course_id: id }).sort({ position: 1, created_at: 1 }).toArray()
  return { course: clean(course), lessons: ls.map(clean) }
}

export async function createCourse(input) {
  const doc = { id: uuid(), title: input.title, description: input.description || '', published: !!input.published, created_at: new Date().toISOString() }
  const courses = await coursesCol()
  await courses.insertOne(doc)
  return clean(doc)
}

export async function updateCourse(id, input) {
  const set = {}
  if ('title' in input) set.title = input.title
  if ('description' in input) set.description = input.description
  if ('published' in input) set.published = !!input.published
  const courses = await coursesCol()
  const doc = await courses.findOneAndUpdate({ id }, { $set: set }, { returnDocument: 'after' })
  if (!doc) throw { status: 404, message: 'Curso não encontrado' }
  return clean(doc)
}

export async function deleteCourse(id) {
  const lessons = await lessonsCol()
  await lessons.deleteMany({ course_id: id })
  const courses = await coursesCol()
  const r = await courses.deleteOne({ id })
  if (r.deletedCount === 0) throw { status: 404, message: 'Curso não encontrado' }
  return { ok: true }
}

export async function createLesson(input) {
  if (!input.course_id || !input.title) throw { status: 400, message: 'Informe o curso e o título da aula' }
  const courses = await coursesCol()
  const course = await courses.findOne({ id: input.course_id })
  if (!course) throw { status: 404, message: 'Curso não encontrado' }
  const doc = { id: uuid(), course_id: input.course_id, title: input.title, description: input.description || '', video_url: input.video_url || '', position: Number(input.position) || 0, created_at: new Date().toISOString() }
  const lessons = await lessonsCol()
  await lessons.insertOne(doc)
  return clean(doc)
}

export async function updateLesson(id, input) {
  const set = {}
  for (const k of ['title', 'description', 'video_url', 'course_id']) if (k in input) set[k] = input[k]
  if ('position' in input) set.position = Number(input.position) || 0
  const lessons = await lessonsCol()
  const doc = await lessons.findOneAndUpdate({ id }, { $set: set }, { returnDocument: 'after' })
  if (!doc) throw { status: 404, message: 'Aula não encontrada' }
  return clean(doc)
}

export async function deleteLesson(id) {
  const lessons = await lessonsCol()
  const r = await lessons.deleteOne({ id })
  if (r.deletedCount === 0) throw { status: 404, message: 'Aula não encontrada' }
  return { ok: true }
}

export async function listUsers() {
  await ensureSeed()
  const users = await usersCol()
  const list = await users.find({}, { projection: { password_hash: 0 } }).sort({ created_at: -1 }).toArray()
  return list.map((u) => clean(pub(u)))
}

export async function createUser({ full_name, email, password }) {
  const emailN = String(email || '').trim().toLowerCase()
  if (!emailN || !password) throw { status: 400, message: 'Informe e-mail e senha do aluno' }
  if (String(password).length < 6) throw { status: 400, message: 'A senha deve ter pelo menos 6 caracteres' }
  const u = await usersCol()
  if (await u.findOne({ email: emailN })) throw { status: 400, message: 'E-mail já cadastrado' }
  const user = { id: uuid(), email: emailN, full_name: String(full_name || '').trim(), role: 'student', password_hash: hashPassword(password), created_at: new Date().toISOString() }
  await u.insertOne(user)
  return pub(user)
}

export async function deleteUser(id) {
  const sessions = await sessionsCol()
  await sessions.deleteMany({ user_id: id })
  const users = await usersCol()
  const r = await users.deleteOne({ id })
  if (r.deletedCount === 0) throw { status: 404, message: 'Aluno não encontrado' }
  return { ok: true }
}

export async function getHome() {
  await ensureSeed()
  const h = await homeCol()
  const row = await h.findOne({ id: 1 })
  return row ? { logo_url: row.logo_url || '', main_title: row.main_title || 'LAGARTES ACADEMY', main_text: row.main_text || '' } : { logo_url: '', main_title: 'LAGARTES ACADEMY', main_text: '' }
}

export async function updateHome(input) {
  await ensureSeed()
  const set = { logo_url: input.logo_url || '', main_title: input.main_title || '', main_text: input.main_text || '' }
  const h = await homeCol()
  const doc = await h.findOneAndUpdate({ id: 1 }, { $set: set }, { returnDocument: 'after' })
  return { logo_url: doc.logo_url, main_title: doc.main_title, main_text: doc.main_text }
}

// ---------- Permissões por aluno (módulo = curso) ----------
// Padrão: tudo liberado. Uma linha com status 'revoked' bloqueia o módulo para o aluno.

export async function revokedCourseIds(studentId) {
  const ac = await accessCol()
  const rows = await ac.find({ student_id: studentId, status: 'revoked' }, { projection: { course_id: 1 } }).toArray()
  return new Set(rows.map((r) => r.course_id))
}

export async function isCourseBlocked(studentId, courseId) {
  const ac = await accessCol()
  const row = await ac.findOne({ student_id: studentId, course_id: courseId })
  return row?.status === 'revoked'
}

export async function getStudentAccess(studentId) {
  await ensureSeed()
  const users = await usersCol()
  const student = await users.findOne({ id: studentId })
  if (!student) throw { status: 404, message: 'Aluno não encontrado' }
  const courses = await (await coursesCol()).find({}, { projection: { _id: 0, id: 1, title: 1, published: 1 } }).sort({ created_at: -1 }).toArray()
  const access = await (await accessCol()).find({ student_id: studentId }).toArray()
  const log = await (await accessLogCol()).find({ student_id: studentId }).sort({ created_at: -1 }).limit(50).toArray()
  const amap = {}
  access.forEach((r) => { amap[r.course_id] = r })
  const titles = {}
  courses.forEach((c) => { titles[c.id] = c.title })
  return {
    student: pub(student),
    courses: courses.map((c) => ({ id: c.id, title: c.title, published: c.published, status: amap[c.id]?.status || 'granted', updated_at: amap[c.id]?.updated_at || null })),
    log: log.map((l) => ({ ...clean(l), course_title: titles[l.course_id] || 'Curso removido' })),
  }
}

export async function setStudentAccess(studentId, items, adminId) {
  await ensureSeed()
  const users = await usersCol()
  if (!(await users.findOne({ id: studentId }))) throw { status: 404, message: 'Aluno não encontrado' }
  const ac = await accessCol()
  const logc = await accessLogCol()
  const now = new Date().toISOString()
  for (const it of items) {
    const existing = await ac.findOne({ student_id: studentId, course_id: it.course_id })
    const prev = existing?.status || 'granted'
    if (existing && prev === it.status) continue // idempotente
    await ac.updateOne(
      { student_id: studentId, course_id: it.course_id },
      { $set: { status: it.status, granted_by: adminId, updated_at: now }, $setOnInsert: { id: uuid(), student_id: studentId, course_id: it.course_id, created_at: now } },
      { upsert: true }
    )
    if (prev !== it.status) {
      await logc.insertOne({ id: uuid(), student_id: studentId, course_id: it.course_id, action: it.status, changed_by: adminId, created_at: now })
    }
  }
  return getStudentAccess(studentId)
}

// ---------- Configurações de suporte (WhatsApp) ----------

export async function getSupport() {
  await ensureSeed()
  const sp = await supportCol()
  return normalizeSupport(await sp.findOne({ id: 1 }))
}

export async function updateSupport(input) {
  await ensureSeed()
  const sp = await supportCol()
  const doc = await sp.findOneAndUpdate({ id: 1 }, { $set: { ...input, updated_at: new Date().toISOString() } }, { upsert: true, returnDocument: 'after' })
  return normalizeSupport(doc)
}
