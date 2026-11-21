import { api, todayBR, addDays } from './api.js';
import { AVATARS, avatarSVG, avatarName } from './avatars.js';
import { ONBOARDING_EVERY_MIN } from './config.js';

// ---------------------------------------------------------------------
// Constantes e utilidades
// ---------------------------------------------------------------------
const ROLES = {
  admin: 'Administrador', gestora: 'Gestora de projetos', designer: 'Designer',
  editor: 'Editor', social_media: 'Social media', trafego: 'Gestor de tráfego', pendente: 'Aguardando cargo'
};
const PRIOS = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
const PRIO_ORDER = { urgente: 0, alta: 1, media: 2, baixa: 3 };
const STATUS = {
  pendente: 'Pendente', finalizada: 'Finalizada', parcial: 'Parcialmente', nao_realizada: 'Não realizada'
};
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-6h4v6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><rect x="3" y="4" width="7" height="7"/><rect x="14" y="4" width="7" height="7"/><path d="M2 20c0-3 2-5 4.5-5S11 17 11 20M13 20c0-3 2-5 4.5-5S22 17 22 20"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4M12 15v4M8 20h8"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><rect x="8" y="3" width="8" height="8"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M20 12H5M11 6l-6 6 6 6"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M14 4H4v16h10M10 12h11M17 8l4 4-4 4"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><rect x="3" y="3" width="18" height="18"/><path d="M12 11v6M12 7v1"/></svg>'
};

const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isManager = (p = state.me) => p && ['admin', 'gestora'].includes(p.role);
const firstName = (n = '') => n.trim().split(/\s+/)[0] || '';
const dObj = (iso) => new Date(iso + 'T12:00:00Z');
const fmtShort = (iso) => { const d = dObj(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const fmtDay = (iso) => {
  const t = todayBR();
  if (iso === t) return 'Hoje';
  if (iso === addDays(t, -1)) return 'Ontem';
  if (iso === addDays(t, 1)) return 'Amanhã';
  return `${WD[dObj(iso).getUTCDay()]}, ${fmtShort(iso)}`;
};
const weekStart = (iso) => { const wd = (dObj(iso).getUTCDay() + 6) % 7; return addDays(iso, -wd); };
const localDate = (ts) => ts ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts)) : null;
const isLate = (t) => {
  if (t.status === 'finalizada') return localDate(t.completed_at) > t.due_date;
  return t.due_date < todayBR();
};
const sortTasks = (a, b) => {
  const done = (x) => (x.status === 'finalizada' ? 1 : 0);
  return done(a) - done(b) || PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || a.due_date.localeCompare(b.due_date);
};
const summary = (list) => {
  const c = { total: list.length, finalizada: 0, parcial: 0, nao_realizada: 0, pendente: 0, late: 0 };
  list.forEach((t) => { c[t.status]++; if (isLate(t)) c.late++; });
  return c;
};

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------
const state = { me: null, people: [], tab: 'hoje', date: todayBR(), painelDate: todayBR(), today: todayBR() };
const person = (id) => state.people.find((p) => p.id === id) || { name: '—', avatar: 'capivara', role: 'pendente' };

// ---------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------
async function start() {
  api.onAuth(async (s) => { if (!s) { state.me = null; renderLogin(); } });
  const s = await api.session();
  if (s) await enter(); else renderLogin();
  maybeOnboarding();
  setInterval(maybeOnboarding, 30_000);
  setInterval(async () => {
    if (state.me && todayBR() !== state.today) {
      state.today = todayBR(); state.date = state.today; state.painelDate = state.today;
      await api.rollover().catch(() => {}); render();
    }
  }, 60_000);
}

async function enter() {
  try {
    state.me = await api.me();
  } catch (e) { renderLogin(e.message); return; }
  if (state.me.role === 'pendente' || state.me.active === false) { renderWaiting(); return; }
  await api.rollover().catch(() => {});
  state.me = await api.me();
  state.people = await api.profiles();
  render();
}

// ---------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------
function renderLogin(err = '') {
  $('#app').innerHTML = `
    <div class="login">
      <img class="logo" src="assets/img/logo.svg" alt="Elevate">
      <div class="headline">
        <h1>Seu dia,<br><span class="red">organizado.</span></h1>
        <p>Entre para registrar as demandas de hoje e acompanhar o time.</p>
      </div>
      <form id="login-form" novalidate>
        <div class="field"><label for="email">E-mail</label><input class="input" id="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="pass">Senha</label><input class="input" id="pass" type="password" autocomplete="current-password" required></div>
        <div class="err" id="login-err">${esc(err)}</div>
        <button class="btn btn-red" type="submit">Entrar ${I.arrow}</button>
        ${api.demo ? '<p class="muted" style="font-size:12px;margin-top:12px;text-align:center">Modo demonstração: entre com qualquer senha (admin@elevate.com, lucas@elevate.com…)</p>' : ''}
      </form>
    </div>`;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.target.querySelector('button'); b.disabled = true;
    try {
      await api.signIn($('#email').value.trim(), $('#pass').value);
      await enter();
    } catch (er) { $('#login-err').textContent = er.message; b.disabled = false; }
  };
}

function renderWaiting() {
  $('#app').innerHTML = `
    <div class="login">
      <img class="logo" src="assets/img/logo.svg" alt="Elevate">
      <div class="headline">
        <h1>Quase lá<span class="red">.</span></h1>
        <p>Sua conta ainda não tem um cargo definido. Peça ao administrador ou à gestora de projetos para liberar seu acesso.</p>
      </div>
      <button class="btn btn-ghost" id="out">${I.out} Sair</button>
    </div>`;
  $('#out').onclick = () => api.signOut();
}

// ---------------------------------------------------------------------
// Estrutura com navegação
// ---------------------------------------------------------------------
async function render() {
  const tabs = [
    ['hoje', 'Hoje', I.home], ['painel', 'Painel', I.chart], ['nova', '', I.plus],
    isManager() ? ['equipe', 'Equipe', I.team] : ['ranking', 'Ranking', I.trophy],
    ['perfil', 'Perfil', I.user]
  ];
  $('#app').innerHTML = `
    <main id="view"></main>
    <nav class="nav">${tabs.map(([k, l, ic]) => k === 'nova'
      ? `<button class="plus" data-tab="nova" aria-label="Nova tarefa">${ic}</button>`
      : `<button data-tab="${k}" class="${state.tab === k ? 'on' : ''}">${ic}<span>${l}</span></button>`).join('')}
    </nav>`;
  $('.nav').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab === 'nova') return newTaskSheet();
    state.tab = b.dataset.tab; window.scrollTo(0, 0); render();
  };
  const views = { hoje: viewHoje, painel: viewPainel, equipe: viewEquipe, ranking: viewRanking, perfil: viewPerfil };
  await views[state.tab]();
}

const topBar = () => `
  <header class="top">
    <span class="av-frame">${avatarSVG(state.me.avatar, 44)}</span>
    <div class="hello"><small>${saudacao()},</small><h1>${esc(firstName(state.me.name))}</h1></div>
    <span class="star-pill" title="Estrelas acumuladas">${I.star}${state.me.stars}</span>
  </header>`;
function saudacao() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function weekStrip(selected, weekTasks, id) {
  const ws = weekStart(selected);
  return `<div class="week" id="${id}">${[...Array(7)].map((_, i) => {
    const d = addDays(ws, i);
    const list = weekTasks.filter((t) => t.task_date === d);
    const cls = ['day', d === selected && 'sel', d === todayBR() && 'today',
      list.length && 'has', list.length && list.every((t) => t.status === 'finalizada') && 'done'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-d="${d}"><span>${WD[dObj(d).getUTCDay()]}</span><b>${dObj(d).getUTCDate()}</b><i></i></button>`;
  }).join('')}</div>`;
}

function taskCard(t, showWho = false) {
  const p = person(t.assigned_to);
  const late = isLate(t);
  return `<button class="task st-${t.status}" data-id="${t.id}">
    <span class="chk">${t.status === 'finalizada' ? I.check : t.status === 'nao_realizada' ? I.x : ''}</span>
    <span class="body">
      <h3>${esc(t.title)}</h3>
      <span class="meta">
        <span class="tag p-${t.priority}">${PRIOS[t.priority]}</span>
        <span class="tag ${late ? 'late' : ''}">${late ? 'Atrasada · ' : 'Prazo '}${fmtShort(t.due_date)}</span>
        ${t.status !== 'pendente' && t.status !== 'finalizada' ? `<span class="tag ${t.status === 'parcial' ? 'p-alta' : 'late'}">${STATUS[t.status]}</span>` : ''}
        ${t.carried_from ? '<span class="tag carry">Do dia anterior</span>' : ''}
      </span>
      ${t.justification && t.status !== 'finalizada' ? `<p class="just">${esc(t.justification)}</p>` : ''}
    </span>
    ${showWho ? `<span class="who">${avatarSVG(p.avatar, 28)}</span>` : ''}
  </button>`;
}

const emptyBox = (msg) => `<div class="empty"><img src="assets/img/seta.svg" alt=""><p>${msg}</p></div>`;

// ---------------------------------------------------------------------
// HOJE
// ---------------------------------------------------------------------
async function viewHoje() {
  const ws = weekStart(state.date);
  const week = await api.tasks({ from: ws, to: addDays(ws, 6), userId: state.me.id });
  const list = week.filter((t) => t.task_date === state.date).sort(sortTasks);
  const c = summary(list);
  const pct = (n) => (c.total ? (n / c.total) * 100 : 0);
  $('#view').innerHTML = `${topBar()}
    <div class="page">
      ${weekStrip(state.date, week, 'wk')}
      <section class="hero">
        <div class="label"><b>${fmtDay(state.date)}</b><span>· suas demandas</span></div>
        <div class="big">${c.finalizada}<small>/${c.total} finalizadas</small></div>
        <div class="bar"><span class="f" style="width:${pct(c.finalizada)}%"></span><span class="p" style="width:${pct(c.parcial)}%"></span><span class="n" style="width:${pct(c.nao_realizada)}%"></span></div>
        <div class="legend">
          <span><i style="background:#181818"></i>Finalizadas ${c.finalizada}</span>
          <span><i style="background:#cc0000"></i>Parciais ${c.parcial}</span>
          <span><i style="background:repeating-linear-gradient(45deg,#cc0000 0 2px,transparent 2px 4px)"></i>Não realizadas ${c.nao_realizada}</span>
        </div>
        <img class="seta" src="assets/img/seta.svg" alt="">
      </section>
      <div class="section-title"><h2>Demandas</h2><span>${c.pendente ? `${c.pendente} para marcar` : c.total ? 'Tudo marcado' : ''}</span></div>
      <div class="list" id="list">${list.length ? list.map((t) => taskCard(t)).join('') : emptyBox(state.date === todayBR() ? 'Nenhuma demanda para hoje.<br>Toque no <b class="red">+</b> para criar.' : 'Nenhuma demanda neste dia.')}</div>
    </div>`;
  $('#wk').onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) { state.date = b.dataset.d; viewHoje(); } };
  $('#list').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) taskSheet(list.find((t) => t.id === b.dataset.id)); };
}

// ---------------------------------------------------------------------
// PAINEL
// ---------------------------------------------------------------------
async function viewPainel() {
  const d = state.painelDate;
  const ws = weekStart(d);
  const week = await api.tasks({ from: ws, to: addDays(ws, 6), userId: isManager() ? undefined : state.me.id });
  const day = week.filter((t) => t.task_date === d);
  const c = summary(day);
  const done = c.total ? Math.round((c.finalizada / c.total) * 100) : 0;
  const kpi = (label, n, color) => `<div class="kpi"><small><i style="background:${color}"></i>${label}</small><b>${n}</b></div>`;

  let peopleHtml = '';
  if (isManager()) {
    const rows = state.people.map((p) => {
      const pl = day.filter((t) => t.assigned_to === p.id);
      return { p, pl, s: summary(pl) };
    }).sort((a, b) => b.s.total - a.s.total || a.p.name.localeCompare(b.p.name));
    peopleHtml = `<div class="section-title"><h2>Equipe</h2><span>${fmtDay(d)}</span></div>
      <div class="list" id="ppl">${rows.map(({ p, s }) => `
        <button class="person" data-p="${p.id}">
          ${avatarSVG(p.avatar, 44)}
          <span class="info">
            <b><span>${esc(p.name)}</span><span class="stars">${I.star}${p.stars}</span></b>
            <small>${ROLES[p.role]} · ${s.total ? `${s.finalizada}/${s.total} finalizadas` : 'sem demandas'}${s.late ? ` · <span class="red">${s.late} atrasada${s.late > 1 ? 's' : ''}</span>` : ''}</small>
            <div class="bar"><span class="f" style="width:${s.total ? (s.finalizada / s.total) * 100 : 0}%"></span><span class="p" style="width:${s.total ? (s.parcial / s.total) * 100 : 0}%"></span></div>
          </span>
        </button>`).join('')}</div>`;
  }

  $('#view').innerHTML = `
    <header class="top"><div class="hello"><small>${isManager() ? 'Acompanhamento diário' : 'Seu desempenho'}</small><h1>Painel</h1></div>
      <span class="star-pill">${I.star}${state.me.stars}</span></header>
    <div class="page">
      ${weekStrip(d, week, 'pwk')}
      <section class="hero">
        <div class="label"><b>${fmtDay(d)}</b><span>· ${isManager() ? 'time todo' : 'você'}</span></div>
        <div class="big">${done}<small>% concluído</small></div>
        <div class="bar"><span class="f" style="width:${done}%"></span></div>
        <div class="legend"><span>${c.total} demandas no dia</span><span class="${c.late ? 'red' : ''}">${c.late} atrasada${c.late === 1 ? '' : 's'}</span></div>
        <img class="seta" src="assets/img/seta.svg" alt="">
      </section>
      <div class="section-title"><h2>Status</h2></div>
      <div class="kpis">
        ${kpi('Finalizadas', c.finalizada, '#e5e5e5')}${kpi('Parciais', c.parcial, '#cc0000')}
        ${kpi('Não realizadas', c.nao_realizada, 'repeating-linear-gradient(45deg,#cc0000 0 2px,transparent 2px 4px)')}${kpi('A marcar', c.pendente, '#6a6a6a')}
      </div>
      ${peopleHtml}
      ${!isManager() ? `<div class="section-title"><h2>Semana</h2><span>${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}</span></div>
        <div class="kpis">${kpi('Finalizadas na semana', summary(week).finalizada, '#e5e5e5')}${kpi('Atrasadas na semana', summary(week).late, '#cc0000')}</div>` : ''}
    </div>`;
  $('#pwk').onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) { state.painelDate = b.dataset.d; viewPainel(); } };
  const ppl = $('#ppl');
  if (ppl) ppl.onclick = (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    personDaySheet(person(b.dataset.p), day.filter((t) => t.assigned_to === b.dataset.p));
  };
}

function personDaySheet(p, list) {
  openSheet(`
    <div class="sheet-head"><div style="display:flex;gap:12px;align-items:center">${avatarSVG(p.avatar, 44)}<div><h2>${esc(p.name)}</h2><small class="muted">${ROLES[p.role]} · ${fmtDay(state.painelDate)}</small></div></div>
      <button class="icon-btn" data-close>${I.x}</button></div>
    <div class="list" id="pd">${list.length ? list.sort(sortTasks).map((t) => taskCard(t)).join('') : emptyBox('Sem demandas neste dia.')}</div>
    <div class="actions"><button class="btn btn-red" id="pd-new">${I.plus} Nova tarefa para ${esc(firstName(p.name))}</button></div>`,
  (root, close) => {
    $('#pd', root).onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) { close(); taskSheet(list.find((t) => t.id === b.dataset.id)); } };
    $('#pd-new', root).onclick = () => { close(); newTaskSheet({ assigned_to: p.id, task_date: state.painelDate }); };
  });
}

// ---------------------------------------------------------------------
// RANKING (funcionários) e EQUIPE (gestão)
// ---------------------------------------------------------------------
const rankingList = (ppl) => `<div class="list">${[...ppl].sort((a, b) => b.stars - a.stars).map((p, i) => `
  <div class="person">
    <span class="rank ${i < 3 ? 'top' : ''}">${i + 1}</span>
    ${avatarSVG(p.avatar, 44)}
    <span class="info"><b><span>${esc(p.name)}${p.id === state.me.id ? ' <small class="muted">(você)</small>' : ''}</span><span class="stars">${I.star}${p.stars}</span></b><small>${ROLES[p.role]}</small></span>
  </div>`).join('')}</div>`;

async function viewRanking() {
  state.people = await api.profiles();
  $('#view').innerHTML = `
    <header class="top"><div class="hello"><small>Dias perfeitos viram estrelas</small><h1>Ranking</h1></div></header>
    <div class="page">
      <section class="hero"><div class="label"><b>Como ganhar</b></div>
        <p style="margin-top:8px;line-height:1.5">Entregue <b>todas</b> as demandas do dia, dentro do prazo, e ganhe <b class="red">1 estrela</b>. As estrelas acumulam.</p>
        <img class="seta" src="assets/img/seta.svg" alt=""></section>
      <div class="section-title"><h2>Time</h2></div>
      ${rankingList(state.people)}
    </div>`;
}

async function viewEquipe() {
  const all = await api.allProfiles();
  state.people = all.filter((p) => p.role !== 'pendente' && p.active !== false);
  const pend = all.filter((p) => p.role === 'pendente');
  $('#view').innerHTML = `
    <header class="top"><div class="hello"><small>${state.people.length} pessoas ativas</small><h1>Equipe</h1></div>
      <button class="icon-btn" id="add" aria-label="Adicionar pessoa">${I.plus}</button></header>
    <div class="page">
      <div class="tabs" id="eq-tabs"><button data-t="pessoas" class="on">Pessoas</button><button data-t="ranking">Ranking</button></div>
      <div id="eq-body"></div>
    </div>`;
  const pessoas = () => `
    ${pend.length ? `<div class="section-title"><h2>Aguardando cargo</h2><span>${pend.length}</span></div>
      <div class="list">${pend.map((p) => memberRow(p)).join('')}</div>` : ''}
    <div class="section-title"><h2>Pessoas</h2></div>
    <div class="list">${all.filter((p) => p.role !== 'pendente').map((p) => memberRow(p)).join('')}</div>
    <div class="actions" style="margin-top:16px"><button class="btn btn-red" id="add2">${I.plus} Adicionar pessoa</button></div>`;
  const body = $('#eq-body');
  const show = (t) => {
    body.innerHTML = t === 'ranking' ? `<div style="height:14px"></div>${rankingList(state.people)}` : pessoas();
    $('#eq-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    const a2 = $('#add2'); if (a2) a2.onclick = memberSheet;
  };
  show('pessoas');
  $('#eq-tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.t); };
  $('#add').onclick = () => memberSheet();
  body.onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) memberSheet(all.find((p) => p.id === b.dataset.m)); };
}
const memberRow = (p) => `
  <button class="person" data-m="${p.id}" style="${p.active === false ? 'opacity:.45' : ''}">
    ${avatarSVG(p.avatar, 44)}
    <span class="info"><b><span>${esc(p.name || p.email)}</span><span class="stars">${I.star}${p.stars}</span></b>
    <small>${ROLES[p.role]}${p.active === false ? ' · desativado' : ''}${p.email ? ` · ${esc(p.email)}` : ''}</small></span>
  </button>`;

function memberSheet(p) {
  const editing = !!(p && p.id);
  const roleOpts = Object.entries(ROLES).filter(([k]) => k !== 'pendente')
    .map(([k, v]) => `<option value="${k}" ${p && p.role === k ? 'selected' : ''}>${v}</option>`).join('');
  openSheet(`
    <div class="sheet-head"><h2>${editing ? 'Editar pessoa' : 'Nova pessoa'}</h2><button class="icon-btn" data-close>${I.x}</button></div>
    <form id="mf">
      <div class="field"><label>Nome</label><input class="input" name="name" required value="${esc(p?.name || '')}"></div>
      ${editing ? `<p class="muted" style="margin:-4px 0 14px;font-size:13px">${esc(p.email || '')}</p>` : `
      <div class="field"><label>E-mail de acesso</label><input class="input" name="email" type="email" required autocomplete="off"></div>
      <div class="field"><label>Senha inicial</label><input class="input" name="password" type="text" minlength="6" required autocomplete="off" placeholder="mínimo 6 caracteres"></div>`}
      <div class="field"><label>Cargo</label><select class="input" name="role" required>${p?.role === 'pendente' || !p ? '<option value="" disabled selected>Escolha…</option>' : ''}${roleOpts}</select></div>
      <div class="err" id="mf-err"></div>
      <div class="actions">
        <button class="btn btn-red" type="submit">${editing ? 'Salvar' : 'Cadastrar'}</button>
        ${editing && p.id !== state.me.id ? `<button class="btn btn-ghost" type="button" id="mf-toggle">${p.active === false ? 'Reativar acesso' : 'Desativar acesso'}</button>` : ''}
      </div>
    </form>`,
  (root, close) => {
    $('#mf', root).onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const b = e.target.querySelector('[type=submit]'); b.disabled = true;
      try {
        if (editing) await api.setMember(p.id, f.name.trim(), f.role);
        else await api.createMember({ name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role });
        close(); toast(editing ? 'Pessoa atualizada.' : `${firstName(f.name)} cadastrado(a).`); render();
      } catch (er) { $('#mf-err', root).textContent = er.message; b.disabled = false; }
    };
    const tg = $('#mf-toggle', root);
    if (tg) tg.onclick = async () => {
      try { await api.updateProfile(p.id, { active: p.active === false }); close(); toast('Acesso atualizado.'); render(); }
      catch (er) { $('#mf-err', root).textContent = er.message; }
    };
  });
}

// ---------------------------------------------------------------------
// PERFIL
// ---------------------------------------------------------------------
async function viewPerfil() {
  const since = addDays(todayBR(), -29);
  const month = await api.tasks({ from: since, to: todayBR(), userId: state.me.id });
  const s = summary(month);
  $('#view').innerHTML = `
    <div class="page">
      <div class="profile-head">
        <span class="av-frame">${avatarSVG(state.me.avatar, 96)}</span>
        <h1>${esc(state.me.name)}</h1><small>${ROLES[state.me.role]}</small>
      </div>
      <div class="stats3">
        <div><b>${I.star}${state.me.stars}</b><small>Estrelas</small></div>
        <div><b>${s.finalizada}</b><small>Entregues 30d</small></div>
        <div><b class="${s.late ? 'red' : ''}">${s.late}</b><small>Atrasos 30d</small></div>
      </div>
      <div class="section-title"><h2>Seu avatar</h2><span>${avatarName(state.me.avatar)}</span></div>
      <div class="av-grid" id="avg">${AVATARS.map((k) => `<button data-a="${k}" class="${k === state.me.avatar ? 'on' : ''}">${avatarSVG(k, 64)}${avatarName(k)}</button>`).join('')}</div>
      <div class="section-title"><h2>Seu nome</h2></div>
      <form id="nf" style="display:grid;grid-template-columns:1fr auto;gap:8px">
        <input class="input" name="name" value="${esc(state.me.name)}" required>
        <button class="btn btn-white" style="width:auto">Salvar</button>
      </form>
      <div class="actions" style="display:grid;gap:8px;margin-top:26px">
        <button class="btn btn-ghost" id="how">${I.info} Ver como funciona</button>
        <button class="btn btn-ghost" id="out">${I.out} Sair</button>
      </div>
    </div>`;
  $('#avg').onclick = async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    state.me = await api.updateProfile(state.me.id, { avatar: b.dataset.a });
    const me = state.people.find((p) => p.id === state.me.id); if (me) me.avatar = state.me.avatar;
    toast(`Agora você é ${avatarName(state.me.avatar).toLowerCase()}!`); viewPerfil();
  };
  $('#nf').onsubmit = async (e) => {
    e.preventDefault();
    state.me = await api.updateProfile(state.me.id, { name: e.target.name.value.trim() });
    toast('Nome atualizado.'); viewPerfil();
  };
  $('#how').onclick = () => showOnboarding();
  $('#out').onclick = () => api.signOut();
}

// ---------------------------------------------------------------------
// Sheets de tarefa
// ---------------------------------------------------------------------
function openSheet(html, bind) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="overlay" data-close></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.style.overflow = 'hidden';
  const close = () => { root.innerHTML = ''; document.body.style.overflow = ''; };
  root.querySelectorAll('[data-close]').forEach((el) => (el.onclick = close));
  bind && bind(root, close);
}

function taskSheet(t) {
  const canEdit = isManager();
  const canDelete = isManager() || t.created_by === state.me.id;
  const mine = t.assigned_to === state.me.id || isManager();
  let status = t.status === 'pendente' ? null : t.status;
  const opts = [
    ['finalizada', 'Finalizada', 'Entreguei tudo.'],
    ['parcial', 'Parcialmente finalizada', 'Volta amanhã para terminar.'],
    ['nao_realizada', 'Não realizada', 'Volta amanhã na sua lista.']
  ];
  const p = person(t.assigned_to);
  openSheet(`
    <div class="sheet-head"><h2>${esc(t.title)}</h2><button class="icon-btn" data-close>${I.x}</button></div>
    <div class="meta" style="display:flex;flex-wrap:wrap;gap:6px;margin:-6px 0 14px">
      <span class="tag p-${t.priority}">${PRIOS[t.priority]}</span>
      <span class="tag">Dia ${fmtShort(t.task_date)}</span>
      <span class="tag ${isLate(t) ? 'late' : ''}">Prazo ${fmtShort(t.due_date)}</span>
      ${t.carried_from ? '<span class="tag carry">Do dia anterior</span>' : ''}
    </div>
    ${t.description ? `<p style="line-height:1.5;margin-bottom:16px;color:#cfcfcf">${esc(t.description)}</p>` : ''}
    ${t.assigned_to !== state.me.id ? `<div class="person" style="margin-bottom:16px">${avatarSVG(p.avatar, 36)}<span class="info"><b>${esc(p.name)}</b><small>${ROLES[p.role]}</small></span></div>` : ''}
    ${mine ? `
    <div class="field"><label>Como ficou essa demanda?</label>
      <div class="status-opts" id="so">${opts.map(([k, l, h]) => `<button type="button" data-v="${k}" class="${status === k ? 'on' : ''}"><span class="chk"></span><span><b>${l}</b><small>${h}</small></span></button>`).join('')}</div>
    </div>
    <div class="field ${status && status !== 'finalizada' ? '' : 'hidden'}" id="jf">
      <label for="just">Por que não foi finalizada? <span class="red">*</span></label>
      <textarea class="input" id="just" placeholder="Ex.: aguardando aprovação do cliente">${esc(t.justification)}</textarea>
    </div>
    <div class="err" id="ts-err"></div>
    <div class="actions"><button class="btn btn-red" id="save">Salvar status</button></div>` : ''}
    <div class="actions">
      ${canEdit ? `<button class="btn btn-ghost" id="edit">Editar tarefa</button>` : ''}
      ${canDelete ? `<button class="btn btn-ghost" id="del" style="color:var(--red)">Excluir tarefa</button>` : ''}
    </div>`,
  (root, close) => {
    const so = $('#so', root);
    if (so) {
      so.onclick = (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        status = b.dataset.v;
        so.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        $('#jf', root).classList.toggle('hidden', status === 'finalizada');
        if (status !== 'finalizada') $('#just', root).focus();
      };
      $('#save', root).onclick = async () => {
        const just = $('#just', root).value.trim();
        if (!status) return ($('#ts-err', root).textContent = 'Escolha um status.');
        if (status !== 'finalizada' && !just) return ($('#ts-err', root).textContent = 'Conte o motivo para seguir.');
        try {
          await api.updateTask(t.id, { status, justification: status === 'finalizada' ? '' : just });
          close(); toast(status === 'finalizada' ? 'Boa! Demanda finalizada.' : 'Status salvo. Ela volta amanhã.'); refresh();
        } catch (er) { $('#ts-err', root).textContent = er.message; }
      };
    }
    const ed = $('#edit', root); if (ed) ed.onclick = () => { close(); newTaskSheet(t); };
    const dl = $('#del', root); if (dl) dl.onclick = async () => {
      if (!confirm('Excluir esta tarefa?')) return;
      try { await api.deleteTask(t.id); close(); toast('Tarefa excluída.'); refresh(); } catch (er) { toast(er.message); }
    };
  });
}

function newTaskSheet(pre = {}) {
  const editing = !!pre.id;
  const t = { title: '', description: '', priority: 'media', task_date: state.tab === 'hoje' ? state.date : todayBR(), due_date: '', assigned_to: state.me.id, ...pre };
  if (!t.due_date) t.due_date = t.task_date;
  const ppl = isManager() ? state.people : [];
  openSheet(`
    <div class="sheet-head"><h2>${editing ? 'Editar tarefa' : 'Nova tarefa'}</h2><button class="icon-btn" data-close>${I.x}</button></div>
    <form id="tf">
      <div class="field"><label>O que precisa ser feito?</label><input class="input" name="title" required maxlength="140" value="${esc(t.title)}" placeholder="Ex.: Carrossel do cliente X"></div>
      <div class="field"><label>Detalhes (opcional)</label><textarea class="input" name="description" maxlength="1000">${esc(t.description)}</textarea></div>
      <div class="field"><label>Prioridade</label>
        <div class="seg" id="prio">${Object.entries(PRIOS).map(([k, v]) => `<button type="button" data-v="${k}" class="${t.priority === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="row2">
        <div class="field"><label>Data da demanda</label><input class="input" type="date" name="task_date" required value="${t.task_date}"></div>
        <div class="field"><label>Prazo de entrega</label><input class="input" type="date" name="due_date" required value="${t.due_date}"></div>
      </div>
      ${ppl.length ? `<div class="field"><label>Responsável</label>
        <div class="people" id="who">${ppl.map((p) => `<button type="button" data-p="${p.id}" class="${t.assigned_to === p.id ? 'on' : ''}">${avatarSVG(p.avatar, 40)}${esc(firstName(p.name))}${p.id === state.me.id ? ' (eu)' : ''}</button>`).join('')}</div></div>`
      : '<p class="muted" style="font-size:13px;margin-bottom:6px">Esta tarefa será adicionada à sua lista.</p>'}
      <div class="err" id="tf-err"></div>
      <div class="actions"><button class="btn btn-red" type="submit">${editing ? 'Salvar alterações' : 'Criar tarefa'}</button></div>
    </form>`,
  (root, close) => {
    const seg = $('#prio', root);
    seg.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; t.priority = b.dataset.v; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const who = $('#who', root);
    if (who) who.onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; t.assigned_to = b.dataset.p; who.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const td = root.querySelector('[name=task_date]'), dd = root.querySelector('[name=due_date]');
    td.onchange = () => { if (dd.value < td.value) dd.value = td.value; };
    $('#tf', root).onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (f.due_date < f.task_date) return ($('#tf-err', root).textContent = 'O prazo não pode ser antes da data da demanda.');
      const payload = { title: f.title.trim(), description: f.description.trim(), priority: t.priority, task_date: f.task_date, due_date: f.due_date, assigned_to: isManager() ? t.assigned_to : state.me.id };
      const b = e.target.querySelector('[type=submit]'); b.disabled = true;
      try {
        if (editing) await api.updateTask(t.id, payload);
        else await api.createTask({ ...payload, created_by: state.me.id });
        close();
        const p = person(payload.assigned_to);
        toast(editing ? 'Tarefa atualizada.' : payload.assigned_to === state.me.id ? 'Tarefa criada.' : `Tarefa enviada para ${firstName(p.name)}.`);
        refresh();
      } catch (er) { $('#tf-err', root).textContent = er.message; b.disabled = false; }
    };
  });
}

async function refresh() {
  state.me = await api.me();
  render();
}

// ---------------------------------------------------------------------
// Carrossel de boas-vindas (1º acesso e a cada X minutos)
// ---------------------------------------------------------------------
const ONB_KEY = 'elvt-onb-last';
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
};
function maybeOnboarding() {
  if (document.querySelector('.onb') || document.hidden) return;
  const last = Number(store.get(ONB_KEY) || 0);
  if (Date.now() - last >= ONBOARDING_EVERY_MIN * 60_000) showOnboarding();
}

const SLIDES = [
  {
    h: 'Seu dia,<br><span class="red">organizado.</span>',
    p: 'Todas as suas demandas em um só lugar. Abra o CRM, veja o que é para hoje e mãos à obra.',
    art: () => `<div class="mock">
      <div class="card-w"><small>Hoje · suas demandas</small><div style="font-size:34px;font-weight:500;margin-top:6px">3<small style="font-size:16px;font-weight:300">/5 finalizadas</small></div>
      <div class="bar"><span class="f" style="width:60%"></span><span class="p" style="width:20%"></span></div></div>
      ${taskCard({ id: 'a', title: 'Carrossel institucional', priority: 'alta', status: 'finalizada', due_date: todayBR(), completed_at: new Date().toISOString(), justification: '' })}
      ${taskCard({ id: 'b', title: 'Reels do lançamento', priority: 'urgente', status: 'pendente', due_date: todayBR(), justification: '' })}
    </div>`
  },
  {
    h: 'Marque como<br><span class="red">ficou.</span>',
    p: 'No fim do dia, marque cada demanda: finalizada, parcialmente finalizada ou não realizada — e conte o porquê.',
    art: () => `<div class="mock status-opts">
      <button class="on" data-v="finalizada"><span class="chk"></span><span><b>Finalizada</b><small>Entreguei tudo.</small></span></button>
      <button class="on" data-v="parcial"><span class="chk"></span><span><b>Parcialmente</b><small>Aguardando aprovação do cliente.</small></span></button>
      <button class="on" data-v="nao_realizada"><span class="chk"></span><span><b>Não realizada</b><small>Briefing não chegou.</small></span></button>
    </div>`
  },
  {
    h: 'Nada fica<br><span class="red">pra trás.</span>',
    p: 'O que não foi finalizado volta sozinho na sua lista do dia seguinte, com o mesmo status e a justificativa.',
    art: () => `<div class="mock">
      ${taskCard({ id: 'c', title: 'Relatório de campanhas', priority: 'alta', status: 'parcial', carried_from: 'x', due_date: todayBR(), justification: 'Falta o dado do Google Ads.' })}
      <img src="assets/img/seta.svg" alt="" style="width:26px;justify-self:center;margin:6px 0">
      <div class="card-w"><b>Amanhã</b> · ela já estará lá esperando por você.</div>
    </div>`
  },
  {
    h: 'Dia perfeito<br>vale <span class="red">estrela.</span>',
    p: 'Entregou todas as demandas do dia dentro do prazo? Ganha uma estrela. Acumule e suba no ranking do time.',
    art: () => `<div class="stars-art">${I.star}${I.star}${I.star}</div>`
  }
];

function showOnboarding() {
  let i = 0;
  const el = document.createElement('div');
  el.className = 'onb';
  document.body.appendChild(el);
  const close = () => { store.set(ONB_KEY, String(Date.now())); el.remove(); };
  const draw = () => {
    const s = SLIDES[i];
    el.innerHTML = `<div class="onb-in">
      <div class="onb-top">
        <span>${String(i + 1).padStart(2, '0')} / ${String(SLIDES.length).padStart(2, '0')}</span>
        <span class="bars">${SLIDES.map((_, k) => `<i class="${k < i ? 'on' : k === i ? 'cur' : ''}"></i>`).join('')}</span>
        <button data-skip>Pular</button>
      </div>
      <div class="onb-slide">
        <h2>${s.h}</h2><p>${s.p}</p>
        <div class="onb-art">${s.art()}</div>
      </div>
      <div class="onb-foot" style="${i === 0 ? 'grid-template-columns:1fr' : ''}">
        ${i ? `<button class="back" data-back aria-label="Voltar">${I.back}</button>` : ''}
        <button class="btn btn-white" data-next>${i === SLIDES.length - 1 ? 'Começar' : 'Próximo'} ${I.arrow}</button>
      </div>
    </div>`;
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-skip]')) return close();
    if (e.target.closest('[data-back]')) { i--; return draw(); }
    if (e.target.closest('[data-next]')) { if (i === SLIDES.length - 1) return close(); i++; draw(); }
  };
  // arrastar para os lados
  let x0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -50 && i < SLIDES.length - 1) { i++; draw(); } else if (dx > 50 && i > 0) { i--; draw(); }
  });
  draw();
}

start();
