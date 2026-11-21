import { STATUS, tip, esc } from './ui.js';

const ORDER = ['finalizada', 'incompleta', 'nao_realizada', 'em_alteracao', 'pendente'];
const SVG_FILL = {
  finalizada: '#e5e5e5', incompleta: '#cc0000', nao_realizada: 'url(#tx-red)', em_alteracao: 'url(#tx-white)', pendente: '#4a4a4a'
};
const LEG_FILL = {
  finalizada: '#e5e5e5', incompleta: '#cc0000', nao_realizada: 'var(--tex)', em_alteracao: 'var(--tex-w)', pendente: '#4a4a4a'
};
const PATTERNS = `<defs>
  <pattern id="tx-red" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#2a0000"/><rect width="2" height="5" fill="#cc0000"/></pattern>
  <pattern id="tx-white" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><rect width="5" height="5" fill="#2a2a2a"/><rect width="2" height="5" fill="#e5e5e5"/></pattern>
</defs>`;

// Rosca: distribuição dos status do dia. Legenda sempre visível + dica ao passar.
export function donut(c, centerLabel = 'finalizadas') {
  const total = c.total || 0;
  const r = 52, C = 2 * Math.PI * r, gap = total > 1 ? 2.5 : 0;
  let acc = 0;
  const arcs = ORDER.filter((k) => c[k] > 0).map((k) => {
    const len = (c[k] / total) * C;
    const a = `<circle class="seg-arc" data-k="${k}" cx="70" cy="70" r="${r}" fill="none" stroke="${SVG_FILL[k]}" stroke-width="14"
      stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-acc}"
      style="animation: rise .6s both"/>`;
    acc += len;
    return a;
  }).join('');
  const pct = total ? Math.round((c.finalizada / total) * 100) : 0;
  const html = `<div class="donut-wrap">
    <div class="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Status das demandas">${PATTERNS}
        <circle cx="70" cy="70" r="${r}" fill="none" stroke="#262626" stroke-width="14"/>${arcs}</svg>
      <div class="center"><b><span data-count="${pct}">0</span>%</b><small>${centerLabel}</small></div>
    </div>
    <div class="dlegend">${ORDER.map((k) => `<div><i style="background:${LEG_FILL[k]}"></i>${STATUS[k]}<b>${c[k]}</b></div>`).join('')}</div>
  </div>`;
  return {
    html,
    bind(root) {
      root.querySelectorAll('.seg-arc').forEach((el) => {
        const k = el.dataset.k;
        tip(el, () => `<b>${STATUS[k]}</b><br>${c[k]} de ${total} (${Math.round((c[k] / total) * 100)}%)`);
      });
    }
  };
}

// Barras da semana: finalizadas (sólido) sobre o restante (cinza), por dia.
export function weekBars(days) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const html = `<div class="bars" role="img" aria-label="Demandas finalizadas por dia">${days.map((d, i) => `
    <div class="col ${d.cur ? 'cur' : ''}" data-i="${i}">
      <span class="v-r" style="height:${((d.total - d.done) / max) * 100}%"></span>
      <span class="v-f" style="height:${(d.done / max) * 100}%"></span>
      <em>${esc(d.label)}</em>
    </div>`).join('')}</div>
    <div class="legend" style="margin-top:12px;color:var(--muted)"><span><i style="background:var(--white)"></i>Finalizadas</span><span><i style="background:var(--s3)"></i>Demais</span><span><i style="background:var(--red)"></i>Dia selecionado</span></div>`;
  return {
    html,
    bind(root) {
      root.querySelectorAll('.bars .col').forEach((el) => {
        const d = days[Number(el.dataset.i)];
        tip(el, () => `<b>${esc(d.full)}</b><br>${d.done} finalizada${d.done === 1 ? '' : 's'} de ${d.total}`);
      });
    }
  };
}
