/**
 * Overlay "khung" dùng chung cho mọi game:
 *  - giữ sân khấu 1080x1920 vừa khít cửa sổ
 *  - tải phần hiển thị của game đang chạy (games/<id>/client/index.js) và chuyển tin nhắn cho nó
 *  - phát giọng đọc AI theo hàng đợi của server (báo 'tts:done' khi đọc xong)
 *
 * Giao diện mà mỗi game client phải export default:
 *   { mount(root, api), unmount?(), onMessage?(type, payload), onSettings?(settings) }
 * api = { socket, settings, snapshot, width, height, on(type, fn), music }
 *   api.music.setIntensity(0..1) · api.music.sting('win' | 'levelup')  (xem public/js/music.js)
 */
import { Music } from './music.js';

const STAGE_W = 1080;
const STAGE_H = 1920;
const stage = document.getElementById('stage');
const root = document.getElementById('game-root');
const loading = document.getElementById('loading');
const caption = document.getElementById('tts-caption');
const unlockBtn = document.getElementById('unlock-audio');

const params = new URLSearchParams(location.search);
if (params.has('transparent')) document.body.classList.add('transparent');
if (params.has('nocaption')) caption.remove();

function fit() {
  const s = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

const socket = io({ query: { role: 'overlay' } });

// ---------------- Nhạc nền ----------------
const music = new Music();
if (params.has('preview')) music.setMuted(true); // bản xem trước trong Admin: tắt tiếng
socket.on('music:settings', s => music.applySettings(s));
async function tryUnlockAudio() {
  const ok = await music.unlock();
  if (!ok && !params.has('preview')) unlockBtn.hidden = false;
}

// ---------------- Game loader ----------------
let current = null; // { id, mod, handlers }

async function loadGame(info) {
  if (current) {
    try { current.mod.unmount && current.mod.unmount(); } catch (e) { console.error(e); }
    root.innerHTML = '';
    current = null;
  }
  if (!info) { loading.textContent = 'Chưa có game nào được bật'; loading.classList.remove('hidden'); return; }

  loading.textContent = `Đang tải ${info.name}…`;
  loading.classList.remove('hidden');
  try {
    const mod = (await import(`${info.clientUrl}?v=${Date.now()}`)).default;
    const handlers = {};
    const api = {
      socket,
      settings: info.settings,
      snapshot: info.snapshot,
      width: STAGE_W,
      height: STAGE_H,
      on(type, fn) { (handlers[type] ||= []).push(fn); },
      music: {
        setIntensity: v => music.setIntensity(v),
        sting: kind => music.sting(kind),
      },
    };
    music.setGame({ style: info.music, files: info.musicFiles });
    tryUnlockAudio();
    current = { id: info.id, mod, handlers, api };
    await mod.mount(root, api);
    loading.classList.add('hidden');
  } catch (e) {
    console.error('Lỗi tải game', e);
    loading.textContent = `Lỗi tải game ${info.name}: ${e.message}`;
  }
}

socket.on('game:active', info => loadGame(info));
socket.on('game:msg', ({ game, type, payload }) => {
  if (!current || current.id !== game) return;
  (current.handlers[type] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  if (current.mod.onMessage) current.mod.onMessage(type, payload);
});
socket.on('game:settings', ({ game, settings }) => {
  if (!current || current.id !== game) return;
  current.api.settings = settings;
  current.mod.onSettings && current.mod.onSettings(settings);
});
socket.on('connect', () => console.log('overlay connected'));

// ---------------- Giọng đọc ----------------
const audio = new Audio();
// Bản xem trước trong trang Admin: tắt tiếng để không đọc 2 lần cùng OBS
if (params.has('preview')) audio.muted = true;
let capTimer = null;

function showCaption(text) {
  if (!caption.isConnected) return;
  clearTimeout(capTimer);
  caption.textContent = text;
  caption.hidden = false;
  caption.style.animation = 'none';
  void caption.offsetWidth;
  caption.style.animation = '';
}
function hideCaption(delay = 600) {
  clearTimeout(capTimer);
  capTimer = setTimeout(() => { caption.hidden = true; }, delay);
}

socket.on('tts:play', ({ id, url, text }) => {
  showCaption(text);
  music.duck(true);
  const finish = () => {
    audio.onended = audio.onerror = null;
    hideCaption();
    music.duck(false);
    socket.emit('tts:done', { id });
  };
  if (!url) { setTimeout(finish, 2500 + text.length * 40); return; }
  audio.src = url;
  audio.onended = finish;
  audio.onerror = finish;
  audio.play().catch(() => {
    // Trình duyệt chặn tự phát âm thanh (OBS thì không chặn) => hiện nút bật âm thanh
    unlockBtn.hidden = false;
    setTimeout(finish, 2500 + text.length * 60);
  });
});

unlockBtn.addEventListener('click', () => {
  audio.play().catch(() => {});
  music.unlock();
  unlockBtn.hidden = true;
});
// bấm bất kỳ đâu trên trang cũng mở khoá âm thanh
addEventListener('pointerdown', () => { music.unlock(); unlockBtn.hidden = true; }, { once: true });
