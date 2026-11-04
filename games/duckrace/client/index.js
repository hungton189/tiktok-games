/**
 * Phần hiển thị game Đua vịt trên sông.
 * Dòng sông chảy từ trên xuống, camera chạy theo đàn vịt dẫn đầu. Vịt cao su vẽ bằng code.
 */
const W = 1080;
const H = 1920;
const WORLD_H = 7200;
const START_W = 1700; // vạch xuất phát (toạ độ thế giới); phía trên là hồ chờ
const FINISH_W = 6700; // vạch đích
const RIVER_L = 90;
const RIVER_R = 990;
const DUCK_COLORS = ['#ffd43b', '#ffd43b', '#ffd43b', '#ffffff', '#ff8fab', '#74c0fc', '#8ce99a', '#ffa94d', '#ffd43b'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const worldYOf = p => START_W + p * (FINISH_W - START_W);
const bank = (wy, side) => (side < 0 ? RIVER_L : RIVER_R) + Math.sin(wy / 260 + (side < 0 ? 0 : 2)) * 26 + Math.sin(wy / 90) * 6;
function seeded(seed) {
  let s = (seed % 2147483647) || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

let st = null;

// =====================================================================
//                         VẼ VỊT CAO SU (nhìn từ trên)
// =====================================================================
export function drawDuck(ctx, x, y, S, o = {}) {
  const { color = '#ffd43b', t = 0, rot = 0, decor = null, wake = true, bob = 0 } = o;
  ctx.save();
  ctx.translate(x, y);
  if (wake) {
    // gợn nước + vệt sóng phía sau (phía trên, vì vịt trôi xuống)
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.9 + k * 0.5) % 1);
      ctx.globalAlpha = 1 - ph;
      ctx.beginPath();
      ctx.ellipse(0, 0, S * (0.45 + ph * 0.35), S * (0.5 + ph * 0.35), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-S * 0.3, -S * 0.25); ctx.lineTo(-S * 0.55, -S * 0.95);
    ctx.moveTo(S * 0.3, -S * 0.25); ctx.lineTo(S * 0.55, -S * 0.95);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.rotate(rot);
  ctx.translate(0, -bob);
  if (decor === 'sparkle') {
    const g = ctx.createRadialGradient(0, 0, S * 0.2, 0, 0, S * 0.9);
    g.addColorStop(0, 'rgba(255, 240, 150, .7)');
    g.addColorStop(1, 'rgba(255, 240, 150, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, S * 0.9, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 6; k++) {
      const a = t * 2 + (k * Math.PI) / 3;
      star(ctx, Math.cos(a) * S * 0.7, Math.sin(a) * S * 0.7, S * 0.08, '#fff');
    }
  }
  // bóng dưới nước
  ctx.fillStyle = 'rgba(0, 40, 80, .25)';
  ctx.beginPath(); ctx.ellipse(S * 0.06, S * 0.08, S * 0.36, S * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  // đuôi (phía sau = phía trên)
  ctx.fillStyle = shade(color, -18);
  ctx.beginPath(); ctx.moveTo(-S * 0.12, -S * 0.3); ctx.quadraticCurveTo(0, -S * 0.62, S * 0.12, -S * 0.3); ctx.fill();
  // thân
  const g = ctx.createRadialGradient(-S * 0.1, -S * 0.08, S * 0.05, 0, 0, S * 0.48);
  g.addColorStop(0, shade(color, 35));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, S * 0.33, S * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // cánh
  ctx.fillStyle = shade(color, -12);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(s * S * 0.23, -S * 0.02, S * 0.1, S * 0.22, s * 0.2, 0, Math.PI * 2); ctx.fill();
  }
  // đầu (phía trước = phía dưới)
  const hg = ctx.createRadialGradient(-S * 0.05, S * 0.28, S * 0.03, 0, S * 0.34, S * 0.25);
  hg.addColorStop(0, shade(color, 40));
  hg.addColorStop(1, color);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, S * 0.34, S * 0.22, 0, Math.PI * 2); ctx.fill();
  // mỏ
  ctx.fillStyle = '#ff8c1a';
  ctx.beginPath(); ctx.ellipse(0, S * 0.56, S * 0.12, S * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8590c';
  ctx.fillRect(-S * 0.1, S * 0.555, S * 0.2, S * 0.012);
  // mắt
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#1d1414';
    ctx.beginPath(); ctx.arc(s * S * 0.1, S * 0.4, S * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s * S * 0.1 + S * 0.012, S * 0.39, S * 0.014, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 110, 140, .45)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * S * 0.15, S * 0.46, S * 0.04, S * 0.025, 0, 0, Math.PI * 2); ctx.fill(); }

  // đồ trang trí (từ quà)
  if (decor === 'bow') {
    // nơ (luôn có khi đã tặng quà)
    ctx.fillStyle = '#f06595';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, S * 0.18); ctx.lineTo(s * S * 0.13, S * 0.1); ctx.lineTo(s * S * 0.13, S * 0.26); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, S * 0.18, S * 0.035, 0, Math.PI * 2); ctx.fill();
  }
  if (decor === 'glasses') {
    ctx.fillStyle = '#212529';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * S * 0.1, S * 0.41, S * 0.075, S * 0.055, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(-S * 0.04, S * 0.4, S * 0.08, S * 0.02);
  }
  if (decor === 'crown' || decor === 'sparkle') {
    ctx.fillStyle = '#fcc419';
    ctx.strokeStyle = '#e67700';
    ctx.lineWidth = S * 0.015;
    ctx.beginPath();
    ctx.moveTo(-S * 0.14, S * 0.24);
    ctx.lineTo(-S * 0.14, S * 0.1); ctx.lineTo(-S * 0.07, S * 0.17); ctx.lineTo(0, S * 0.06); ctx.lineTo(S * 0.07, S * 0.17); ctx.lineTo(S * 0.14, S * 0.1);
    ctx.lineTo(S * 0.14, S * 0.24); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function star(ctx, x, y, r, c) {
  ctx.fillStyle = c;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.35 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => clamp(v + amt, 0, 255);
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function duckColor(seed) {
  return DUCK_COLORS[seed % DUCK_COLORS.length];
}

// =====================================================================
//                              CLIENT
// =====================================================================
export default {
  mount(root, api) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(link);
    root.innerHTML = `
      <div class="dk">
        <canvas class="dk-main" width="${W}" height="${H}"></canvas>
        <div class="dk-hud">
          <div class="dk-top">
            <div class="dk-title">🦆 ĐUA VỊT TRÊN SÔNG</div>
            <div class="dk-sub"><span class="dk-pill">ĐĂNG KÝ</span><span class="dk-chip dk-count-chip">🦆 0</span><span class="dk-chip dk-round"></span><span class="dk-chip dk-mode"></span></div>
          </div>
          <div class="dk-howto"></div>
          <div class="dk-rank hidden"><h3>🏁 Dẫn đầu</h3><ol></ol></div>
          <div class="dk-map hidden"><div class="fin"></div></div>
          <div class="dk-center hidden"></div>
          <div class="dk-toasts"></div>
          <div class="dk-kings"></div>
        </div>
      </div>`;
    const q = s => root.querySelector(s);
    st = {
      api, link,
      ctx: q('canvas.dk-main').getContext('2d'),
      ui: { pill: q('.dk-pill'), count: q('.dk-count-chip'), round: q('.dk-round'), rank: q('.dk-rank'), rankList: q('.dk-rank ol'), map: q('.dk-map'), center: q('.dk-center'), toasts: q('.dk-toasts'), kings: q('.dk-kings'), hud: q('.dk-hud'), howto: q('.dk-howto'), mode: q('.dk-mode') },
      snap: null,
      ducks: new Map(), // id -> { id, name, p, shown, b (hệ số cổ vũ), seed, effect, color, slot, ph }
      lobbyDucks: [],
      camY: START_W - 1480,
      t: 0,
      hearts: [],
      pops: [],
      splashes: [],
      confetti: [],
      scenery: makeScenery(),
      raf: 0,
    };

    applySnapshot(api.snapshot);
    api.on('phase', applySnapshot);
    api.on('state', s => {
      st.snap.phase = s.phase;
      st.snap.timeLeft = s.timeLeft;
      st.snap.flow = s.flow;
      if (s.ducks) for (const d of s.ducks) { const x = st.ducks.get(d.id); if (x) Object.assign(x, { p: d.p, effect: d.effect, f: d.f, b: d.b }); }
      renderTop(s.count);
    });
    api.on('joined', ({ id, name, seed, count }) => {
      st.snap.lobby.recent = [...(st.snap.lobby.recent || []), { id, name, seed }].slice(-12);
      st.snap.lobby.count = count;
      addLobbyDuck({ id, name, seed });
      renderCenter();
      renderTop(count);
    });
    api.on('thanks', ({ name, honors }) => {
      st.snap.honors = honors;
      toast(`🙏 Cảm ơn ${name}`);
      renderKings(true);
    });
    api.on('cheer', ({ id, kind }) => {
      const d = st.ducks.get(id);
      if (d) st.pops.push({ id, txt: kind === 'chat' ? '📣' : '❤️', life: 1, max: 1, dx: rnd(-30, 30) });
    });
    api.on('event', ({ id, kind }) => {
      const d = st.ducks.get(id);
      if (!d) return;
      if (kind === 'rock') d.rock = 1.2;
      toast(kind === 'rapids' ? `🌊 Vịt ${d.name} gặp dòng xiết!` : kind === 'whirlpool' ? `🌀 Vịt ${d.name} bị xoáy nước!` : `🪨 Vịt ${d.name} va phải đá!`, 'event');
    });
    api.on('hearts', ({ count }) => { for (let i = 0; i < count; i++) st.hearts.push({ x: rnd(140, 940), y: H + 20, vy: rnd(160, 260), s: rnd(26, 44), life: 4, ph: rnd(0, 6) }); });
    api.on('finish', ({ name }) => banner(`🏁 ${name} VỀ NHẤT!`));

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

// ---------------- dữ liệu ----------------
function slotOf(seed, i, n) {
  // vị trí ngang cố định cho từng vịt, rải đều + lệch ngẫu nhiên theo seed
  const r = seeded(seed + 11);
  const base = n > 1 ? i / (n - 1) : 0.5;
  return clamp(0.08 + base * 0.84 + (r() - 0.5) * 0.08, 0.05, 0.95);
}

function applySnapshot(snap) {
  if (!snap || !st) return;
  const prev = st.snap && st.snap.phase;
  st.snap = snap;
  st.ducks = new Map();
  const n = (snap.ducks || []).length;
  // xáo thứ tự slot theo seed để các vịt không xếp theo thứ tự đăng ký
  const order = [...(snap.ducks || [])].sort((a, b) => (a.seed % 997) - (b.seed % 997));
  order.forEach((d, i) => st.ducks.set(d.id, { ...d, shown: d.p, color: duckColor(d.seed), slot: slotOf(d.seed, i, n), ph: (d.seed % 628) / 100, spin: 0 }));
  st.lobbyDucks = [];
  if (snap.phase === 'lobby') (snap.lobby.recent || []).forEach(addLobbyDuck);
  renderTop(snap.phase === 'lobby' ? snap.lobby.count : n);
  renderCenter();
  renderKings();
  renderHowto();
  st.ui.rank.classList.toggle('hidden', snap.phase !== 'race');
  st.ui.map.classList.toggle('hidden', snap.phase !== 'race');
  if (snap.phase === 'race' && prev !== 'race') { banner('🦆 THẢ VỊT!'); buildMap(); }
  if (st.api.music) st.api.music.setIntensity(snap.phase === 'race' ? 0.85 : snap.phase === 'lobby' ? 0.4 : 0.3);
  if (snap.phase === 'result' && prev !== 'result') {
    for (let i = 0; i < 220; i++) st.confetti.push({ x: rnd(80, 1000), y: rnd(-300, 0), vy: rnd(220, 520), vx: rnd(-60, 60), r: rnd(0, 6), vr: rnd(-8, 8), c: `hsl(${rnd(0, 360)}, 90%, 60%)`, life: rnd(3, 5), w: rnd(10, 18) });
    if (st.api.music) st.api.music.sting('win');
  }
}

function addLobbyDuck(d) {
  if (st.lobbyDucks.some(x => x.id === d.id)) return;
  st.lobbyDucks.push({ ...d, color: duckColor(d.seed), x: rnd(RIVER_L + 90, RIVER_R - 90), y: rnd(START_W - 640, START_W - 70), vx: rnd(-20, 20), vy: rnd(-10, 10), ph: rnd(0, 6), drop: 1 });
  if (st.lobbyDucks.length > 60) st.lobbyDucks.shift();
}

// ---------------- HUD ----------------
function renderTop(count) {
  const s = st.snap;
  st.ui.pill.className = `dk-pill ${s.phase}`;
  st.ui.pill.textContent = s.phase === 'lobby' ? `ĐĂNG KÝ · ${s.timeLeft}s` : s.phase === 'race' ? '● ĐANG ĐUA' : 'KẾT QUẢ';
  st.ui.count.textContent = `🦆 ${count ?? 0}`;
  st.ui.round.textContent = `Ván ${s.round}`;
  const big = st.ui.center.querySelector('.dk-big');
  if (big && s.phase === 'lobby') big.textContent = s.timeLeft;
}

function renderCenter() {
  const s = st.snap;
  const c = st.ui.center;
  if (s.phase === 'lobby') {
    const recent = (s.lobby.recent || []).slice().reverse();
    c.innerHTML = `
      <h2>Thả vịt của bạn xuống sông!</h2>
      <div class="dk-big">${s.timeLeft}</div>
      <div class="dk-count">🦆 ${s.lobby.count} vịt đã xuống nước</div>
      <p>${s.mode === 'cheer' ? '💬 Bình luận để tham gia · lúc đua thả tim cổ vũ vịt của bạn' : '💬 Bình luận để tham gia · 🎲 kết quả ngẫu nhiên'}</p>
      <div class="dk-joiners">${recent.map((r, i) => `<span class="${i === 0 ? 'new' : ''}">🦆 ${esc(r.name)}</span>`).join('')}</div>`;
    c.style.top = '310px';
    c.classList.remove('hidden');
  } else if (s.phase === 'result' && s.result) {
    const r = s.result;
    c.innerHTML = `
      <h2>🏆 VỀ NHẤT 🏆</h2>
      <div class="dk-winner"><canvas width="600" height="600"></canvas><div class="nm">${esc(r.winner.name)}</div></div>
      <p>Thắng trong ${r.total} chú vịt</p>
      <div class="dk-top5">${r.top.slice(1, 5).map((d, i) => `<div>${['🥈', '🥉', '4️⃣', '5️⃣'][i]} ${esc(d.name)}</div>`).join('')}</div>`;
    const cv = c.querySelector('canvas');
    const cx = cv.getContext('2d');
    drawDuck(cx, 300, 290, 300, { color: duckColor(r.winner.seed), decor: 'crown', wake: false }); // vương miện = vinh danh người thắng
    c.style.top = '520px';
    c.classList.remove('hidden');
  } else {
    c.classList.add('hidden');
  }
}

/** Dải dưới cùng: luân phiên bảng "Vua vịt" và "Vinh danh" người tặng quà */
function renderKings(showHonors = false) {
  const list = st.snap.topWinners || [];
  const honors = st.snap.honors || [];
  const kings = list.length
    ? `👑 Vua vịt: ${list.slice(0, 3).map(k => `<b>${esc(k.name)}</b> ×${k.wins}`).join(' &nbsp;·&nbsp; ')}`
    : '👑 Thắng ván để lên bảng Vua vịt!';
  const thanks = honors.length ? `🙏 Vinh danh: ${honors.slice(0, 4).map(n => `<b>${esc(n)}</b>`).join(' · ')}` : null;
  st.ui.kings.innerHTML = showHonors && thanks ? thanks : kings;
  clearTimeout(st.kingsTimer);
  if (thanks) st.kingsTimer = setTimeout(() => st && renderKings(!showHonors), 6000);
}

function renderHowto() {
  const cheer = st.snap.mode === 'cheer';
  st.ui.howto.innerHTML = cheer
    ? '<span>💬 Bình luận = thả vịt</span><span>❤️ Tim = vịt bạn bơi nhanh</span><span>🙏 Quà = vinh danh</span>'
    : '<span>💬 Bình luận = thả vịt</span><span>🎲 Kết quả ngẫu nhiên</span><span>🙏 Quà = vinh danh</span>';
  st.ui.mode.textContent = cheer ? '📣 Cổ vũ' : '🎲 Bốc thăm';
}

function buildMap() {
  st.ui.map.querySelectorAll('b').forEach(b => b.remove());
  st.mapDots = new Map();
  for (const d of st.ducks.values()) {
    const b = document.createElement('b');
    st.ui.map.appendChild(b);
    st.mapDots.set(d.id, b);
  }
}

function updateRankUI(sorted) {
  const top = sorted.slice(0, 5);
  const html = top.map((d, i) => `<li><i>${['🥇', '🥈', '🥉', '4.', '5.'][i]}</i>${esc(d.name)}</li>`).join('');
  if (st.ui.rankList._h !== html) { st.ui.rankList.innerHTML = html; st.ui.rankList._h = html; }
  if (!st.mapDots) return;
  sorted.forEach((d, i) => {
    const b = st.mapDots.get(d.id);
    if (!b) return;
    b.style.top = `${clamp(d.shown, 0, 1) * 100}%`;
    b.className = i < 3 ? `t${i + 1}` : '';
  });
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `dk-toast ${kind}`;
  el.textContent = text.length > 34 ? text.slice(0, 33) + '…' : text;
  st.ui.toasts.appendChild(el);
  while (st.ui.toasts.children.length > 2) st.ui.toasts.firstChild.remove();
  setTimeout(() => el.remove(), 3000);
}

function banner(text) {
  const b = document.createElement('div');
  b.className = 'dk-banner';
  b.textContent = text;
  st.ui.hud.appendChild(b);
  setTimeout(() => b.remove(), 2100);
}

// ---------------- cảnh vật hai bên bờ ----------------
function makeScenery() {
  const items = [];
  const r = seeded(4242);
  for (let wy = 0; wy < WORLD_H + 400; wy += 70) {
    for (const side of [-1, 1]) {
      const k = r();
      const type = k < 0.38 ? 'tree' : k < 0.58 ? 'bush' : k < 0.72 ? 'rock' : k < 0.86 ? 'reed' : 'flower';
      const edge = bank(wy, side);
      const x = side < 0 ? edge - 20 - r() * (edge - 30) : edge + 20 + r() * (W - edge - 30);
      items.push({ type, x, wy: wy + r() * 60, s: 0.7 + r() * 0.6, side });
    }
    if (r() < 0.35) items.push({ type: 'lily', x: RIVER_L + 60 + r() * (RIVER_R - RIVER_L - 120), wy: wy + r() * 60, s: 0.7 + r() * 0.5 });
  }
  return items;
}

// ---------------- cập nhật ----------------
function update(dt) {
  st.t += dt;
  const s = st.snap;
  const all = [...st.ducks.values()];
  for (const d of all) {
    d.shown += (d.p - d.shown) * Math.min(1, dt * 6);
    if (d.effect === 'whirlpool') d.spin += dt * 9;
    else d.spin += (Math.round(d.spin / (Math.PI * 2)) * Math.PI * 2 - d.spin) * Math.min(1, dt * 4);
    if (d.rock) d.rock = Math.max(0, d.rock - dt);
    if (d.effect === 'rapids' && Math.random() < 0.5) st.splashes.push({ x: duckX(d), wy: worldYOf(d.shown) - 30, vx: rnd(-80, 80), vy: rnd(-120, -40), r: rnd(4, 9), life: 0.6 });
  }
  // vịt chờ ở hồ xuất phát
  for (const d of st.lobbyDucks) {
    d.drop = Math.max(0, d.drop - dt * 2);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.x < RIVER_L + 80 || d.x > RIVER_R - 80) d.vx *= -1;
    if (d.y < START_W - 660 || d.y > START_W - 50) d.vy *= -1;
  }
  // camera
  let target = START_W - 1480; // đăng ký: nhìn hồ chờ phía trên vạch xuất phát
  if (s.phase === 'race' && all.length) {
    const sorted = ranked(all);
    const top = sorted.slice(0, 3);
    const focus = top.reduce((a, d) => a + worldYOf(d.shown), 0) / top.length;
    target = focus - 1000;
    updateRankUI(sorted);
  } else if (s.phase === 'result') {
    target = FINISH_W - 1250;
  }
  target = clamp(target, 0, WORLD_H - H);
  st.camY += (target - st.camY) * Math.min(1, dt * (s.phase === 'race' ? 2.5 : 1.2));

  for (const h of st.hearts) { h.y -= h.vy * dt; h.life -= dt; }
  for (const p of st.pops) p.life -= dt;
  st.pops = st.pops.filter(p => p.life > 0);
  if (st.pops.length > 60) st.pops.splice(0, st.pops.length - 60);
  st.hearts = st.hearts.filter(h => h.life > 0 && h.y > 200);
  for (const p of st.splashes) { p.x += p.vx * dt; p.wy += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
  st.splashes = st.splashes.filter(p => p.life > 0);
  for (const c of st.confetti) { c.x += (c.vx + Math.sin(st.t * 3 + c.r) * 40) * dt; c.y += c.vy * dt; c.r += c.vr * dt; c.life -= dt; }
  st.confetti = st.confetti.filter(c => c.life > 0 && c.y < H);
}

/** Xếp hạng: vịt đã về đích theo thứ tự về, sau đó tới vịt đi xa nhất */
function ranked(list) {
  return list.slice().sort((a, b) => {
    const fa = a.f || 1e9;
    const fb = b.f || 1e9;
    return fa - fb || b.shown - a.shown;
  });
}

function duckX(d) {
  const wy = worldYOf(d.shown);
  const l = bank(wy, -1) + 70;
  const r = bank(wy, 1) - 70;
  return l + (r - l) * d.slot + Math.sin(st.t * 0.9 + d.ph) * 18;
}

// ---------------- vẽ ----------------
function draw() {
  const { ctx, t } = st;
  const cam = st.camY;
  const s = st.snap;

  // cỏ hai bên
  ctx.fillStyle = '#58b85b';
  ctx.fillRect(0, 0, W, H);
  for (let y = -((cam * 1) % 120); y < H; y += 120) {
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    ctx.fillRect(0, y, W, 60);
  }
  // mặt sông
  const step = 20;
  ctx.beginPath();
  for (let sy = -step; sy <= H + step; sy += step) ctx.lineTo(bank(sy + cam, -1), sy);
  for (let sy = H + step; sy >= -step; sy -= step) ctx.lineTo(bank(sy + cam, 1), sy);
  ctx.closePath();
  const water = ctx.createLinearGradient(RIVER_L, 0, RIVER_R, 0);
  water.addColorStop(0, '#1c7ed6');
  water.addColorStop(0.5, '#339af0');
  water.addColorStop(1, '#1c7ed6');
  ctx.fillStyle = water;
  ctx.fill();
  // bờ cát
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#e6c88a';
  ctx.stroke();
  ctx.save();
  ctx.clip();
  // sóng chảy xuống (tốc độ theo độ xiết)
  const flowSpeed = 140 + (s.flow || 0) * 260 + (s.phase === 'race' ? 120 : 0);
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const off = (t * flowSpeed + cam) % 160;
  for (let wy = -160; wy < H + 160; wy += 160) {
    for (let k = 0; k < 6; k++) {
      const x = RIVER_L + 60 + k * 150 + ((wy + cam - off) / 160 % 2 ? 60 : 0);
      const y = wy + off - (cam % 160) + (k % 2) * 50;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 22, y + 10, x + 44, y);
      ctx.stroke();
    }
  }
  ctx.restore();

  // cảnh vật
  for (const it of st.scenery) {
    const y = it.wy - cam;
    if (y < -160 || y > H + 160) continue;
    drawScenery(ctx, it, y, t);
  }

  // vạch xuất phát (cầu gỗ) + vạch đích
  const sy = START_W - cam;
  if (sy > -100 && sy < H + 100) {
    ctx.fillStyle = '#8d5a2b';
    ctx.fillRect(0, sy - 18, W, 36);
    for (let x = 0; x < W; x += 36) { ctx.fillStyle = x % 72 ? '#a86f39' : '#9c6533'; ctx.fillRect(x, sy - 18, 34, 36); }
    ctx.fillStyle = '#fff';
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('XUẤT PHÁT', W / 2, sy);
  }
  const fy = FINISH_W - cam;
  if (fy > -200 && fy < H + 200) {
    const sq = 24;
    for (let x = bank(FINISH_W, -1) - 10, k = 0; x < bank(FINISH_W, 1) + 10; x += sq, k++) {
      for (let r = 0; r < 2; r++) { ctx.fillStyle = (k + r) % 2 ? '#111' : '#fff'; ctx.fillRect(x, fy + r * sq - sq, sq, sq); }
    }
    for (const x of [bank(FINISH_W, -1) - 30, bank(FINISH_W, 1) + 18]) { ctx.fillStyle = '#ced4da'; ctx.fillRect(x, fy - 190, 12, 190); }
    ctx.fillStyle = '#e03131';
    roundRect(ctx, RIVER_L - 30, fy - 200, RIVER_R - RIVER_L + 60, 70, 16);
    ctx.fill();
    ctx.strokeStyle = '#fff3bf'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏁  VỀ ĐÍCH  🏁', W / 2, fy - 164);
  }

  // vịt chờ (đăng ký)
  if (s.phase === 'lobby') {
    for (const d of st.lobbyDucks) {
      const y = d.y - cam;
      drawDuck(ctx, d.x, y, 74, { color: d.color, t: t + d.ph, bob: Math.sin(t * 3 + d.ph) * 3 + d.drop * 60 });
      label(ctx, d.name, d.x, y + 62, false);
    }
  }

  // vịt đang đua
  const all = [...st.ducks.values()];
  const n = all.length;
  const size = n > 25 ? 70 : n > 12 ? 84 : 100;
  const sorted = ranked(all);
  const showName = new Set(sorted.slice(0, 6).map(d => d.id));
  const drawOrder = all.slice().sort((a, b) => a.shown - b.shown);
  for (const d of drawOrder) {
    const wy = worldYOf(d.shown);
    const y = wy - cam;
    if (y < -120 || y > H + 120) continue;
    const x = duckX(d);
    if (d.effect === 'whirlpool') {
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y, size * (0.5 + k * 0.25), t * 6 + k, t * 6 + k + 4); ctx.stroke(); }
    }
    if (d.rock > 0) {
      ctx.fillStyle = '#868e96';
      ctx.beginPath(); ctx.ellipse(x + 10, y + size * 0.7, size * 0.45, size * 0.28, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#adb5bd';
      ctx.beginPath(); ctx.ellipse(x, y + size * 0.64, size * 0.25, size * 0.14, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    if ((d.b || 1) > 1.08) {
      // đang được cổ vũ: vệt sóng mạnh phía sau + vòng sáng
      const k = clamp(((d.b || 1) - 1) / 0.6, 0, 1);
      ctx.strokeStyle = `rgba(255, 230, 120, ${0.4 + 0.5 * k})`;
      ctx.lineWidth = 5;
      for (let j = 0; j < 3; j++) {
        const o = ((t * 500 + j * 40) % 120);
        ctx.beginPath(); ctx.moveTo(x + (j - 1) * 22, y - size * 0.6 - o); ctx.lineTo(x + (j - 1) * 22, y - size * 0.6 - o - 40 * k); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, size * (0.62 + 0.05 * Math.sin(t * 12)), 0, Math.PI * 2); ctx.stroke();
    }
    drawDuck(ctx, x, y, size, { color: d.color, t: t + d.ph, rot: d.spin, bob: Math.sin(t * 4 + d.ph) * 3 });
    const rank = sorted.indexOf(d);
    if (rank === 0 && s.phase !== 'lobby') {
      ctx.font = `${Math.round(size * 0.5)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', x, y - size * 0.75 + Math.sin(t * 5) * 4);
    }
    if (showName.has(d.id) || (d.b || 1) > 1.08) label(ctx, `${rank < 3 ? ['🥇', '🥈', '🥉'][rank] + ' ' : ''}${d.name}`, x, y + size * 0.8, rank < 3);
  }

  // bọt nước
  for (const p of st.splashes) {
    ctx.fillStyle = `rgba(255,255,255,${p.life / 0.6})`;
    ctx.beginPath(); ctx.arc(p.x, p.wy - cam, p.r, 0, Math.PI * 2); ctx.fill();
  }
  // biểu tượng cổ vũ bay lên từ vịt
  for (const p of st.pops) {
    const d = st.ducks.get(p.id);
    if (!d) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.font = '40px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.txt, duckX(d) + p.dx, worldYOf(d.shown) - cam - 60 - (1 - p.life) * 90);
  }
  ctx.globalAlpha = 1;
  // tim bay
  for (const h of st.hearts) {
    ctx.globalAlpha = clamp(h.life / 1.5, 0, 1);
    ctx.font = `${h.s}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('❤️', h.x + Math.sin(t * 3 + h.ph) * 20, h.y);
  }
  ctx.globalAlpha = 1;
  // pháo giấy
  for (const c of st.confetti) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
    ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -5, c.w, 10);
    ctx.restore();
  }
}

function label(ctx, text, x, y, strong) {
  const t = text.length > 14 ? text.slice(0, 13) + '…' : text;
  ctx.font = `${strong ? 800 : 700} ${strong ? 26 : 21}px "Be Vietnam Pro", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(t).width + 18;
  ctx.fillStyle = strong ? 'rgba(255, 212, 59, .95)' : 'rgba(0, 30, 60, .7)';
  roundRect(ctx, x - w / 2, y - 16, w, 32, 16);
  ctx.fill();
  ctx.fillStyle = strong ? '#3b2500' : '#fff';
  ctx.fillText(t, x, y + 1);
}

function drawScenery(ctx, it, y, t) {
  const { x, s } = it;
  switch (it.type) {
    case 'tree': {
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(x + 8, y + 10, 46 * s, 40 * s, 0, 0, Math.PI * 2); ctx.fill();
      for (const [dx, dy, r, c] of [[0, 0, 44, '#2b8a3e'], [-14, -10, 30, '#37b24d'], [12, -16, 24, '#51cf66']]) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'bush':
      for (const [dx, r] of [[-14, 18], [0, 22], [14, 17]]) { ctx.fillStyle = '#40c057'; ctx.beginPath(); ctx.arc(x + dx * s, y, r * s, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.arc(x - 6 * s, y - 6 * s, 4 * s, 0, Math.PI * 2); ctx.arc(x + 9 * s, y + 2 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'rock':
      ctx.fillStyle = '#868e96';
      ctx.beginPath(); ctx.ellipse(x, y, 30 * s, 20 * s, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#adb5bd';
      ctx.beginPath(); ctx.ellipse(x - 6 * s, y - 5 * s, 15 * s, 9 * s, 0.4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'reed':
      ctx.strokeStyle = '#2f9e44';
      ctx.lineWidth = 4;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(x + k * 7, y + 18);
        ctx.quadraticCurveTo(x + k * 9 + Math.sin(t * 2 + k) * 5, y - 10, x + k * 11 + Math.sin(t * 2 + k) * 8, y - 34 * s);
        ctx.stroke();
      }
      ctx.fillStyle = '#8d5a2b';
      ctx.beginPath(); ctx.ellipse(x + 2, y - 28 * s, 4, 10, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'flower':
      for (let k = 0; k < 5; k++) {
        const a = (k * Math.PI * 2) / 5;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fcc419';
      ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'lily':
      ctx.fillStyle = '#2f9e44';
      ctx.beginPath(); ctx.arc(x, y, 26 * s, 0.3, Math.PI * 2 - 0.1); ctx.lineTo(x, y); ctx.fill();
      if (s > 1) { ctx.fillStyle = '#faa2c1'; ctx.beginPath(); ctx.arc(x + 6, y - 4, 8, 0, Math.PI * 2); ctx.fill(); }
      break;
    default:
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
