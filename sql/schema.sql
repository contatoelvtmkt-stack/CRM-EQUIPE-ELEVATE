-- =====================================================================
-- CRM EQUIPE ELEVATE — estrutura do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

-- ---------- Perfis ----------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text not null default '',
  role        text not null default 'pendente'
              check (role in ('pendente','admin','gestora','designer','editor','social_media','trafego')),
  avatar      text not null default 'capivara',
  stars       int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Tarefas ---------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null default '',
  priority      text not null default 'media'
                check (priority in ('baixa','media','alta','urgente')),
  task_date     date not null default (now() at time zone 'America/Sao_Paulo')::date,
  due_date      date not null default (now() at time zone 'America/Sao_Paulo')::date,
  assigned_to   uuid not null references public.profiles(id) on delete cascade,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pendente'
                check (status in ('pendente','finalizada','parcial','nao_realizada')),
  justification text not null default '',
  completed_at  timestamptz,
  carried_from  uuid unique references public.tasks(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists tasks_assigned_date on public.tasks (assigned_to, task_date);
create index if not exists tasks_date on public.tasks (task_date);

-- ---------- Registro de estrelas (1 por dia perfeito) ------------------
create table if not exists public.star_days (
  user_id  uuid references public.profiles(id) on delete cascade,
  day      date,
  earned   boolean not null,
  primary key (user_id, day)
);

-- ---------- Funções auxiliares ------------------------------------------
create or replace function public.today_br() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- usado pelas funções internas para pular as travas dos gatilhos
create or replace function public.bypass() returns boolean
language sql stable as $$ select coalesce(current_setting('app.bypass', true), '') = 'on' $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin','gestora'), false)
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() <> 'pendente', false)
$$;

-- Cria o perfil automaticamente quando um usuário é criado.
-- O cargo começa como 'pendente' e só um admin/gestora pode definir.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que um funcionário comum mude o próprio cargo ou estrelas.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() and not public.bypass() then
    new.role   := old.role;
    new.stars  := old.stars;
    new.active := old.active;
    new.email  := old.email;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- Regras de tarefa: quem não é gestor só cria para si; preenche datas de conclusão.
create or replace function public.task_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.bypass() then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if auth.uid() is not null and not public.is_manager() then
      new.assigned_to := auth.uid();
    end if;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_manager() then
    -- funcionário comum só altera status/justificativa
    new.title := old.title; new.description := old.description;
    new.priority := old.priority; new.task_date := old.task_date;
    new.due_date := old.due_date; new.assigned_to := old.assigned_to;
    new.created_by := old.created_by;
  end if;
  if new.status = 'finalizada' and (tg_op = 'INSERT' or old.status <> 'finalizada') then
    new.completed_at := now();
  elsif new.status <> 'finalizada' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists task_rules on public.tasks;
create trigger task_rules before insert or update on public.tasks
  for each row execute function public.task_rules();

-- ---------- Virada de dia: estrelas + tarefas que passam para hoje ------
-- Chamado pelo app ao abrir. Seguro rodar várias vezes.
create or replace function public.daily_rollover() returns void
language plpgsql security definer set search_path = public as $$
declare t date := public.today_br();
begin
  perform set_config('app.bypass', 'on', true);
  -- 1) tarefas de dias anteriores que ficaram sem marcar viram "não realizada"
  update public.tasks
     set status = 'nao_realizada',
         justification = case when justification = '' then 'Não foi marcada no dia.' else justification end
   where task_date < t and status = 'pendente';

  -- 2) estrelas: dia perfeito = todas as tarefas do dia finalizadas até o prazo
  insert into public.star_days (user_id, day, earned)
  select assigned_to, task_date,
         bool_and(status = 'finalizada'
                  and (completed_at at time zone 'America/Sao_Paulo')::date <= due_date)
    from public.tasks
   where task_date < t
   group by assigned_to, task_date
  on conflict (user_id, day) do nothing;

  update public.profiles p
     set stars = s.total
    from (select user_id, count(*) filter (where earned) as total
            from public.star_days group by user_id) s
   where s.user_id = p.id and p.stars <> s.total;

  -- 3) parcial / não realizada passam para hoje com o mesmo status
  insert into public.tasks (title, description, priority, task_date, due_date,
                            assigned_to, created_by, status, justification, carried_from)
  select o.title, o.description, o.priority, t, o.due_date,
         o.assigned_to, o.created_by, o.status, o.justification, o.id
    from public.tasks o
   where o.task_date < t
     and o.status in ('parcial','nao_realizada')
     and not exists (select 1 from public.tasks n where n.carried_from = o.id);
end $$;

-- Cadastro de funcionário (admin/gestora): define nome e cargo de um usuário recém-criado
create or replace function public.set_member(p_id uuid, p_name text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Sem permissão'; end if;
  update public.profiles set name = p_name, role = p_role where id = p_id;
end $$;

-- ---------- Segurança (RLS) ---------------------------------------------
alter table public.profiles  enable row level security;
alter table public.tasks     enable row level security;
alter table public.star_days enable row level security;

drop policy if exists "perfis visiveis" on public.profiles;
create policy "perfis visiveis" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_member());

drop policy if exists "editar perfil" on public.profiles;
create policy "editar perfil" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());

drop policy if exists "ver tarefas" on public.tasks;
create policy "ver tarefas" on public.tasks for select to authenticated
  using (public.is_manager() or (public.is_member() and assigned_to = auth.uid()));

drop policy if exists "criar tarefas" on public.tasks;
create policy "criar tarefas" on public.tasks for insert to authenticated
  with check (public.is_manager() or (public.is_member() and assigned_to = auth.uid()));

drop policy if exists "atualizar tarefas" on public.tasks;
create policy "atualizar tarefas" on public.tasks for update to authenticated
  using (public.is_manager() or assigned_to = auth.uid())
  with check (public.is_manager() or assigned_to = auth.uid());

drop policy if exists "apagar tarefas" on public.tasks;
create policy "apagar tarefas" on public.tasks for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

drop policy if exists "ver estrelas" on public.star_days;
create policy "ver estrelas" on public.star_days for select to authenticated
  using (public.is_member());

-- Permissões das tabelas (projetos novos do Supabase não liberam sozinhos)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.star_days to authenticated;
grant execute on function public.daily_rollover() to authenticated;
grant execute on function public.set_member(uuid, text, text) to authenticated;
