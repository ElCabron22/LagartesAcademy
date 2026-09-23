-- =============================================================
-- LAGARTES ACADEMY — Migration: Permissões por aluno + Suporte WhatsApp
-- Idempotente: pode rodar quantas vezes quiser.
-- Rode PRIMEIRO no projeto de Preview, depois em Produção.
-- Rollback: supabase-migration-permissoes-rollback.sql
-- Dashboard → SQL Editor → New query → cole tudo → Run
-- =============================================================

-- 1) Relação aluno–módulo (módulo = curso). Padrão: tudo liberado; linha 'revoked' bloqueia.
create table if not exists public.course_access (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'granted' check (status in ('granted', 'revoked')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id)            -- garante idempotência (sem permissões duplicadas)
);
create index if not exists course_access_student_idx on public.course_access(student_id);

-- 2) Histórico de alterações de permissão
create table if not exists public.course_access_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  course_id uuid not null,
  action text not null check (action in ('granted', 'revoked')),
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists course_access_log_student_idx on public.course_access_log(student_id, created_at desc);

-- 3) Configurações globais de suporte (linha única)
create table if not exists public.support_settings (
  id boolean primary key default true check (id = true),
  whatsapp_number text not null default '',
  default_message text not null default 'Olá, gostaria de adquirir este módulo.',
  button_text text not null default 'Falar no WhatsApp',
  locked_message text not null default 'Este módulo ainda não está liberado para você. Fale com o suporte para adquirir o acesso.',
  float_text text not null default 'Precisa de ajuda?',
  show_float boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.support_settings(id) values (true) on conflict do nothing;

-- 4) Helper: o usuário atual pode acessar o módulo? (admin sempre pode)
create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or not exists (
    select 1 from public.course_access a
    where a.student_id = (select auth.uid())
      and a.course_id = p_course_id
      and a.status = 'revoked'
  )
$$;

-- 5) Row Level Security
alter table public.course_access enable row level security;
alter table public.course_access_log enable row level security;
alter table public.support_settings enable row level security;

-- Aulas: além do curso publicado, exige acesso ao módulo (bloqueio também no banco, não só na API)
drop policy if exists "lessons of visible courses read" on public.lessons;
create policy "lessons of visible courses read" on public.lessons for select to anon, authenticated
  using (
    exists (select 1 from courses c where c.id = course_id and (c.published or public.is_admin()))
    and public.has_course_access(course_id)
  );

drop policy if exists "own access read" on public.course_access;
create policy "own access read" on public.course_access for select to authenticated
  using (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "admin access write" on public.course_access;
create policy "admin access write" on public.course_access for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin log all" on public.course_access_log;
create policy "admin log all" on public.course_access_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "support read" on public.support_settings;
create policy "support read" on public.support_settings for select to authenticated using (true);

drop policy if exists "admin support write" on public.support_settings;
create policy "admin support write" on public.support_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
