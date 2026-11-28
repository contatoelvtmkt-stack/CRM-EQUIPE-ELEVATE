import { api, todayBR } from './api.js';
import { JEREMIAS_SVG, TURTLE_SVG } from './avatars.js';
import { JEREMIAS_EVERY_MIN } from './config.js';
import { I, state, isManager, isReviewer, $, esc, face, toast, busy, hideTip, ROLES, sheetOpen } from './ui.js';
import { newTaskSheet } from './tasks.js';
import { viewHoje, viewPainel, viewFluxo, viewRanking, viewChat, viewEnergia, viewEquipe, viewPerfil, viewMais, viewRelatorios, viewSatisfacao } from './views.js';
import { viewSaldos, viewFinanceiro, loadLowBalances, lowBalancePopup, isAdsTeam } from './admin.js';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
};

// ---------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------
async function start() {
  state.render = render;
  render.badges = () => loadLowBalances().then(updateBadges);
  api.onAuth((s) => { if (!s) { state.me = null; renderLogin(); } });
  const s = await api.session();
  if (s) await enter(); else renderLogin();
  setInterval(maybeJeremias, 60_000);
  setInterval(async () => {
    if (state.me && todayBR() !== state.today) {
      state.today = todayBR(); state.date = state.today; state.painelDate = state.today;
      await api.rollover().catch(() => {}); render();
    }
  }, 60_000);
}

// lembra o menu aberto (sobrevive a recarregar a página)
const TAB_KEY = 'elvt-tab';
function readTab() { try { return localStorage.getItem(TAB_KEY); } catch { return null; } }
function saveTab() { try { localStorage.setItem(TAB_KEY, state.tab); } catch { /* */ } }

// atualização em tempo real: quando alguém mexe numa tarefa, recarrega a tela
let rtTimer = null, rtPending = false, rtUnsub = null;
function startRealtime() {
  if (rtUnsub || !api.subscribeTasks) return;
  rtUnsub = api.subscribeTasks((type) => {
    if (type !== 'tasks') return;
    if (!['hoje', 'painel', 'fluxo'].includes(state.tab)) return;
    clearTimeout(rtTimer);
    rtTimer = setTimeout(() => {
      if (sheetOpen || document.querySelector('.rep-view, .onb, .jer-wrap') || document.body.classList.contains('is-dragging')) { rtPending = true; return; }
      refreshView(true);
    }, 700);
  });
  window.addEventListener('elvt:sheet-closed', () => { if (rtPending) { rtPending = false; refreshView(true); } });
}

async function enter() {
  try { state.me = await api.me(); } catch (e) { renderLogin(e.message); return; }
  if (state.me.role === 'pendente' || state.me.active === false) { renderWaiting(); return; }
  await api.rollover().catch(() => {});
  [state.me, state.people, state.clients] = await Promise.all([api.me(), api.profiles(), api.clients().catch(() => [])]);
  state.tab = readTab() || 'hoje';
  render();
  setTimeout(maybeJeremias, 4000);
  startRealtime();
  // saldo baixo nas contas de anúncios (admin e gestor de tráfego)
  if (isAdsTeam()) loadLowBalances().then(() => { updateBadges(); lowBalancePopup((tab) => { state.tab = tab; render(); }); });
}

// ---------------------------------------------------------------------
// Login (centralizado, logo menor e perto do título)
// ---------------------------------------------------------------------
function renderLogin(err = '') {
  $('#app').className = 'app';
  $('#app').innerHTML = `
    <div class="login"><div class="login-box">
      <img class="logo" src="assets/img/logo.svg" alt="Elevate">
      <h1>Seu dia,<br><span class="red">organizado.</span></h1>
      <p class="sub">Entre para registrar as demandas de hoje e acompanhar o time.</p>
      <form id="login-form" novalidate>
        <div class="field"><label for="email">E-mail</label><input class="input" id="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="pass">Senha</label><input class="input" id="pass" type="password" autocomplete="current-password" required></div>
        <div class="err" id="login-err">${esc(err)}</div>
        <button class="btn btn-red" type="submit">Entrar ${I.arrow}</button>
        ${api.demo ? '<p class="muted" style="font-size:12px;margin-top:14px;text-align:center;line-height:1.5">Modo demonstração: qualquer senha.<br>admin@ · gestora@ · designer@ · social@ · trafego@elevate.com</p>' : ''}
      </form>
    </div></div>`;
  $('#login-form').onsubmit = (e) => {
    e.preventDefault();
    busy(e.target.querySelector('button'), async () => {
      try { await api.signIn($('#email').value.trim(), $('#pass').value); await enter(); }
      catch (er) { $('#login-err').textContent = er.message; }
    });
  };
}

function renderWaiting() {
  $('#app').className = 'app';
  $('#app').innerHTML = `
    <div class="login"><div class="login-box">
      <img class="logo" src="assets/img/logo.svg" alt="Elevate">
      <h1>Quase lá<span class="red">.</span></h1>
      <p class="sub">Sua conta ainda não tem um cargo definido. Peça ao administrador ou à gestora de projetos para liberar seu acesso.</p>
      <button class="btn btn-ghost" id="out">${I.out} Sair</button>
    </div></div>`;
  $('#out').onclick = () => api.signOut();
}

// ---------------------------------------------------------------------
// Estrutura: menu lateral (desktop) + barra inferior (celular)
// ---------------------------------------------------------------------
function menuItems() {
  const items = [['hoje', 'Hoje', I.home], ['painel', 'Painel', I.chart]];
  if (isReviewer()) items.push(['fluxo', 'Kanban', I.flow], ['relatorios', 'Relatórios', I.report], ['satisfacao', 'Satisfação', I.star]);
  items.push(['ranking', 'Ranking', I.trophy], ['chat', 'Chat da equipe', I.chat]);
  if (isAdsTeam()) items.push(['saldos', 'Saldos de anúncios', I.wallet]);
  if (state.me.role === 'admin') items.push(['financeiro', 'Financeiro', I.cash]);
  if (isManager()) items.push(['energia', 'Energia do time', I.bolt], ['equipe', 'Equipe e clientes', I.team]);
  items.push(['perfil', 'Perfil', I.user]);
  return items;
}

// botão "Atualizar" em todo menu: recarrega só a tela aberta
let currentView = null;
async function refreshView(silent = false) {
  if (!currentView) return;
  const y = window.scrollY;
  const kb = document.querySelector('.kanban'); const kx = kb ? kb.scrollLeft : 0;
  try { await currentView(); } catch (e) { if (!silent) toast(e.message); }
  addRefreshButton(); updateBadges();
  window.scrollTo(0, y);
  const kb2 = document.querySelector('.kanban'); if (kb2) kb2.scrollLeft = kx;
  if (!silent) toast('Atualizado.');
}
function addRefreshButton() {
  const head = document.querySelector('#view .top, #view .chat-head');
  if (!head || head.querySelector('.refresh-btn')) return;
  const b = document.createElement('button');
  b.className = 'icon-btn refresh-btn'; b.title = 'Atualizar'; b.setAttribute('aria-label', 'Atualizar');
  b.innerHTML = I.refresh;
  b.onclick = async () => { b.classList.add('spin'); await refreshView(); b.classList.remove('spin'); };
  head.appendChild(b);
}
window.addEventListener('elvt:refresh', () => refreshView(true));

// contador de contas com saldo baixo no menu
function updateBadges() {
  const n = (state.lowBalances || []).length;
  document.querySelectorAll('.side [data-tab="saldos"], .nav [data-tab="mais"], .menu-list [data-go="saldos"]').forEach((b) => {
    b.querySelector('.badge')?.remove();
    if (n) { const s = document.createElement('span'); s.className = 'badge'; s.textContent = n; b.appendChild(s); }
  });
}

async function render() {
  if (!state.me) return;
  hideTip();
  const items = menuItems();
  const fourth = isReviewer() ? ['fluxo', 'Fluxo', I.flow] : ['chat', 'Chat', I.chat];
  const bottom = [['hoje', 'Hoje', I.home], ['painel', 'Painel', I.chart], ['nova', '', I.plus], fourth, ['mais', 'Mais', I.more]];
  const inBottom = new Set(bottom.map((b) => b[0]));
  const moreItems = items.filter(([k]) => !inBottom.has(k));
  const onMore = state.tab === 'mais' || (!inBottom.has(state.tab));

  $('#app').className = 'app shell';
  $('#app').innerHTML = `
    <aside class="side">
      <img class="logo" src="assets/img/logo.svg" alt="Elevate">
      <nav aria-label="Menu principal">
        ${items.map(([k, l, ic]) => `<button data-tab="${k}" class="${state.tab === k ? 'on' : ''}">${ic}<span>${l}</span></button>`).join('')}
      </nav>
      <button class="btn btn-red new" data-tab="nova">${I.plus} Nova tarefa</button>
      <div class="me card"><span class="av-slot">${face(state.me, 36)}</span><div><b>${esc(state.me.name)}</b><small>${ROLES[state.me.role]}</small></div><span class="star-pill" style="height:32px;padding:0 8px">${I.star}${state.me.stars}</span></div>
    </aside>
    <main id="view"></main>
    <nav class="nav" aria-label="Menu">${bottom.map(([k, l, ic]) => k === 'nova'
      ? `<button class="plus" data-tab="nova" aria-label="Nova tarefa">${ic}</button>`
      : `<button data-tab="${k}" class="${(k === 'mais' ? onMore : state.tab === k) ? 'on' : ''}">${ic}<span>${l}</span></button>`).join('')}
    </nav>`;
  $('#app').querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    if (b.dataset.tab === 'nova') return newTaskSheet();
    state.tab = b.dataset.tab; saveTab(); window.scrollTo(0, 0); render();
  }));
  const views = {
    hoje: viewHoje, painel: viewPainel, fluxo: viewFluxo, ranking: viewRanking, chat: viewChat,
    energia: viewEnergia, equipe: viewEquipe, perfil: viewPerfil, relatorios: viewRelatorios, satisfacao: viewSatisfacao, saldos: viewSaldos, financeiro: () => viewFinanceiro(), mais: () => viewMais(moreItems)
  };
  if (state.tab !== 'relatorios') state.relClient = null;
  if ((state.tab === 'saldos' && !isAdsTeam()) || (state.tab === 'financeiro' && state.me.role !== 'admin')) state.tab = 'hoje';
  if ((['fluxo', 'relatorios', 'satisfacao'].includes(state.tab) && !isReviewer()) || (['energia', 'equipe'].includes(state.tab) && !isManager())) state.tab = 'hoje';
  saveTab();
  currentView = views[state.tab];
  try { await views[state.tab](); } catch (e) { toast(e.message); }
  addRefreshButton();
  updateBadges();
}

// ---------------------------------------------------------------------
// Jeremias: a cada 2 horas pergunta como estão as demandas (menos admin/gestora)
// ---------------------------------------------------------------------
function maybeJeremias() {
  if (!state.me || isManager() || document.hidden || $('.onb') || $('.jer-wrap') || $('#sheet-root').children.length) return;
  const key = `elvt-jer-${state.me.id}`;
  const last = Number(store.get(key) || 0);
  if (!last) { store.set(key, String(Date.now())); return; } // começa a contar a partir do 1º acesso
  if (Date.now() - last >= JEREMIAS_EVERY_MIN * 60_000) showJeremias();
}

export function showJeremias() {
  const el = document.createElement('div');
  el.className = 'jer-wrap';
  el.innerHTML = `<div class="jer card glow" role="dialog" aria-modal="true" aria-labelledby="jer-q">
    <div class="face">${JEREMIAS_SVG}</div>
    <div class="from">Mensagem de<b>Jeremias</b></div>
    <p id="jer-q">Tudo certo com as demandas, pessoal? Como está o andamento?</p>
    <div class="two">
      <button class="btn btn-ghost" data-a="devagar">${TURTLE_SVG} Devagar hoje</button>
      <button class="btn btn-red" data-a="ok">Tudo certo!</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.onclick = async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    store.set(`elvt-jer-${state.me.id}`, String(Date.now()));
    el.remove();
    try { await api.pulse(b.dataset.a); } catch { /* segue mesmo assim */ }
    toast(b.dataset.a === 'ok' ? 'Boa! O Jeremias ficou feliz.' : 'Tudo bem, um passo de cada vez 🐢');
  };
}

start();
