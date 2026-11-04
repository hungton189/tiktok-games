/**
 * NHẠC NỀN dùng chung cho mọi game.
 *
 * 2 nguồn nhạc:
 *  1) "Nhạc tự tạo" (mặc định): trình duyệt tự soạn và phát nhạc bằng Web Audio.
 *     Nhạc sinh ra ngay lúc chạy, không dùng bài hát của ai => không lo bản quyền khi live.
 *     Phong cách:  'calm'   - êm, thư giãn (pad + đàn gảy + tiếng bong bóng) — hợp Bể cá
 *                  'upbeat' - sôi động (trống, bass, giai điệu 8-bit)        — hợp Đua thú
 *  2) "File của tôi": phát lần lượt các file mp3/ogg/wav bạn bỏ vào thư mục music/<id-game>/ hoặc music/shared/
 *
 * Game có thể điều khiển qua api.music:
 *   api.music.setIntensity(0..1)  // độ sôi động (vd: chờ = 0.4, đang đua = 1)
 *   api.music.sting('win')        // đoạn nhạc ngắn khi có sự kiện (win | levelup)
 * Khi AI đọc, nhạc tự nhỏ lại (ducking).
 */

const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export class Music {
  constructor() {
    this.ctx = null;
    this.settings = { enabled: true, volume: 0.35, source: 'generated', duck: true };
    this.style = 'calm';
    this.intensity = 0.6;
    this.muted = false;
    this.ducked = false;
    this.files = [];
    this.fileIdx = 0;
    this._timer = null;
    this._step = 0;
    this._nextTime = 0;
    this._gen = null;
  }

  // ---------------- khởi tạo ----------------
  _ensure() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // reverb tổng hợp (không cần file)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.8, 2.2);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);

    // delay cho đàn gảy
    this.delay = ctx.createDelay(1.5);
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.32;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.25;
    this.delaySend.connect(this.delay);
    this.delay.connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.master);

    this.noise = this._noiseBuffer();

    // phần phát file
    this.fileEl = new Audio();
    this.fileEl.crossOrigin = 'anonymous';
    this.fileEl.addEventListener('ended', () => this._playNextFile());
    this.fileEl.addEventListener('error', () => setTimeout(() => this._playNextFile(), 1000));
    try { this.ctx.createMediaElementSource(this.fileEl).connect(this.master); } catch (_) { /* OfflineAudioContext (dùng khi xuất thử) */ }
  }

  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _noiseBuffer() {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------------- điều khiển ----------------
  /** Trình duyệt chỉ cho phát tiếng sau 1 cú bấm (OBS thì không cần). Trả về true nếu đang chạy được. */
  async unlock() {
    this._ensure();
    try { await this.ctx.resume(); } catch (_) {}
    return this.ctx.state === 'running';
  }

  get blocked() {
    return this.ctx && this.ctx.state !== 'running';
  }

  setMuted(m) {
    this.muted = m;
    this._applyVolume();
  }

  applySettings(s) {
    const prevSource = this.settings.source;
    this.settings = { ...this.settings, ...s };
    if (!this.ctx) return;
    this._applyVolume();
    if (prevSource !== this.settings.source) this._restart();
  }

  /** Gọi khi đổi game: style = phong cách mặc định của game, files = danh sách file nhạc của game */
  setGame({ style, files }) {
    this.style = style || 'calm';
    this.files = (files || []).slice().sort(() => Math.random() - 0.5);
    this.fileIdx = 0;
    this.intensity = 0.6;
    this._ensure();
    this._restart();
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, Number(v) || 0));
  }

  duck(on) {
    this.ducked = on;
    this._applyVolume();
  }

  _targetVolume() {
    const s = this.settings;
    if (!s.enabled || this.muted) return 0;
    return s.volume * (this.ducked && s.duck ? 0.3 : 1);
  }

  _applyVolume() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this._targetVolume(), this.ctx.currentTime, this.ducked ? 0.15 : 0.6);
  }

  _restart() {
    clearInterval(this._timer);
    this._timer = null;
    this.fileEl.pause();
    const useFiles = this.settings.source === 'files' && this.files.length > 0;
    if (useFiles) {
      this._playNextFile();
    } else {
      this._gen = this.style === 'upbeat' ? new Upbeat(this) : new Calm(this);
      this._step = 0;
      this._nextTime = this.ctx.currentTime + 0.2;
      this._timer = setInterval(() => this._schedule(), 25);
    }
    this._applyVolume();
  }

  _playNextFile() {
    if (!this.files.length || this.settings.source !== 'files') return;
    this.fileEl.src = this.files[this.fileIdx % this.files.length];
    this.fileIdx++;
    this.fileEl.play().catch(() => {});
  }

  _schedule() {
    if (this.ctx.state !== 'running') return;
    const secPerStep = 60 / this._gen.bpm / 4;
    // tab bị treo lâu (vd OBS ẩn nguồn) => đừng phát dồn
    if (this._nextTime < this.ctx.currentTime - 0.5) this._nextTime = this.ctx.currentTime + 0.05;
    while (this._nextTime < this.ctx.currentTime + 0.15) {
      this._gen.step(this._step, this._nextTime, secPerStep);
      this._step++;
      this._nextTime += secPerStep;
    }
  }

  sting(kind) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.05;
    const notes = kind === 'win' ? [67, 71, 74, 79, 83] : [72, 76, 79, 84];
    notes.forEach((n, i) => this.lead(n, t + i * 0.09, i === notes.length - 1 ? 0.6 : 0.12, 0.16));
    this.hat(t + notes.length * 0.09, 0.8, 0.25);
  }

  // ---------------- "nhạc cụ" ----------------
  _out(node, { reverb = 0, delay = 0 } = {}) {
    node.connect(this.master);
    if (reverb) { const g = this.ctx.createGain(); g.gain.value = reverb; node.connect(g).connect(this.reverbSend); }
    if (delay) { const g = this.ctx.createGain(); g.gain.value = delay; node.connect(g).connect(this.delaySend); }
  }

  pad(notes, t, dur, vol = 0.05, cutoff = 1400) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.4));
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    f.connect(g);
    this._out(g, { reverb: 0.8 });
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 1);
      }
    }
  }

  pluck(n, t, vol = 0.08, decay = 0.7) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    this._out(g, { reverb: 0.6, delay: 0.7 });
    for (const [type, mul, v] of [['sine', 1, 1], ['triangle', 2, 0.25]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      og.gain.value = v;
      o.type = type;
      o.frequency.value = midi(n) * mul;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  }

  bass(n, t, dur, vol = 0.12, type = 'triangle') {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = midi(n);
    f.type = 'lowpass';
    f.frequency.value = type === 'square' ? 700 : 900;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g);
    this._out(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  lead(n, t, dur, vol = 0.05) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = midi(n);
    f.type = 'lowpass';
    f.frequency.value = 2600;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    o.connect(f).connect(g);
    this._out(g, { reverb: 0.25, delay: 0.2 });
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  kick(t, vol = 0.5) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g);
    this._out(g);
    o.start(t);
    o.stop(t + 0.3);
  }

  _noiseHit(t, { vol, type, freq, decay, reverb = 0 }) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    s.connect(f).connect(g);
    this._out(g, { reverb });
    s.start(t, Math.random() * 0.5);
    s.stop(t + decay + 0.02);
  }

  snare(t, vol = 0.22) {
    this._noiseHit(t, { vol, type: 'bandpass', freq: 1800, decay: 0.16, reverb: 0.3 });
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = 190;
    g.gain.setValueAtTime(vol * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g);
    this._out(g);
    o.start(t);
    o.stop(t + 0.1);
  }

  hat(t, vol = 0.06, decay = 0.04) {
    this._noiseHit(t, { vol, type: 'highpass', freq: 7000, decay });
  }

  bubble(t, vol = 0.05) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f0 = 500 + Math.random() * 500;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g);
    this._out(g, { reverb: 0.7 });
    o.start(t);
    o.stop(t + 0.2);
  }
}

// =====================================================================
//  Phong cách "calm": nhạc nền thư giãn, 72 bpm, Cmaj7 – Am7 – Fmaj7 – G6
// =====================================================================
class Calm {
  constructor(m) {
    this.m = m;
    this.bpm = 72;
    this.chords = [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 64],
    ];
    this.scale = [72, 74, 76, 79, 81, 84, 86, 88]; // ngũ cung Đô trưởng, quãng cao
    this.last = 3;
  }

  step(i, t, sps) {
    const m = this.m;
    const bar = Math.floor(i / 16);
    const s = i % 16;
    const chord = this.chords[bar % this.chords.length];
    if (s === 0) {
      m.pad(chord, t, sps * 16, 0.06);
      m.bass(chord[0] - 24, t, sps * 14, 0.14, 'sine');
    }
    if (s === 8) m.bass(chord[0] - 24, t, sps * 7, 0.1, 'sine');
    // đàn gảy: đi từng bước gần nhau cho giai điệu mượt
    const p = 0.12 + 0.35 * m.intensity;
    if (s % 2 === 0 && Math.random() < p) {
      this.last = Math.max(0, Math.min(this.scale.length - 1, this.last + pick([-2, -1, -1, 1, 1, 2, 0])));
      m.pluck(this.scale[this.last], t, 0.08 + 0.04 * Math.random());
    }
    if (s === 0 && bar % 4 === 3) m.pluck(chord[3] + 12, t + sps * 2, 0.07, 1.4);
    if (Math.random() < 0.03 + 0.04 * m.intensity) m.bubble(t + Math.random() * sps);
  }
}

// =====================================================================
//  Phong cách "upbeat": sôi động 8-bit, 138 bpm, G – D – Em – C
// =====================================================================
class Upbeat {
  constructor(m) {
    this.m = m;
    this.bpm = 138;
    this.chords = [
      [55, 59, 62],
      [50, 54, 57],
      [52, 55, 59],
      [48, 52, 55],
    ];
    this.scale = [67, 69, 71, 74, 76, 79, 81, 83]; // ngũ cung Son trưởng
    this.motif = this._makeMotif();
  }

  /** giai điệu 2 ô nhịp, lặp lại để nghe "có bài" chứ không ngẫu nhiên lộn xộn */
  _makeMotif() {
    const rhythm = pick([
      [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0],
      [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0],
      [1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0],
    ]);
    let idx = 3;
    return rhythm.map(on => {
      if (!on) return null;
      idx = Math.max(0, Math.min(this.scale.length - 1, idx + pick([-2, -1, 1, 1, 2, 0])));
      return this.scale[idx];
    });
  }

  step(i, t, sps) {
    const m = this.m;
    const x = m.intensity;
    const bar = Math.floor(i / 16);
    const s = i % 16;
    const chord = this.chords[bar % this.chords.length];
    if (s === 0 && bar % 8 === 0 && bar > 0) this.motif = this._makeMotif();

    // trống
    if (s % 4 === 0 && (x > 0.3 || s === 0 || s === 8)) m.kick(t, s === 0 ? 0.5 : 0.4);
    if ((s === 4 || s === 12) && x > 0.45) m.snare(t, 0.18 + 0.08 * x);
    if (s % 2 === 0) m.hat(t, 0.035 + 0.03 * x);
    if (s % 4 === 2 && x > 0.75) m.hat(t, 0.05, 0.12);
    if (x > 0.9 && s === 14 && bar % 2 === 1) m.snare(t, 0.12);

    // bass nảy theo nốt móc đơn
    if (s % 2 === 0) {
      const n = chord[0] - 12 + (s % 4 === 2 ? 12 : 0);
      m.bass(n, t, sps * 1.8, 0.1, 'square');
    }
    // hợp âm nền
    if (s === 0) m.pad(chord.map(n => n + 12), t, sps * 16, 0.018 + 0.012 * x, 2200);
    // giai điệu chính khi đủ sôi động
    if (x >= 0.7) {
      const n = this.motif[s];
      if (n) m.lead(n, t, sps * 0.9, 0.035);
    } else if (s % 4 === 0 && Math.random() < 0.4) {
      m.pluck(pick(chord) + 24, t, 0.04, 0.4);
    }
  }
}
