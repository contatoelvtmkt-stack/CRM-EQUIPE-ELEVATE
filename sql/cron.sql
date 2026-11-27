-- =====================================================================
-- Publicador automático do Instagram: chama a função "ig-publish"
-- a cada 5 minutos. Rode DEPOIS de publicar as funções no Supabase.
-- Pode rodar de novo sem problema.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('ig-publish');
exception when others then null; -- ainda não existia
end $$;

select cron.schedule(
  'ig-publish',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://yzpxyiisadexrwplcljp.supabase.co/functions/v1/ig-publish',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"origem": "cron"}'::jsonb
     ) $$
);

-- Relatórios mensais: todo dia 1, às 6h (horário de Brasília), gera o mês anterior de cada cliente
do $$
begin
  perform cron.unschedule('relatorios-mensais');
exception when others then null;
end $$;

select cron.schedule(
  'relatorios-mensais',
  '0 9 1 * *',
  $$ select net.http_post(
       url := 'https://yzpxyiisadexrwplcljp.supabase.co/functions/v1/meta-report',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"monthly": true}'::jsonb,
       timeout_milliseconds := 120000
     ) $$
);

-- Saldos das contas de anúncios: atualiza de hora em hora
do $$
begin
  perform cron.unschedule('saldos-anuncios');
exception when others then null;
end $$;

select cron.schedule(
  'saldos-anuncios',
  '17 * * * *',
  $$ select net.http_post(
       url := 'https://yzpxyiisadexrwplcljp.supabase.co/functions/v1/ads-balance',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"origem": "cron"}'::jsonb,
       timeout_milliseconds := 60000
     ) $$
);
