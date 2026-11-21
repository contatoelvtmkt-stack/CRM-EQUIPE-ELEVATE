// Vercel: prévia (Open Graph) de cada link de aprovação, para WhatsApp/Instagram/etc.
// Só é chamada para robôs de prévia (ver vercel.json). Pessoas abrem a página normal.
const SUPABASE_URL = 'https://yzpxyiisadexrwplcljp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KdUF5mwUOCO0H1sSbPRo4Q_e3zs4SMB';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  const token = String(req.query.t || '').replace(/[^a-f0-9]/gi, '').slice(0, 80);
  const host = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const pageUrl = `${host}/aprovacao.html?t=${token}`;
  let title = 'Aprovação de conteúdo';
  let desc = 'Veja o conteúdo preparado pela Elevate e responda em um toque.';
  let image = `${host}/assets/img/og-elevate.jpg`;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_approval`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    const d = await r.json();
    if (d && d.title) {
      title = `Aprovação de conteúdo · ${d.client?.name || 'Elevate'}`;
      desc = d.state === 'aberto' ? `${d.title}. Toque para ver e aprovar.` : d.title;
      const img = (d.files || []).find((f) => f.kind === 'file' && /\.(jpe?g|png|webp|gif)$/i.test(f.name || f.path || ''));
      if (img) image = `${SUPABASE_URL}/storage/v1/object/public/anexos/${img.path.split('/').map(encodeURIComponent).join('/')}`;
      else if (d.client?.logo_url) image = d.client.logo_url;
    }
  } catch { /* usa a prévia padrão */ }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(pageUrl)}">
</head><body><a href="${esc(pageUrl)}">${esc(title)}</a></body></html>`);
};
