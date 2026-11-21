// Página pública de aprovação do cliente (sem login). Lê o link temporário (?t=…)
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const qs = new URLSearchParams(location.search);
const TOKEN = (qs.get('t') || '').trim();
const DEMO = qs.has('demo');
const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtDate = (d) => { const x = new Date(d); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; };
const fmtDateTime = (iso) => { const x = new Date(iso); return `${x.getDate()} ${MONTHS[x.getMonth()]} · ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
const fmtIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'EL';

const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1.6-1.6"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><rect x="3" y="4" width="18" height="16"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M9 5l7 7-7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><rect x="3" y="3" width="18" height="18"/><path d="M12 7v5l3 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'
};

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---------------------------------------------------------------------
// Dados (Supabase público ou demonstração)
// ---------------------------------------------------------------------
const sb = DEMO ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const publicUrl = (path) => DEMO ? path : sb.storage.from('anexos').getPublicUrl(path).data.publicUrl;

async function load() {
  if (DEMO) {
    return {
      state: 'aberto', expires_at: new Date(Date.now() + 6 * 86400e3).toISOString(), due_date: new Date().toISOString().slice(0, 10),
      title: 'Carrossel institucional: 5 slides',
      description: 'Carrossel para o feed apresentando os diferenciais da clínica.',
      client: { name: 'Clínica Sorriso', logo_url: null }, instagram: 'clinicasorriso', post_format: 'carrossel',
      post_at: new Date(Date.now() + 3 * 86400e3).toISOString(), caption: 'Seu sorriso merece cuidado de verdade 💙\nConheça nossa estrutura e agende sua avaliação.\n\n#clinicasorriso #odontologia',
      files: [
        { kind: 'file', name: 'slide-1.jpg', path: 'assets/img/bg-branco.jpg' },
        { kind: 'file', name: 'slide-2.jpg', path: 'assets/img/og-elevate.jpg' },
        { kind: 'file', name: 'slide-3.png', path: 'assets/img/icon-512.png' },
        { kind: 'file', name: 'Plano editorial dezembro.pdf', path: '#' },
        { kind: 'link', name: 'Figma do carrossel', url: 'https://www.figma.com' }
      ]
    };
  }
  const { data, error } = await sb.rpc('get_approval', { p_token: TOKEN });
  if (error) throw new Error(error.message);
  return data;
}

async function submit(decision, note, files) {
  if (DEMO) { await new Promise((r) => setTimeout(r, 600)); return; }
  const uploaded = [];
  for (const f of files) {
    const safe = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-60);
    const path = `cliente/${TOKEN}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from('anexos').upload(path, f, { contentType: f.type || undefined });
    if (error) throw new Error('Não foi possível enviar ' + f.name + '.');
    uploaded.push({ path, name: f.name });
  }
  const { error } = await sb.rpc('submit_approval', { p_token: TOKEN, p_decision: decision, p_note: note, p_files: uploaded });
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
}

// ---------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------
const kindOf = (f) => {
  if (f.kind === 'link') return 'link';
  const n = (f.name || f.path || '').toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif)$/.test(n)) return 'image';
  if (/\.(mp4|mov|webm|m4v)$/.test(n)) return 'video';
  if (/\.pdf$/.test(n)) return 'pdf';
  return 'other';
};

function header(d) {
  const c = d.client || {};
  return `<header class="ap-head rise">
    <div class="ap-brand">
      <span class="ap-logo">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="${esc(c.name)}">` : `<b>${esc(initials(c.name))}</b>`}</span>
      <div><small>Aprovação de conteúdo</small><h1>${esc(c.name || 'Seu conteúdo')}</h1></div>
    </div>
    <span class="ap-by">por <img src="assets/img/logo.svg" alt="Elevate"></span>
  </header>`;
}

function statusScreen(d, kind) {
  const msgs = {
    invalido: ['Link não encontrado', 'Confira se o endereço foi copiado inteiro, ou peça um novo link para a equipe Elevate.'],
    expirado: ['Este link expirou', 'Os links de aprovação valem por 7 dias. Peça um novo link para a equipe Elevate.'],
    encerrado: ['Esta revisão foi encerrada', 'O conteúdo já seguiu para a próxima etapa. Se precisar de algo, fale com a equipe Elevate.'],
    respondido: [d?.decision === 'aprovado' ? 'Conteúdo aprovado' : 'Alteração enviada', d?.decision === 'aprovado' ? 'Obrigado! Você já aprovou este conteúdo e ele seguiu para o agendamento.' : 'Obrigado! Seu pedido de alteração já está com a equipe Elevate.'],
    aprovado: ['Conteúdo aprovado!', 'Obrigado! A equipe Elevate já recebeu sua aprovação e o post segue para o agendamento.'],
    alteracao: ['Pedido enviado!', 'Obrigado! A equipe Elevate já recebeu sua alteração e vai ajustar o conteúdo.']
  };
  const [h, p] = msgs[kind] || msgs.invalido;
  const good = ['aprovado', 'alteracao', 'respondido'].includes(kind);
  $('#ap').innerHTML = `${d?.client ? header(d) : '<header class="ap-head"><span></span><span class="ap-by">por <img src="assets/img/logo.svg" alt="Elevate"></span></header>'}
    <main class="ap-done rise">
      <span class="ap-done-ic ${good ? 'ok' : ''}">${good ? (kind === 'alteracao' || d?.decision === 'alteracao' ? ICON.edit : ICON.check) : ICON.clock}</span>
      <h2>${h}</h2><p>${p}</p>
      ${d?.title ? `<p class="ap-done-t">${esc(d.title)}</p>` : ''}
    </main>`;
}

function mediaHtml(files) {
  const imgs = files.filter((f) => kindOf(f) === 'image');
  const vids = files.filter((f) => kindOf(f) === 'video');
  const pdfs = files.filter((f) => kindOf(f) === 'pdf');
  const others = files.filter((f) => ['other', 'link'].includes(kindOf(f)));
  let h = '';
  if (imgs.length) {
    h += `<section class="ap-carousel rise" style="--i:1" aria-label="Artes do conteúdo">
      <div class="ap-track" id="track">${imgs.map((f, i) => `<figure><img src="${esc(publicUrl(f.path))}" alt="Arte ${i + 1} de ${imgs.length}" ${i ? 'loading="lazy"' : ''}></figure>`).join('')}</div>
      ${imgs.length > 1 ? `<button class="ap-nav prev" aria-label="Anterior">${ICON.prev}</button><button class="ap-nav next" aria-label="Próxima">${ICON.next}</button>
        <div class="ap-dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
        <span class="ap-count"><b id="cur">1</b>/${imgs.length}</span>` : ''}
    </section>`;
  }
  vids.forEach((f, i) => {
    h += `<section class="ap-video rise" style="--i:${2 + i}"><video src="${esc(publicUrl(f.path))}" controls playsinline preload="metadata"></video></section>`;
  });
  if (pdfs.length || others.length) {
    h += `<section class="ap-files rise" style="--i:3">${[...pdfs, ...others].map((f) => {
      const k = kindOf(f);
      const url = k === 'link' ? f.url : publicUrl(f.path);
      return `<a class="ap-file card" href="${esc(url)}" target="_blank" rel="noopener">
        <span class="ap-file-ic">${k === 'link' ? ICON.link : ICON.file}</span>
        <span class="ap-file-n"><b>${esc(f.name)}</b><small>${k === 'pdf' ? 'PDF · toque para abrir' : k === 'link' ? 'Link externo' : 'Arquivo · toque para abrir'}</small></span>
        ${ICON.arrow}</a>`;
    }).join('')}</section>`;
    const firstPdf = pdfs[0];
    if (firstPdf && !DEMO) h += `<section class="ap-pdf rise d-only-block"><iframe src="${esc(publicUrl(firstPdf.path))}#view=FitH" title="${esc(firstPdf.name)}"></iframe></section>`;
  }
  return h;
}

function render(d) {
  const files = d.files || [];
  const hasMedia = files.length > 0;
  $('#ap').innerHTML = `${header(d)}
    <div class="ap-grid">
      <div class="ap-main">${hasMedia ? mediaHtml(files) : ''}</div>
      <aside class="ap-side">
        <section class="ap-info card glow rise" style="--i:2">
          <span class="tag solid">${ICON.clock} Disponível até ${fmtDate(d.expires_at)}</span>
          <h2>${esc(d.title)}</h2>
          ${d.description ? `<p class="ap-desc">${esc(d.description)}</p>` : ''}
          ${d.post_at || d.post_format ? `<div class="ap-post">
            ${d.post_format ? `<span><small>Formato</small><b>${esc({ feed: 'Feed', carrossel: 'Carrossel', reels: 'Reels', story: 'Story' }[d.post_format] || d.post_format)}</b></span>` : ''}
            ${d.post_at ? `<span><small>Postagem prevista</small><b>${fmtDateTime(d.post_at)}</b></span>` : ''}
            ${d.instagram ? `<span><small>Perfil</small><b>@${esc(d.instagram)}</b></span>` : ''}
          </div>` : ''}
          ${d.caption ? `<div class="ap-cap"><small>Legenda</small><p>${esc(d.caption)}</p></div>` : ''}
          ${d.due_date && !d.post_at ? `<p class="ap-due">Prazo de entrega: <b>${fmtIso(d.due_date)}</b></p>` : ''}
        </section>
        <section class="ap-decide rise" style="--i:3" id="decide">
          <p class="ap-q">O que você achou?</p>
          <div class="ap-btns">
            <button class="btn btn-ghost" data-d="alteracao">${ICON.edit} Alteração</button>
            <button class="btn btn-red" data-d="aprovado">${ICON.check} Aprovado</button>
          </div>
        </section>
        <section class="ap-change card hidden rise" id="change">
          <label for="note"><b>O que precisa mudar?</b></label>
          <textarea class="input" id="note" rows="4" placeholder="Ex.: trocar a foto do slide 2 e deixar o título maior"></textarea>
          <div class="ap-thumbs" id="thumbs"></div>
          <label class="btn btn-ghost btn-sm" style="width:100%;cursor:pointer">${ICON.image} Anexar imagem de referência<input type="file" accept="image/*" multiple class="sr" id="files"></label>
          <p class="err" id="err"></p>
          <div class="ap-btns"><button class="btn btn-ghost" id="cancel">Voltar</button><button class="btn btn-red" id="send">Confirmar alteração</button></div>
        </section>
        <section class="ap-confirm card hidden rise" id="confirm">
          <p><b>Confirmar aprovação?</b><br><span class="muted">O conteúdo segue direto para o agendamento da postagem.</span></p>
          <div class="ap-btns"><button class="btn btn-ghost" id="no">Voltar</button><button class="btn btn-red" id="yes">${ICON.check} Sim, aprovar</button></div>
        </section>
      </aside>
    </div>`;
  bindCarousel();
  bindDecision(d);
}

function bindCarousel() {
  const track = $('#track'); if (!track) return;
  const dots = [...document.querySelectorAll('.ap-dots i')];
  const n = track.children.length;
  const cur = () => Math.round(track.scrollLeft / track.clientWidth);
  const go = (i) => track.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * track.clientWidth, behavior: 'smooth' });
  track.addEventListener('scroll', () => {
    const i = cur(); dots.forEach((d, k) => d.classList.toggle('on', k === i));
    const c = $('#cur'); if (c) c.textContent = i + 1;
  }, { passive: true });
  const p = $('.ap-nav.prev'), nx = $('.ap-nav.next');
  if (p) p.onclick = () => go(cur() - 1);
  if (nx) nx.onclick = () => go(cur() + 1);
  dots.forEach((d, k) => (d.onclick = () => go(k)));
  document.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(cur() - 1); if (e.key === 'ArrowRight') go(cur() + 1); });
}

function bindDecision(d) {
  const files = [];
  const show = (id) => ['decide', 'change', 'confirm'].forEach((k) => $('#' + k).classList.toggle('hidden', k !== id));
  $('#decide').onclick = (e) => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    if (b.dataset.d === 'aprovado') show('confirm'); else { show('change'); $('#note').focus(); }
  };
  $('#cancel').onclick = () => show('decide');
  $('#no').onclick = () => show('decide');
  const drawThumbs = () => {
    $('#thumbs').innerHTML = files.map((f, i) => `<span><img src="${URL.createObjectURL(f)}" alt=""><button data-rm="${i}" aria-label="Remover">${ICON.x}</button></span>`).join('');
  };
  $('#files').onchange = (e) => {
    for (const f of e.target.files) { if (f.size > 15 * 1024 * 1024) toast(`${f.name} passa de 15 MB.`); else if (files.length < 6) files.push(f); }
    e.target.value = ''; drawThumbs();
  };
  $('#thumbs').onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { files.splice(+b.dataset.rm, 1); drawThumbs(); } };
  const send = async (btn, decision) => {
    const note = decision === 'alteracao' ? $('#note').value.trim() : '';
    if (decision === 'alteracao' && !note) { $('#err').textContent = 'Conte o que precisa mudar.'; return; }
    btn.disabled = true; btn.classList.add('loading');
    try { await submit(decision, note, decision === 'alteracao' ? files : []); statusScreen(d, decision); }
    catch (er) { toast(er.message); btn.disabled = false; btn.classList.remove('loading'); }
  };
  $('#yes').onclick = (e) => send(e.currentTarget, 'aprovado');
  $('#send').onclick = (e) => send(e.currentTarget, 'alteracao');
}

// ---------------------------------------------------------------------
(async () => {
  if (!TOKEN && !DEMO) return statusScreen(null, 'invalido');
  try {
    const d = await load();
    if (!d || d.state === 'invalido') return statusScreen(null, 'invalido');
    document.title = `Aprovação de conteúdo · ${d.client?.name || 'Elevate'}`;
    if (d.state !== 'aberto') return statusScreen(d, d.state);
    render(d);
  } catch (e) {
    statusScreen(null, 'invalido');
    toast(e.message);
  }
})();
