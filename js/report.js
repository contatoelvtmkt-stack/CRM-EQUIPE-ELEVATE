// Relatório de Instagram, Facebook e Tráfego pago em páginas A4 deitadas (tela e PDF)
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
const num = (v) => (v === null || v === undefined ? '—' : v >= 10000 ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : nf.format(Math.round(v * 100) / 100));
const money = (v, cur = 'BRL') => (v === null || v === undefined ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur || 'BRL' }).format(v));
const dec = (v) => (v === null || v === undefined ? '—' : v.toFixed(2).replace('.', ','));
const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);

function delta(cur, prev, invert = false) {
  if (typeof cur !== 'number' || typeof prev !== 'number' || prev === 0) return '';
  const p = ((cur - prev) / prev) * 100;
  if (Math.abs(p) < 0.5) return '<span class="dl eq">= igual ao período anterior</span>';
  const up = p > 0; const good = invert ? !up : up;
  return `<span class="dl ${good ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(p).toFixed(Math.abs(p) < 10 ? 1 : 0).replace('.', ',')}% <em>vs. período anterior</em></span>`;
}
const kpi = (label, value, d = '', sub = '', cls = '', extra = '') => `<div class="rk ${cls}"><small>${label}</small><b>${value}</b>${sub ? `<span class="sub">${sub}</span>` : ''}${d}${extra}</div>`;

// barra dividida seguidores x não seguidores (legenda sempre visível)
function followSplit(by) {
  if (!by) return '';
  const f = by.FOLLOWER ?? 0; const n = by.NON_FOLLOWER ?? 0; const t = f + n;
  if (!t) return '';
  return `<div class="rsplit"><span class="bar2"><i style="width:${pct(f, t)}%"></i><i class="nf" style="width:${pct(n, t)}%"></i></span>
    <span class="lg"><span><i></i>Seguidores <b>${String(pct(f, t)).replace('.', ',')}%</b></span><span><i class="nf"></i>Não seguidores <b>${String(pct(n, t)).replace('.', ',')}%</b></span></span></div>`;
}

// gráfico de barras diário (SVG)
function dailyChart(series, label, H = 200, fmt = (v) => nf.format(v), axis = num) {
  if (!series?.length) return `<div class="rchart empty">Sem dados diários de ${label.toLowerCase()} neste período.</div>`;
  const W = 640, pl = 52, pb = 26, pt = 10;
  const max = Math.max(1, ...series.map((s) => s.value));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const bw = (W - pl) / series.length;
  const y = (v) => pt + (H - pt - pb) * (1 - v / top);
  const grid = [];
  for (let v = 0; v <= top + 1e-9; v += step) grid.push(`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pl - 8}" y="${y(v) + 4}" class="ax" text-anchor="end">${axis(v)}</text>`);
  const every = Math.ceil(series.length / 8);
  const best = series.reduce((a, b) => (b.value > a.value ? b : a), series[0]);
  const bars = series.map((s, i) => {
    const x = pl + i * bw + 1; const h = Math.max(0, y(0) - y(s.value));
    return `<rect x="${x}" y="${y(s.value)}" width="${Math.max(1, bw - 2)}" height="${h}" class="${s === best ? 'rbar hi' : 'rbar'}"><title>${fmtShort(s.date)}: ${fmt(s.value)}</title></rect>
      ${i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 8}" class="ax" text-anchor="middle">${fmtShort(s.date)}</text>` : ''}`;
  }).join('');
  return `<div class="rchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} por dia">${grid.join('')}${bars}</svg>
    <p class="rnote">Melhor dia: <b>${fmtShort(best.date)}</b> com ${fmt(best.value)}. Total no período: <b>${fmt(series.reduce((a, s) => a + s.value, 0))}</b>.</p></div>`;
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

function header(d, title, icon) {
  return `<header class="rh">
    <div class="rh-c">${d.client.logo_url ? `<img src="${esc(d.client.logo_url)}" alt="">` : `<b>${esc((d.client.name || '?').slice(0, 2).toUpperCase())}</b>`}
      <div><small>${title}</small><h1>${esc(d.client.name)}</h1></div></div>
    <div class="rh-p"><span>${periodLabel(d.since, d.until)}</span><img src="assets/img/logo.svg" alt="Elevate"></div>
  </header>`;
}
const footer = (d, page, total) => `<footer class="rf"><span>Relatório gerado pelo CRM Elevate em ${fmtDate(d.generated_at)} · comparação com ${fmtDate(d.prev.since)} a ${fmtDate(d.prev.until)}</span><span>${String(page).padStart(2, '0')}/${String(total).padStart(2, '0')}</span></footer>`;
const unavailable = (msg) => `<div class="runav"><img src="assets/img/seta.svg" alt=""><p>${esc(msg)}</p></div>`;

// ---------------------------------------------------------------------
export function renderReport(d) {
  const pages = [];
  const ig = d.ig; const fb = d.fb; const ads = d.ads;

  // ---------- Instagram: visão geral ----------
  if (ig) {
    const t = ig.totals || {}; const p = ig.prevTotals || {};
    const posts = ig.posts || [];
    const byType = posts.reduce((a, x) => ((a[x.type] = (a[x.type] || 0) + 1), a), {});
    const net = typeof t.follows === 'number' ? t.follows - (t.unfollows || 0) : null;
    const taps = t.taps_by_button || {};
    const tapRows = [
      ['Visitas ao perfil', t.profile_views],
      ['Toques em links externos', taps.UNDEFINED ?? taps.WEBSITE ?? (t.website_clicks ?? null)],
      ['Toques no endereço comercial', taps.DIRECTION ?? null],
      ['Toques no botão de ligar', taps.CALL ?? null],
      ['Toques no botão de e-mail', taps.EMAIL ?? null],
      ['Toques em mensagem / WhatsApp', taps.TEXT ?? null]
    ].filter(([, v], i) => i < 4 || (v ?? 0) > 0);
    pages.push((n, tot) => `<section class="rep-page">${header(d, 'Relatório de Instagram')}
      <div class="rbody ig1">
        <div class="rtitle"><h2>Instagram <span>@${esc(ig.username)}</span></h2></div>
        <div class="rkpis k4">
          ${kpi('Total de seguidores', num(ig.followers))}
          ${kpi('Novos seguidores', net === null ? '—' : `${net >= 0 ? '+' : ''}${nf.format(net)}`, '', t.follows !== undefined ? `${nf.format(t.follows)} novos · ${nf.format(t.unfollows || 0)} saíram` : '', 'accent')}
          ${kpi('Publicações', nf.format(posts.length), '', Object.entries(byType).map(([k, v]) => `${v} ${TYPE[k] || k}`).join(' · ') || 'nenhuma no período')}
          ${kpi('Visualizações', num(t.views), delta(t.views, p.views), 'antigas "impressões"')}
        </div>
        <div class="rkpis k2 tall">
          ${kpi('Contas alcançadas', num(t.reach), delta(t.reach, p.reach), '', 'split', followSplit(t.reach_by_follow))}
          ${kpi('Interações', num(t.total_interactions), delta(t.total_interactions, p.total_interactions), `${num(t.likes)} curtidas · ${num(t.comments)} comentários · ${num(t.saves)} salvos · ${num(t.shares)} compart.`, 'split', followSplit(t.total_interactions_by_follow))}
        </div>
        <div class="rbox">
          <h3>Atividade no perfil</h3>
          <ul class="rlist2">${tapRows.map(([l, v]) => `<li><span>${l}</span><b>${v === null || v === undefined ? '—' : nf.format(v)}</b></li>`).join('')}</ul>
          ${t.accounts_engaged !== undefined ? `<p class="rnote" style="margin-top:10px">Contas engajadas: <b>${nf.format(t.accounts_engaged)}</b> ${delta(t.accounts_engaged, p.accounts_engaged).replace('class="dl', 'class="dl inl')}</p>` : ''}
        </div>
        <div class="rsec chart"><h2>Alcance por dia</h2>${dailyChart(ig.daily, 'Alcance', 210)}</div>
      </div>${footer(d, n, tot)}</section>`);

    // ---------- Instagram: conteúdos ----------
    const rank = (x) => x.reach ?? x.interactions ?? (x.likes + x.comments);
    const top = [...posts].sort((a, b) => rank(b) - rank(a)).slice(0, 8);
    pages.push((n, tot) => `<section class="rep-page">${header(d, 'Relatório de Instagram')}
      <div class="rbody">
        <div class="rsec"><h2>Conteúdos de maior alcance <span>${posts.length} publicações no período${Object.keys(byType).length ? ' · ' + Object.entries(byType).map(([k, v]) => `${v} ${TYPE[k] || k}`).join(' · ') : ''}</span></h2>
          ${top.length ? `<div class="rposts">${top.map((x) => postCard(x)).join('')}</div>` : '<p class="rempty">Nenhuma publicação no período.</p>'}
        </div>
      </div>${footer(d, n, tot)}</section>`);
  }

  // ---------- Facebook ----------
  if (fb) {
    pages.push((n, tot) => {
      if (fb.unavailable) return `<section class="rep-page">${header(d, 'Relatório de Facebook')}<div class="rbody one">${unavailable(fb.unavailable)}</div>${footer(d, n, tot)}</section>`;
      const t = fb.totals || {}; const p = fb.prevTotals || {};
      const views = t.page_media_view ?? t.page_impressions ?? t.page_impressions_unique;
      const pviews = p.page_media_view ?? p.page_impressions ?? p.page_impressions_unique;
      const newF = t.page_daily_follows_unique ?? t.page_fan_adds_unique;
      const pnewF = p.page_daily_follows_unique ?? p.page_fan_adds_unique;
      const top = [...(fb.posts || [])].sort((a, b) => (b.reactions + b.comments + b.shares) - (a.reactions + a.comments + a.shares)).slice(0, 4);
      return `<section class="rep-page">${header(d, 'Relatório de Facebook')}
      <div class="rbody fb">
        <div class="rsec"><h2>Facebook <span>${esc(fb.name)}</span></h2>
          <div class="rkpis">
            ${kpi('Visualizações', num(views), delta(views, pviews))}
            ${kpi('Interações com o conteúdo', num(t.page_post_engagements), delta(t.page_post_engagements, p.page_post_engagements))}
            ${kpi('Novos seguidores na página', num(newF), delta(newF, pnewF), '', 'accent')}
            ${kpi('Cliques nas ações da página', num(t.page_total_actions), delta(t.page_total_actions, p.page_total_actions), 'botões, contato e links')}
            ${kpi('Seguidores da página', num(fb.followers))}
            ${kpi('Publicações', nf.format((fb.posts || []).length))}
          </div>
          <div style="margin-top:10px">${dailyChart(fb.daily, 'Visualizações', 200)}</div>
          ${fb.errors?.length && views === undefined ? '<p class="rwarn">Algumas métricas da página não vieram da Meta. Confira se o token tem a permissão read_insights.</p>' : ''}
        </div>
        <div class="rsec"><h2>Publicações com mais engajamento <span>${(fb.posts || []).length} no período</span></h2>
          ${top.length ? `<div class="rposts rlist">${top.map((x) => postCard(x, true)).join('')}</div>` : '<p class="rempty">Nenhuma publicação no período.</p>'}
        </div>
      </div>${footer(d, n, tot)}</section>`;
    });
  }

  // ---------- Tráfego pago ----------
  if (ads) {
    pages.push((n, tot) => {
      if (ads.unavailable) return `<section class="rep-page">${header(d, 'Relatório de Tráfego pago')}<div class="rbody one">${unavailable(ads.unavailable)}</div>${footer(d, n, tot)}</section>`;
      const t = ads.totals || {}; const p = ads.prevTotals || {}; const cur = ads.currency;
      return `<section class="rep-page">${header(d, 'Relatório de Tráfego pago')}
      <div class="rbody ads">
        <div class="rtitle"><h2>Tráfego pago · Meta Ads <span>${esc(ads.name)}</span></h2></div>
        <div class="rkpis k4">
          ${kpi('Valor investido', money(t.spend, cur), delta(t.spend, p?.spend), '', 'accent')}
          ${t.conversations || !t.results || t.result_label === 'Conversas iniciadas'
            ? kpi('Conversas iniciadas', num(t.conversations), delta(t.conversations, p?.conversations))
            : kpi(t.result_label, num(t.results), delta(t.results, p?.results))}
          ${kpi('Custo por resultado', money(t.cost_per_result, cur), delta(t.cost_per_result, p?.cost_per_result, true), t.result_label !== 'Resultados' ? `por ${t.result_label.toLowerCase().replace(/s( |$)/g, '$1').trim()}` : '')}
          ${kpi('Cliques no link', num(t.link_clicks), delta(t.link_clicks, p?.link_clicks), t.ctr ? `CTR ${dec(t.ctr)}%` : '')}
          ${kpi('Alcance', num(t.reach), delta(t.reach, p?.reach))}
          ${kpi('Impressões', num(t.impressions), delta(t.impressions, p?.impressions))}
          ${kpi('Frequência', dec(t.frequency), '', 'vezes que cada pessoa viu, em média')}
          ${kpi('Cliques (todos)', num(t.clicks), delta(t.clicks, p?.clicks))}
        </div>
        <div class="rsec"><h2>Investimento por dia</h2>${dailyChart(ads.daily, 'Investimento', 190, (v) => money(v, cur), (v) => money(v, cur).replace(/,00$/, ''))}</div>
        <div class="rsec"><h2>Campanhas <span>por valor investido</span></h2>
          ${ads.campaigns?.length ? `<table class="rtable"><thead><tr><th>Campanha</th><th>Investido</th><th>Resultados</th><th>Custo/result.</th></tr></thead><tbody>
            ${ads.campaigns.slice(0, 6).map((c) => `<tr><td>${esc(c.name)}</td><td>${money(c.spend, cur)}</td><td>${num(c.results)} <small>${esc(c.result_label.toLowerCase())}</small></td><td>${money(c.cost_per_result, cur)}</td></tr>`).join('')}
          </tbody></table>` : '<p class="rempty">Nenhuma campanha com investimento no período.</p>'}
        </div>
      </div>${footer(d, n, tot)}</section>`;
    });
  }

  if (!pages.length) return '<p class="rempty">Sem dados para este relatório.</p>';
  return pages.map((f, i) => f(i + 1, pages.length)).join('');
}
