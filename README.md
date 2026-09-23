# LAGARTES ACADEMY

Plataforma minimalista de cursos em vídeo. Stack: **Next.js 15 (App Router) + Supabase (Auth + Postgres + Storage)**. Tema escuro, verde `#9FDD05`.

## Funcionalidades
- **Login / Criar conta** por e-mail e senha (Supabase Auth) e **Login com Google** (OAuth)
- **Home do aluno**: saudação + lista "Meus Cursos"
- **Página do curso**: lista de aulas, player de vídeo (YouTube ou arquivo enviado), título e descrição
- **Painel Admin** (`/admin`, só admin): CRUD de Cursos, Aulas, Alunos e edição da Home (logo, título, texto)
- **Upload de vídeo** direto para o Supabase Storage (bucket privado, reprodução via URL assinada)

## Estrutura
```
app/
  page.js                     # Login / Criar conta (+ Google)
  home/page.js                # Home do aluno
  curso/[id]/page.js          # Página do curso e player
  admin/page.js               # Painel administrativo
  auth/callback/page.js       # Retorno do login com Google
  api/[[...path]]/route.js     # Backend (rota catch-all) — toda a API sob /api
lib/
  supabase.js                 # Clientes Supabase (servidor)
  supabase-browser.js         # Cliente Supabase (navegador: Google + upload)
  local.js                    # Adaptador local MongoDB (fallback sem Supabase)
  api-client.js               # fetch com Bearer token
supabase-setup.sql            # Script SQL para criar tabelas/policies no Supabase
```

## Variáveis de ambiente
Veja `.env.example`. As chaves `SUPABASE_*` ficam **apenas no servidor**; `NEXT_PUBLIC_*` vão para o navegador (anon é pública e segura).

## Rodar localmente
```bash
yarn install
# preencha o .env com as chaves do Supabase
yarn dev   # http://localhost:3000
```

## Configurar o Supabase
1. Crie um projeto em https://supabase.com
2. Em **SQL Editor**, cole e rode o conteúdo de `supabase-setup.sql`
3. Em **Settings → API**, copie `Project URL`, `anon key` e `service_role key` para o `.env`
4. (Opcional) **Authentication → Providers → Google**: ative e cole o Client ID/Secret do Google Cloud
5. **Storage**: o bucket privado `lesson-videos` é criado automaticamente no primeiro upload

## Publicar na Vercel
1. Envie o código para um repositório no seu GitHub
2. Na Vercel, **New Project → Import** o repositório
3. Em **Environment Variables**, cadastre todas as chaves do `.env.example` (Production + Preview)
4. **Deploy**. O banco continua no Supabase, então os dados/usuários são os mesmos.

### Login com Google — URLs importantes
- No **Google Cloud Console** (Authorized redirect URI): `https://SEU-PROJETO.supabase.co/auth/v1/callback`
- No **Supabase → Authentication → URL Configuration** (Redirect URLs): a URL do seu app + `/auth/callback` (ex.: `https://seuapp.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`)
