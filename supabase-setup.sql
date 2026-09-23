-- =============================================================
-- LAGARTES ACADEMY — Setup do Supabase (versão à prova de erro)
-- Pode rodar quantas vezes quiser: ignora o que já existe.
-- Dashboard → SQL Editor → New query → cole tudo → Run
-- =============================================================

-- Enum de papéis (só cria se ainda não existir)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'student');
  end if;
end $$;

-- Perfis (1 para cada usuário do Authentication)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

-- Cursos
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Aulas
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  video_url text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Configurações da Home (linha única)
create table if not exists public.home_settings (
  id boolean primary key default true check (id = true),
  logo_url text not null default '',
  main_title text not null default 'LAGARTES ACADEMY',
  main_text text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.home_settings(id) values (true) on conflict do nothing;

-- Helper: o usuário atual é admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.profiles
  where id = (select auth.uid()) and role = 'admin'
) $$;

-- Cria o perfil automaticamente a cada novo cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.home_settings enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "published courses read" on public.courses;
create policy "published courses read" on public.courses for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists "lessons of visible courses read" on public.lessons;
create policy "lessons of visible courses read" on public.lessons for select to anon, authenticated
  using (exists (select 1 from courses c where c.id = course_id and (c.published or public.is_admin())));

drop policy if exists "public home read" on public.home_settings;
create policy "public home read" on public.home_settings for select to anon, authenticated using (true);

drop policy if exists "admin profile write" on public.profiles;
create policy "admin profile write" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin course write" on public.courses;
create policy "admin course write" on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin lesson write" on public.lessons;
create policy "admin lesson write" on public.lessons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin home write" on public.home_settings;
create policy "admin home write" on public.home_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Dados iniciais: curso CorelDRAW do Zero ----------
-- Só insere se ainda não existir um curso com esse título.
insert into public.courses (title, description, published)
select 'CorelDRAW do Zero',
       'Aprenda CorelDRAW do absoluto zero: interface, ferramentas, formas, cores e o seu primeiro projeto profissional, passo a passo.',
       true
where not exists (select 1 from public.courses where title = 'CorelDRAW do Zero');

insert into public.lessons (course_id, title, description, video_url, position)
select c.id, v.title, v.description, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', v.pos
from public.courses c,
(values
  ('Aula 1 — Conhecendo a interface', 'Tour completo pela tela do CorelDRAW: barra de ferramentas, paletas de cores, páginas e zoom. Ao final você navega com total confiança.', 1),
  ('Aula 2 — Formas e ferramentas de desenho', 'Retângulos, elipses, curvas e a caneta: crie suas primeiras formas e entenda nós e contornos na prática.', 2),
  ('Aula 3 — Cores, preenchimentos e contornos', 'Paletas CMYK e RGB, preenchimento uniforme e degradê, espessura de contorno e como aplicar a identidade visual da sua marca.', 3)
) as v(title, description, pos)
where c.title = 'CorelDRAW do Zero'
  and not exists (select 1 from public.lessons l where l.course_id = c.id);
