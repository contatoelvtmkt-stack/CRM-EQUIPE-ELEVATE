// Supabase Edge Function: meta-report
// Gera o relatório de Instagram e Facebook de um cliente num período e salva no banco.
//   CRM:  POST { client_id, since: "AAAA-MM-DD", until: "AAAA-MM-DD" }  (login de admin/gestora/social media)
//   Cron: POST { monthly: true }  → gera o mês anterior de todos os clientes vinculados
//
// Publicar: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "meta-report"
// Em "Details", desligue "Enforce JWT verification" (a função confere o login sozinha).
// Cada métrica é pedida separadamente: se a Meta desativar alguma, o resto do relatório continua.

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

type Obj = Record<string, any>;

// ---------- banco ----------
const dbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: KEY, ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json', ...extra
});
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: dbHeaders((init.headers as Record<string, string>) ?? {}) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Banco: ${t}`);
  return t ? JSON.parse(t) : null;
}
async function caller(req: Request): Promise<{ id: string; role: string } | null> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt || !jwt.startsWith('eyJ')) return null;
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${jwt}` } });
  if (!u.ok) return null;
  const { id } = await u.json();
  const [p] = await db(`profiles?id=eq.${id}&select=role,active`);
  return p && p.active !== false ? { id, role: p.role } : null;
}

// ---------- Graph ----------
async function g(path: string, params: Record<string, string> = {}, token = META) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`${GRAPH}${path}?${qs}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.error_user_msg || d.error.message);
  return d;
}
const safe = async <T>(p: Promise<T>, fallback: T, errs?: string[], label?: string): Promise<T> => {
  try { return await p; } catch (e) { if (errs && label) errs.push(`${label}: ${(e as Error).message}`); return fallback; }
};

// ---------- datas (horário de Brasília) ----------
const DAY = 86400;
const toUnix = (iso: string, end = false) => Math.floor(new Date(`${iso}T${end ? '23:59:59' : '00:00:00'}-03:00`).getTime() / 1000);
const isoOf = (unix: number) => new Date((unix - 3 * 3600) * 1000).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5) + 1;
// janelas de até 30 dias (limite da API de insights)
function windows(since: string, until: string) {
  const out: [number, number][] = [];
  let s = toUnix(since);
  const end = toUnix(until, true) + 1;
  while (s < end) { const e = Math.min(s + 30 * DAY, end); out.push([s, e]); s = e; }
  return out;
}

// ---------- Instagram ----------
const IG_TOTALS = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'profile_links_taps', 'website_clicks', 'profile_views'];

async function igTotals(ig: string, since: string, until: string, errs: string[]) {
  const out: Obj = {};
  await Promise.all(IG_TOTALS.map(async (m) => {
    let sum = 0; let ok = false;
    for (const [s, e] of windows(since, until)) {
      const d = await safe(g(`/${ig}/insights`, { metric: m, period: 'day', metric_type: 'total_value', since: String(s), until: String(e) }), null as Obj | null, errs, `Instagram ${m}`);
      const v = d?.data?.[0]?.total_value?.value;
      if (typeof v === 'number') { sum += v; ok = true; }
    }
    if (ok) out[m] = sum;
  }));
  // seguidores ganhos e perdidos
  let follows = 0, unfollows = 0, okF = false;
  for (const [s, e] of windows(since, until)) {
    const d = await safe(g(`/${ig}/insights`, { metric: 'follows_and_unfollows', period: 'day', metric_type: 'total_value', breakdown: 'follow_type', since: String(s), until: String(e) }), null as Obj | null);
    for (const r of d?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []) {
      okF = true;
      if (r.dimension_values?.[0] === 'FOLLOWER') follows += r.value; else unfollows += r.value;
    }
  }
  if (okF) { out.follows = follows; out.unfollows = unfollows; }
  return out;
}

async function igDailyReach(ig: string, since: string, until: string) {
  const series: { date: string; value: number }[] = [];
  for (const [s, e] of windows(since, until)) {
    const d = await safe(g(`/${ig}/insights`, { metric: 'reach', period: 'day', since: String(s), until: String(e) }), null as Obj | null);
    for (const v of d?.data?.[0]?.values ?? []) series.push({ date: isoOf(Date.parse(v.end_time) / 1000 - 1), value: v.value });
  }
  return series;
}

async function igPosts(ig: string, since: string, until: string) {
  const s = toUnix(since), e = toUnix(until, true);
  const posts: Obj[] = [];
  let next: string | null = `/${ig}/media`;
  let params: Record<string, string> = { fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count', limit: '50' };
  for (let page = 0; next && page < 6; page++) {
    const d: Obj = await g(next, params);
    for (const m of d.data ?? []) {
      const t = Date.parse(m.timestamp) / 1000;
      if (t > e) continue;
      if (t < s) { next = null; break; }
      posts.push(m);
    }
    if (next) {
      const after = d.paging?.cursors?.after;
      if (!after || !d.paging?.next) next = null; else params = { ...params, after };
    }
  }
  // métricas de cada post (até 40)
  await Promise.all(posts.slice(0, 40).map(async (m) => {
    const metrics = m.media_product_type === 'STORY' ? 'reach,views,replies' : 'reach,views,saved,shares,total_interactions';
    let d = await safe(g(`/${m.id}/insights`, { metric: metrics }), null as Obj | null);
    if (!d) d = await safe(g(`/${m.id}/insights`, { metric: 'reach,saved' }), null as Obj | null);
    for (const x of d?.data ?? []) m[x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? 0;
  }));
  return posts.map((m) => ({
    id: m.id, caption: (m.caption ?? '').slice(0, 220), type: m.media_product_type === 'REELS' ? 'reels' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : m.media_product_type === 'STORY' ? 'story' : 'feed',
    permalink: m.permalink, thumb: m.thumbnail_url || m.media_url || '', date: m.timestamp,
    likes: m.like_count ?? 0, comments: m.comments_count ?? 0, reach: m.reach ?? null, views: m.views ?? null,
    saves: m.saved ?? null, shares: m.shares ?? null, interactions: m.total_interactions ?? null
  }));
}

async function instagram(ig: string, since: string, until: string, prev: [string, string]) {
  const errs: string[] = [];
  const profile = await safe(g(`/${ig}`, { fields: 'username,name,followers_count,follows_count,media_count,profile_picture_url' }), {} as Obj, errs, 'Perfil do Instagram');
  const [totals, prevTotals, daily, posts] = await Promise.all([
    igTotals(ig, since, until, errs),
    igTotals(ig, prev[0], prev[1], []),
    igDailyReach(ig, since, until),
    safe(igPosts(ig, since, until), [] as Obj[], errs, 'Posts do Instagram')
  ]);
  return {
    username: profile.username ?? '', name: profile.name ?? '', picture: profile.profile_picture_url ?? '',
    followers: profile.followers_count ?? null, media_count: profile.media_count ?? null,
    totals, prevTotals, daily, posts, errors: [...new Set(errs)].slice(0, 8)
  };
}

// ---------- Facebook ----------
const FB_METRICS = ['page_media_view', 'page_impressions_unique', 'page_post_engagements', 'page_follows', 'page_daily_follows_unique', 'page_views_total', 'page_video_views'];

async function pageToken(pageId: string) {
  const d = await g('/me/accounts', { fields: 'id,access_token', limit: '200' });
  return (d.data ?? []).find((p: Obj) => p.id === pageId)?.access_token ?? null;
}
async function fbTotals(page: string, tok: string, since: string, until: string, errs: string[]) {
  const out: Obj = {}; const daily: Obj = {};
  await Promise.all(FB_METRICS.map(async (m) => {
    let sum = 0, last: number | null = null, ok = false; const series: Obj[] = [];
    for (const [s, e] of windows(since, until)) {
      const d = await safe(g(`/${page}/insights`, { metric: m, period: 'day', since: String(s), until: String(e) }, tok), null as Obj | null, errs, `Facebook ${m}`);
      for (const v of d?.data?.[0]?.values ?? []) {
        if (typeof v.value === 'number') { ok = true; sum += v.value; last = v.value; series.push({ date: isoOf(Date.parse(v.end_time) / 1000 - 1), value: v.value }); }
      }
    }
    if (ok) { out[m] = m === 'page_follows' ? last : sum; daily[m] = series; }
  }));
  return { totals: out, daily };
}
async function facebook(pageId: string, since: string, until: string, prev: [string, string]) {
  const errs: string[] = [];
  const tok = await safe(pageToken(pageId), null as string | null, errs, 'Acesso à página');
  if (!tok) return { errors: ['A página do Facebook não está liberada para o usuário do sistema CRM Elevate.', ...errs] };
  const info = await safe(g(`/${pageId}`, { fields: 'name,followers_count,fan_count,picture{url}' }, tok), {} as Obj, errs, 'Página');
  const [cur, prv, posts] = await Promise.all([
    fbTotals(pageId, tok, since, until, errs),
    fbTotals(pageId, tok, prev[0], prev[1], []),
    safe(g(`/${pageId}/posts`, {
      fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)',
      since: String(toUnix(since)), until: String(toUnix(until, true)), limit: '50'
    }, tok), { data: [] } as Obj, errs, 'Posts do Facebook')
  ]);
  return {
    name: info.name ?? '', picture: info.picture?.data?.url ?? '', followers: info.followers_count ?? info.fan_count ?? null,
    totals: cur.totals, prevTotals: prv.totals,
    daily: cur.daily.page_impressions_unique ?? cur.daily.page_media_view ?? [],
    posts: (posts.data ?? []).map((p: Obj) => ({
      id: p.id, caption: (p.message ?? '').slice(0, 220), permalink: p.permalink_url, thumb: p.full_picture ?? '', date: p.created_time,
      reactions: p.reactions?.summary?.total_count ?? 0, comments: p.comments?.summary?.total_count ?? 0, shares: p.shares?.count ?? 0
    })),
    errors: [...new Set(errs)].slice(0, 8)
  };
}

// ---------- relatório ----------
async function buildReport(client: Obj, since: string, until: string) {
  const len = daysBetween(since, until);
  const prev: [string, string] = [addDays(since, -len), addDays(since, -1)];
  const [ig, fb] = await Promise.all([
    client.ig_user_id ? instagram(client.ig_user_id, since, until, prev) : Promise.resolve(null),
    client.fb_page_id ? facebook(client.fb_page_id, since, until, prev) : Promise.resolve(null)
  ]);
  return { client: { id: client.id, name: client.name, logo_url: client.logo_url }, since, until, prev: { since: prev[0], until: prev[1] }, ig, fb, generated_at: new Date().toISOString() };
}
async function saveReport(client: Obj, kind: string, since: string, until: string, data: Obj, by: string | null) {
  const [row] = await db('reports?on_conflict=client_id,kind,period_start,period_end', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ client_id: client.id, kind, period_start: since, period_end: until, data, created_by: by })
  });
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!META) return json({ error: 'O token da Meta (META_TOKEN) ainda não foi salvo nos Secrets das Edge Functions.' }, 500);
    const body = await req.json().catch(() => ({}));

    if (body.monthly) {
      // mês anterior (horário de Brasília)
      const today = isoOf(Date.now() / 1000);
      const first = `${today.slice(0, 7)}-01`;
      const until = addDays(first, -1);
      const since = `${until.slice(0, 7)}-01`;
      const clients: Obj[] = await db('clients?active=eq.true&or=(ig_user_id.not.is.null,fb_page_id.not.is.null)&select=*');
      const done: string[] = [];
      for (const c of clients) {
        try { await saveReport(c, 'mensal', since, until, await buildReport(c, since, until), null); done.push(c.name); }
        catch (e) { done.push(`${c.name}: erro ${(e as Error).message}`); }
      }
      return json({ periodo: [since, until], clientes: done });
    }

    const who = await caller(req);
    if (!who || !['admin', 'gestora', 'social_media'].includes(who.role)) return json({ error: 'Sem permissão.' }, 403);
    const { client_id, since, until } = body;
    if (!client_id || !/^\d{4}-\d{2}-\d{2}$/.test(since ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(until ?? '')) return json({ error: 'Informe o cliente e as datas.' }, 400);
    if (since > until) return json({ error: 'A data inicial é depois da final.' }, 400);
    if (daysBetween(since, until) > 366) return json({ error: 'O período máximo é de 1 ano.' }, 400);
    const [client] = await db(`clients?id=eq.${client_id}&select=*`);
    if (!client) return json({ error: 'Cliente não encontrado.' }, 404);
    if (!client.ig_user_id && !client.fb_page_id) return json({ error: 'Este cliente ainda não tem Instagram nem página do Facebook vinculados.' }, 400);
    const data = await buildReport(client, since, until);
    const kind = body.kind === 'mensal' ? 'mensal' : 'personalizado';
    const row = await saveReport(client, kind, since, until, data, who.id);
    return json({ report: row });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
