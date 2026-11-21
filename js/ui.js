import { todayBR, addDays } from './api.js';
import { avatarSVG } from './avatars.js';

// ---------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------
export const ROLES = {
  admin: 'Administrador', gestora: 'Gestora de projetos', designer_editor: 'Designer / Editor',
  social_media: 'Social media', trafego: 'Gestor de tráfego', pendente: 'Aguardando cargo'
};
export const PRIOS = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
export const PRIO_ORDER = { urgente: 0, alta: 1, media: 2, baixa: 3 };
export const STATUS = {
  pendente: 'A marcar', finalizada: 'Finalizada', incompleta: 'Incompleta',
  nao_realizada: 'Não realizada', em_alteracao: 'Em alteração'
};
export const STAGES = [
  ['a_fazer', 'A fazer'], ['em_alteracao', 'Em alteração'], ['revisao_interna', 'Revisão interna'],
  ['revisao_cliente', 'Revisão do cliente'], ['agendamento', 'Agendamento'], ['concluido', 'Concluído']
];
export const STAGE = Object.fromEntries(STAGES);
export const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// cores dos status (as mesmas no gráfico, na barra e na legenda)
export const SWATCH = {
  finalizada: '#e5e5e5', incompleta: '#cc0000', nao_realizada: 'var(--tex)',
  em_alteracao: 'var(--tex-w)', pendente: '#4a4a4a'
};

const p = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">${d}</svg>`;
export const I = {
  home: p('<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-6h4v6"/>'),
  chart: p('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>',
  team: p('<rect x="3" y="4" width="7" height="7"/><rect x="14" y="4" width="7" height="7"/><path d="M2 20c0-3 2-5 4.5-5S11 17 11 20M13 20c0-3 2-5 4.5-5S22 17 22 20"/>'),
  trophy: p('<path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4M12 15v4M8 20h8"/>'),
  user: p('<rect x="8" y="3" width="8" height="8"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>'),
  flow: p('<rect x="3" y="4" width="5" height="16"/><rect x="10" y="4" width="5" height="10"/><rect x="17" y="4" width="4" height="6"/>'),
  chat: p('<path d="M3 4h18v13H8l-5 4z"/><path d="M7 9h10M7 13h6"/>'),
  bolt: p('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  more: p('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  arrow: p('<path d="M4 12h15M13 6l6 6-6 6"/>'),
  back: p('<path d="M20 12H5M11 6l-6 6 6 6"/>'),
  out: p('<path d="M14 4H4v16h10M10 12h11M17 8l4 4-4 4"/>'),
  info: p('<rect x="3" y="3" width="18" height="18"/><path d="M12 11v6M12 7v1"/>'),
  search: p('<rect x="4" y="4" width="12" height="12"/><path d="M16 16l5 5"/>'),
  link: p('<path d="M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1.6-1.6"/>'),
  clip: p('<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/>'),
  file: p('<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/>'),
  image: p('<rect x="3" y="4" width="18" height="16"/><path d="M3 16l5-5 4 4 3-3 6 6"/><rect x="15" y="7" width="3" height="3"/>'),
  camera: p('<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><rect x="8.5" y="9.5" width="7" height="7"/>'),
  send: p('<path d="M3 11 21 3l-6 18-3-8z"/><path d="M12 13 21 3"/>'),
  building: p('<rect x="4" y="3" width="16" height="18"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M10 21v-4h4v4"/>'),
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l5 4 4-7 4 7 5-4-2 12H5z"/></svg>',
  clock: p('<rect x="3" y="3" width="18" height="18"/><path d="M12 7v5l3 2"/>')
};

// ---------------------------------------------------------------------
// Estado compartilhado
// ---------------------------------------------------------------------
export const state = {
  me: null, people: [], clients: [], tab: 'hoje',
  date: todayBR(), painelDate: todayBR(), today: todayBR(),
  fluxoStage: 'revisao_interna', fluxoQuery: '', fluxoClient: '',
  render: () => {}
};
export const isManager = (u = state.me) => !!u && ['admin', 'gestora'].includes(u.role);
export const isReviewer = (u = state.me) => !!u && ['admin', 'gestora', 'social_media'].includes(u.role);
export const person = (id) => state.people.find((x) => x.id === id) || { name: '—', avatar: 'capivara', role: 'pendente' };
export const clientName = (id) => state.clients.find((c) => c.id === id)?.name || '';

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const firstName = (n = '') => n.trim().split(/\s+/)[0] || '';
export const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
export const dObj = (iso) => new Date(iso + 'T12:00:00Z');
export const fmtShort = (iso) => { const d = dObj(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const fmtDay = (iso) => {
  const t = todayBR();
  if (iso === t) return 'Hoje';
  if (iso === addDays(t, -1)) return 'Ontem';
  if (iso === addDays(t, 1)) return 'Amanhã';
  return `${WD[dObj(iso).getUTCDay()]}, ${fmtShort(iso)}`;
};
export const weekStart = (iso) => addDays(iso, -((dObj(iso).getUTCDay() + 6) % 7));
export const localDate = (ts) => ts ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts)) : null;
export const hhmm = (ts) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(ts));
export const ago = (ts) => {
  const m = Math.round((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
};
export const isLate = (t) => (t.status === 'finalizada' ? localDate(t.completed_at) > t.due_date : t.due_date < todayBR());
export const sortTasks = (a, b) => {
  const done = (x) => (x.status === 'finalizada' ? 1 : 0);
  return done(a) - done(b) || PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || a.due_date.localeCompare(b.due_date);
};
export const summary = (list) => {
  const c = { total: list.length, finalizada: 0, incompleta: 0, nao_realizada: 0, em_alteracao: 0, pendente: 0, late: 0 };
  list.forEach((t) => { c[t.status]++; if (isLate(t)) c.late++; });
  return c;
};
export const saudacao = () => {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

// foto de perfil (se houver) ou o bichinho escolhido
export const face = (u, size = 40) => u?.photo_url
  ? `<img class="avatar" src="${esc(u.photo_url)}" width="${size}" height="${size}" alt="${esc(u.name || '')}" loading="lazy">`
  : avatarSVG(u?.avatar, size);

export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800);
}

export const hideTip = () => document.getElementById('tip')?.classList.remove('show');
window.addEventListener('scroll', hideTip, { passive: true });

export function openSheet(html, bind) {
  hideTip();
  const root = $('#sheet-root');
  root.innerHTML = `<div class="overlay" data-close></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.style.overflow = 'hidden';
  const close = () => { root.innerHTML = ''; document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-close]').forEach((el) => (el.onclick = close));
  bind && bind(root, close);
}

// dica flutuante dos gráficos
export function tip(el, html) {
  let t = $('#tip');
  if (!t) { t = document.createElement('div'); t.id = 'tip'; t.className = 'tip'; document.body.appendChild(t); }
  const show = (x, y) => {
    t.innerHTML = html(); t.classList.add('show');
    const r = t.getBoundingClientRect();
    t.style.left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + 'px';
    t.style.top = Math.max(8, y - r.height - 14) + 'px';
  };
  el.addEventListener('pointerenter', (e) => show(e.clientX, e.clientY));
  el.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
  el.addEventListener('pointerleave', () => t.classList.remove('show'));
}

// números que sobem ao aparecer
export function countUp(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count); const dur = 700; const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// efeito de "onda" no toque em qualquer botão principal
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn, .nav .plus, .day, .chips button, .seg button, .status-opts button');
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'ripple'; s.style.left = e.clientX - r.left + 'px'; s.style.top = e.clientY - r.top + 'px';
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  b.style.overflow = 'hidden';
  b.appendChild(s); setTimeout(() => s.remove(), 650);
});

export async function busy(btn, fn) {
  btn.disabled = true; btn.classList.add('loading');
  try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('loading'); }
}

export const emptyBox = (msg) => `<div class="empty"><img src="assets/img/seta.svg" alt=""><p>${msg}</p></div>`;
