-- =====================================================================
-- CRM EQUIPE ELEVATE — estrutura do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no Supabase: SQL Editor → New query → Run.
-- Pode rodar quantas vezes quiser: ele cria o que falta e atualiza o que
-- já existe, sem apagar dados.
-- =====================================================================

-- ---------- Perfis ----------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text not null default '',
  role        text not null default 'pendente',
  avatar      text not null default 'capivara',
  stars       int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists photo_url text;

-- cargos: designer e editor viraram um só ("Designer / Editor")
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'designer_editor' where role in ('designer', 'editor');
alter table public.profiles add constraint profiles_role_check
  check (role in ('pendente','admin','gestora','designer_editor','social_media','trafego'));

-- ---------- Clientes --------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.clients add column if not exists logo_url text;
alter table public.clients add column if not exists instagram text;
-- conta do Instagram usada para publicar (vinculada pelo token do usuário do sistema)
alter table public.clients add column if not exists ig_user_id  text;
alter table public.clients add column if not exists ig_username text;

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
  status        text not null default 'pendente',
  justification text not null default '',
  completed_at  timestamptz,
  carried_from  uuid unique references public.tasks(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.tasks add column if not exists client_id   uuid references public.clients(id) on delete set null;
alter table public.tasks add column if not exists stage       text not null default 'a_fazer';
alter table public.tasks add column if not exists root_id     uuid;
alter table public.tasks add column if not exists review_note text not null default '';
alter table public.tasks add column if not exists stage_at    timestamptz not null default now();
-- publicação
alter table public.tasks add column if not exists post_at      timestamptz;
alter table public.tasks add column if not exists caption      text not null default '';
alter table public.tasks add column if not exists post_format  text;
alter table public.tasks add column if not exists scheduled_at timestamptz;
alter table public.tasks add column if not exists scheduled_by uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists publish_status  text;
alter table public.tasks add column if not exists publish_error   text not null default '';
alter table public.tasks add column if not exists ig_container_id text;
alter table public.tasks add column if not exists ig_media_id     text;
alter table public.tasks add column if not exists ig_permalink    text;
alter table public.tasks add column if not exists published_at    timestamptz;
alter table public.tasks drop constraint if exists tasks_publish_status_check;
alter table public.tasks add constraint tasks_publish_status_check
  check (publish_status is null or publish_status in ('fila','processando','publicando','publicado','erro'));
alter table public.tasks drop constraint if exists tasks_post_format_check;
alter table public.tasks add constraint tasks_post_format_check
  check (post_format is null or post_format in ('feed','carrossel','reels','story'));

-- status do dia: "parcial" virou "incompleta"; nova "em_alteracao"
alter table public.tasks drop constraint if exists tasks_status_check;
update public.tasks set status = 'incompleta' where status = 'parcial';
alter table public.tasks add constraint tasks_status_check
  check (status in ('pendente','finalizada','incompleta','nao_realizada','em_alteracao'));

alter table public.tasks drop constraint if exists tasks_stage_check;
alter table public.tasks add constraint tasks_stage_check
  check (stage in ('a_fazer','em_alteracao','revisao_interna','revisao_cliente','agendamento','concluido'));

-- root_id = id da "peça" original; as cópias dos dias seguintes apontam para ela
update public.tasks t set root_id = coalesce(
  (with recursive c as (select id, carried_from from public.tasks where id = t.id
                        union all select p.id, p.carried_from from public.tasks p join c on p.id = c.carried_from)
   select id from c where carried_from is null limit 1), t.id)
 where root_id is null;

create index if not exists tasks_assigned_date on public.tasks (assigned_to, task_date);
create index if not exists tasks_date on public.tasks (task_date);
create index if not exists tasks_root on public.tasks (root_id, created_at desc);

-- ---------- Anexos (links e arquivos), presos à peça (root_id) ---------
create table if not exists public.task_attachments (
  id         uuid primary key default gen_random_uuid(),
  root_id    uuid not null,
  kind       text not null check (kind in ('link','file')),
  url        text not null default '',
  path       text not null default '',
  name       text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists task_attachments_root on public.task_attachments (root_id);

-- ---------- Registro de estrelas (1 por dia perfeito) ------------------
create table if not exists public.star_days (
  user_id  uuid references public.profiles(id) on delete cascade,
  day      date,
  earned   boolean not null,
  primary key (user_id, day)
);

-- ---------- Jeremias: energia do time ----------------------------------
create table if not exists public.pulses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  answer     text not null check (answer in ('ok','devagar')),
  created_at timestamptz not null default now()
);
create index if not exists pulses_created on public.pulses (created_at desc);

-- ---------- Chat da equipe ---------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_created on public.messages (created_at desc);

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

-- quem enxerga e move o fluxo de conteúdo
create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin','gestora','social_media'), false)
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() <> 'pendente', false)
$$;

-- Cria o perfil automaticamente quando um usuário é criado.
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

-- Regras de tarefa
create or replace function public.task_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.root_id is null then new.root_id := new.id; end if;
  if public.bypass() then return new; end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.stage := 'a_fazer';
    if auth.uid() is not null and not public.is_manager() then
      new.assigned_to := auth.uid();
    end if;
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_manager() then
    -- funcionário comum só altera status/justificativa
    new.title := old.title; new.description := old.description;
    new.priority := old.priority; new.task_date := old.task_date;
    new.due_date := old.due_date; new.assigned_to := old.assigned_to;
    new.created_by := old.created_by; new.client_id := old.client_id;
    new.stage := old.stage; new.review_note := old.review_note; new.root_id := old.root_id;
    new.post_at := old.post_at; new.caption := old.caption; new.post_format := old.post_format;
    new.scheduled_at := old.scheduled_at; new.scheduled_by := old.scheduled_by;
    new.publish_status := old.publish_status; new.publish_error := old.publish_error;
    new.ig_container_id := old.ig_container_id; new.ig_media_id := old.ig_media_id;
    new.ig_permalink := old.ig_permalink; new.published_at := old.published_at;
  end if;

  -- marcou como finalizada: a peça vai para a revisão interna
  if new.status = 'finalizada' and (tg_op = 'INSERT' or old.status <> 'finalizada') then
    new.completed_at := now();
    if new.stage in ('a_fazer','em_alteracao') then new.stage := 'revisao_interna'; new.stage_at := now(); end if;
  elsif new.status <> 'finalizada' then
    new.completed_at := null;
    -- desmarcou antes de alguém revisar: volta para a etapa de produção
    if tg_op = 'UPDATE' and old.status = 'finalizada' and new.stage = 'revisao_interna' then
      new.stage := case when new.review_note <> '' then 'em_alteracao' else 'a_fazer' end;
      new.stage_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists task_rules on public.tasks;
create trigger task_rules before insert or update on public.tasks
  for each row execute function public.task_rules();

-- tarefas que já estavam finalizadas antes do fluxo existir entram na revisão interna
update public.tasks set stage = 'revisao_interna' where stage = 'a_fazer' and status = 'finalizada';

-- ---------- Fluxo de conteúdo: aprovar / pedir alteração / mover -------
-- p_action: 'aprovar' (avança uma etapa) | 'alterar' (volta para quem fez) | 'mover' (vai para p_stage)
create or replace function public.review_task(p_id uuid, p_action text, p_note text default '', p_stage text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks; nxt text; d date := public.today_br();
begin
  if not public.is_reviewer() then raise exception 'Sem permissão'; end if;
  perform set_config('app.bypass', 'on', true);
  select * into t from public.tasks where id = p_id;
  if not found then raise exception 'Tarefa não encontrada'; end if;

  if p_action = 'alterar' then
    perform public._request_change(t.id, p_note, auth.uid());
    return;
  end if;

  if p_action = 'aprovar' then
    nxt := case t.stage when 'revisao_interna' then 'revisao_cliente'
                        when 'revisao_cliente' then 'agendamento'
                        when 'agendamento'     then 'concluido' else null end;
    if nxt is null then raise exception 'Esta etapa não pode ser aprovada'; end if;
  elsif p_action = 'mover' then
    if p_stage not in ('revisao_interna','revisao_cliente','agendamento','concluido') then
      raise exception 'Etapa inválida';
    end if;
    nxt := p_stage;
  else
    raise exception 'Ação inválida';
  end if;
  update public.tasks set stage = nxt, stage_at = now(),
         review_note = case when coalesce(p_note,'') <> '' then p_note else review_note end
   where id = t.id;
end $$;

-- Confirmação do agendamento (social media, gestora ou admin), na etapa Agendamento
create or replace function public.confirm_schedule(p_id uuid, p_post_at timestamptz, p_caption text, p_format text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  if not public.is_reviewer() then raise exception 'Sem permissão'; end if;
  select * into t from public.tasks where id = p_id;
  if t.stage <> 'agendamento' then raise exception 'A tarefa precisa estar em Agendamento'; end if;
  if p_post_at is null then raise exception 'Informe a data e a hora da postagem'; end if;
  perform set_config('app.bypass', 'on', true);
  update public.tasks set post_at = p_post_at, caption = coalesce(p_caption, ''), post_format = nullif(p_format, ''),
         scheduled_at = now(), scheduled_by = auth.uid(),
         publish_status = case when exists (select 1 from public.clients c where c.id = t.client_id and c.ig_user_id is not null)
                               then 'fila' else null end,
         publish_error = '', ig_container_id = null
   where root_id = t.root_id;
end $$;

-- publicar agora / tentar de novo (equipe de revisão)
create or replace function public.publish_now(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  if not public.is_reviewer() then raise exception 'Sem permissão'; end if;
  select * into t from public.tasks where id = p_id;
  if t.stage <> 'agendamento' or t.scheduled_at is null then raise exception 'Confirme o agendamento antes'; end if;
  if not exists (select 1 from public.clients c where c.id = t.client_id and c.ig_user_id is not null) then
    raise exception 'Este cliente ainda não tem Instagram vinculado (Equipe → Clientes)';
  end if;
  if t.publish_status in ('publicando','publicado') then raise exception 'Este post já está sendo publicado'; end if;
  perform set_config('app.bypass', 'on', true);
  update public.tasks set post_at = least(coalesce(post_at, now()), now()), publish_status = 'fila', publish_error = '', ig_container_id = null
   where root_id = t.root_id;
end $$;

create or replace function public.unconfirm_schedule(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  if not public.is_reviewer() then raise exception 'Sem permissão'; end if;
  select * into t from public.tasks where id = p_id;
  perform set_config('app.bypass', 'on', true);
  if t.publish_status in ('publicando','publicado') then raise exception 'Este post já foi publicado'; end if;
  update public.tasks set scheduled_at = null, scheduled_by = null, publish_status = null, publish_error = '', ig_container_id = null
   where root_id = t.root_id;
end $$;

-- Fluxo: a versão mais recente de cada peça
create or replace view public.pipeline with (security_invoker = true) as
  select distinct on (root_id) * from public.tasks order by root_id, created_at desc;

-- ---------- Virada de dia: estrelas + tarefas que passam para hoje ------
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

  -- 3) incompleta / não realizada / em alteração passam para hoje com o mesmo status
  insert into public.tasks (title, description, priority, task_date, due_date, assigned_to, created_by,
                            status, justification, carried_from, client_id, stage, root_id, review_note, stage_at,
                            post_at, caption, post_format)
  select o.title, o.description, o.priority, t, o.due_date, o.assigned_to, o.created_by,
         o.status, o.justification, o.id, o.client_id, o.stage, o.root_id, o.review_note, o.stage_at,
         o.post_at, o.caption, o.post_format
    from public.tasks o
   where o.task_date < t
     and o.status in ('incompleta','nao_realizada','em_alteracao')
     and not exists (select 1 from public.tasks n where n.carried_from = o.id);
end $$;

-- Cadastro de funcionário (admin/gestora)
create or replace function public.set_member(p_id uuid, p_name text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Sem permissão'; end if;
  update public.profiles set name = p_name, role = p_role where id = p_id;
end $$;


-- ---------- Aprovação do cliente: links temporários ---------------------
create table if not exists public.approval_links (
  token      text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  root_id    uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  decision   text check (decision in ('aprovado','alteracao')),
  note       text not null default ''
);
create index if not exists approval_links_root on public.approval_links (root_id, created_at desc);

-- versão mais recente da peça
create or replace function public.latest_task(p_root uuid) returns public.tasks
language sql stable security definer set search_path = public as $$
  select * from public.tasks where root_id = p_root order by created_at desc limit 1
$$;

-- pedido de alteração (usado pela revisão interna e pelo cliente)
create or replace function public._request_change(p_id uuid, p_note text, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks; d date := public.today_br();
begin
  perform set_config('app.bypass', 'on', true);
  select * into t from public.tasks where id = p_id;
  if t.task_date = d and t.status <> 'finalizada' then
    update public.tasks set status = 'em_alteracao', stage = 'em_alteracao', review_note = coalesce(p_note,''),
           stage_at = now(), completed_at = null where id = t.id;
  else
    insert into public.tasks (title, description, priority, task_date, due_date, assigned_to, created_by,
                              status, justification, client_id, stage, root_id, review_note, stage_at,
                              post_at, caption, post_format)
    values (t.title, t.description, t.priority, d, greatest(t.due_date, d), t.assigned_to, coalesce(p_by, t.created_by),
            'em_alteracao', '', t.client_id, 'em_alteracao', t.root_id, coalesce(p_note,''), now(),
            t.post_at, t.caption, t.post_format);
    update public.tasks set stage = 'em_alteracao', stage_at = now() where id = t.id;
  end if;
end $$;

-- cria um link novo (e encerra os anteriores da mesma peça)
create or replace function public._new_approval_link(p_root uuid, p_by uuid) returns text
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  update public.approval_links set expires_at = least(expires_at, now())
   where root_id = p_root and used_at is null and expires_at > now();
  insert into public.approval_links (root_id, created_by) values (p_root, p_by) returning token into tok;
  return tok;
end $$;

-- ao entrar em "Revisão do cliente", o link é criado sozinho
create or replace function public.on_stage_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage = 'revisao_cliente' and (tg_op = 'INSERT' or old.stage is distinct from 'revisao_cliente') then
    perform public._new_approval_link(new.root_id, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists on_stage_change on public.tasks;
create trigger on_stage_change after insert or update of stage on public.tasks
  for each row execute function public.on_stage_change();

-- equipe: gerar um link novo manualmente
create or replace function public.new_approval_link(p_task uuid) returns text
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  if not public.is_reviewer() then raise exception 'Sem permissão'; end if;
  select * into t from public.tasks where id = p_task;
  if t.stage <> 'revisao_cliente' then raise exception 'A tarefa precisa estar em Revisão do cliente'; end if;
  return public._new_approval_link(t.root_id, auth.uid());
end $$;

-- link válido? (aberto, dentro do prazo e a peça ainda em Revisão do cliente)
create or replace function public.approval_token_ok(p_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.approval_links l
                  where l.token = p_token and l.used_at is null and l.expires_at > now()
                    and (public.latest_task(l.root_id)).stage = 'revisao_cliente')
$$;

-- PÚBLICO (cliente sem login): ver o conteúdo do link
create or replace function public.get_approval(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare l public.approval_links; t public.tasks; c public.clients; st text;
begin
  select * into l from public.approval_links where token = p_token;
  if not found then return json_build_object('state', 'invalido'); end if;
  t := public.latest_task(l.root_id);
  select * into c from public.clients where id = t.client_id;
  st := case when l.used_at is not null then 'respondido'
             when l.expires_at <= now() then 'expirado'
             when t.stage <> 'revisao_cliente' then 'encerrado'
             else 'aberto' end;
  return json_build_object(
    'state', st, 'decision', l.decision, 'expires_at', l.expires_at,
    'title', t.title, 'description', t.description, 'due_date', t.due_date,
    'post_at', t.post_at, 'caption', t.caption, 'post_format', t.post_format, 'instagram', c.instagram,
    'client', json_build_object('name', coalesce(c.name, ''), 'logo_url', c.logo_url),
    'files', coalesce((select json_agg(json_build_object('kind', a.kind, 'name', a.name, 'url', a.url, 'path', a.path) order by a.created_at)
                         from public.task_attachments a where a.root_id = l.root_id and a.name not like 'Cliente – %'), '[]'::json));
end $$;

-- PÚBLICO: resposta do cliente
create or replace function public.submit_approval(p_token text, p_decision text, p_note text default '', p_files json default '[]')
returns json language plpgsql security definer set search_path = public as $$
declare l public.approval_links; t public.tasks; f json;
begin
  if not public.approval_token_ok(p_token) then raise exception 'Este link não está mais disponível.'; end if;
  if p_decision not in ('aprovado','alteracao') then raise exception 'Resposta inválida'; end if;
  if p_decision = 'alteracao' and coalesce(trim(p_note), '') = '' then raise exception 'Descreva a alteração.'; end if;
  select * into l from public.approval_links where token = p_token for update;
  t := public.latest_task(l.root_id);
  perform set_config('app.bypass', 'on', true);
  update public.approval_links set used_at = now(), decision = p_decision, note = coalesce(p_note, '') where token = p_token;
  for f in select * from json_array_elements(coalesce(p_files, '[]'::json)) loop
    if (f->>'path') like 'cliente/' || p_token || '/%' then
      insert into public.task_attachments (root_id, kind, path, name, created_by)
      values (l.root_id, 'file', f->>'path', 'Cliente – ' || coalesce(f->>'name', 'arquivo'), null);
    end if;
  end loop;
  if p_decision = 'aprovado' then
    update public.tasks set stage = 'agendamento', stage_at = now() where id = t.id;
  else
    perform public._request_change(t.id, 'Cliente: ' || trim(p_note), null);
  end if;
  return json_build_object('ok', true);
end $$;

-- ---------- Segurança (RLS) ---------------------------------------------
alter table public.profiles         enable row level security;
alter table public.tasks            enable row level security;
alter table public.star_days        enable row level security;
alter table public.clients          enable row level security;
alter table public.task_attachments enable row level security;
alter table public.pulses           enable row level security;
alter table public.messages         enable row level security;

drop policy if exists "perfis visiveis" on public.profiles;
create policy "perfis visiveis" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_member());
drop policy if exists "editar perfil" on public.profiles;
create policy "editar perfil" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());

drop policy if exists "ver tarefas" on public.tasks;
create policy "ver tarefas" on public.tasks for select to authenticated
  using (public.is_reviewer() or (public.is_member() and assigned_to = auth.uid()));
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
create policy "ver estrelas" on public.star_days for select to authenticated using (public.is_member());

alter table public.approval_links enable row level security;
drop policy if exists "ver links" on public.approval_links;
create policy "ver links" on public.approval_links for select to authenticated using (public.is_reviewer());

drop policy if exists "ver clientes" on public.clients;
create policy "ver clientes" on public.clients for select to authenticated using (public.is_member());
drop policy if exists "gerir clientes" on public.clients;
drop policy if exists "criar clientes" on public.clients;
create policy "criar clientes" on public.clients for insert to authenticated with check (public.is_member());
drop policy if exists "editar clientes" on public.clients;
create policy "editar clientes" on public.clients for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- anexos: quem vê a peça vê os anexos
drop policy if exists "ver anexos" on public.task_attachments;
create policy "ver anexos" on public.task_attachments for select to authenticated
  using (public.is_reviewer() or exists (select 1 from public.tasks t where t.root_id = task_attachments.root_id and t.assigned_to = auth.uid()));
drop policy if exists "criar anexos" on public.task_attachments;
create policy "criar anexos" on public.task_attachments for insert to authenticated
  with check (public.is_reviewer() or exists (select 1 from public.tasks t where t.root_id = task_attachments.root_id and t.assigned_to = auth.uid()));
drop policy if exists "apagar anexos" on public.task_attachments;
create policy "apagar anexos" on public.task_attachments for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

drop policy if exists "responder jeremias" on public.pulses;
create policy "responder jeremias" on public.pulses for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
drop policy if exists "ver energia" on public.pulses;
create policy "ver energia" on public.pulses for select to authenticated
  using (public.is_manager() or user_id = auth.uid());

drop policy if exists "ler chat" on public.messages;
create policy "ler chat" on public.messages for select to authenticated using (public.is_member());
drop policy if exists "escrever chat" on public.messages;
create policy "escrever chat" on public.messages for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
drop policy if exists "apagar chat" on public.messages;
create policy "apagar chat" on public.messages for delete to authenticated
  using (user_id = auth.uid() or public.is_manager());

-- ---------- Permissões das tabelas ---------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.tasks, public.clients,
  public.task_attachments, public.messages to authenticated;
grant select, insert on public.pulses to authenticated;
grant select on public.star_days, public.pipeline to authenticated;
grant execute on function public.daily_rollover() to authenticated;
grant execute on function public.set_member(uuid, text, text) to authenticated;
grant execute on function public.review_task(uuid, text, text, text) to authenticated;
grant execute on function public.confirm_schedule(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.unconfirm_schedule(uuid) to authenticated;
grant execute on function public.publish_now(uuid) to authenticated;
grant select on public.approval_links to authenticated;
grant execute on function public.new_approval_link(uuid) to authenticated;
grant usage on schema public to anon;
grant execute on function public.get_approval(text) to anon, authenticated;
grant execute on function public.approval_token_ok(text) to anon, authenticated;
grant execute on function public.submit_approval(text, text, text, json) to anon, authenticated;
revoke execute on function public._request_change(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public._new_approval_link(uuid, uuid) from public, anon, authenticated;

-- ---------- Arquivos: fotos de perfil e anexos (Supabase Storage) --------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)  on conflict (id) do nothing;
    insert into storage.buckets (id, name, public) values ('anexos',  'anexos',  true)  on conflict (id) do nothing;
    -- o cliente precisa ver as imagens/vídeos pelo link; os caminhos têm códigos aleatórios
    update storage.buckets set public = true where id = 'anexos';

    drop policy if exists "fotos: enviar a propria" on storage.objects;
    create policy "fotos: enviar a propria" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
    drop policy if exists "fotos: trocar a propria" on storage.objects;
    create policy "fotos: trocar a propria" on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
    drop policy if exists "anexos: equipe envia" on storage.objects;
    create policy "anexos: equipe envia" on storage.objects for insert to authenticated
      with check (bucket_id = 'anexos' and public.is_member());
    drop policy if exists "anexos: cliente envia" on storage.objects;
    create policy "anexos: cliente envia" on storage.objects for insert to anon
      with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = 'cliente'
                  and public.approval_token_ok((storage.foldername(name))[2]));
    drop policy if exists "anexos: equipe abre" on storage.objects;
    create policy "anexos: equipe abre" on storage.objects for select to authenticated
      using (bucket_id = 'anexos' and public.is_member());
  end if;
end $$;

-- ---------- Chat em tempo real -------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
