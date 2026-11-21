// Supabase Edge Function: ig-publish
// Publica no Instagram os posts com agendamento confirmado cuja data/hora já chegou.
// Roda a cada 5 minutos (sql/cron.sql) e também pelo botão "Publicar agora" do CRM.
//
// Publicar: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "ig-publish"
// Em "Settings" da função, desligue "Enforce JWT verification".
// Ela só publica o que já está na fila e na hora; chamar a mais não publica nada a mais.

const GRAPH = 'https://graph.facebook.com/v23.0';
const URL_ = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  (() => { try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? ''; } catch { return ''; } })();
const META = Deno.env.get('META_TOKEN') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- banco (PostgREST com a chave de serviço) ----------
const dbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: KEY,
  ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
  'Content-Type': 'application/json',
  ...extra
});
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: dbHeaders((init.headers as Record<string, string>) ?? {}) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Banco: ${t}`);
  return t ? JSON.parse(t) : null;
}
const patchRoot = (rootId: string, body: Record<string, unknown>, where = '') =>
  db(`tasks?root_id=eq.${rootId}${where}`, { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=representation' } });

// ---------- Graph API ----------
async function gpost(path: string, params: Record<string, string>) {
  const body = new URLSearchParams({ ...params, access_token: META });
  const r = await fetch(`${GRAPH}${path}`, { method: 'POST', body });
  const d = await r.json();
  if (d.error) throw new Error(d.error.error_user_msg || d.error.message);
  return d;
}
async function gget(path: string, fields: string) {
  const r = await fetch(`${GRAPH}${path}?fields=${fields}&access_token=${encodeURIComponent(META)}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.error_user_msg || d.error.message);
  return d;
}
// espera o contêiner ficar pronto (imagens: segundos; vídeos: pode levar minutos)
async function waitReady(id: string, tries = 6): Promise<'ok' | 'wait'> {
  for (let i = 0; i < tries; i++) {
    const s = await gget(`/${id}`, 'status_code,status');
    if (s.status_code === 'FINISHED') return 'ok';
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`O Instagram recusou a mídia: ${s.status ?? s.status_code}`);
    await sleep(3000);
  }
  return 'wait';
}

// ---------- mídia ----------
type Att = { name: string; path: string };
const isVideo = (a: Att) => /\.(mp4|mov|m4v)$/i.test(a.name || a.path);
const isImage = (a: Att) => /\.(jpe?g|png|webp|gif|heic)$/i.test(a.name || a.path);
const publicUrl = (path: string) => `${URL_}/storage/v1/object/public/anexos/${path.split('/').map(encodeURIComponent).join('/')}`;
function checkImage(a: Att) {
  if (!/\.jpe?g$/i.test(a.path)) throw new Error(`"${a.name}" não é JPG. O Instagram só aceita imagens em JPG: exporte em JPG e anexe de novo.`);
}

// cria o(s) contêiner(es) do post e devolve o estado para guardar em ig_container_id
async function createContainers(ig: string, t: Record<string, string>, media: Att[]) {
  const fmt = t.post_format || 'feed';
  const caption = t.caption || '';
  if (!media.length) throw new Error('A tarefa não tem imagem ou vídeo anexado.');
  if (fmt === 'carrossel') {
    const items = media.slice(0, 10);
    if (items.length < 2) throw new Error('Carrossel precisa de pelo menos 2 imagens ou vídeos anexados.');
    const children: string[] = [];
    for (const a of items) {
      if (isVideo(a)) children.push((await gpost(`/${ig}/media`, { media_type: 'VIDEO', video_url: publicUrl(a.path), is_carousel_item: 'true' })).id);
      else { checkImage(a); children.push((await gpost(`/${ig}/media`, { image_url: publicUrl(a.path), is_carousel_item: 'true' })).id); }
    }
    return { children, caption };
  }
  const a = fmt === 'reels' ? media.find(isVideo) : media[0];
  if (!a) throw new Error('Reels precisa de um vídeo (MP4 ou MOV) anexado.');
  let params: Record<string, string>;
  if (fmt === 'story') {
    if (isVideo(a)) params = { media_type: 'STORIES', video_url: publicUrl(a.path) };
    else { checkImage(a); params = { media_type: 'STORIES', image_url: publicUrl(a.path) }; }
  } else if (isVideo(a)) {
    params = { media_type: 'REELS', video_url: publicUrl(a.path), caption, share_to_feed: 'true' };
  } else {
    checkImage(a);
    params = { image_url: publicUrl(a.path), caption };
  }
  return { container: (await gpost(`/${ig}/media`, params)).id };
}

// avança um post: cria contêiner → espera ficar pronto → publica
async function advance(t: Record<string, string>) {
  const rootId = t.root_id;
  const [client] = await db(`clients?id=eq.${t.client_id}&select=ig_user_id,ig_username`);
  const ig = client?.ig_user_id;
  if (!ig) throw new Error('O cliente não tem Instagram vinculado (Equipe → Clientes).');

  let state: { container?: string; children?: string[]; caption?: string } = t.ig_container_id ? JSON.parse(t.ig_container_id) : {};
  if (!state.container && !state.children) {
    const atts: Att[] = await db(`task_attachments?root_id=eq.${rootId}&kind=eq.file&select=name,path&order=created_at`);
    const media = atts.filter((a) => !a.name.startsWith('Cliente – ') && (isImage(a) || isVideo(a)));
    state = await createContainers(ig, t, media);
    await patchRoot(rootId, { ig_container_id: JSON.stringify(state) });
  }
  // carrossel: espera os itens e cria o contêiner principal
  if (state.children && !state.container) {
    for (const c of state.children) if ((await waitReady(c, 3)) === 'wait') return 'aguardando';
    state.container = (await gpost(`/${ig}/media`, { media_type: 'CAROUSEL', children: state.children.join(','), caption: state.caption ?? '' })).id;
    await patchRoot(rootId, { ig_container_id: JSON.stringify(state) });
  }
  if ((await waitReady(state.container!)) === 'wait') return 'aguardando';

  // trava para não publicar duas vezes
  const claimed = await patchRoot(rootId, { publish_status: 'publicando' }, '&publish_status=eq.processando');
  if (!claimed?.length) return 'ocupado';
  try {
    const pub = await gpost(`/${ig}/media_publish`, { creation_id: state.container! });
    let permalink = '';
    try { permalink = (await gget(`/${pub.id}`, 'permalink')).permalink ?? ''; } catch { /* sem link */ }
    const now = new Date().toISOString();
    await patchRoot(rootId, {
      publish_status: 'publicado', publish_error: '', ig_media_id: pub.id, ig_permalink: permalink,
      published_at: now, stage: 'concluido', stage_at: now
    });
    return 'publicado';
  } catch (e) {
    await patchRoot(rootId, { publish_status: 'processando' });
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    return await run();
  } catch (e) {
    const msg = (e as Error).message || String(e);
    const hint = /publish_status|column|coluna/i.test(msg)
      ? ' (Rode de novo o sql/schema.sql mais recente no SQL Editor.)'
      : /JWT|apikey|Invalid API key|No API key/i.test(msg) ? ' (A função não encontrou a chave interna do Supabase.)' : '';
    return json({ error: msg + hint }, 500);
  }
});

async function run() {
  if (!META) return json({ error: 'O token da Meta (META_TOKEN) ainda não foi salvo nos Secrets das Edge Functions.' }, 500);
  if (!URL_ || !KEY) return json({ error: 'A função não encontrou SUPABASE_URL ou a chave de serviço (SUPABASE_SERVICE_ROLE_KEY).' }, 500);
  const until = new Date(Date.now() + 60_000).toISOString();
  const due: Record<string, string>[] = await db(
    `pipeline?select=*&stage=eq.agendamento&scheduled_at=not.is.null&publish_status=in.(fila,processando)&post_at=lte.${encodeURIComponent(until)}&order=post_at&limit=20`
  );
  const results: Record<string, string>[] = [];
  for (const t of due) {
    try {
      if (t.publish_status === 'fila') {
        const claimed = await patchRoot(t.root_id, { publish_status: 'processando', publish_error: '' }, '&publish_status=eq.fila');
        if (!claimed?.length) continue; // outra execução já pegou
      }
      results.push({ titulo: t.title, resultado: await advance(t) });
    } catch (e) {
      const msg = (e as Error).message.slice(0, 500);
      await patchRoot(t.root_id, { publish_status: 'erro', publish_error: msg, ig_container_id: null }).catch(() => {});
      results.push({ titulo: t.title, resultado: 'erro', erro: msg });
    }
  }
  return json({ verificados: due.length, results });
}
