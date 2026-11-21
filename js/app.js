import { api, todayBR } from './api.js';
import { JEREMIAS_SVG, TURTLE_SVG } from './avatars.js';
import { ONBOARDING_EVERY_MIN, JEREMIAS_EVERY_MIN } from './config.js';
import { I, state, isManager, isReviewer, $, esc, face, toast, busy, hideTip, ROLES } from './ui.js';
import { taskCard, newTaskSheet } from './tasks.js';
import { viewHoje, viewPainel, viewFluxo, viewRanking, viewChat, viewEnergia, viewEquipe, viewPerfil, viewMais, viewRelatorios } from './views.js';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
};

// ---------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------
async function start() {
  state.render = render;
  api.onAuth((s) => { if (!s) { state.me = null; renderLogin(); } });
  const s = await api.session();
  if (s) await enter(); else renderLogin();
  maybeOnboarding();
  setInterval(maybeOnboarding, 30_000);
  setInterval(maybeJeremias, 60_000);
  setInterval(async () => {
    if (state.me && todayBR() !== state.today) {
      state.today = todayBR(); state.date = state.today; state.painelDate = state.today;
      await api.rollover().catch(() => {}); render();
    }
  }, 60_000);
  window.addEventListener('elvt:onboarding', () => showOnboarding());
}

async function enter() {
  try { state.me = await api.me(); } catch (e) { renderLogin(e.message); return; }
  if (state.me.role === 'pendente' || state.me.active === false) { renderWaiting(); return; }
  await api.rollover().catch(() => {});
  [state.me, state.people, state.clients] = await Promise.all([api.me(), api.profiles(), api.clients().catch(() => [])]);
  state.tab = 'hoje';
  render();
  setTimeout(maybeJeremias, 4000);
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
  if (isReviewer()) items.push(['fluxo', 'Fluxo de conteúdo', I.flow], ['relatorios', 'Relatórios', I.report]);
  items.push(['ranking', 'Ranking', I.trophy], ['chat', 'Chat da equipe', I.chat]);
  if (isManager()) items.push(['energia', 'Energia do time', I.bolt], ['equipe', 'Equipe e clientes', I.team]);
  items.push(['perfil', 'Perfil', I.user]);
  return items;
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
    state.tab = b.dataset.tab; window.scrollTo(0, 0); render();
  }));
  const views = {
    hoje: viewHoje, painel: viewPainel, fluxo: viewFluxo, ranking: viewRanking, chat: viewChat,
    energia: viewEnergia, equipe: viewEquipe, perfil: viewPerfil, relatorios: viewRelatorios, mais: () => viewMais(moreItems)
  };
  if (state.tab !== 'relatorios') state.relClient = null;
  if ((['fluxo', 'relatorios'].includes(state.tab) && !isReviewer()) || (['energia', 'equipe'].includes(state.tab) && !isManager())) state.tab = 'hoje';
  try { await views[state.tab](); } catch (e) { toast(e.message); }
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

// ---------------------------------------------------------------------
// Carrossel de boas-vindas (1º acesso e a cada X minutos)
// ---------------------------------------------------------------------
const ONB_KEY = 'elvt-onb-last';
function maybeOnboarding() {
  if ($('.onb') || $('.jer-wrap') || document.hidden) return;
  const last = Number(store.get(ONB_KEY) || 0);
  if (Date.now() - last >= ONBOARDING_EVERY_MIN * 60_000) showOnboarding();
}

const fakeTask = (o) => ({ id: o.id, title: o.title, priority: o.priority, status: o.status, due_date: todayBR(), task_date: todayBR(), completed_at: new Date().toISOString(), justification: o.justification || '', review_note: o.review_note || '', stage: o.stage || 'a_fazer', carried_from: o.carried_from || null, assigned_to: '' });
const SLIDES = [
  {
    h: 'Seu dia,<br><span class="red">organizado.</span>',
    p: 'Todas as suas demandas em um só lugar. Abra o CRM, veja o que é para hoje e mãos à obra.',
    art: () => `<div class="mock">
      <div class="card-w"><small>Hoje · suas demandas</small><div style="font-size:34px;font-weight:500;margin-top:6px">3<small style="font-size:16px;font-weight:300">/5 finalizadas</small></div>
      <div class="bar"><span class="f" style="width:60%"></span><span class="p" style="width:20%"></span></div></div>
      ${taskCard(fakeTask({ id: 'a', title: 'Carrossel institucional', priority: 'alta', status: 'finalizada', stage: 'revisao_interna' }))}
      ${taskCard(fakeTask({ id: 'b', title: 'Reels do lançamento', priority: 'urgente', status: 'pendente' }), { i: 1 })}
    </div>`
  },
  {
    h: 'Marque como<br><span class="red">ficou.</span>',
    p: 'No fim do dia, marque cada demanda como finalizada, incompleta ou não realizada, e conte o porquê.',
    art: () => `<div class="mock status-opts">
      <button class="on" data-v="finalizada"><span class="chk"></span><span><b>Finalizada</b><small>Vai para a revisão interna.</small></span></button>
      <button class="on" data-v="incompleta"><span class="chk"></span><span><b>Incompleta</b><small>Aguardando aprovação do cliente.</small></span></button>
      <button class="on" data-v="nao_realizada"><span class="chk"></span><span><b>Não realizada</b><small>Briefing não chegou.</small></span></button>
    </div>`
  },
  {
    h: 'Nada fica<br><span class="red">pra trás.</span>',
    p: 'O que não foi finalizado volta sozinho no dia seguinte. Se a revisão pedir ajuste, a peça volta como "em alteração".',
    art: () => `<div class="mock">
      ${taskCard(fakeTask({ id: 'c', title: 'Logo da campanha de verão', priority: 'alta', status: 'em_alteracao', review_note: 'Cliente pediu o vermelho mais escuro.' }))}
      <img src="assets/img/seta.svg" alt="" style="width:14px;justify-self:center;margin:6px 0">
      <div class="card-w"><b>A fazer → Revisão interna → Cliente → Agendamento → Concluído</b></div>
    </div>`
  },
  {
    h: 'Dia perfeito<br>vale <span class="red">estrela.</span>',
    p: 'Entregou todas as demandas do dia dentro do prazo? Ganha uma estrela, e seu bichinho corre na frente do ranking.',
    art: () => `<div class="stars-art">${I.star}${I.star}${I.star}</div>`
  }
];

function showOnboarding() {
  if ($('.onb')) return;
  let i = 0;
  const el = document.createElement('div');
  el.className = 'onb';
  document.body.appendChild(el);
  let auto;
  const close = () => { clearTimeout(auto); store.set(ONB_KEY, String(Date.now())); el.remove(); };
  const draw = () => {
    clearTimeout(auto);
    const s = SLIDES[i];
    el.innerHTML = `<div class="onb-in">
      <div class="onb-top">
        <span>${String(i + 1).padStart(2, '0')} / ${String(SLIDES.length).padStart(2, '0')}</span>
        <span class="progress">${SLIDES.map((_, k) => `<i class="${k < i ? 'on' : k === i ? 'cur' : ''}"></i>`).join('')}</span>
        <button data-skip>Pular</button>
      </div>
      <div class="onb-slide">
        <div class="onb-text"><h2>${s.h}</h2><p>${s.p}</p></div>
        <div class="onb-art"><div class="onb-art-in">${s.art()}</div></div>
      </div>
      <div class="onb-foot" style="${i === 0 ? 'grid-template-columns:1fr' : ''}">
        ${i ? `<button class="back" data-back aria-label="Voltar">${I.back}</button>` : ''}
        <button class="btn btn-white" data-next>${i === SLIDES.length - 1 ? 'Começar' : 'Próximo'} ${I.arrow}</button>
      </div>
    </div>`;
    if (i < SLIDES.length - 1) auto = setTimeout(() => { i++; draw(); }, 6000);
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-skip]')) return close();
    if (e.target.closest('[data-back]')) { i--; return draw(); }
    if (e.target.closest('[data-next]')) { if (i === SLIDES.length - 1) return close(); i++; draw(); }
  };
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
