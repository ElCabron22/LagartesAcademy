-- =============================================================
-- ROLLBACK da migration de Permissões + Suporte WhatsApp
-- Restaura a policy original de aulas e remove as tabelas novas.
-- ATENÇÃO: apaga os dados de permissões/histórico/configurações de suporte.
-- =============================================================

drop policy if exists "lessons of visible courses read" on public.lessons;
create policy "lessons of visible courses read" on public.lessons for select to anon, authenticated
  using (exists (select 1 from courses c where c.id = course_id and (c.published or public.is_admin())));

drop function if exists public.has_course_access(uuid);

drop table if exists public.course_access_log;
drop table if exists public.course_access;
drop table if exists public.support_settings;
