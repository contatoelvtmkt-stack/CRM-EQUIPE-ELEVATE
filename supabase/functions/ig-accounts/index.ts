// Supabase Edge Function: ig-accounts
// Lista as contas do Instagram que o token do usuário do sistema (META_TOKEN) pode usar,
// para vincular cada uma a um cliente no CRM. Só admin, gestora e social media podem chamar.
//
// Publicar: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "ig-accounts"
// Em "Settings" da função, desligue "Enforce JWT verification" (a função confere o login sozinha).

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

const dbHeaders = () => ({
  apikey: KEY,
  ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
  'Content-Type': 'application/json'
});

async function callerRole(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${jwt}` } });
  if (!u.ok) return null;
  const { id } = await u.json();
  const r = await fetch(`${URL_}/rest/v1/profiles?id=eq.${id}&select=role,active`, { headers: dbHeaders() });
  const [p] = await r.json();
  return p && p.active !== false ? p.role : null;
}

async function graph(path: string) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(META)}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.error_user_msg || d.error.message);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!META) return json({ error: 'O token da Meta (META_TOKEN) ainda não foi salvo nos Secrets das Edge Functions.' }, 500);
    const role = await callerRole(req);
    if (!role || !['admin', 'gestora', 'social_media'].includes(role)) return json({ error: 'Sem permissão.' }, 403);

    const found = new Map<string, Record<string, string>>();
    // 1) páginas atribuídas ao usuário do sistema, com o Instagram ligado
    const pages = await graph('/me/accounts?fields=name,instagram_business_account{id,username,profile_picture_url}&limit=200');
    for (const p of pages.data ?? []) {
      const ig = p.instagram_business_account;
      if (ig?.id) found.set(ig.id, { id: ig.id, username: ig.username ?? '', picture: ig.profile_picture_url ?? '', page: p.name ?? '', page_id: p.id });
      else found.set(`page:${p.id}`, { id: '', username: '', picture: '', page: p.name ?? '', page_id: p.id }); // página sem Instagram ligado
    }
    // 2) contas do Instagram dos portfólios a que o usuário do sistema tem acesso
    try {
      const me = await graph('/me?fields=id,name');
      const biz = await graph(`/${me.id}/businesses?fields=id,name&limit=50`).catch(() => ({ data: [] }));
      for (const b of biz.data ?? []) {
        for (const edge of ['instagram_accounts', 'client_instagram_accounts', 'owned_instagram_accounts']) {
          const r = await graph(`/${b.id}/${edge}?fields=id,username,profile_pic&limit=200`).catch(() => ({ data: [] }));
          for (const ig of r.data ?? []) {
            if (ig?.id && !found.has(ig.id)) found.set(ig.id, { id: ig.id, username: ig.username ?? '', picture: ig.profile_pic ?? '', page: '', page_id: '' });
          }
        }
      }
    } catch { /* lista das páginas já basta */ }

    return json({ accounts: [...found.values()].sort((a, b) => (a.username || a.page).localeCompare(b.username || b.page)) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
