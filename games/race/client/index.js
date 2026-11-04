/**
 * Phần hiển thị game Đại hội đua thú.
 * Đường đua dọc nhìn từ trên xuống: xuất phát ở dưới, đích ở trên. Con vật vẽ bằng code (animals.js).
 */
import { drawAnimal } from './animals.js';

const W = 1080;
const H = 1920;
const TRACK_L = 110;
const TRACK_R = 970;
const LANE_W = (TRACK_R - TRACK_L) / 4;
const TRACK_TOP = 400;
const TRACK_BOTTOM = 1470;
const FINISH_Y = 525;
const START_Y = 1330;
const ANIMAL_SIZE = 150;
const COLORS = ['#ff4f8b', '#f5b700', '#ff6b2c', '#2f8cff'];
const DARK = ['#3a0d22', '#3a2a00', '#3d1505', '#08254a'];

const laneX = i => TRACK_L + LANE_W * (i + 0.5);
const yOf = p => START_Y - p * (START_Y - FINISH_Y);
const scaleOf = p => 1 - 0.12 * p; // xa hơn thì nhỏ hơn một chút => có chiều sâu
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let st = null;

export default {
  mount(root, api) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(link);

    root.innerHTML = `
      <div class="rc">
        <canvas class="rc-main" width="${W}" height="${H}"></canvas>
        <div class="rc-hud">
          <div class="rc-top">
            <div class="rc-title">ĐẠI HỘI ĐUA THÚ</div>
            <div class="rc-sub"><span class="rc-pill">CHỌN PHE</span><span class="rc-round"></span></div>
          </div>
          <div class="rc-howto"><span>💬 Bình luận <b>1·2·3·4</b> chọn phe</span><span>❤️ Tim = tăng tốc</span><span>🎁 Quà = lướt nhanh</span></div>
          <div class="rc-center hidden"></div>
          <div class="rc-floats"></div>
          <div class="rc-cards"></div>
          <div class="rc-fans"></div>
        </div>
      </div>`;
    const q = s => root.querySelector(s);
    st = {
      api, link,
      ctx: q('canvas.rc-main').getContext('2d'),
      ui: { pill: q('.rc-pill'), round: q('.rc-round'), center: q('.rc-center'), floats: q('.rc-floats'), cards: q('.rc-cards'), fans: q('.rc-fans'), hud: q('.rc-hud') },
      snap: null,
      lanes: [],
      dust: [],
      leaves: [],
      confetti: [],
      crowd: makeCrowd(),
      bg: null,
      cardEls: [],
      t: 0,
      raf: 0,
    };
    st.bg = buildBackground();

    applySnapshot(api.snapshot);
    api.on('phase', applySnapshot);
    api.on('state', s => {
      st.snap.phase = s.phase;
      st.snap.timeLeft = s.timeLeft;
      s.lanes.forEach((l, i) => Object.assign(st.lanes[i], { target: l.p, mult: l.mult, effect: l.effect, dash: l.dash, members: l.members, name: l.name, emoji: l.emoji, animal: l.animal }));
      renderPhaseText();
      updateCards();
    });
    api.on('joined', ({ lane, name, auto, switched }) => floatText(lane, `${auto ? '➕' : switched ? '🔄' : '🙋'} ${name}`));
    api.on('support', ({ lane, name, kind, points, giftName, superGift }) => {
      if (kind === 'like') { if (Math.random() < 0.45) floatText(lane, `❤️ ${name} +${points}`); }
      else if (kind === 'gift') { floatText(lane, `🎁 ${name} · ${giftName}`, superGift ? 'super' : 'gift'); pulse(lane); }
      else if (kind === 'share') floatText(lane, `🔁 ${name} +${points}`);
      else if (kind === 'follow') floatText(lane, `⭐ ${name} +${points}`);
    });
    api.on('chat', ({ lane, name, text }) => floatText(lane, `💬 ${name}: ${text}`));
    api.on('event', ({ lane, kind }) => {
      floatText(lane, kind === 'mud' ? '🟤 Sa vũng bùn!' : '🍃 Gió xuôi!', 'event');
      const l = st.lanes[lane];
      if (kind === 'mud') for (let k = 0; k < 24; k++) st.dust.push(splash(laneX(lane), yOf(l.p), '#6b4423'));
    });
    api.on('sprint', () => { banner('🔥 NƯỚC RÚT x2 🔥'); if (api.music) api.music.setIntensity(1); });
    api.on('topFans', list => { st.snap.topFans = list; renderFans(); });

    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      st.raf = requestAnimationFrame(loop);
    };
    st.raf = requestAnimationFrame(loop);
  },

  unmount() {
    if (!st) return;
    cancelAnimationFrame(st.raf);
    st.link.remove();
    st = null;
  },
};

// =====================================================================
//                              NỀN TĨNH
// =====================================================================
function buildBackground() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  // trời
  const sky = g.createLinearGradient(0, 0, 0, 440);
  sky.addColorStop(0, '#4fb4ff');
  sky.addColorStop(1, '#bfe9ff');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, 440);
  // mây
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (const [x, y, s] of [[150, 150, 1], [860, 120, 1.2], [520, 70, 0.8], [990, 300, 0.7], [60, 330, 0.8]]) {
    for (const [dx, dy, r] of [[0, 0, 40], [40, -18, 46], [86, 0, 38], [42, 14, 40]]) {
      g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill();
    }
  }
  // đồi xa
  for (const [col, base, amp, ph] of [['#8fd18a', 400, 40, 0], ['#6cc06a', 420, 30, 2]]) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, base - Math.sin(x / 140 + ph) * amp - 20);
    g.lineTo(W, H); g.fill();
  }
  // cỏ có sọc cắt
  for (let y = 420, k = 0; y < H; y += 70, k++) {
    g.fillStyle = k % 2 ? '#4caf50' : '#55b958';
    g.fillRect(0, y, W, 70);
  }

  // khán đài gỗ 2 bên
  for (const x0 of [0, TRACK_R + 10]) {
    const w = TRACK_L - 10;
    g.fillStyle = '#8d5a2b';
    g.fillRect(x0, TRACK_TOP + 10, w, TRACK_BOTTOM - TRACK_TOP - 20);
    for (let y = TRACK_TOP + 10, k = 0; y < TRACK_BOTTOM - 10; y += 46, k++) {
      g.fillStyle = k % 2 ? '#a86f39' : '#b97c42';
      g.fillRect(x0, y, w, 40);
    }
  }

  // đường đua đất
  g.save();
  roundRect(g, TRACK_L - 6, TRACK_TOP, TRACK_R - TRACK_L + 12, TRACK_BOTTOM - TRACK_TOP, 26);
  g.clip();
  const dirt = g.createLinearGradient(0, TRACK_TOP, 0, TRACK_BOTTOM);
  dirt.addColorStop(0, '#d9a066');
  dirt.addColorStop(1, '#c4844b');
  g.fillStyle = dirt;
  g.fillRect(TRACK_L - 6, TRACK_TOP, TRACK_R - TRACK_L + 12, TRACK_BOTTOM - TRACK_TOP);
  // màu làn nhạt
  for (let i = 0; i < 4; i++) {
    g.fillStyle = COLORS[i];
    g.globalAlpha = 0.1;
    g.fillRect(TRACK_L + i * LANE_W, TRACK_TOP, LANE_W, TRACK_BOTTOM - TRACK_TOP);
  }
  g.globalAlpha = 1;
  // hạt đất
  for (let k = 0; k < 2600; k++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(120, 70, 30, .18)' : 'rgba(255, 230, 190, .22)';
    g.beginPath();
    g.arc(rnd(TRACK_L, TRACK_R), rnd(TRACK_TOP, TRACK_BOTTOM), rnd(1, 3.5), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // viền + rào trắng giữa các làn
  g.strokeStyle = '#fff';
  g.lineWidth = 8;
  roundRect(g, TRACK_L - 6, TRACK_TOP, TRACK_R - TRACK_L + 12, TRACK_BOTTOM - TRACK_TOP, 26);
  g.stroke();
  for (let i = 1; i < 4; i++) {
    const x = TRACK_L + i * LANE_W;
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = 5;
    g.setLineDash([34, 20]);
    g.beginPath(); g.moveTo(x, TRACK_TOP + 10); g.lineTo(x, TRACK_BOTTOM - 10); g.stroke();
    g.setLineDash([]);
  }
  // mốc khoảng cách
  g.font = '800 26px system-ui, sans-serif';
  g.textAlign = 'left';
  for (const p of [0.25, 0.5, 0.75]) {
    const y = yOf(p);
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(TRACK_L, y - 2, TRACK_R - TRACK_L, 4);
    g.fillStyle = '#fff';
    g.fillText(`${Math.round(p * 100)}%`, TRACK_R - 66, y - 10);
  }

  // cổng xuất phát
  const gy = START_Y + 70;
  g.fillStyle = '#e9ecef';
  g.fillRect(TRACK_L - 6, gy, TRACK_R - TRACK_L + 12, 16);
  for (let i = 0; i <= 4; i++) {
    const x = TRACK_L + i * LANE_W;
    g.fillStyle = '#adb5bd';
    g.fillRect(x - 6, gy - 50, 12, 66);
  }

  // vạch đích caro
  const sq = 22;
  for (let x = TRACK_L - 6, k = 0; x < TRACK_R + 6; x += sq, k++) {
    for (let r = 0; r < 2; r++) {
      g.fillStyle = (k + r) % 2 ? '#1a1a1a' : '#fff';
      g.fillRect(x, FINISH_Y - sq * 2 + r * sq, sq, sq);
    }
  }
  // cổng đích: cột + băng rôn
  for (const x of [TRACK_L - 26, TRACK_R + 14]) {
    const pg = g.createLinearGradient(x, 0, x + 12, 0);
    pg.addColorStop(0, '#ced4da'); pg.addColorStop(1, '#868e96');
    g.fillStyle = pg;
    g.fillRect(x, 300, 12, FINISH_Y - 300);
  }
  const bx = TRACK_L - 40;
  const bw = TRACK_R - TRACK_L + 80;
  const bgd = g.createLinearGradient(0, 300, 0, 380);
  bgd.addColorStop(0, '#ff4b4b'); bgd.addColorStop(1, '#c92a2a');
  g.fillStyle = bgd;
  roundRect(g, bx, 304, bw, 74, 16);
  g.fill();
  g.strokeStyle = '#fff3bf'; g.lineWidth = 5; g.stroke();
  g.fillStyle = '#fff';
  g.font = '900 46px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('🏁  VỀ ĐÍCH  🏁', W / 2, 358);

  return c;
}

function makeCrowd() {
  const people = [];
  const shirts = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b', '#f8f9fa', '#20c997'];
  const skins = ['#f1c27d', '#e0ac69', '#ffdbac', '#c68642'];
  for (const [x0, x1] of [[10, TRACK_L - 16], [TRACK_R + 16, W - 10]]) {
    for (let y = TRACK_TOP + 36, row = 0; y < TRACK_BOTTOM - 20; y += 46, row++) {
      for (let x = x0 + 16 + (row % 2) * 10; x < x1 - 8; x += 30) {
        people.push({ x, y, shirt: shirts[Math.floor(Math.random() * shirts.length)], skin: skins[Math.floor(Math.random() * skins.length)], ph: rnd(0, 6), flag: Math.random() < 0.12 ? COLORS[Math.floor(Math.random() * 4)] : null });
      }
    }
  }
  return people;
}

// =====================================================================
//                              HUD (DOM)
// =====================================================================
function applySnapshot(snap) {
  if (!snap || !st) return;
  const prevPhase = st.snap && st.snap.phase;
  st.snap = snap;
  st.lanes = snap.lanes.map((l, i) => {
    const old = st.lanes[i] || {};
    return { ...l, p: snap.phase === 'race' && old.p !== undefined ? old.p : l.p, target: l.p, run: old.run || rnd(0, 6), blinkAt: rnd(1, 4), blink: 0 };
  });
  buildCards();
  renderPhaseText();
  updateCards();
  renderFans();
  renderCenter();
  if (st.api.music) st.api.music.setIntensity(snap.phase === 'race' ? 0.85 : snap.phase === 'lobby' ? 0.5 : 0.3);
  if (snap.phase === 'race' && prevPhase !== 'race') banner('🚩 XUẤT PHÁT!');
  if (snap.phase === 'result' && prevPhase !== 'result' && snap.result) {
    burstConfetti();
    if (st.api.music) st.api.music.sting('win');
  }
}

function portrait(canvas, l, i, size, run = 0.8) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  drawAnimal(c, l.animal, canvas.width / 2, canvas.height / 2 + size * 0.05, size, { run, color: COLORS[i], number: i + 1, emoji: l.emoji });
}

function buildCards() {
  const key = st.lanes.map(l => `${l.name}|${l.animal}|${l.emoji}`).join(',');
  if (st.ui.cards._key === key) return;
  st.ui.cards._key = key;
  st.ui.cards.innerHTML = st.lanes.map((l, i) => `
    <div class="rc-card" style="--c:${COLORS[i]};--bg:linear-gradient(180deg, ${COLORS[i]}cc, ${DARK[i]})">
      <div class="num">${i + 1}</div>
      <canvas width="300" height="220"></canvas>
      <div class="nm">${esc(l.name)}</div>
      <div class="meta"></div>
      <div class="bar"><i></i><b></b></div>
    </div>`).join('');
  st.cardEls = [...st.ui.cards.children].map((el, i) => {
    portrait(el.querySelector('canvas'), st.lanes[i], i, 230, 0.4);
    return { el, meta: el.querySelector('.meta'), bar: el.querySelector('.bar i'), barText: el.querySelector('.bar b') };
  });
}

function leaderIndex() {
  return st.lanes.reduce((b, l, i) => (l.target > st.lanes[b].target ? i : b), 0);
}

function updateCards() {
  const s = st.snap;
  const lead = s.phase === 'race' ? leaderIndex() : -1;
  st.cardEls.forEach((c, i) => {
    const l = st.lanes[i];
    const meta = `👥 ${l.members} · 🏆 ${s.wins[i] || 0}`;
    if (c.meta.textContent !== meta) c.meta.textContent = meta;
    const boost = clamp(((l.mult || 1) - 1) / 1.6, 0, 1);
    c.bar.style.width = `${Math.round(boost * 100)}%`;
    c.barText.textContent = s.phase === 'race' ? `⚡ x${(l.mult || 1).toFixed(1)}` : '';
    c.el.classList.toggle('lead', i === lead);
  });
}

function renderPhaseText() {
  const s = st.snap;
  st.ui.pill.className = `rc-pill ${s.phase}`;
  st.ui.pill.textContent = s.phase === 'lobby' ? `CHỌN PHE · ${s.timeLeft}s` : s.phase === 'race' ? '● ĐANG ĐUA' : 'KẾT QUẢ';
  st.ui.round.textContent = `Ván ${s.round}`;
  if (s.phase === 'lobby') {
    const n = st.ui.center.querySelector('.rc-ring .n');
    const arc = st.ui.center.querySelector('.rc-ring .arc');
    if (n) n.textContent = s.timeLeft;
    if (arc) {
      const total = Math.max(1, (st.api.settings && st.api.settings.lobbySeconds) || 30);
      arc.style.strokeDashoffset = String(691 * (1 - clamp(s.timeLeft / total, 0, 1)));
    }
  }
}

function renderFans() {
  const list = st.snap.topFans || [];
  st.ui.fans.innerHTML = list.length
    ? `🔥 Cổ động viên nhiệt nhất: ${list.slice(0, 3).map((f, i) => `<b>${['🥇', '🥈', '🥉'][i]} ${esc(f.name)}</b> ${f.points}đ`).join(' &nbsp; ')}`
    : '🔥 Thả tim, tặng quà để lên bảng cổ động viên!';
}

function renderCenter() {
  const s = st.snap;
  const c = st.ui.center;
  if (s.phase === 'lobby') {
    c.innerHTML = `
      <h2>Ván ${s.round} sắp xuất phát!</h2>
      <div class="rc-ring">
        <svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="110" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="18"/>
        <circle class="arc" cx="130" cy="130" r="110" fill="none" stroke="#ffd43b" stroke-width="18" stroke-linecap="round" stroke-dasharray="691" stroke-dashoffset="0" style="transition: stroke-dashoffset .9s linear"/></svg>
        <div class="n">${s.timeLeft}</div>
      </div>
      <p>Bình luận số để chọn phe cổ vũ</p>
      <div class="rc-choices">${st.lanes.map((l, i) => `<div style="--c:${COLORS[i]}"><canvas width="220" height="160"></canvas><b>${i + 1}</b></div>`).join('')}</div>`;
    c.querySelectorAll('.rc-choices canvas').forEach((cv, i) => portrait(cv, st.lanes[i], i, 170, 0.4));
    c.classList.remove('hidden');
    renderPhaseText();
  } else if (s.phase === 'result' && s.result) {
    const r = s.result;
    const w = st.lanes[r.winner];
    const order = r.order;
    const slot = (rank, cls) => {
      const i = order[rank];
      if (i === undefined) return '';
      return `<div class="p ${cls}"><div class="nm">${esc(st.lanes[i].name)}</div><canvas width="400" height="300" data-i="${i}"></canvas><div class="blk">${rank + 1}</div></div>`;
    };
    c.innerHTML = `
      <h2>🏆 ${esc(w.name)} về nhất!</h2>
      <div class="rc-podium">${slot(1, 'p2')}${slot(0, 'p1')}${slot(2, 'p3')}</div>
      ${r.mvp ? `<div class="rc-mvp">⭐ Cổ động viên nhiệt nhất: <b>${esc(r.mvp.name)}</b> · ${r.mvp.points} điểm</div>` : ''}`;
    c.querySelectorAll('.rc-podium canvas').forEach(cv => {
      const i = Number(cv.dataset.i);
      portrait(cv, st.lanes[i], i, i === r.winner ? 230 : 190);
    });
    c.classList.remove('hidden');
  } else {
    c.classList.add('hidden');
  }
}

function floatText(lane, text, kind = '') {
  if (!st) return;
  const lanesFloats = [...st.ui.floats.children].filter(e => e.dataset.lane === String(lane));
  if (lanesFloats.length >= 3 && !kind) return; // tránh rối mắt
  const el = document.createElement('div');
  el.className = `rc-float ${kind}`;
  el.dataset.lane = lane;
  el.style.setProperty('--c', COLORS[lane]);
  el.textContent = text.length > 26 ? text.slice(0, 25) + '…' : text;
  el.style.left = `${clamp(laneX(lane), 220, W - 220)}px`;
  el.style.top = `${1420 - lanesFloats.length * 46}px`;
  st.ui.floats.appendChild(el);
  while (st.ui.floats.children.length > 16) st.ui.floats.firstChild.remove();
  setTimeout(() => el.remove(), 2100);
}

function pulse(lane) {
  const c = st.cardEls[lane];
  if (!c) return;
  c.el.classList.add('pulse');
  setTimeout(() => c.el.classList.remove('pulse'), 250);
}

function banner(text) {
  const b = document.createElement('div');
  b.className = 'rc-banner';
  b.textContent = text;
  st.ui.hud.appendChild(b);
  setTimeout(() => b.remove(), 2100);
}

// =====================================================================
//                          MÔ PHỎNG HIỂN THỊ
// =====================================================================
function splash(x, y, c) {
  const a = rnd(0, Math.PI * 2);
  const sp = rnd(80, 240);
  return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rnd(5, 11), life: 0.6, max: 0.6, c, grow: 0 };
}

function burstConfetti() {
  for (let i = 0; i < 220; i++) {
    st.confetti.push({ x: rnd(100, 980), y: rnd(-200, 0), vx: rnd(-80, 80), vy: rnd(200, 520), r: rnd(0, 6), vr: rnd(-8, 8), c: `hsl(${rnd(0, 360)}, 90%, 60%)`, life: rnd(3, 5), w: rnd(10, 18) });
  }
}

function update(dt) {
  st.t += dt;
  const racing = st.snap.phase === 'race';
  st.lanes.forEach((l, i) => {
    if (l.target < l.p - 0.05) l.p = l.target; // ván mới: về vạch xuất phát
    l.p += (l.target - l.p) * Math.min(1, dt * 8);
    l.run += dt * (racing ? 9 + (l.mult || 1) * 5 : 0);
    l.blinkAt -= dt;
    if (l.blinkAt <= 0) { l.blink = 0.15; l.blinkAt = rnd(2, 5); }
    l.blink = Math.max(0, l.blink - dt);
    if (racing) {
      const x = laneX(i);
      const y = yOf(l.p) + ANIMAL_SIZE * 0.45 * scaleOf(l.p);
      const n = l.dash ? 3 : (l.mult || 1) > 1.5 ? 2 : Math.random() < 0.6 ? 1 : 0;
      for (let k = 0; k < n; k++) st.dust.push({ x: x + rnd(-36, 36), y: y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(60, 140), r: rnd(7, 13), life: 0.8, max: 0.8, c: l.dash ? COLORS[i] : 'rgba(225, 190, 140, .9)', grow: 14 });
      if (l.effect === 'wind' && Math.random() < 0.5) st.leaves.push({ x: x + rnd(-80, 80), y: yOf(l.p) + 140, vy: -rnd(500, 800), rot: rnd(0, 6), life: 0.8 });
    }
  });
  for (const d of st.dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; d.r += d.grow * dt; }
  st.dust = st.dust.filter(d => d.life > 0);
  if (st.dust.length > 260) st.dust.splice(0, st.dust.length - 260);
  for (const f of st.leaves) { f.y += f.vy * dt; f.rot += dt * 8; f.life -= dt; }
  st.leaves = st.leaves.filter(f => f.life > 0);
  for (const c of st.confetti) { c.x += (c.vx + Math.sin(st.t * 3 + c.r) * 40) * dt; c.y += c.vy * dt; c.r += c.vr * dt; c.life -= dt; }
  st.confetti = st.confetti.filter(c => c.life > 0 && c.y < H);
}

function draw() {
  const { ctx, t } = st;
  const phase = st.snap.phase;
  ctx.drawImage(st.bg, 0, 0);

  // vùng nước rút
  const sp = (st.snap.sprintPercent || 0) / 100;
  if (sp > 0) {
    const y1 = yOf(1 - sp);
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(t * 5) * 0.06;
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(TRACK_L, FINISH_Y, TRACK_R - TRACK_L, y1 - FINISH_Y);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('🔥 NƯỚC RÚT x2', TRACK_R - 14, y1 - 12);
  }

  // khán giả (nhún mạnh hơn khi đang đua)
  const hype = phase === 'race' ? 1 : phase === 'result' ? 1.4 : 0.35;
  for (const p of st.crowd) {
    const j = Math.max(0, Math.sin(t * 7 + p.ph)) * 7 * hype;
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 10 - j, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(p.x, p.y - 4 - j, 8, 0, Math.PI * 2); ctx.fill();
    if (p.flag) {
      const fx = p.x + 8;
      const fy = p.y - 30 - j;
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx, p.y - j); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = p.flag;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 16, fy + 5 + Math.sin(t * 9 + p.ph) * 3); ctx.lineTo(fx, fy + 11); ctx.fill();
    }
  }

  // vũng bùn
  st.lanes.forEach((l, i) => {
    if (l.effect === 'mud') {
      ctx.fillStyle = 'rgba(92, 58, 28, .85)';
      ctx.beginPath(); ctx.ellipse(laneX(i), yOf(l.p) + 20, 92, 56, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(140, 95, 55, .7)';
      ctx.beginPath(); ctx.ellipse(laneX(i) - 20, yOf(l.p) + 10, 40, 20, 0, 0, Math.PI * 2); ctx.fill();
    }
  });

  // bụi
  for (const d of st.dust) {
    ctx.globalAlpha = Math.max(0, d.life / d.max) * 0.55;
    ctx.fillStyle = d.c;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // con vật (con ở dưới vẽ sau => nằm trên)
  const lead = phase === 'lobby' ? -1 : leaderIndex();
  const ranks = st.lanes.map((l, i) => i).sort((a, b) => st.lanes[b].p - st.lanes[a].p);
  const order = st.lanes.map((l, i) => i).sort((a, b) => yOf(st.lanes[a].p) - yOf(st.lanes[b].p));
  for (const i of order) {
    const l = st.lanes[i];
    const s = scaleOf(l.p);
    const size = ANIMAL_SIZE * s;
    const x = laneX(i);
    const y = yOf(l.p);
    const hop = phase === 'race' ? Math.abs(Math.sin(l.run)) * 10 * s : phase === 'lobby' ? Math.max(0, Math.sin(t * 3 + i * 1.3)) * 14 : Math.abs(Math.sin(t * 6 + i)) * (i === st.snap.result?.winner ? 22 : 4);

    if (l.dash) {
      // vệt siêu tốc
      const tg = ctx.createLinearGradient(x, y, x, y + 320);
      tg.addColorStop(0, COLORS[i]);
      tg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = tg;
      ctx.globalAlpha = 0.65;
      ctx.beginPath(); ctx.moveTo(x - size * 0.4, y); ctx.lineTo(x + size * 0.4, y); ctx.lineTo(x + 12, y + 320); ctx.lineTo(x - 12, y + 320); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.shadowColor = COLORS[i];
      ctx.shadowBlur = 50;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, size * 0.62 + Math.sin(t * 20) * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (l.effect === 'wind' || l.dash) {
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const ox = (k - 2) * 26;
        const off = (t * 900 + k * 70) % 160;
        ctx.beginPath(); ctx.moveTo(x + ox, y + 70 + off); ctx.lineTo(x + ox, y + 120 + off); ctx.stroke();
      }
    }

    drawAnimal(ctx, l.animal, x, y, size, { run: l.run, color: COLORS[i], number: i + 1, blink: l.blink > 0 ? 1 : 0, emoji: l.emoji, hop });

    // vương miện cho con dẫn đầu
    if (i === lead) {
      const cy = y - size * 0.82 - hop + Math.sin(t * 5) * 4;
      ctx.font = `${Math.round(54 * s)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', x, cy);
    }
    // thứ hạng khi đang đua
    if (phase === 'race') {
      const rank = ranks.indexOf(i) + 1;
      const bx = x + size * 0.5;
      const by = y - size * 0.35;
      ctx.fillStyle = rank === 1 ? '#ffd43b' : rank === 2 ? '#e9ecef' : rank === 3 ? '#ffa94d' : '#495057';
      ctx.beginPath(); ctx.arc(bx, by, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = rank === 4 ? '#fff' : '#222';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rank), bx, by + 1);
    }
  }

  // lá bay (gió xuôi)
  for (const f of st.leaves) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.fillStyle = '#51cf66';
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // pháo giấy
  for (const c of st.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.r);
    ctx.fillStyle = c.c;
    ctx.fillRect(-c.w / 2, -5, c.w, 10);
    ctx.restore();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
