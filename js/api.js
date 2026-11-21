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
  if (/Sem permiss/i.test(msg)) return 'Você não tem permissão para isso.';
  return msg;
}

// ---------------------------------------------------------------------
// Supabase (produção)
// ---------------------------------------------------------------------
function supabaseApi() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  return {
    demo: false,
    async session() { return (await sb.auth.getSession()).data.session; },
    onAuth(cb) { sb.auth.onAuthStateChange((_e, s) => cb(s)); },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async me() {
      const { data: { user } } = await sb.auth.getUser();
      return ok(await sb.from('profiles').select('*').eq('id', user.id).single());
    },
    async rollover() { await sb.rpc('daily_rollover'); },
    async profiles() {
      return ok(await sb.from('profiles').select('*').neq('role', 'pendente').order('name'));
    },
    async allProfiles() { return ok(await sb.from('profiles').select('*').order('name')); },
    async tasks({ date, from, to, userId }) {
      let q = sb.from('tasks').select('*').order('created_at');
      if (date) q = q.eq('task_date', date);
      if (from) q = q.gte('task_date', from);
      if (to) q = q.lte('task_date', to);
      if (userId) q = q.eq('assigned_to', userId);
      return ok(await q);
    },
    async createTask(t) { return ok(await sb.from('tasks').insert(t).select().single()); },
    async updateTask(id, patch) { return ok(await sb.from('tasks').update(patch).eq('id', id).select().single()); },
    async deleteTask(id) { ok(await sb.from('tasks').delete().eq('id', id)); },
    async updateProfile(id, patch) { return ok(await sb.from('profiles').update(patch).eq('id', id).select().single()); },
    async createMember({ name, email, password, role }) {
      // cliente separado, para não trocar a sessão de quem está cadastrando
      const tmp = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: 'tmp-signup' }
      });
      const data = ok(await tmp.auth.signUp({ email, password, options: { data: { name } } }));
      if (!data.user) throw new Error('Não foi possível criar o usuário.');
      ok(await sb.rpc('set_member', { p_id: data.user.id, p_name: name, p_role: role }));
    },
    async setMember(id, name, role) { ok(await sb.rpc('set_member', { p_id: id, p_name: name, p_role: role })); }
  };
}

// ---------------------------------------------------------------------
// Modo demonstração (?demo na URL) — dados de exemplo no navegador
// ---------------------------------------------------------------------
function demoApi() {
  const t = todayBR();
  const uid = () => Math.random().toString(36).slice(2, 10);
  const people = [
    { id: 'u1', name: 'Isaac', role: 'admin', avatar: 'capivara', stars: 12, email: 'admin@elevate.com', active: true },
    { id: 'u2', name: 'Marina', role: 'gestora', avatar: 'coruja', stars: 18, email: 'marina@elevate.com', active: true },
    { id: 'u3', name: 'Lucas', role: 'designer', avatar: 'gato', stars: 9, email: 'lucas@elevate.com', active: true },
    { id: 'u4', name: 'Bia', role: 'editor', avatar: 'raposa', stars: 15, email: 'bia@elevate.com', active: true },
    { id: 'u5', name: 'Rafa', role: 'social_media', avatar: 'sapo', stars: 7, email: 'rafa@elevate.com', active: true },
    { id: 'u6', name: 'Duda', role: 'trafego', avatar: 'panda', stars: 11, email: 'duda@elevate.com', active: true }
  ];
  const mk = (title, who, status, prio, extra = {}) => ({
    id: uid(), title, description: '', priority: prio, task_date: t, due_date: t,
    assigned_to: who, created_by: 'u2', status, justification: '', completed_at: status === 'finalizada' ? new Date().toISOString() : null,
    carried_from: null, created_at: new Date().toISOString(), ...extra
  });
  const tasks = [
    mk('Carrossel institucional — 5 slides', 'u1', 'finalizada', 'alta'),
    mk('Revisar pauta da semana', 'u1', 'pendente', 'media', { description: 'Conferir as pautas com a Marina antes das 16h.' }),
    mk('Aprovar orçamento do cliente Nova', 'u1', 'parcial', 'urgente', { justification: 'Aguardando retorno do financeiro.', carried_from: 'x' }),
    mk('Reunião de alinhamento com o time', 'u1', 'pendente', 'baixa', { due_date: addDays(t, 2) }),
    mk('Reels do lançamento', 'u4', 'finalizada', 'alta'),
    mk('Corte do podcast ep. 12', 'u4', 'pendente', 'media'),
    mk('Peças do feed — clínica', 'u3', 'finalizada', 'media'),
    mk('Logo da campanha de verão', 'u3', 'nao_realizada', 'alta', { justification: 'Briefing não chegou.' }),
    mk('Agendar posts da semana', 'u5', 'finalizada', 'media'),
    mk('Relatório de campanhas', 'u6', 'parcial', 'alta', { justification: 'Falta o dado do Google Ads.' }),
    mk('Subir novos criativos', 'u6', 'finalizada', 'urgente')
  ];
  let me = people[0];
  const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));
  let logged = sessionStorage.getItem('demo-logged') === '1';
  let authCb = () => {};
  return {
    demo: true,
    async session() { return logged ? { user: { id: me.id } } : null; },
    onAuth(cb) { authCb = cb; },
    async signIn(email) {
      me = people.find((p) => p.email === email) || people[0];
      logged = true; sessionStorage.setItem('demo-logged', '1'); authCb({ user: { id: me.id } });
    },
    async signOut() { logged = false; sessionStorage.removeItem('demo-logged'); authCb(null); },
    async me() { return wait(me); },
    async rollover() {},
    async profiles() { return wait(people.filter((p) => p.role !== 'pendente')); },
    async allProfiles() { return wait(people); },
    async tasks({ date, from, to, userId }) {
      const mgr = ['admin', 'gestora'].includes(me.role);
      return wait(tasks.filter((x) =>
        (!date || x.task_date === date) && (!from || x.task_date >= from) && (!to || x.task_date <= to) &&
        (!userId || x.assigned_to === userId) && (mgr || x.assigned_to === me.id)));
    },
    async createTask(x) {
      const n = mk(x.title, x.assigned_to || me.id, 'pendente', x.priority, x);
      if (!['admin', 'gestora'].includes(me.role)) n.assigned_to = me.id;
      tasks.push(n); return wait(n);
    },
    async updateTask(id, patch) {
      const x = tasks.find((k) => k.id === id); Object.assign(x, patch);
      x.completed_at = x.status === 'finalizada' ? new Date().toISOString() : null;
      return wait(x);
    },
    async deleteTask(id) { tasks.splice(tasks.findIndex((k) => k.id === id), 1); },
    async updateProfile(id, patch) { const p = people.find((k) => k.id === id); Object.assign(p, patch); return wait(p); },
    async createMember({ name, email, role }) {
      people.push({ id: uid(), name, email, role, avatar: 'capivara', stars: 0, active: true });
    },
    async setMember(id, name, role) { Object.assign(people.find((k) => k.id === id), { name, role }); }
  };
}

const DEMO = new URLSearchParams(location.search).has('demo');
const createClient = (...a) => window.supabase.createClient(...a);
export const api = DEMO ? demoApi() : supabaseApi();
