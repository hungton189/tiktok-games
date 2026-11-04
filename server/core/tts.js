'use strict';
/**
 * Hàng đợi giọng đọc AI có ƯU TIÊN + nhiều "nhà cung cấp giọng" (provider).
 * - Game gọi ctx.say(text, { priority }) — không cần biết TTS chạy thế nào.
 * - Provider:
 *     'kokoro' : Kokoro tiếng Việt chạy trên máy (tts-server/kokoro_server.py), miễn phí, không cần Internet
 *     'edge'   : Microsoft Edge TTS, miễn phí, cần Internet
 *   Nếu provider chính lỗi (vd chưa bật server Kokoro) và bật "dự phòng", sẽ tự chuyển sang Edge.
 * - File âm thanh được cache theo nội dung + giọng.
 * - Phát lần lượt trên overlay: chờ overlay báo 'tts:done' rồi mới đọc câu tiếp => không bao giờ đọc chồng.
 * - Hàng đợi dài: bỏ bớt câu ưu tiên thấp để không bị trễ so với live.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { numbersToWords } = require('./vnNumber');

const PRIORITY = { low: 1, normal: 5, high: 8, critical: 10 };
const PREFETCH = 2; // số câu được tạo giọng trước
const MAX_AGE_MS = 30000; // câu chờ quá 30 giây thì bỏ (trừ câu ưu tiên cao)

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

class TtsQueue {
  /**
   * @param {object} opts
   * @param {string} opts.cacheDir
   * @param {(payload:object)=>void} opts.broadcast - gửi 'tts:play' tới overlay
   * @param {()=>object} opts.getSettings - xem DEFAULT_TTS_SETTINGS trong server/index.js
   */
  constructor({ cacheDir, broadcast, getSettings }) {
    this.cacheDir = cacheDir;
    this.broadcast = broadcast;
    this.getSettings = getSettings;
    fs.mkdirSync(cacheDir, { recursive: true });
    this.queue = [];
    this.playing = null;
    this._seq = 0;
    this._edge = null;
    this._edgeVoice = null;
    this.lastError = null;
    this.lastProvider = null;
    this._chain = Promise.resolve(); // tạo giọng lần lượt từng câu (Kokoro chạy trên CPU, gửi dồn sẽ bị nghẽn)
    this._kokoroDownUntil = 0;
  }

  /** @returns {boolean} true nếu được nhận vào hàng đợi */
  say(text, { priority = 'normal', dedupeKey } = {}) {
    const s = this.getSettings();
    if (!s.enabled || !text) return false;
    const p = typeof priority === 'number' ? priority : (PRIORITY[priority] || PRIORITY.normal);

    if (dedupeKey && this.queue.some(i => i.dedupeKey === dedupeKey)) return false;

    if (this.queue.length >= s.maxQueue) {
      let lowestIdx = 0;
      this.queue.forEach((it, i) => { if (it.priority < this.queue[lowestIdx].priority) lowestIdx = i; });
      if (this.queue[lowestIdx].priority >= p) return false;
      this.queue.splice(lowestIdx, 1);
    }

    const item = { id: ++this._seq, text, priority: p, dedupeKey, audioPromise: null, createdAt: Date.now() };
    const idx = this.queue.findIndex(i => i.priority < p);
    if (idx === -1) this.queue.push(item);
    else this.queue.splice(idx, 0, item);

    this._next();
    this._prefetch();
    return true;
  }

  /** Chỉ tạo trước giọng cho câu sắp đọc (không tạo cho cả hàng đợi => không làm nghẽn Kokoro) */
  _prefetch() {
    this.queue.slice(0, PREFETCH).forEach(item => this._ensureAudio(item));
  }

  _ensureAudio(item) {
    if (!item.audioPromise) {
      const run = () => this.synthesize(item.text).catch(err => {
        this.lastError = err.message;
        console.warn('[tts] Không tạo được giọng đọc:', err.message);
        return null;
      });
      item.audioPromise = this._chain.then(run, run);
      this._chain = item.audioPromise;
    }
    return item.audioPromise;
  }

  done(id) {
    if (this.playing && this.playing.id === id) this._finish();
  }

  clear() {
    this.queue = [];
  }

  status() {
    return { queued: this.queue.length, playing: this.playing ? this.playing.text : null, lastError: this.lastError, lastProvider: this.lastProvider };
  }

  async _next() {
    if (this.playing || this.queue.length === 0) return;
    // bỏ câu đã quá cũ (live trôi rất nhanh), trừ câu quan trọng
    const now = Date.now();
    this.queue = this.queue.filter(i => i.priority >= PRIORITY.high || now - i.createdAt < MAX_AGE_MS);
    if (this.queue.length === 0) return;
    const item = this.queue.shift();
    this.playing = item;
    const file = await this._ensureAudio(item);
    this._prefetch();
    if (this.playing !== item) return;
    this.broadcast({ id: item.id, text: item.text, url: file ? `/tts/${file}` : null });
    const estimateMs = file ? 2500 + item.text.length * 110 : 2500;
    item.timer = setTimeout(() => { if (this.playing === item) this._finish(); }, Math.min(estimateMs, 25000));
  }

  _finish() {
    clearTimeout(this.playing && this.playing.timer);
    this.playing = null;
    setTimeout(() => this._next(), 250);
  }

  // ======================= tạo file âm thanh =======================

  /**
   * Trả về tên file trong cacheDir.
   * Giữ MỘT giọng ổn định: chỉ chuyển sang Edge khi server Kokoro KHÔNG CHẠY (không kết nối được),
   * và chuyển hẳn trong 30 giây rồi mới thử lại — không đổi giọng qua lại từng câu.
   * Kokoro chậm hay lỗi 1 câu thì bỏ qua câu đó (chỉ hiện chữ), không đổi giọng.
   */
  async synthesize(text) {
    const s = this.getSettings();
    let primary = s.provider === 'kokoro' ? 'kokoro' : 'edge';
    if (primary === 'kokoro' && s.fallbackToEdge && Date.now() < this._kokoroDownUntil) primary = 'edge';
    try {
      const name = await this._synthWith(primary, text, s);
      this.lastProvider = primary;
      if (primary === s.provider) this.lastError = null;
      return name;
    } catch (e) {
      if (primary === 'edge' || !s.fallbackToEdge || !e.kokoroDown) throw e;
      this._kokoroDownUntil = Date.now() + 30000;
      console.warn(`[tts] Kokoro không chạy (${e.message}) => dùng Edge trong 30 giây`);
      this.lastError = `Kokoro không chạy: ${e.message} (đang dùng tạm Edge)`;
      try {
        const name = await this._synthWith('edge', text, s);
        this.lastProvider = 'edge';
        return name;
      } catch (e2) {
        throw new Error(`Kokoro: ${e.message} · Edge: ${e2.message}`);
      }
    }
  }

  async _synthWith(provider, text, s) {
    const key = provider === 'kokoro' ? `kokoro|${s.kokoroVoice}|${s.kokoroSpeed}|${text}` : `edge|${s.voice}|${s.rate}|${text}`;
    const ext = provider === 'kokoro' ? 'wav' : 'mp3';
    const name = `${crypto.createHash('md5').update(key).digest('hex')}.${ext}`;
    const full = path.join(this.cacheDir, name);
    if (fs.existsSync(full)) return name;
    const buf = provider === 'kokoro' ? await this._kokoro(text, s) : await this._edgeSynth(text, s);
    if (!buf || buf.length < 500) throw new Error('Dữ liệu âm thanh rỗng');
    fs.writeFileSync(full, buf);
    return name;
  }

  // ---- Kokoro tiếng Việt (server Python chạy trên máy) ----
  async _kokoro(text, s) {
    const url = `${String(s.kokoroUrl || 'http://127.0.0.1:5005').replace(/\/$/, '')}/tts`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: numbersToWords(text), voice: s.kokoroVoice, speed: Number(s.kokoroSpeed) || 1 }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`server Kokoro trả lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('server Kokoro phản hồi quá lâu');
      if (e.cause && ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'].includes(e.cause.code)) {
        const err = new Error('chưa bật server Kokoro (chạy tts-server/start_kokoro.command)');
        err.kokoroDown = true;
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Danh sách giọng Kokoro lấy từ server (dùng cho trang Admin) */
  async kokoroVoices() {
    const s = this.getSettings();
    const res = await fetch(`${String(s.kokoroUrl).replace(/\/$/, '')}/voices`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ---- Microsoft Edge TTS ----
  async _edgeSynth(text, s) {
    const run = async () => {
      const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
      if (!this._edge || this._edgeVoice !== s.voice) {
        if (this._edge) try { this._edge.close(); } catch (_) {}
        const engine = new MsEdgeTTS();
        await engine.setMetadata(s.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        this._edge = engine;
        this._edgeVoice = s.voice;
      }
      const { audioStream } = this._edge.toStream(xmlEscape(text), { rate: s.rate });
      const chunks = [];
      await new Promise((resolve, reject) => {
        audioStream.on('data', c => chunks.push(c));
        audioStream.on('close', resolve);
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });
      return Buffer.concat(chunks);
    };
    try {
      return await run();
    } catch (e) {
      this._edge = null; // kết nối có thể đã chết => tạo lại và thử 1 lần nữa
      return await run();
    }
  }
}

module.exports = { TtsQueue, PRIORITY };
