import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const todayBR = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const ok = ({ data, error }) => {
  if (error) throw new Error(traduz(error.message));
  return data;
};

function traduz(msg = '') {
  if (/Invalid login/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Este e-mail já está cadastrado.';
  if (/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/Email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.';
  if (/Sem permiss|permission denied|row-level security/i.test(msg)) return 'Você não tem permissão para isso.';
  if (/Bucket not found/i.test(msg)) return 'Armazenamento de arquivos não configurado. Rode o schema.sql de novo.';
  return msg;
}

const safeName = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);

// Reduz a foto de perfil para 400×400 (corte central) antes de enviar
export async function squareImage(file, size = 400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
  } finally { URL.revokeObjectURL(url); }
}

// ---------------------------------------------------------------------
// Supabase (produção)
// ---------------------------------------------------------------------
function supabaseApi() {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let uid = null;
  const getUid = async () => uid || (uid = (await sb.auth.getUser()).data.user?.id);
  return {
    demo: false,
    async session() { return (await sb.auth.getSession()).data.session; },
    onAuth(cb) { sb.auth.onAuthStateChange((_e, s) => { uid = s?.user?.id || null; cb(s); }); },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); uid = null; },
    async signOut() { await sb.auth.signOut(); },
    async me() { return ok(await sb.from('profiles').select('*').eq('id', await getUid()).single()); },
    async rollover() { await sb.rpc('daily_rollover'); },
    async profiles() { return ok(await sb.from('profiles').select('*').neq('role', 'pendente').eq('active', true).order('name')); },
    async allProfiles() { return ok(await sb.from('profiles').select('*').order('name')); },
    async tasks({ date, from, to, userId }) {
      let q = sb.from('tasks').select('*').order('created_at');
      if (date) q = q.eq('task_date', date);
      if (from) q = q.gte('task_date', from);
      if (to) q = q.lte('task_date', to);
      if (userId) q = q.eq('assigned_to', userId);
      return ok(await q);
    },
    async pipeline() { return ok(await sb.from('pipeline').select('*').order('stage_at', { ascending: false }).limit(1000)); },
    async createTask(t) { return ok(await sb.from('tasks').insert(t).select().single()); },
    async updateTask(id, patch) { return ok(await sb.from('tasks').update(patch).eq('id', id).select().single()); },
    async deleteTask(id) { ok(await sb.from('tasks').delete().eq('id', id)); },
    async review(id, action, note = '', stage = null) { ok(await sb.rpc('review_task', { p_id: id, p_action: action, p_note: note, p_stage: stage })); },
    async updateProfile(id, patch) { return ok(await sb.from('profiles').update(patch).eq('id', id).select().single()); },
    async uploadPhoto(file) {
      const id = await getUid();
      const blob = await squareImage(file);
      const path = `${id}/${Date.now()}.jpg`;
      ok(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true }));
      const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      return ok(await sb.from('profiles').update({ photo_url: url }).eq('id', id).select().single());
    },
    async removePhoto() { return ok(await sb.from('profiles').update({ photo_url: null }).eq('id', await getUid()).select().single()); },
    async createMember({ name, email, password, role }) {
      // cliente separado, para não trocar a sessão de quem está cadastrando
      const tmp = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: 'tmp-signup' }
      });
      const data = ok(await tmp.auth.signUp({ email, password, options: { data: { name } } }));
      if (!data.user) throw new Error('Não foi possível criar o usuário.');
      ok(await sb.rpc('set_member', { p_id: data.user.id, p_name: name, p_role: role }));
    },
    async setMember(id, name, role) { ok(await sb.rpc('set_member', { p_id: id, p_name: name, p_role: role })); },
    async clients() { return ok(await sb.from('clients').select('*').order('name')); },
    async createClient(name) { return ok(await sb.from('clients').insert({ name }).select().single()); },
    async updateClient(id, patch) { return ok(await sb.from('clients').update(patch).eq('id', id).select().single()); },
    async attachments(rootId) { return ok(await sb.from('task_attachments').select('*').eq('root_id', rootId).order('created_at')); },
    async addLink(rootId, url, name) { return ok(await sb.from('task_attachments').insert({ root_id: rootId, kind: 'link', url, name: name || url }).select().single()); },
    async addFile(rootId, file) {
      const path = `${rootId}/${Date.now()}-${safeName(file.name)}`;
      ok(await sb.storage.from('anexos').upload(path, file, { contentType: file.type || undefined }));
      return ok(await sb.from('task_attachments').insert({ root_id: rootId, kind: 'file', path, name: file.name }).select().single());
    },
    async fileUrl(path) { return ok(await sb.storage.from('anexos').createSignedUrl(path, 3600)).signedUrl; },
    async deleteAttachment(id) { ok(await sb.from('task_attachments').delete().eq('id', id)); },
    async pulse(answer) { ok(await sb.from('pulses').insert({ answer })); },
    async pulses(sinceIso) { return ok(await sb.from('pulses').select('*').gte('created_at', sinceIso).order('created_at')); },
    async messages() {
      const d = ok(await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(150));
      return d.reverse();
    },
    async sendMessage(body) { return ok(await sb.from('messages').insert({ body }).select().single()); },
    async deleteMessage(id) { ok(await sb.from('messages').delete().eq('id', id)); },
    subscribeMessages(cb) {
      const ch = sb.channel('chat').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, cb).subscribe();
      return () => sb.removeChannel(ch);
    }
  };
}

// ---------------------------------------------------------------------
// Modo demonstração (?demo na URL) — dados de exemplo no navegador
// ---------------------------------------------------------------------
function demoApi() {
  const t = todayBR();
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const people = [
    { id: 'u1', name: 'Isaac Silva', role: 'admin', avatar: 'capivara', stars: 12, email: 'admin@elevate.com', active: true },
    { id: 'u2', name: 'Marina Costa', role: 'gestora', avatar: 'coruja', stars: 18, email: 'gestora@elevate.com', active: true },
    { id: 'u3', name: 'Lucas Lima', role: 'designer_editor', avatar: 'gato', stars: 9, email: 'designer@elevate.com', active: true },
    { id: 'u4', name: 'Bia Rocha', role: 'designer_editor', avatar: 'raposa', stars: 15, email: 'editor@elevate.com', active: true },
    { id: 'u5', name: 'Rafa Mendes', role: 'social_media', avatar: 'sapo', stars: 7, email: 'social@elevate.com', active: true },
    { id: 'u6', name: 'Duda Alves', role: 'trafego', avatar: 'panda', stars: 11, email: 'trafego@elevate.com', active: true }
  ];
  const clients = [
    { id: 'c1', name: 'Clínica Sorriso', active: true }, { id: 'c2', name: 'Studio Nova', active: true },
    { id: 'c3', name: 'Café Grão', active: true }, { id: 'c4', name: 'Academia Força', active: true }
  ];
  const mk = (title, who, status, prio, extra = {}) => {
    const id = uid();
    return {
      id, root_id: id, title, description: '', priority: prio, task_date: t, due_date: t, assigned_to: who, created_by: 'u2',
      status, justification: '', completed_at: status === 'finalizada' ? iso(3600e3) : null, carried_from: null,
      client_id: null, stage: status === 'finalizada' ? 'revisao_interna' : 'a_fazer', review_note: '', stage_at: iso(5400e3),
      created_at: iso(8 * 3600e3), ...extra
    };
  };
  const past = (d, title, who, status, extra = {}) => mk(title, who, status, 'media', { task_date: addDays(t, d), due_date: addDays(t, d), ...extra });
  const tasks = [
    mk('Carrossel institucional — 5 slides', 'u1', 'finalizada', 'alta', { client_id: 'c1' }),
    mk('Revisar pauta da semana', 'u1', 'pendente', 'media', { description: 'Conferir as pautas com a Marina antes das 16h.' }),
    mk('Aprovar orçamento do cliente', 'u1', 'incompleta', 'urgente', { justification: 'Aguardando retorno do financeiro.', carried_from: 'x', client_id: 'c2' }),
    mk('Reunião de alinhamento com o time', 'u1', 'pendente', 'baixa', { due_date: addDays(t, 2) }),
    mk('Reels do lançamento', 'u4', 'finalizada', 'alta', { client_id: 'c2' }),
    mk('Corte do podcast ep. 12', 'u4', 'pendente', 'media', { client_id: 'c3' }),
    mk('Peças do feed — novembro', 'u3', 'finalizada', 'media', { client_id: 'c1', stage: 'revisao_cliente' }),
    mk('Logo da campanha de verão', 'u3', 'em_alteracao', 'alta', { client_id: 'c4', stage: 'em_alteracao', review_note: 'Cliente pediu o vermelho mais escuro.' }),
    mk('Stories da promoção', 'u3', 'nao_realizada', 'media', { justification: 'Briefing não chegou.', client_id: 'c3' }),
    mk('Agendar posts da semana', 'u5', 'finalizada', 'media', { client_id: 'c3', stage: 'agendamento' }),
    mk('Relatório de campanhas', 'u6', 'incompleta', 'alta', { justification: 'Falta o dado do Google Ads.', client_id: 'c4' }),
    mk('Subir novos criativos', 'u6', 'finalizada', 'urgente', { client_id: 'c2', stage: 'concluido' }),
    ...[-1, -2, -3, -4].flatMap((d) => [
      past(d, `Post diário ${-d}`, 'u1', 'finalizada', { stage: 'concluido', client_id: 'c1' }),
      past(d, `Ajuste de copy ${-d}`, 'u1', d === -2 ? 'incompleta' : 'finalizada', { stage: 'concluido' }),
      past(d, `Arte promocional ${-d}`, 'u3', d === -3 ? 'nao_realizada' : 'finalizada', { stage: 'concluido', client_id: 'c3' }),
      past(d, `Vídeo curto ${-d}`, 'u4', 'finalizada', { stage: 'concluido', client_id: 'c2' }),
      past(d, `Campanha ${-d}`, 'u6', d === -1 ? 'incompleta' : 'finalizada', { stage: 'concluido', client_id: 'c4' })
    ])
  ];
  const attachments = [{ id: 'a1', root_id: tasks[0].root_id, kind: 'link', url: 'https://www.figma.com', name: 'Figma do carrossel', created_by: 'u1' }];
  const pulses = [
    { id: uid(), user_id: 'u3', answer: 'ok', created_at: iso(5 * 3600e3) },
    { id: uid(), user_id: 'u4', answer: 'ok', created_at: iso(4 * 3600e3) },
    { id: uid(), user_id: 'u5', answer: 'devagar', created_at: iso(3 * 3600e3) },
    { id: uid(), user_id: 'u6', answer: 'ok', created_at: iso(2 * 3600e3) },
    { id: uid(), user_id: 'u3', answer: 'devagar', created_at: iso(3600e3) },
    ...[1, 2, 3, 4, 5, 6].flatMap((d) => ['u3', 'u4', 'u5', 'u6'].map((u, i) => ({ id: uid(), user_id: u, answer: (d + i) % 3 ? 'ok' : 'devagar', created_at: iso(d * 86400e3 + i * 3600e3) })))
  ];
  const messages = [
    { id: uid(), user_id: 'u2', body: 'Bom dia, time! Hoje tem entrega da Clínica Sorriso até as 17h.', created_at: iso(3 * 3600e3) },
    { id: uid(), user_id: 'u3', body: 'Feed já está na revisão interna 🙌', created_at: iso(2.5 * 3600e3) },
    { id: uid(), user_id: 'u5', body: 'Vou agendar os posts do Café Grão depois do almoço.', created_at: iso(3600e3) }
  ];
  let me = people[0];
  const isRev = () => ['admin', 'gestora', 'social_media'].includes(me.role);
  const isMgr = () => ['admin', 'gestora'].includes(me.role);
  const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 90));
  const store = (k, v) => { try { v === undefined ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* */ } };
  const read = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
  let logged = !!read('demo-user');
  if (logged) me = people.find((p) => p.id === read('demo-user')) || people[0];
  let authCb = () => {};
  const msgSubs = new Set();
  const latest = () => {
    const m = new Map();
    [...tasks].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((x) => m.set(x.root_id, x));
    return [...m.values()];
  };
  return {
    demo: true,
    async session() { return logged ? { user: { id: me.id } } : null; },
    onAuth(cb) { authCb = cb; },
    async signIn(email) {
      me = people.find((p) => p.email === email.toLowerCase()) || people[0];
      logged = true; store('demo-user', me.id); authCb({ user: { id: me.id } });
    },
    async signOut() { logged = false; store('demo-user'); authCb(null); },
    async me() { return wait(me); },
    async rollover() {},
    async profiles() { return wait(people.filter((p) => p.role !== 'pendente' && p.active)); },
    async allProfiles() { return wait(people); },
    async tasks({ date, from, to, userId }) {
      return wait(tasks.filter((x) =>
        (!date || x.task_date === date) && (!from || x.task_date >= from) && (!to || x.task_date <= to) &&
        (!userId || x.assigned_to === userId) && (isRev() || x.assigned_to === me.id)));
    },
    async pipeline() { return wait(latest().filter((x) => isRev() || x.assigned_to === me.id)); },
    async createTask(x) {
      const n = mk(x.title, x.assigned_to || me.id, 'pendente', x.priority, { ...x, created_at: new Date().toISOString(), stage: 'a_fazer' });
      if (!isMgr()) n.assigned_to = me.id;
      tasks.push(n); return wait(n);
    },
    async updateTask(id, patch) {
      const x = tasks.find((k) => k.id === id);
      const was = x.status;
      Object.assign(x, patch);
      if (x.status === 'finalizada' && was !== 'finalizada') {
        x.completed_at = new Date().toISOString();
        if (['a_fazer', 'em_alteracao'].includes(x.stage)) { x.stage = 'revisao_interna'; x.stage_at = x.completed_at; }
      } else if (x.status !== 'finalizada') {
        x.completed_at = null;
        if (was === 'finalizada' && x.stage === 'revisao_interna') x.stage = x.review_note ? 'em_alteracao' : 'a_fazer';
      }
      return wait(x);
    },
    async deleteTask(id) { tasks.splice(tasks.findIndex((k) => k.id === id), 1); },
    async review(id, action, note = '', stage = null) {
      const x = tasks.find((k) => k.id === id);
      if (action === 'mover') { Object.assign(x, { stage, stage_at: new Date().toISOString() }); return; }
      const nowIso = new Date().toISOString();
      if (action === 'alterar') {
        if (x.task_date === t && x.status !== 'finalizada') Object.assign(x, { status: 'em_alteracao', stage: 'em_alteracao', review_note: note, stage_at: nowIso });
        else {
          x.stage = 'em_alteracao'; x.stage_at = nowIso;
          tasks.push({ ...x, id: uid(), task_date: t, due_date: x.due_date > t ? x.due_date : t, status: 'em_alteracao', justification: '', review_note: note, completed_at: null, carried_from: null, created_at: nowIso });
        }
        return;
      }
      const nxt = { revisao_interna: 'revisao_cliente', revisao_cliente: 'agendamento', agendamento: 'concluido' }[x.stage];
      Object.assign(x, { stage: nxt, stage_at: nowIso });
    },
    async updateProfile(id, patch) { const p = people.find((k) => k.id === id); Object.assign(p, patch); return wait(p); },
    async uploadPhoto(file) {
      const blob = await squareImage(file);
      me.photo_url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      return wait(me);
    },
    async removePhoto() { me.photo_url = null; return wait(me); },
    async createMember({ name, email, role }) { people.push({ id: uid(), name, email, role, avatar: 'capivara', stars: 0, active: true }); },
    async setMember(id, name, role) { Object.assign(people.find((k) => k.id === id), { name, role }); },
    async clients() { return wait(clients); },
    async createClient(name) { const c = { id: uid(), name, active: true }; clients.push(c); return wait(c); },
    async updateClient(id, patch) { const c = clients.find((k) => k.id === id); Object.assign(c, patch); return wait(c); },
    async attachments(rootId) { return wait(attachments.filter((a) => a.root_id === rootId)); },
    async addLink(rootId, url, name) { const a = { id: uid(), root_id: rootId, kind: 'link', url, name: name || url, created_by: me.id }; attachments.push(a); return wait(a); },
    async addFile(rootId, file) { const a = { id: uid(), root_id: rootId, kind: 'file', path: URL.createObjectURL(file), name: file.name, created_by: me.id }; attachments.push(a); return wait(a); },
    async fileUrl(path) { return path; },
    async deleteAttachment(id) { attachments.splice(attachments.findIndex((a) => a.id === id), 1); },
    async pulse(answer) { pulses.push({ id: uid(), user_id: me.id, answer, created_at: new Date().toISOString() }); },
    async pulses(since) { return wait(pulses.filter((p) => p.created_at >= since && (isMgr() || p.user_id === me.id))); },
    async messages() { return wait(messages); },
    async sendMessage(body) {
      const m = { id: uid(), user_id: me.id, body, created_at: new Date().toISOString() };
      messages.push(m); msgSubs.forEach((cb) => cb({ eventType: 'INSERT', new: m })); return wait(m);
    },
    async deleteMessage(id) { messages.splice(messages.findIndex((m) => m.id === id), 1); msgSubs.forEach((cb) => cb({ eventType: 'DELETE' })); },
    subscribeMessages(cb) { msgSubs.add(cb); return () => msgSubs.delete(cb); }
  };
}

const DEMO = new URLSearchParams(location.search).has('demo');
export const api = DEMO ? demoApi() : supabaseApi();
