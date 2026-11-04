/* Trang quản trị: kết nối TikTok, giả lập, chọn game, cài đặt game, giọng đọc. */
const socket = io({ query: { role: 'admin' } });
const $ = id => document.getElementById(id);
let state = null;

function toast(msg, isErr = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = isErr ? 'err' : '';
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2600);
}

function send(event, payload, okMsg) {
  socket.emit(event, payload, res => {
    if (!res) return;
    if (!res.ok) toast(res.error || 'Có lỗi', true);
    else if (okMsg) toast(okMsg);
  });
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- Render ----------------
function renderStats(stats) {
  $('stats').innerHTML =
    `👋 <b>${stats.join}</b> vào · 💬 <b>${stats.chat}</b> bình luận · ❤️ <b>${stats.like}</b> tim · ⭐ <b>${stats.follow}</b> follow · 🔁 <b>${stats.share}</b> share · 🎁 <b>${stats.gift}</b> quà (<b>${stats.coins}</b> xu)`;
}

function renderTikTok(t) {
  const el = $('tt-status');
  const map = { connected: ['ok', `Đã kết nối @${t.username}`], connecting: ['warn', `Đang kết nối @${t.username}…`], error: ['err', t.error || 'Lỗi'], disconnected: ['', t.error || 'Chưa kết nối'] };
  const [cls, text] = map[t.status] || ['', t.status];
  el.className = `status ${cls}`;
  el.textContent = text;
  if (document.activeElement !== $('tt-user') && !$('tt-user').value) $('tt-user').value = t.username || '';
  $('tt-key').placeholder = t.hasKey ? 'Đã lưu key (dán key mới để thay)' : 'Dán API key rồi bấm Kết nối';
}

function renderSim(sim) {
  $('sim-toggle').textContent = sim.running ? 'Dừng giả lập' : 'Bắt đầu';
  $('sim-toggle').className = sim.running ? 'danger' : 'primary';
}

function renderTtsStatus(s) {
  const el = $('tts-status');
  const via = s.lastProvider ? `[${s.lastProvider === 'kokoro' ? 'Kokoro' : 'Edge'}] ` : '';
  const busy = s.playing ? `Đang đọc: "${s.playing}" · chờ: ${s.queued}` : `Rảnh · chờ: ${s.queued}`;
  if (s.lastError) { el.className = 'status err'; el.textContent = `${via}${busy} — Lỗi: ${s.lastError}`; return; }
  el.className = 'status';
  el.textContent = via + busy;
}

function renderGame() {
  const sel = $('game-select');
  sel.innerHTML = state.games.map(g => `<option value="${esc(g.id)}" ${g.id === state.activeGame ? 'selected' : ''}>${esc(g.name)}${g.id === state.activeGame ? ' (đang chạy)' : ''}</option>`).join('');
  const g = state.games.find(x => x.id === sel.value);
  $('game-desc').textContent = g ? g.description : '';

  // Form cài đặt sinh tự động từ settings + settingsSchema của game
  const form = $('game-settings');
  if (form.contains(document.activeElement)) return; // đang gõ thì không vẽ lại
  const schema = state.gameSchema || {};
  form.innerHTML = Object.entries(state.gameSettings || {}).map(([k, v]) => {
    const sc = schema[k] || {};
    const label = esc(sc.label || k);
    if (Array.isArray(sc.options)) {
      const opts = sc.options.map(([val, text]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(text)}</option>`).join('');
      return `<label for="s-${k}">${label}</label><select id="s-${k}" name="${k}">${opts}</select>`;
    }
    if (typeof v === 'boolean') return `<label for="s-${k}">${label}</label><input id="s-${k}" name="${k}" type="checkbox" ${v ? 'checked' : ''} />`;
    if (typeof v === 'number') return `<label for="s-${k}">${label}</label><input id="s-${k}" name="${k}" type="number" value="${v}" ${sc.min !== undefined ? `min="${sc.min}"` : ''} ${sc.max !== undefined ? `max="${sc.max}"` : ''} step="${sc.step || 'any'}" />`;
    return `<label for="s-${k}">${label}</label><input id="s-${k}" name="${k}" type="text" value="${esc(v)}" />`;
  }).join('') + (Object.keys(state.gameSettings || {}).length ? '<div class="full"><button class="primary" type="submit">Lưu cài đặt game</button></div>' : '');

  $('game-actions').innerHTML = (state.gameActions || []).map(a =>
    `<button data-action="${esc(a.id)}" data-confirm="${esc(a.confirm || '')}" class="${a.danger ? 'danger' : ''}">${esc(a.label)}</button>`).join('');
}

let kokoroVoicesLoaded = false;
function renderTts(t) {
  $('tts-enabled').checked = !!t.enabled;
  $('tts-provider').value = t.provider;
  $('tts-kokoro-box').hidden = t.provider !== 'kokoro';
  $('tts-edge-box').hidden = t.provider !== 'edge';
  $('tts-fallback').checked = !!t.fallbackToEdge;
  if (document.activeElement !== $('tts-kspeed')) $('tts-kspeed').value = t.kokoroSpeed;
  const ksel = $('tts-kvoice');
  if (![...ksel.options].some(o => o.value === t.kokoroVoice)) ksel.add(new Option(t.kokoroVoice, t.kokoroVoice));
  ksel.value = t.kokoroVoice;
  $('tts-voice').value = t.voice;
  $('tts-rate').value = t.rate;
  if (t.provider === 'kokoro' && !kokoroVoicesLoaded) loadKokoroVoices(true);
}

function loadKokoroVoices(silent) {
  kokoroVoicesLoaded = true;
  socket.emit('tts:kokoroVoices', null, res => {
    if (!res || !res.ok) { if (!silent) toast(res ? res.error : 'Lỗi', true); return; }
    const sel = $('tts-kvoice');
    const cur = state ? state.tts.kokoroVoice : sel.value;
    sel.innerHTML = res.result.map(v => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('');
    if (cur) sel.value = cur;
    if (!silent) toast(`Đã tải ${res.result.length} giọng Kokoro`);
  });
}

const TYPE_ICON = { join: '👋', chat: '💬', like: '❤️', gift: '🎁', follow: '⭐', share: '🔁' };
function logLine(e) {
  const time = new Date(e.ts).toLocaleTimeString('vi-VN');
  let detail = '';
  if (e.type === 'chat') detail = `: ${esc(e.text)}${e.flagged ? ' <span class="flag">(đã lọc)</span>' : ''}`;
  if (e.type === 'like') detail = ` thả ${e.count} tim`;
  if (e.type === 'gift') detail = ` tặng ${esc(e.giftName)} (${e.coins} xu)`;
  if (e.type === 'join') detail = ' vào live';
  if (e.type === 'follow') detail = ' đã follow';
  if (e.type === 'share') detail = ' đã chia sẻ';
  const src = e.source === 'simulator' ? ' <span class="hint">[giả lập]</span>' : '';
  return `<li><span class="t">${time}</span><span>${TYPE_ICON[e.type] || ''} <b>${esc(e.user.name)}</b>${detail}${src}</span></li>`;
}

function renderMusic() {
  const m = state.music;
  $('mu-enabled').checked = !!m.enabled;
  $('mu-source').value = m.source;
  $('mu-duck').checked = !!m.duck;
  if (document.activeElement !== $('mu-volume')) $('mu-volume').value = m.volume;
  $('mu-volume-val').textContent = `${Math.round(m.volume * 100)}%`;
  const style = state.gameMusic === 'upbeat' ? 'sôi động' : 'êm dịu';
  const n = (state.musicFiles || []).length;
  $('mu-info').textContent = m.source === 'files'
    ? (n ? `Đang dùng ${n} file nhạc cho game này.` : 'Chưa có file nào trong music/<id-game>/ hoặc music/shared/ — đang tạm dùng nhạc tự tạo.')
    : `Game này dùng phong cách ${style}. Nhạc tự sinh ra lúc chạy nên không dính bản quyền. Mở overlay ở tab riêng để nghe.`;
}

function renderAll() {
  renderMusic();
  renderStats(state.stats);
  renderTikTok(state.tiktok);
  renderSim(state.sim);
  renderGame();
  renderTts(state.tts);
  renderTtsStatus(state.ttsStatus);
  if (document.activeElement !== $('banned')) $('banned').value = (state.extraBannedWords || []).join('\n');
  $('log').innerHTML = state.recentEvents.map(logLine).join('');
}

// ---------------- Socket ----------------
socket.on('admin:state', s => { state = s; renderAll(); });
socket.on('admin:tick', ({ stats, ttsStatus }) => { renderStats(stats); renderTtsStatus(ttsStatus); });
socket.on('tiktok:status', s => { if (state) { Object.assign(state.tiktok, s); renderTikTok(state.tiktok); } });
socket.on('sim:status', s => { if (state) { state.sim = s; renderSim(s); } });
socket.on('event:log', e => {
  const log = $('log');
  log.insertAdjacentHTML('afterbegin', logLine(e));
  while (log.children.length > 80) log.lastChild.remove();
});

// ---------------- Controls ----------------
$('tt-connect').onclick = () => {
  send('tiktok:connect', { username: $('tt-user').value, signApiKey: $('tt-key').value });
  $('tt-key').value = '';
};
$('tt-disconnect').onclick = () => send('tiktok:disconnect');

$('sim-speed').oninput = e => ($('sim-speed-val').textContent = `${e.target.value}x`);
$('sim-toggle').onclick = () => (state && state.sim.running ? send('sim:stop') : send('sim:start', { speed: $('sim-speed').value }));
document.querySelectorAll('[data-sim]').forEach(b => (b.onclick = () => send('sim:event', { type: b.dataset.sim, newUser: b.dataset.sim === 'join' })));
document.querySelectorAll('[data-gift]').forEach(b => (b.onclick = () => send('sim:event', { type: 'gift', coins: Number(b.dataset.gift) })));

$('game-select').onchange = () => {
  const g = state.games.find(x => x.id === $('game-select').value);
  $('game-desc').textContent = g ? g.description : '';
};
$('game-activate').onclick = () => send('game:activate', { id: $('game-select').value }, 'Đã đổi game');
$('game-settings').onsubmit = e => {
  e.preventDefault();
  const patch = {};
  for (const input of e.target.querySelectorAll('input, select')) patch[input.name] = input.type === 'checkbox' ? input.checked : input.value;
  document.activeElement.blur();
  send('game:settings', { patch }, 'Đã lưu cài đặt game');
};
$('game-actions').onclick = e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  send('game:action', { action: b.dataset.action }, 'Xong');
};

const saveTts = () => send('tts:settings', {
  enabled: $('tts-enabled').checked,
  provider: $('tts-provider').value,
  fallbackToEdge: $('tts-fallback').checked,
  kokoroVoice: $('tts-kvoice').value,
  kokoroSpeed: $('tts-kspeed').value,
  voice: $('tts-voice').value,
  rate: $('tts-rate').value,
}, 'Đã lưu giọng đọc');
['tts-enabled', 'tts-provider', 'tts-fallback', 'tts-kvoice', 'tts-kspeed', 'tts-voice', 'tts-rate'].forEach(id => ($(id).onchange = saveTts));
$('tts-kreload').onclick = () => loadKokoroVoices(false);
$('tts-test').onclick = () => send('tts:test', { text: $('tts-text').value });
$('tts-clear').onclick = () => send('tts:clear', null, 'Đã xoá hàng đợi');
const saveMusic = () => send('music:settings', {
  enabled: $('mu-enabled').checked,
  source: $('mu-source').value,
  duck: $('mu-duck').checked,
  volume: $('mu-volume').value,
});
['mu-enabled', 'mu-source', 'mu-duck'].forEach(id => ($(id).onchange = saveMusic));
$('mu-volume').oninput = () => ($('mu-volume-val').textContent = `${Math.round($('mu-volume').value * 100)}%`);
$('mu-volume').onchange = saveMusic;
$('mu-rescan').onclick = () => send('music:rescan', null, 'Đã quét lại thư mục nhạc');
$('banned-save').onclick = () => send('safety:words', { words: $('banned').value }, 'Đã lưu từ cấm');
