// Supabase Edge Function: ads-balance
// Atualiza o saldo das contas de anúncios dos clientes e marca as que estão com saldo baixo.
//   Cron (de hora em hora): POST { }            → atualiza todas
//   CRM ("Atualizar agora"): POST { } com login → atualiza todas e devolve a lista
// Pré-pago (Pix/boleto): saldo disponível informado pela Meta.
// Cartão: só há "saldo" se a conta tiver limite de gasto (limite − gasto).
//
// Publicar: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "ads-balance"
// Em "Details", desligue "Enforce JWT verification".

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

const dbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: KEY, ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json', ...extra
});
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: dbHeaders((init.headers as Record<string, string>) ?? {}) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Banco: ${t}`);
  return t ? JSON.parse(t) : null;
}

// "Saldo disponível (R$ 1.234,56 BRL)" → 1234.56
export function parseMoney(text: string): number | null {
  const m = String(text ?? '').match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  let v = m[1].replace(/\s/g, '');
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}/.test(v) && !/\.\d{1,2}$/.test(v)) v = v.replace(/\./g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const cents = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v) / 100);

export function computeBalance(acc: Obj) {
  const prepaid = acc.is_prepay_account === true;
  const spent = cents(acc.amount_spent);
  const cap = cents(acc.spend_cap);
  let available: number | null = null;
  if (prepaid) {
    available = parseMoney(acc.funding_source_details?.display_string ?? '');
    if (available === null && cap && cap > 0 && spent !== null) available = Math.max(0, cap - spent);
  } else if (cap && cap > 0 && spent !== null) {
    available = Math.max(0, cap - spent);
  }
  return {
    kind: prepaid ? 'prepago' : acc.funding_source_details ? 'cartao' : 'desconhecido',
    available: available === null ? null : Math.round(available * 100) / 100,
    spend_cap: cap && cap > 0 ? cap : null,
    amount_spent: spent,
    account_status: acc.account_status ?? null
  };
}

async function fetchAccount(id: string) {
  const act = id.startsWith('act_') ? id : `act_${id}`;
  const fields = 'name,currency,account_status,amount_spent,spend_cap,balance,is_prepay_account,funding_source_details';
  let r = await fetch(`${GRAPH}/${act}?fields=${fields}&access_token=${encodeURIComponent(META)}`);
  let d = await r.json();
  if (d.error) {
    // sem permissão para a forma de pagamento: tenta sem ela
    r = await fetch(`${GRAPH}/${act}?fields=name,currency,account_status,amount_spent,spend_cap,balance,is_prepay_account&access_token=${encodeURIComponent(META)}`);
    d = await r.json();
    if (d.error) throw new Error(d.error.error_user_msg || d.error.message);
  }
  return d;
}

async function refreshAll() {
  const clients: Obj[] = await db('clients?ad_account_id=not.is.null&removed_at=is.null&active=eq.true&select=id,name,ad_account_id,ad_alert_threshold');
  const out: Obj[] = [];
  for (const c of clients) {
    const row: Obj = { client_id: c.id, account_id: c.ad_account_id, checked_at: new Date().toISOString(), error: '' };
    try {
      const acc = await fetchAccount(c.ad_account_id);
      const b = computeBalance(acc);
      Object.assign(row, { account_name: acc.name ?? '', currency: acc.currency ?? 'BRL', ...b });
      row.low = b.available !== null && b.available <= Number(c.ad_alert_threshold ?? 30);
    } catch (e) {
      Object.assign(row, { error: (e as Error).message.slice(0, 300), low: false });
    }
    await db('ad_balances?on_conflict=client_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) });
    if (!row.error) await db('ad_balance_history', { method: 'POST', body: JSON.stringify({ client_id: c.id, available: row.available ?? null, low: row.low }) });
    out.push({ cliente: c.name, ...row });
  }
  // guarda só os últimos 60 dias de histórico
  const cut = new Date(Date.now() - 60 * 864e5).toISOString();
  await db(`ad_balance_history?checked_at=lt.${encodeURIComponent(cut)}`, { method: 'DELETE' }).catch(() => {});
  return out;
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      if (!META) return json({ error: 'O token da Meta (META_TOKEN) ainda não foi salvo nos Secrets das Edge Functions.' }, 500);
      if (!URL_ || !KEY) return json({ error: 'A função não encontrou SUPABASE_URL ou a chave de serviço.' }, 500);
      const results = await refreshAll();
      return json({ atualizados: results.length, baixos: results.filter((r) => r.low).length, results });
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  });
}
