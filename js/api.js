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

// PNG/WebP viram JPG de alta qualidade (o Instagram só publica JPG); fundo transparente vira branco
export async function toJpegIfNeeded(file) {
  if (!/^image\/(png|webp)$/i.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
    return new File([blob], file.name.replace(/\.(png|webp)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; } finally { URL.revokeObjectURL(url); }
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
    async allProfiles() { return ok(await sb.from('profiles').select('*').is('removed_at', null).order('name')); },
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
      ok(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }));
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
    async clients() { return ok(await sb.from('clients').select('*').is('removed_at', null).order('name')); },
    async createClient(name) { return ok(await sb.from('clients').insert({ name }).select().single()); },
    async updateClient(id, patch) { return ok(await sb.from('clients').update(patch).eq('id', id).select().single()); },
    async attachments(rootId) { return ok(await sb.from('task_attachments').select('*').eq('root_id', rootId).order('created_at')); },
    async addLink(rootId, url, name) { return ok(await sb.from('task_attachments').insert({ root_id: rootId, kind: 'link', url, name: name || url }).select().single()); },
    async addFile(rootId, original) {
      const file = await toJpegIfNeeded(original);
      const path = `${rootId}/${Date.now()}-${safeName(file.name)}`;
      ok(await sb.storage.from('anexos').upload(path, file, { contentType: file.type || undefined }));
      return ok(await sb.from('task_attachments').insert({ root_id: rootId, kind: 'file', path, name: file.name }).select().single());
    },
    async fileUrl(path) { return sb.storage.from('anexos').getPublicUrl(path).data.publicUrl; },
    async uploadClientLogo(clientId, file) {
      const blob = await squareImage(file, 300);
      const path = `logos/${clientId}-${Date.now()}.jpg`;
      ok(await sb.storage.from('anexos').upload(path, blob, { contentType: 'image/jpeg' }));
      const url = sb.storage.from('anexos').getPublicUrl(path).data.publicUrl;
      return ok(await sb.from('clients').update({ logo_url: url }).eq('id', clientId).select().single());
    },
    async approvalLink(rootId) {
      const d = ok(await sb.from('approval_links').select('*').eq('root_id', rootId).order('created_at', { ascending: false }).limit(1));
      return d[0] || null;
    },
    async newApprovalLink(taskId) { return ok(await sb.rpc('new_approval_link', { p_task: taskId })); },
    // ---- clientes / equipe ----
    async removeClient(id) { ok(await sb.from('clients').update({ removed_at: new Date().toISOString(), active: false }).eq('id', id)); },
    async removeMember(id) { ok(await sb.rpc('remove_member', { p_id: id })); },
    async plans() { return ok(await sb.from('client_plans').select('*')); },
    async savePlan(clientId, plan) { return ok(await sb.from('client_plans').upsert({ client_id: clientId, ...plan, updated_at: new Date().toISOString() }).select().single()); },
    // ---- saldos de anúncios ----
    async adBalances() { return ok(await sb.from('ad_balances').select('*')); },
    async adHistory(clientId) { return ok(await sb.from('ad_balance_history').select('*').eq('client_id', clientId).order('checked_at', { ascending: false }).limit(72)); },
    async refreshBalances() {
      const { data, error } = await sb.functions.invoke('ads-balance', { body: { origem: 'crm' } });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* */ }
        if (/Failed to send|not found|404/i.test(msg)) msg = 'A função "ads-balance" ainda não foi publicada no Supabase.';
        throw new Error(msg);
      }
      return data;
    },
    async setThreshold(clientId, value) { ok(await sb.rpc('set_ad_threshold', { p_client: clientId, p_value: value })); },
    // ---- financeiro (admin) ----
    async financeSync() { return ok(await sb.rpc('finance_sync')); },
    async entries(from, to) {
      return ok(await sb.from('finance_entries').select('*')
        .or(`and(due_date.gte.${from},due_date.lte.${to}),and(paid_at.gte.${from},paid_at.lte.${to})`)
        .order('due_date', { ascending: false }).limit(2000));
    },
    async addEntry(e) { return ok(await sb.from('finance_entries').insert(e).select().single()); },
    async updateEntry(id, patch) { return ok(await sb.from('finance_entries').update(patch).eq('id', id).select().single()); },
    async deleteEntry(id) { ok(await sb.from('finance_entries').delete().eq('id', id)); },
    // ---- metas ----
    async goals() { return ok(await sb.from('goals').select('*').order('end_date', { ascending: false })); },
    async saveGoal(g) { return ok(await sb.from('goals').upsert(g).select().single()); },
    async deleteGoal(id) { ok(await sb.from('goals').delete().eq('id', id)); },
    async goalsProgress() { return ok(await sb.rpc('goals_progress')) || []; },
    async confirmSchedule(id, postAt, caption, format) { ok(await sb.rpc('confirm_schedule', { p_id: id, p_post_at: postAt, p_caption: caption, p_format: format || '' })); },
    async unconfirmSchedule(id) { ok(await sb.rpc('unconfirm_schedule', { p_id: id })); },
    async reports(clientId) {
      return ok(await sb.from('reports').select('id,client_id,kind,period_start,period_end,created_at').eq('client_id', clientId).order('period_start', { ascending: false }).limit(60));
    },
    async lastReports() { return ok(await sb.from('reports').select('client_id,period_start,period_end,created_at').order('created_at', { ascending: false }).limit(300)); },
    async report(id) { return ok(await sb.from('reports').select('*').eq('id', id).single()); },
    async deleteReport(id) { ok(await sb.from('reports').delete().eq('id', id)); },
    async generateReport(clientId, since, until, kind = 'personalizado') {
      const { data, error } = await sb.functions.invoke('meta-report', { body: { client_id: clientId, since, until, kind } });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* */ }
        if (/Failed to send|not found|404/i.test(msg)) msg = 'A função "meta-report" ainda não foi publicada no Supabase.';
        throw new Error(msg);
      }
      return data.report;
    },
    async igAccounts() {
      const { data, error } = await sb.functions.invoke('ig-accounts', { body: {} });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* */ }
        if (/Failed to send|not found|404/i.test(msg)) msg = 'A função "ig-accounts" ainda não foi publicada no Supabase.';
        throw new Error(msg);
      }
      return { accounts: data.accounts || [], adaccounts: data.adaccounts || [], adsError: data.ads_error || '', oldVersion: !('adaccounts' in data) };
    },
    async publishNow(id) {
      ok(await sb.rpc('publish_now', { p_id: id }));
      const { data, error } = await sb.functions.invoke('ig-publish', { body: { origem: 'crm' } });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* */ }
        throw new Error(msg);
      }
      return data;
    },
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
    { id: 'c1', name: 'Clínica Sorriso', active: true, instagram: 'clinicasorriso', ad_account_id: 'act_111', ad_account_name: 'Clínica Sorriso', ad_alert_threshold: 30 }, { id: 'c2', name: 'Studio Nova', active: true, instagram: 'studionova', ad_account_id: 'act_222', ad_account_name: 'Studio Nova', ad_alert_threshold: 30 },
    { id: 'c3', name: 'Café Grão', active: true, instagram: 'cafegrao', ig_user_id: '17841400000000003', ig_username: 'cafegrao', fb_page_id: '1003', fb_page_name: 'Café Grão', ad_account_id: 'act_333', ad_account_name: 'Café Grão - Anúncios', ad_alert_threshold: 30 }, { id: 'c4', name: 'Academia Força', active: true }
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
    mk('Peças do feed — novembro', 'u3', 'finalizada', 'media', { client_id: 'c1', stage: 'revisao_cliente', post_format: 'feed', post_at: new Date(Date.now() + 3 * 86400e3).toISOString(), caption: 'Seu sorriso merece cuidado de verdade 💙' }),
    mk('Logo da campanha de verão', 'u3', 'em_alteracao', 'alta', { client_id: 'c4', stage: 'em_alteracao', review_note: 'Cliente pediu o vermelho mais escuro.' }),
    mk('Stories da promoção', 'u3', 'nao_realizada', 'media', { justification: 'Briefing não chegou.', client_id: 'c3' }),
    mk('Agendar posts da semana', 'u5', 'finalizada', 'media', { client_id: 'c3', stage: 'agendamento', post_format: 'carrossel', post_at: new Date(Date.now() + 2 * 86400e3).toISOString(), caption: 'Café quentinho e grão selecionado ☕️ Passa aqui!\n#cafegrao #cafeespecial' }),
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
  // relatórios de exemplo
  const seeded = (seed) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  function fakeReport(c, since, until) {
    const rnd = seeded(since.split('-').join('') % 9973);
    const days = Math.round((Date.parse(until) - Date.parse(since)) / 864e5) + 1;
    const daily = [...Array(days)].map((_, i) => ({ date: addDays(since, i), value: Math.round(400 + rnd() * 900 + (i % 7 === 5 ? 700 : 0)) }));
    const tot = (k, base) => Math.round(base * (0.8 + rnd() * 0.5));
    const types = ['feed', 'carrossel', 'reels', 'reels', 'carrossel', 'feed', 'story', 'reels'];
    const imgs = ['assets/img/bg-branco.jpg', 'assets/img/og-elevate.jpg', 'assets/img/icon-512.png'];
    const ig = {
      username: c.ig_username || c.instagram || 'cliente', followers: 5321, totals: { reach: tot('r', 21000), views: tot('v', 64000), accounts_engaged: tot('e', 1900), total_interactions: tot('i', 3400), likes: tot('l', 2800), comments: tot('c', 240), shares: tot('s', 180), saves: tot('sv', 310), profile_views: tot('pv', 1500), profile_links_taps: tot('pl', 120), follows: 140, unfollows: 32, reach_by_follow: { FOLLOWER: 8200, NON_FOLLOWER: 12700 }, total_interactions_by_follow: { FOLLOWER: 2300, NON_FOLLOWER: 1100 }, taps_by_button: { UNDEFINED: 29, DIRECTION: 1, CALL: 4, TEXT: 12 } },
      prevTotals: { reach: 18000, views: 61000, accounts_engaged: 2100, total_interactions: 3000, likes: 2500, comments: 260, shares: 150, saves: 280, profile_views: 1400, profile_links_taps: 90 },
      daily, errors: [],
      posts: types.map((t, i) => ({ id: 'p' + i, type: t, caption: ['Café da manhã com vista pro mar ☀️', 'Conheça nossas suítes renovadas', 'Bastidores do fim de semana', 'Promoção de feriado: 3 noites pelo preço de 2', 'Roteiro: 5 praias perto da pousada', 'Depoimento de hóspede', 'Story: check-in', 'Pôr do sol de ontem'][i], date: addDays(since, Math.min(days - 1, i * 3 + 1)) + 'T15:00:00Z', permalink: 'https://www.instagram.com/', thumb: imgs[i % 3], likes: Math.round(80 + rnd() * 400), comments: Math.round(rnd() * 40), reach: Math.round(900 + rnd() * 5000), saves: Math.round(rnd() * 60), shares: Math.round(rnd() * 30) }))
    };
    const fb = { name: c.fb_page_name || c.name, followers: 1830, totals: { page_media_view: tot('fv', 9800), page_post_engagements: tot('fe', 640), page_daily_follows_unique: 24, page_total_actions: 41 }, prevTotals: { page_media_view: 10400, page_post_engagements: 590, page_daily_follows_unique: 18 }, daily: daily.map((x) => ({ date: x.date, value: Math.round(x.value / 3) })), errors: [],
      posts: [0, 1, 2, 3].map((i) => ({ id: 'f' + i, caption: ['Pacote de fim de ano já disponível', 'Nossa piscina aquecida', 'Vagas para o Réveillon', 'Bem-vindos, novos hóspedes!'][i], date: addDays(since, i * 6 + 2) + 'T12:00:00Z', permalink: 'https://www.facebook.com/', thumb: imgs[(i + 1) % 3], reactions: Math.round(20 + rnd() * 120), comments: Math.round(rnd() * 20), shares: Math.round(rnd() * 10) })) };
    const len = days;
    const sum = (o) => o;
    const ads = c.ad_account_id ? {
      name: c.ad_account_name || 'Conta de anúncios', currency: 'BRL',
      totals: sum({ spend: 241.57, reach: 10444, impressions: 23111, frequency: 2.21, clicks: 363, link_clicks: 153, conversations: 33, leads: 0, purchases: 0, result_label: 'Conversas iniciadas', results: 33, cost_per_result: 7.32, ctr: 1.57, cpm: 10.45 }),
      prevTotals: { spend: 210, reach: 9800, impressions: 20500, frequency: 2.09, clicks: 301, link_clicks: 120, conversations: 25, results: 25, cost_per_result: 8.4 },
      daily: daily.map((x) => ({ date: x.date, value: Math.round((5 + rnd() * 6) * 100) / 100 })),
      campaigns: [
        { name: '[MSG] Pacotes de fim de semana', spend: 140.2, results: 21, result_label: 'Conversas iniciadas', cost_per_result: 6.68 },
        { name: '[MSG] Suítes temáticas', spend: 71.37, results: 12, result_label: 'Conversas iniciadas', cost_per_result: 5.95 },
        { name: '[ALCANCE] Perfil', spend: 30, results: 61, result_label: 'Cliques no link', cost_per_result: 0.49 }
      ], errors: [] } : { unavailable: 'A conta de anúncios deste cliente ainda não foi vinculada (Equipe → Clientes → botão do Instagram → Conta de anúncios).' };
    return { client: { id: c.id, name: c.name, logo_url: c.logo_url }, since, until, prev: { since: addDays(since, -len), until: addDays(since, -1) }, ig, fb, ads, generated_at: new Date().toISOString() };
  }
  const plans = [
    { client_id: 'c1', plan_type: 'recorrente', plan_name: 'Plano Social', plan_value: 1800, billing_day: 5, start_date: '2026-01-10' },
    { client_id: 'c2', plan_type: 'recorrente', plan_name: 'Plano Completo', plan_value: 3200, billing_day: 10, start_date: '2026-03-01' },
    { client_id: 'c3', plan_type: 'recorrente', plan_name: 'Plano Social + Tráfego', plan_value: 2400, billing_day: 15, start_date: '2026-05-01' },
    { client_id: 'c4', plan_type: 'avulso', plan_name: '', plan_value: 0, billing_day: 10, start_date: '2026-08-01' }
  ];
  const entries = [
    { id: 'e1', kind: 'receita', source: 'avulso', client_id: 'c4', description: 'Ensaio fotográfico · Academia Força', category: 'Serviço avulso', amount: 950, due_date: addDays(t, -12), paid_at: addDays(t, -10), status: 'pago', notes: '' },
    { id: 'e2', kind: 'custo', source: 'manual', client_id: null, description: 'Adobe Creative Cloud', category: 'Software', amount: 289.9, due_date: addDays(t, -8), paid_at: addDays(t, -8), status: 'pago', notes: '' },
    { id: 'e3', kind: 'custo', source: 'manual', client_id: null, description: 'Freelancer de vídeo', category: 'Terceiros', amount: 600, due_date: addDays(t, 6), paid_at: null, status: 'pendente', notes: '' }
  ];
  const ym = t.slice(0, 7);
  const goals = [
    { id: 'g1', title: 'Faturamento do mês', metric: 'faturamento', period: 'mes', start_date: ym + '-01', end_date: addDays(addDays(ym + '-01', 32).slice(0, 7) + '-01', -1), target: 12000 },
    { id: 'g2', title: 'Clientes recorrentes no ano', metric: 'clientes', period: 'ano', start_date: t.slice(0, 4) + '-01-01', end_date: t.slice(0, 4) + '-12-31', target: 10 }
  ];
  const balances = [
    { client_id: 'c3', account_id: 'act_333', account_name: 'Café Grão - Anúncios', currency: 'BRL', kind: 'prepago', available: 22.4, spend_cap: null, amount_spent: 1830.5, account_status: 1, low: true, error: '', checked_at: new Date(Date.now() - 1200e3).toISOString() },
    { client_id: 'c1', account_id: 'act_111', account_name: 'Clínica Sorriso', currency: 'BRL', kind: 'cartao', available: null, spend_cap: null, amount_spent: 5320, account_status: 1, low: false, error: '', checked_at: new Date(Date.now() - 1200e3).toISOString() },
    { client_id: 'c2', account_id: 'act_222', account_name: 'Studio Nova', currency: 'BRL', kind: 'prepago', available: 184.9, spend_cap: null, amount_spent: 2210, account_status: 1, low: false, error: '', checked_at: new Date(Date.now() - 1200e3).toISOString() }
  ];
  // agendamento automático ao entrar em "Agendamento" com data de postagem
  function autoSchedule(x) {
    if (x.stage !== 'agendamento' || x.scheduled_at || !x.post_at) return;
    const cli = clients.find((c) => c.id === x.client_id);
    Object.assign(x, { scheduled_at: new Date().toISOString(), scheduled_by: x.created_by, publish_status: cli?.ig_user_id ? 'fila' : null, publish_error: '' });
  }
  const demoReports = [];
  [1, 2].forEach((k) => {
    const first = new Date(); first.setUTCDate(1); first.setUTCMonth(first.getUTCMonth() - k);
    const since = first.toISOString().slice(0, 10);
    const end = new Date(first); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
    const until = end.toISOString().slice(0, 10);
    const c = clients.find((x) => x.id === 'c3');
    demoReports.push({ id: 'rep' + k, client_id: 'c3', kind: 'mensal', period_start: since, period_end: until, created_at: new Date().toISOString(), data: fakeReport(c, since, until) });
  });
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
    async profiles() { return wait(people.filter((p) => p.role !== 'pendente' && p.active && !p.removed_at)); },
    async allProfiles() { return wait(people.filter((p) => !p.removed_at)); },
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
      if (action === 'mover') { Object.assign(x, { stage, stage_at: new Date().toISOString() }); autoSchedule(x); return; }
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
      autoSchedule(x);
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
    async clients() { return wait(clients.filter((c) => !c.removed_at)); },
    async createClient(name) { const c = { id: uid(), name, active: true }; clients.push(c); return wait(c); },
    async updateClient(id, patch) { const c = clients.find((k) => k.id === id); Object.assign(c, patch); return wait(c); },
    async attachments(rootId) { return wait(attachments.filter((a) => a.root_id === rootId)); },
    async addLink(rootId, url, name) { const a = { id: uid(), root_id: rootId, kind: 'link', url, name: name || url, created_by: me.id }; attachments.push(a); return wait(a); },
    async addFile(rootId, file) { const a = { id: uid(), root_id: rootId, kind: 'file', path: URL.createObjectURL(file), name: file.name, created_by: me.id }; attachments.push(a); return wait(a); },
    async fileUrl(path) { return path; },
    async uploadClientLogo(clientId, file) {
      const blob = await squareImage(file, 300);
      const c = clients.find((k) => k.id === clientId);
      c.logo_url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      return wait(c);
    },
    async approvalLink(rootId) {
      const x = latest().find((k) => k.root_id === rootId);
      return x && x.stage === 'revisao_cliente' ? { token: 'demo', root_id: rootId, created_at: x.stage_at, expires_at: new Date(Date.now() + 6 * 86400e3).toISOString(), used_at: null } : null;
    },
    async newApprovalLink() { return 'demo'; },
    async removeClient(id) { Object.assign(clients.find((c) => c.id === id), { removed_at: new Date().toISOString(), active: false }); },
    async removeMember(id) { Object.assign(people.find((x) => x.id === id), { removed_at: new Date().toISOString(), active: false }); },
    async plans() { return wait(plans); },
    async savePlan(clientId, plan) { const i = plans.findIndex((x) => x.client_id === clientId); const row = { client_id: clientId, ...plan }; if (i >= 0) plans[i] = { ...plans[i], ...row }; else plans.push(row); return wait(row); },
    async adBalances() { return wait(balances); },
    async adHistory(clientId) { return wait([...Array(24)].map((_, i) => ({ client_id: clientId, available: Math.max(0, (balances.find((b) => b.client_id === clientId)?.available ?? 0) + i * 4.2), checked_at: new Date(Date.now() - i * 3600e3).toISOString() }))); },
    async refreshBalances() { await new Promise((r) => setTimeout(r, 600)); balances.forEach((b) => (b.checked_at = new Date().toISOString())); return { atualizados: balances.length, baixos: balances.filter((b) => b.low).length }; },
    async setThreshold(clientId, value) { const c = clients.find((x) => x.id === clientId); c.ad_alert_threshold = value; const b = balances.find((x) => x.client_id === clientId); if (b) b.low = b.available !== null && b.available <= value; },
    async financeSync() {
      const cur = todayBR().slice(0, 7) + '-01';
      plans.filter((p) => p.plan_type === 'recorrente' && p.plan_value > 0).forEach((p) => {
        for (let k = 2; k >= 0; k--) {
          const d = new Date(cur + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - k); const comp = d.toISOString().slice(0, 10);
          if (comp < p.start_date.slice(0, 7) + '-01') continue;
          if (!entries.some((e) => e.source === 'plano' && e.client_id === p.client_id && e.competence === comp)) {
            const c = clients.find((x) => x.id === p.client_id);
            entries.push({ id: uid(), kind: 'receita', source: 'plano', client_id: p.client_id, competence: comp, description: `${p.plan_name || 'Plano mensal'} · ${c.name}`, category: 'Plano recorrente', amount: p.plan_value, due_date: comp.slice(0, 8) + String(p.billing_day).padStart(2, '0'), paid_at: k > 0 ? comp.slice(0, 8) + String(p.billing_day).padStart(2, '0') : null, status: k > 0 ? 'pago' : 'pendente', notes: '' });
          }
        }
      });
      return 0;
    },
    async entries(from, to) { return wait(entries.filter((e) => (e.due_date >= from && e.due_date <= to) || (e.paid_at && e.paid_at >= from && e.paid_at <= to))); },
    async addEntry(e) { const row = { id: uid(), status: 'pendente', notes: '', source: 'manual', ...e }; entries.push(row); return wait(row); },
    async updateEntry(id, patch) { const e = entries.find((x) => x.id === id); Object.assign(e, patch); return wait(e); },
    async deleteEntry(id) { entries.splice(entries.findIndex((x) => x.id === id), 1); },
    async goals() { return wait(goals); },
    async saveGoal(g) { if (g.id) { Object.assign(goals.find((x) => x.id === g.id), g); return wait(g); } const row = { ...g, id: uid() }; goals.push(row); return wait(row); },
    async deleteGoal(id) { goals.splice(goals.findIndex((x) => x.id === id), 1); },
    async goalsProgress() {
      const t = todayBR();
      return wait(goals.filter((g) => g.end_date >= addDays(t, -31)).map((g) => ({ ...g, current: g.metric === 'faturamento'
        ? entries.filter((e) => e.kind === 'receita' && e.status === 'pago' && e.paid_at >= g.start_date && e.paid_at <= g.end_date).reduce((a, e) => a + Number(e.amount), 0)
        : plans.filter((p) => p.plan_type === 'recorrente' && !clients.find((c) => c.id === p.client_id)?.removed_at).length })));
    },
    async confirmSchedule(id, postAt, caption, format) {
      const x = tasks.find((k) => k.id === id);
      const cli = clients.find((c) => c.id === x.client_id);
      tasks.filter((k) => k.root_id === x.root_id).forEach((k) => Object.assign(k, { post_at: postAt, caption, post_format: format || null, scheduled_at: new Date().toISOString(), scheduled_by: me.id, publish_status: cli?.ig_user_id ? 'fila' : null, publish_error: '' }));
    },
    async reports(clientId) { return wait(demoReports.filter((r) => r.client_id === clientId)); },
    async lastReports() { return wait(demoReports); },
    async report(id) { return wait(demoReports.find((r) => r.id === id)); },
    async deleteReport(id) { demoReports.splice(demoReports.findIndex((r) => r.id === id), 1); },
    async generateReport(clientId, since, until, kind = 'personalizado') {
      await new Promise((r) => setTimeout(r, 700));
      const c = clients.find((k) => k.id === clientId);
      const r = { id: uid(), client_id: clientId, kind, period_start: since, period_end: until, created_at: new Date().toISOString(), data: fakeReport(c, since, until) };
      demoReports.unshift(r); return wait(r);
    },
    async igAccounts() {
      await new Promise((r) => setTimeout(r, 500));
      return {
        accounts: [{ id: '17841400000000001', username: 'a2pousadaap', page: 'A2 Pousada', page_id: '1001', picture: '' }, { id: '17841400000000002', username: 'fisioclinic', page: 'Fisioclinic', page_id: '1002', picture: '' }, { id: '', username: '', page: 'Conta Livre', page_id: '1009', picture: '' }],
        adaccounts: [{ id: 'act_111', name: 'A2 Pousada - Anúncios', currency: 'BRL' }, { id: 'act_222', name: 'Fisioclinic', currency: 'BRL' }]
      };
    },
    async publishNow(id) {
      const x = tasks.find((k) => k.id === id);
      const nowIso = new Date().toISOString();
      tasks.filter((k) => k.root_id === x.root_id).forEach((k) => Object.assign(k, { publish_status: 'publicado', ig_permalink: 'https://www.instagram.com/', published_at: nowIso, stage: 'concluido', stage_at: nowIso }));
      return { verificados: 1 };
    },
    async unconfirmSchedule(id) {
      const x = tasks.find((k) => k.id === id);
      tasks.filter((k) => k.root_id === x.root_id).forEach((k) => Object.assign(k, { scheduled_at: null, scheduled_by: null }));
    },
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
