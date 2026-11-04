'use strict';
/**
 * Quản lý các game dạng "plugin".
 * Mỗi game là 1 thư mục trong games/<id>/ gồm:
 *   - server.js      : logic game chạy trên server (xem games/_template/server.js)
 *   - client/index.js: phần hiển thị chạy trên overlay (trình duyệt / OBS)
 *   - client/...     : ảnh, âm thanh, css riêng của game
 * Thư mục bắt đầu bằng "_" (vd _template) sẽ bị bỏ qua.
 *
 * Tại 1 thời điểm chỉ có 1 game chạy. Đổi game từ trang Admin, không cần khởi động lại server.
 */
const fs = require('fs');
const path = require('path');
const { Store } = require('./store');

const TICK_MS = 100;

class GameManager {
  /**
   * @param {object} deps
   * @param {string} deps.gamesDir
   * @param {string} deps.dataDir
   * @param {import('socket.io').Server} deps.io
   * @param {import('./tts').TtsQueue} deps.tts
   * @param {import('./safety').Safety} deps.safety
   * @param {import('./store').Store} deps.settings - kho cài đặt chung
   */
  constructor({ gamesDir, dataDir, musicDir, io, tts, safety, settings }) {
    Object.assign(this, { gamesDir, dataDir, musicDir, io, tts, safety, settings });
    this.games = new Map(); // id -> module
    this.active = null; // { id, module, instance, store, ctx }
    this._tickTimer = null;
    this._lastTick = Date.now();
  }

  discover() {
    this.games.clear();
    for (const dir of fs.readdirSync(this.gamesDir, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name.startsWith('_') || dir.name.startsWith('.')) continue;
      const file = path.join(this.gamesDir, dir.name, 'server.js');
      if (!fs.existsSync(file)) continue;
      try {
        const mod = require(file);
        if (!mod.meta || !mod.meta.id || typeof mod.create !== 'function') {
          console.warn(`[games] Bỏ qua ${dir.name}: thiếu meta.id hoặc hàm create()`);
          continue;
        }
        if (mod.meta.id !== dir.name) console.warn(`[games] Lưu ý: thư mục ${dir.name} nhưng meta.id = ${mod.meta.id}`);
        this.games.set(mod.meta.id, mod);
      } catch (e) {
        console.error(`[games] Lỗi khi nạp game ${dir.name}:`, e);
      }
    }
    console.log(`[games] Đã nạp ${this.games.size} game: ${[...this.games.keys()].join(', ')}`);
  }

  list() {
    return [...this.games.values()].map(m => ({
      id: m.meta.id,
      name: m.meta.name || m.meta.id,
      description: m.meta.description || '',
      version: m.meta.version || '0.0.0',
    }));
  }

  getSettings(id) {
    const mod = this.games.get(id);
    const saved = (this.settings.get('games', {}) || {})[id] || {};
    return { ...(mod && mod.defaultSettings), ...saved };
  }

  updateSettings(id, patch) {
    const mod = this.games.get(id);
    if (!mod) throw new Error(`Không có game ${id}`);
    // chỉ nhận các khoá có trong defaultSettings, ép đúng kiểu dữ liệu
    const clean = {};
    for (const [k, v] of Object.entries(patch || {})) {
      if (!(k in (mod.defaultSettings || {}))) continue;
      const def = mod.defaultSettings[k];
      if (typeof def === 'number') clean[k] = Number(v);
      else if (typeof def === 'boolean') clean[k] = v === true || v === 'true';
      else clean[k] = String(v);
      if (typeof def === 'number' && !Number.isFinite(clean[k])) delete clean[k];
    }
    const all = this.settings.get('games', {}) || {};
    all[id] = { ...(all[id] || {}), ...clean };
    this.settings.set('games', all);
    const settings = this.getSettings(id);
    if (this.active && this.active.id === id) {
      this.active.ctx.settings = settings;
      this._call('onSettingsChange', settings);
      this.io.to('overlay').emit('game:settings', { game: id, settings });
    }
    return settings;
  }

  activate(id) {
    const mod = this.games.get(id);
    if (!mod) throw new Error(`Không tìm thấy game "${id}"`);
    this.deactivate();

    const store = new Store(path.join(this.dataDir, 'games'), id);
    const ctx = {
      gameId: id,
      settings: this.getSettings(id),
      /** lưu trữ riêng của game (data/games/<id>.json), còn lại sau khi tắt server */
      store,
      /** gửi tin nhắn tới phần hiển thị (client/index.js) của game */
      emit: (type, payload) => this.io.to('overlay').emit('game:msg', { game: id, type, payload }),
      /** cho AI đọc 1 câu; priority: 'low' | 'normal' | 'high' | 'critical' */
      say: (text, opts) => this.tts.say(this.safety.forSpeech(text), opts),
      safety: this.safety,
      log: (...a) => console.log(`[${id}]`, ...a),
    };
    const instance = mod.create(ctx) || {};
    this.active = { id, module: mod, instance, store, ctx };
    this.settings.set('activeGame', id);
    this._call('onStart');
    this._startTick();
    this.broadcastActive();
    console.log(`[games] Đang chạy game: ${mod.meta.name || id}`);
  }

  deactivate() {
    if (!this.active) return;
    this._call('onStop');
    this.active.store.flush();
    this.active = null;
    clearInterval(this._tickTimer);
    this._tickTimer = null;
  }

  /** Thông tin để overlay tải đúng game và vẽ lại trạng thái hiện tại */
  activePayload() {
    if (!this.active) return null;
    const { id, module: mod, ctx } = this.active;
    return {
      id,
      name: mod.meta.name || id,
      settings: ctx.settings,
      snapshot: this._call('getSnapshot') || null,
      clientUrl: `/games/${id}/index.js`,
      music: mod.meta.music || 'calm',
      musicFiles: this.musicFiles(id),
    };
  }

  /** File nhạc của game: music/<id>/ trước, không có thì music/shared/ */
  musicFiles(id) {
    if (!this.musicDir) return [];
    const exts = /\.(mp3|ogg|wav|m4a|aac)$/i;
    for (const sub of [id, 'shared']) {
      const dir = path.join(this.musicDir, sub);
      try {
        const files = fs.readdirSync(dir).filter(f => exts.test(f) && !f.startsWith('.'));
        if (files.length) return files.map(f => `/music/${encodeURIComponent(sub)}/${encodeURIComponent(f)}`);
      } catch (_) {}
    }
    return [];
  }

  broadcastActive(target) {
    (target || this.io.to('overlay')).emit('game:active', this.activePayload());
  }

  handleEvent(evt) {
    if (!this.active) return;
    this._call('onEvent', evt);
  }

  adminAction(action, payload) {
    if (!this.active) throw new Error('Chưa có game nào đang chạy');
    const actions = this.active.module.meta.adminActions || [];
    if (!actions.some(a => a.id === action)) throw new Error(`Game không có thao tác "${action}"`);
    return this._call('onAdminAction', action, payload);
  }

  _startTick() {
    clearInterval(this._tickTimer);
    this._lastTick = Date.now();
    this._tickTimer = setInterval(() => {
      const now = Date.now();
      const dt = (now - this._lastTick) / 1000;
      this._lastTick = now;
      this._call('onTick', dt);
    }, TICK_MS);
  }

  /** Gọi hàm của game, bắt lỗi để 1 game lỗi không làm sập cả server */
  _call(fn, ...args) {
    const inst = this.active && this.active.instance;
    if (!inst || typeof inst[fn] !== 'function') return undefined;
    try {
      return inst[fn](...args);
    } catch (e) {
      console.error(`[games] Lỗi trong ${this.active.id}.${fn}:`, e);
      return undefined;
    }
  }

  shutdown() {
    this.deactivate();
  }
}

module.exports = { GameManager };
