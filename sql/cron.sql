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
