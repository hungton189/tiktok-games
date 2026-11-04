'use strict';
/**
 * Live TikTok Games — server chính.
 *
 *   Connector (TikTok / Giả lập) ──► làm sạch (Safety) ──► GameManager ──► game đang chạy
 *                                                              │
 *                                       Socket.io ◄────────────┘──► Overlay (OBS) + Admin
 *
 * Chạy: npm start  =>  Overlay: http://localhost:3000/overlay.html   Admin: http://localhost:3000/admin.html
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { Store } = require('./core/store');
const { Safety } = require('./core/safety');
const { TtsQueue } = require('./core/tts');
const { GameManager } = require('./core/gameManager');
const { TikTokConnector } = require('./core/connectors/tiktok');
const { SimulatorConnector } = require('./core/connectors/simulator');
const { KokoroProcess } = require('./core/kokoroProcess');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const GAMES_DIR = path.join(ROOT, 'games');
const MUSIC_DIR = path.join(ROOT, 'music');
const PORT = Number(process.env.PORT) || 3000;

// ---------- Cài đặt chung (data/settings.json) ----------
const DEFAULT_TTS = {
  enabled: true,
  provider: 'kokoro', // 'kokoro' (chạy trên máy) | 'edge' (Microsoft, cần Internet)
  fallbackToEdge: true, // Kokoro lỗi thì tự dùng Edge
  kokoroUrl: 'http://127.0.0.1:5005',
  kokoroVoice: 'diem_trinh',
  kokoroSpeed: 1.0,
  voice: 'vi-VN-HoaiMyNeural', // giọng Edge
  rate: '+0%', // tốc độ Edge
  maxQueue: 6,
};
const settings = new Store(DATA_DIR, 'settings', {
  activeGame: 'aquarium',
  tts: DEFAULT_TTS,
  tiktok: { username: '', signApiKey: '' },
  music: { enabled: true, volume: 0.35, source: 'generated', duck: true }, // source: 'generated' | 'files'
  safety: { extraBannedWords: [] },
  games: {},
});

// ---------- Khởi tạo ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const safety = new Safety(settings.get('safety').extraBannedWords);
const tts = new TtsQueue({
  cacheDir: path.join(DATA_DIR, 'tts-cache'),
  broadcast: payload => io.to('overlay').emit('tts:play', payload),
  getSettings: () => ({ ...DEFAULT_TTS, ...settings.get('tts') }),
});
const games = new GameManager({ gamesDir: GAMES_DIR, dataDir: DATA_DIR, musicDir: MUSIC_DIR, io, tts, safety, settings });
const DEFAULT_MUSIC = { enabled: true, volume: 0.35, source: 'generated', duck: true };
const musicSettings = () => ({ ...DEFAULT_MUSIC, ...settings.get('music') });
const tiktok = new TikTokConnector();
const simulator = new SimulatorConnector();
const kokoro = new KokoroProcess({ getUrl: () => ({ ...DEFAULT_TTS, ...settings.get('tts') }).kokoroUrl });

// ---------- HTTP ----------
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.use('/tts', express.static(path.join(DATA_DIR, 'tts-cache'), { maxAge: '1d' }));
app.use('/music', express.static(MUSIC_DIR));
// Chỉ phục vụ thư mục client/ của mỗi game (không lộ code server)
app.use('/games/:id', (req, res, next) => {
  if (!/^[a-z0-9_-]+$/i.test(req.params.id)) return res.sendStatus(404);
  express.static(path.join(GAMES_DIR, req.params.id, 'client'))(req, res, next);
});
app.get('/', (req, res) => res.redirect('/admin.html'));

// ---------- Luồng sự kiện ----------
const recentEvents = [];
const stats = { join: 0, chat: 0, like: 0, gift: 0, follow: 0, share: 0, coins: 0 };

function onLiveEvent(evt) {
  // 1) làm sạch tên và nội dung trước khi bất kỳ game nào nhìn thấy
  evt.user.name = safety.cleanName(evt.user.name);
  if (evt.type === 'chat') {
    const { text, flagged } = safety.cleanText(evt.text, 80);
    evt.text = text;
    evt.flagged = flagged;
    if (!text) return;
  }
  if (evt.type === 'like') evt.count = Math.max(1, Math.min(500, Number(evt.count) || 1));
  if (evt.type === 'gift') evt.coins = Math.max(0, Number(evt.coins) || 0);

  // 2) thống kê + nhật ký cho Admin
  stats[evt.type] = (stats[evt.type] || 0) + (evt.type === 'like' ? evt.count : 1);
  if (evt.type === 'gift') stats.coins += evt.coins;
  if (evt.type !== 'like' || Math.random() < 0.2) {
    recentEvents.unshift(evt);
    if (recentEvents.length > 60) recentEvents.pop();
    io.to('admin').emit('event:log', evt);
  }

  // 3) chuyển cho game đang chạy
  games.handleEvent(evt);
}

tiktok.on('event', onLiveEvent);
simulator.on('event', onLiveEvent);
tiktok.on('status', s => io.to('admin').emit('tiktok:status', s));
simulator.on('status', s => io.to('admin').emit('sim:status', s));

// ---------- Socket.io ----------
function adminState() {
  return {
    games: games.list(),
    activeGame: games.active ? games.active.id : null,
    gameSettings: games.active ? games.active.ctx.settings : {},
    gameSchema: games.active ? games.active.module.settingsSchema || {} : {},
    gameActions: games.active ? games.active.module.meta.adminActions || [] : [],
    tts: { ...DEFAULT_TTS, ...settings.get('tts') },
    music: musicSettings(),
    musicFiles: games.active ? games.musicFiles(games.active.id) : [],
    gameMusic: games.active ? games.active.module.meta.music || 'calm' : 'calm',
    ttsStatus: tts.status(),
    tiktok: { status: tiktok.status, username: tiktok.username || settings.get('tiktok').username, error: tiktok.error, hasKey: !!settings.get('tiktok').signApiKey },
    sim: { running: simulator.running, speed: simulator.speed },
    stats,
    recentEvents,
    extraBannedWords: settings.get('safety').extraBannedWords,
  };
}

io.on('connection', socket => {
  const role = socket.handshake.query.role === 'admin' ? 'admin' : 'overlay';
  socket.join(role);

  if (role === 'overlay') {
    socket.emit('music:settings', musicSettings());
    games.broadcastActive(socket);
    socket.on('tts:done', ({ id } = {}) => tts.done(id));
    return;
  }

  // ----- admin -----
  socket.emit('admin:state', adminState());
  const reply = (ack, fn) => {
    try {
      const result = fn();
      if (typeof ack === 'function') ack({ ok: true, result });
      io.to('admin').emit('admin:state', adminState());
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  };

  socket.on('tiktok:connect', ({ username, signApiKey } = {}, ack) => reply(ack, () => {
    const t = settings.get('tiktok');
    const next = { ...t, username: String(username || '').replace(/^@/, '').trim() };
    if (typeof signApiKey === 'string' && signApiKey.trim()) next.signApiKey = signApiKey.trim();
    settings.set('tiktok', next);
    tiktok.connect(next.username, { signApiKey: next.signApiKey });
  }));
  socket.on('tiktok:disconnect', (_, ack) => reply(ack, () => { tiktok.disconnect(); }));

  socket.on('sim:start', ({ speed } = {}, ack) => reply(ack, () => simulator.start(speed)));
  socket.on('sim:stop', (_, ack) => reply(ack, () => simulator.stop()));
  socket.on('sim:event', (payload = {}, ack) => reply(ack, () => simulator.manual(payload.type, payload)));

  socket.on('game:activate', ({ id } = {}, ack) => reply(ack, () => games.activate(id)));
  socket.on('game:settings', ({ patch } = {}, ack) => reply(ack, () => games.updateSettings(games.active.id, patch)));
  socket.on('game:action', ({ action, payload } = {}, ack) => reply(ack, () => games.adminAction(action, payload)));

  socket.on('tts:settings', (patch = {}, ack) => reply(ack, () => {
    const cur = { ...DEFAULT_TTS, ...settings.get('tts') };
    const next = { ...cur };
    if (patch.enabled !== undefined) next.enabled = !!patch.enabled;
    if (patch.fallbackToEdge !== undefined) next.fallbackToEdge = !!patch.fallbackToEdge;
    if (['kokoro', 'edge'].includes(patch.provider)) next.provider = patch.provider;
    for (const k of ['voice', 'rate', 'kokoroVoice', 'kokoroUrl']) if (typeof patch[k] === 'string' && patch[k].trim()) next[k] = patch[k].trim();
    if (patch.kokoroSpeed !== undefined && Number(patch.kokoroSpeed) > 0) next.kokoroSpeed = Math.min(2, Math.max(0.5, Number(patch.kokoroSpeed)));
    if (Number(patch.maxQueue) > 0) next.maxQueue = Number(patch.maxQueue);
    settings.set('tts', next);
  }));
  socket.on('tts:kokoroVoices', async (_, ack) => {
    try {
      ack({ ok: true, result: await tts.kokoroVoices() });
    } catch (e) {
      ack({ ok: false, error: 'Không kết nối được server Kokoro. Hãy chạy tts-server/start_kokoro.command' });
    }
  });
  socket.on('music:settings', (patch = {}, ack) => reply(ack, () => {
    const cur = musicSettings();
    const next = { ...cur };
    if (patch.enabled !== undefined) next.enabled = !!patch.enabled;
    if (patch.duck !== undefined) next.duck = !!patch.duck;
    if (['generated', 'files'].includes(patch.source)) next.source = patch.source;
    if (patch.volume !== undefined && Number.isFinite(Number(patch.volume))) next.volume = Math.max(0, Math.min(1, Number(patch.volume)));
    settings.set('music', next);
    io.to('overlay').emit('music:settings', next);
  }));
  socket.on('music:rescan', (_, ack) => reply(ack, () => games.broadcastActive()));
  socket.on('tts:test', ({ text } = {}, ack) => reply(ack, () => tts.say(safety.forSpeech(text || 'Xin chào, đây là giọng đọc thử nghiệm.'), { priority: 'critical' })));
  socket.on('tts:clear', (_, ack) => reply(ack, () => tts.clear()));

  socket.on('safety:words', ({ words } = {}, ack) => reply(ack, () => {
    const list = String(words || '').split(/[,\n]/).map(w => w.trim()).filter(Boolean);
    settings.set('safety', { ...settings.get('safety'), extraBannedWords: list });
    safety.setWords(list);
  }));
});

// gửi trạng thái TTS + thống kê định kỳ cho Admin
setInterval(() => io.to('admin').emit('admin:tick', { stats, ttsStatus: tts.status() }), 1000);

// ---------- Khởi động ----------
games.discover();
const startId = games.games.has(settings.get('activeGame')) ? settings.get('activeGame') : games.list()[0] && games.list()[0].id;
if (startId) games.activate(startId);
kokoro.start();

server.listen(PORT, () => {
  console.log('\n==============================================');
  console.log('  Live TikTok Games đã chạy');
  console.log(`  Admin   : http://localhost:${PORT}/admin.html`);
  console.log(`  Overlay : http://localhost:${PORT}/overlay.html  (đưa vào OBS, 1080x1920)`);
  console.log('==============================================\n');
});

function shutdown() {
  console.log('\nĐang lưu dữ liệu và tắt server...');
  games.shutdown();
  settings.flush();
  kokoro.stop();
  tiktok.disconnect().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => kokoro.stop());
process.on('unhandledRejection', r => console.error('[unhandledRejection]', r));
process.on('uncaughtException', e => console.error('[uncaughtException]', e));
