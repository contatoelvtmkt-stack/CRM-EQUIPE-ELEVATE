// Relatório de Instagram e Facebook em páginas A4 deitadas (tela e PDF)
import { esc } from './ui.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dParts = (iso) => iso.slice(0, 10).split('-').map(Number);
const fmtDate = (iso) => { const [y, m, d] = dParts(iso); return `${d} ${MS[m - 1]} ${y}`; };
const fmtShort = (iso) => { const [, m, d] = dParts(iso); return `${d}/${String(m).padStart(2, '0')}`; };
export const periodLabel = (since, until) => {
  const [y1, m1, d1] = dParts(since); const [y2, m2, d2] = dParts(until);
  const lastDay = new Date(Date.UTC(y2, m2, 0)).getUTCDate();
  if (d1 === 1 && y1 === y2 && m1 === m2 && d2 === lastDay) return `${MONTHS[m1 - 1][0].toUpperCase()}${MONTHS[m1 - 1].slice(1)} de ${y1}`;
  return `${fmtDate(since)} a ${fmtDate(until)}`;
};
const nf = new Intl.NumberFormat('pt-BR');
const num = (v) => (v === null || v === undefined ? '—' : v >= 10000 ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : nf.format(v));

function delta(cur, prev) {
  if (typeof cur !== 'number' || typeof prev !== 'number' || prev === 0) return '';
  const p = ((cur - prev) / prev) * 100;
  if (Math.abs(p) < 0.5) return '<span class="dl eq">= igual ao período anterior</span>';
  const up = p > 0;
  return `<span class="dl ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(p).toFixed(Math.abs(p) < 10 ? 1 : 0).replace('.', ',')}% <em>vs. período anterior</em></span>`;
}

const kpi = (label, value, d = '', sub = '') => `<div class="rk">
  <small>${label}</small><b>${num(value)}</b>${sub ? `<span class="sub">${sub}</span>` : ''}${d}</div>`;

// gráfico de barras diário (SVG): barras finas, 2px de espaço, grade discreta, rótulos esparsos
function dailyChart(series, label, H = 200) {
  if (!series?.length) return `<div class="rchart empty">Sem dados diários de ${label.toLowerCase()} neste período.</div>`;
  const W = 640, pl = 44, pb = 26, pt = 10;
  const max = Math.max(1, ...series.map((s) => s.value));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const bw = (W - pl) / series.length;
  const y = (v) => pt + (H - pt - pb) * (1 - v / top);
  const grid = [];
  for (let v = 0; v <= top; v += step) grid.push(`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pl - 8}" y="${y(v) + 4}" class="ax" text-anchor="end">${num(v)}</text>`);
  const every = Math.ceil(series.length / 8);
  const best = series.reduce((a, b) => (b.value > a.value ? b : a), series[0]);
  const bars = series.map((s, i) => {
    const x = pl + i * bw + 1; const h = Math.max(0, y(0) - y(s.value));
    return `<rect x="${x}" y="${y(s.value)}" width="${Math.max(1, bw - 2)}" height="${h}" class="${s === best ? 'rbar hi' : 'rbar'}" data-tip="${fmtShort(s.date)}: ${nf.format(s.value)}"><title>${fmtShort(s.date)}: ${nf.format(s.value)}</title></rect>
      ${i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 8}" class="ax" text-anchor="middle">${fmtShort(s.date)}</text>` : ''}`;
  }).join('');
  return `<div class="rchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} por dia">${grid.join('')}${bars}</svg>
    <p class="rnote">Melhor dia: <b>${fmtShort(best.date)}</b> com ${nf.format(best.value)}. Total no período: <b>${nf.format(series.reduce((a, s) => a + s.value, 0))}</b>.</p></div>`;
}
function niceStep(max) {
  const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10;
}

const TYPE = { feed: 'Feed', carrossel: 'Carrossel', reels: 'Reels', story: 'Story' };
function postCard(p, fb = false) {
  const stats = fb
    ? [['Reações', p.reactions], ['Comentários', p.comments], ['Compart.', p.shares]]
    : [['Alcance', p.reach], ['Curtidas', p.likes], ['Coment.', p.comments], ['Salvos', p.saves]];
  return `<a class="rp" href="${esc(p.permalink || '#')}" target="_blank" rel="noopener">
    <span class="rp-img">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<i>${fb ? 'Facebook' : TYPE[p.type] || 'Post'}</i></span>
    <span class="rp-b"><small>${fmtDate(p.date)}</small><span class="rp-c">${esc(p.caption || 'Sem legenda')}</span>
      <span class="rp-s">${stats.map(([l, v]) => `<span><b>${num(v)}</b>${l}</span>`).join('')}</span></span></a>`;
}

function header(d, title, page, total) {
  return `<header class="rh">
    <div class="rh-c">${d.client.logo_url ? `<img src="${esc(d.client.logo_url)}" alt="">` : `<b>${esc((d.client.name || '?').slice(0, 2).toUpperCase())}</b>`}
      <div><small>${title}</small><h1>${esc(d.client.name)}</h1></div></div>
    <div class="rh-p"><span>${periodLabel(d.since, d.until)}</span><img src="assets/img/logo.svg" alt="Elevate"></div>
  </header>`;
}
const footer = (d, page, total) => `<footer class="rf"><span>Relatório gerado pelo CRM Elevate em ${fmtDate(d.generated_at)} · comparação com ${fmtDate(d.prev.since)} a ${fmtDate(d.prev.until)}</span><span>${page}/${total}</span></footer>`;

export function renderReport(d) {
  const pages = [];
  const ig = d.ig; const fb = d.fb;
  if (ig) {
    const t = ig.totals || {}; const p = ig.prevTotals || {};
    const net = typeof t.follows === 'number' ? t.follows - (t.unfollows || 0) : null;
    pages.push((n, tot) => `<section class="rep-page">${header(d, 'Relatório de Instagram', n, tot)}
      <div class="rbody">
        <div class="rsec"><h2>Instagram <span>@${esc(ig.username)}</span></h2>
          <div class="rkpis">
            ${kpi('Seguidores', ig.followers, '', net !== null ? `${net >= 0 ? '+' : ''}${nf.format(net)} no período (${nf.format(t.follows)} novos, ${nf.format(t.unfollows || 0)} saíram)` : '')}
            ${kpi('Alcance', t.reach, delta(t.reach, p.reach), 'contas alcançadas')}
            ${kpi('Visualizações', t.views, delta(t.views, p.views))}
            ${kpi('Contas engajadas', t.accounts_engaged, delta(t.accounts_engaged, p.accounts_engaged))}
            ${kpi('Interações', t.total_interactions, delta(t.total_interactions, p.total_interactions))}
            ${kpi('Curtidas', t.likes, delta(t.likes, p.likes))}
            ${kpi('Comentários', t.comments, delta(t.comments, p.comments))}
            ${kpi('Salvamentos', t.saves, delta(t.saves, p.saves), t.shares !== undefined ? `${nf.format(t.shares)} compartilhamentos` : '')}
            ${t.profile_views !== undefined ? kpi('Visitas ao perfil', t.profile_views, delta(t.profile_views, p.profile_views)) : ''}
            ${t.profile_links_taps !== undefined ? kpi('Toques nos links', t.profile_links_taps, delta(t.profile_links_taps, p.profile_links_taps)) : ''}
          </div>
        </div>
        <div class="rsec"><h2>Alcance por dia</h2>${dailyChart(ig.daily, 'Alcance', 360)}</div>
      </div>${footer(d, n, tot)}</section>`);
    const posts = [...(ig.posts || [])];
    const rank = (x) => x.reach ?? x.interactions ?? (x.likes + x.comments);
    const top = posts.sort((a, b) => rank(b) - rank(a)).slice(0, 8);
    const byType = posts.reduce((a, x) => ((a[x.type] = (a[x.type] || 0) + 1), a), {});
    pages.push((n, tot) => `<section class="rep-page">${header(d, 'Relatório de Instagram', n, tot)}
      <div class="rbody">
        <div class="rsec"><h2>Conteúdos de maior alcance <span>${posts.length} publicações no período${Object.keys(byType).length ? ' · ' + Object.entries(byType).map(([k, v]) => `${v} ${TYPE[k] || k}`).join(' · ') : ''}</span></h2>
          ${top.length ? `<div class="rposts">${top.map((x) => postCard(x)).join('')}</div>` : '<p class="rempty">Nenhuma publicação no período.</p>'}
        </div>
        ${ig.errors?.length ? `<p class="rwarn">Algumas métricas não estavam disponíveis na Meta para este período.</p>` : ''}
      </div>${footer(d, n, tot)}</section>`);
  }
  if (fb && !fb.errors?.[0]?.startsWith('A página')) {
    const t = fb.totals || {}; const p = fb.prevTotals || {};
    const views = t.page_media_view ?? t.page_impressions_unique;
    const pviews = p.page_media_view ?? p.page_impressions_unique;
    const top = [...(fb.posts || [])].sort((a, b) => (b.reactions + b.comments + b.shares) - (a.reactions + a.comments + a.shares)).slice(0, 4);
    pages.push((n, tot) => `<section class="rep-page">${header(d, 'Relatório de Facebook', n, tot)}
      <div class="rbody fb">
        <div class="rsec"><h2>Facebook <span>${esc(fb.name)}</span></h2>
          <div class="rkpis">
            ${kpi('Seguidores da página', fb.followers)}
            ${kpi('Visualizações', views, delta(views, pviews))}
            ${kpi('Engajamento nos posts', t.page_post_engagements, delta(t.page_post_engagements, p.page_post_engagements))}
            ${kpi('Novos seguidores', t.page_daily_follows_unique, delta(t.page_daily_follows_unique, p.page_daily_follows_unique))}
          </div>
          <div style="margin-top:10px">${dailyChart(fb.daily, 'Visualizações', 230)}</div>
        </div>
        <div class="rsec"><h2>Publicações com mais engajamento <span>${(fb.posts || []).length} no período</span></h2>
          ${top.length ? `<div class="rposts rlist">${top.map((x) => postCard(x, true)).join('')}</div>` : '<p class="rempty">Nenhuma publicação no período.</p>'}
        </div>
      </div>${footer(d, n, tot)}</section>`);
  }
  if (!pages.length) return '<p class="rempty">Sem dados para este relatório.</p>';
  return pages.map((f, i) => f(i + 1, pages.length)).join('');
}
