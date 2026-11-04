/**
 * Phần hiển thị của game Bể cá (chạy trong overlay).
 * Cá được vẽ hoàn toàn bằng code (Canvas 2D) => không cần file ảnh.
 * Muốn thay bằng ảnh PNG sau này: sửa hàm drawFish() để ctx.drawImage(...) theo f.tier.
 */
const W = 1080;
const H = 1920;
const TANK = { top: 430, bottom: 1560, left: 40, right: 1040 };
const SAND_Y = 1600;

// kích thước (chiều dài thân, px) và tốc độ theo bậc
const TIER_LEN = [70, 92, 100, 150, 200, 330];
const TIER_SPEED = [95, 85, 90, 70, 65, 40];
const TIER_ICON = ['🐟', '🐠', '🐠', '🎏', '🐉', '🐋'];

// ---------- tiện ích ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ====================================================================
//                          VẼ CÁ (theo loài)
// ====================================================================
function drawFish(ctx, f, t) {
  const L = f.len * f.pop;
  const wag = Math.sin(t * (f.tier === 5 ? 2.2 : 7) + f.phase) * (f.tier === 5 ? 0.12 : 0.28);
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.dir, 1);
  ctx.rotate(clamp(f.vy / 260, -0.35, 0.35) * f.dir);
  switch (f.tier) {
    case 0: drawGuppy(ctx, L, wag, f); break;
    case 1: drawGoldfish(ctx, L, wag, f); break;
    case 2: drawClown(ctx, L, wag, f); break;
    case 3: drawKoi(ctx, L, wag, f, t); break;
    case 4: drawArowana(ctx, L, wag, f); break;
    default: drawWhale(ctx, L, wag, f);
  }
  ctx.restore();
}

function eye(ctx, x, y, r) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();
}

function body(ctx, L, Hh, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function tail(ctx, L, Hh, wag, fill, spread = 1, length = 0.45) {
  const bx = -L * 0.42;
  ctx.save();
  ctx.translate(bx, 0);
  ctx.rotate(wag);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-L * length * 0.6, -Hh * 0.9 * spread, -L * length, -Hh * 0.75 * spread);
  ctx.quadraticCurveTo(-L * length * 0.75, 0, -L * length, Hh * 0.75 * spread);
  ctx.quadraticCurveTo(-L * length * 0.6, Hh * 0.9 * spread, 0, 0);
  ctx.fill();
  ctx.restore();
}

function drawGuppy(ctx, L, wag, f) {
  const Hh = L * 0.34;
  const hue = f.hue;
  tail(ctx, L, Hh, wag, `hsla(${hue}, 95%, 60%, .9)`, 1.5, 0.55);
  const g = ctx.createLinearGradient(0, -Hh / 2, 0, Hh / 2);
  g.addColorStop(0, '#b9c9d6'); g.addColorStop(1, '#eef4f8');
  body(ctx, L * 0.85, Hh, g);
  ctx.fillStyle = `hsla(${hue}, 90%, 65%, .8)`;
  ctx.beginPath(); ctx.moveTo(-L * 0.1, -Hh * 0.4); ctx.quadraticCurveTo(-L * 0.25, -Hh * 1.1, -L * 0.32, -Hh * 0.3); ctx.fill();
  eye(ctx, L * 0.26, -Hh * 0.08, Hh * 0.17);
}

function drawGoldfish(ctx, L, wag, f) {
  const Hh = L * 0.62;
  tail(ctx, L, Hh, wag, 'rgba(255, 150, 40, .85)', 0.9, 0.5);
  tail(ctx, L, Hh, -wag * 0.6, 'rgba(255, 200, 90, .6)', 0.7, 0.42);
  const g = ctx.createRadialGradient(L * 0.1, -Hh * 0.2, 2, 0, 0, L * 0.55);
  g.addColorStop(0, '#ffd27a'); g.addColorStop(0.6, '#ff8a1e'); g.addColorStop(1, '#e8600a');
  body(ctx, L * 0.85, Hh, g);
  ctx.fillStyle = 'rgba(255, 140, 30, .85)';
  ctx.beginPath(); ctx.moveTo(-L * 0.15, -Hh * 0.42); ctx.quadraticCurveTo(0, -Hh * 0.95, L * 0.12, -Hh * 0.45); ctx.fill();
  eye(ctx, L * 0.24, -Hh * 0.1, Hh * 0.13);
}

function drawClown(ctx, L, wag, f) {
  const Hh = L * 0.48;
  const orange = '#ff7a1a';
  tail(ctx, L, Hh, wag, orange, 0.8, 0.32);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, L * 0.45, Hh / 2, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = orange; ctx.fillRect(-L, -Hh, L * 2, Hh * 2);
  for (const sx of [0.22, -0.05, -0.3]) {
    ctx.fillStyle = '#111'; ctx.fillRect(L * sx - L * 0.07, -Hh, L * 0.14, Hh * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(L * sx - L * 0.05, -Hh, L * 0.1, Hh * 2);
  }
  ctx.restore();
  ctx.fillStyle = orange;
  ctx.beginPath(); ctx.moveTo(-L * 0.2, -Hh * 0.45); ctx.quadraticCurveTo(0, -Hh * 0.95, L * 0.15, -Hh * 0.45); ctx.fill();
  eye(ctx, L * 0.32, -Hh * 0.08, Hh * 0.13);
}

function drawKoi(ctx, L, wag, f, t) {
  const Hh = L * 0.36;
  tail(ctx, L, Hh, wag, 'rgba(255, 255, 255, .85)', 1.1, 0.4);
  const g = ctx.createLinearGradient(0, -Hh / 2, 0, Hh / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e9edf0');
  body(ctx, L, Hh, g);
  // đốm đỏ cố định theo seed
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); ctx.clip();
  const r = seeded(f.seed + 7);
  ctx.fillStyle = '#e8322a';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(rnd2(r, -L * 0.35, L * 0.3), rnd2(r, -Hh * 0.35, Hh * 0.1), rnd2(r, L * 0.08, L * 0.18), rnd2(r, Hh * 0.18, Hh * 0.35), r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // râu
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(L * 0.47, Hh * 0.1); ctx.quadraticCurveTo(L * 0.58, Hh * (0.3 + Math.sin(t * 3) * 0.1), L * 0.52, Hh * 0.45); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.moveTo(L * 0.05, Hh * 0.35); ctx.quadraticCurveTo(-L * 0.02, Hh * 0.9, -L * 0.12, Hh * 0.35); ctx.fill();
  eye(ctx, L * 0.36, -Hh * 0.1, Hh * 0.11);
}
function rnd2(r, a, b) { return a + r() * (b - a); }

function drawArowana(ctx, L, wag, f) {
  const Hh = L * 0.26;
  tail(ctx, L, Hh, wag, 'rgba(255, 190, 60, .9)', 1.6, 0.25);
  // vây lưng + vây hậu môn dài ở phía sau
  ctx.fillStyle = 'rgba(255, 170, 40, .9)';
  ctx.beginPath(); ctx.moveTo(-L * 0.42, -Hh * 0.2); ctx.quadraticCurveTo(-L * 0.25, -Hh * 1.0, -L * 0.05, -Hh * 0.4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L * 0.42, Hh * 0.2); ctx.quadraticCurveTo(-L * 0.25, Hh * 1.0, -L * 0.05, Hh * 0.4); ctx.fill();
  const g = ctx.createLinearGradient(0, -Hh / 2, 0, Hh / 2);
  g.addColorStop(0, '#fff2b0'); g.addColorStop(0.4, '#f4c443'); g.addColorStop(1, '#c98a12');
  body(ctx, L, Hh, g);
  // vảy
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(160, 100, 0, .45)'; ctx.lineWidth = 2;
  const s = Hh * 0.28;
  for (let x = -L * 0.4; x < L * 0.3; x += s) {
    for (let y = -Hh * 0.5; y < Hh * 0.5; y += s * 0.9) {
      ctx.beginPath(); ctx.arc(x, y, s * 0.55, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
  }
  ctx.restore();
  // râu rồng
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(L * 0.48, Hh * 0.15); ctx.lineTo(L * 0.62, Hh * 0.05); ctx.stroke();
  eye(ctx, L * 0.38, -Hh * 0.12, Hh * 0.13);
}

function drawWhale(ctx, L, wag, f) {
  const Hh = L * 0.36;
  // đuôi
  ctx.save();
  ctx.translate(-L * 0.45, -Hh * 0.05);
  ctx.rotate(wag - 0.15);
  ctx.fillStyle = '#2f6fb3';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-L * 0.1, -Hh * 0.2, -L * 0.18, -Hh * 0.45);
  ctx.quadraticCurveTo(-L * 0.12, -Hh * 0.05, -L * 0.2, Hh * 0.25); ctx.quadraticCurveTo(-L * 0.08, Hh * 0.1, 0, 0.1 * Hh); ctx.fill();
  ctx.restore();
  // thân
  const g = ctx.createLinearGradient(0, -Hh / 2, 0, Hh / 2);
  g.addColorStop(0, '#5aa7ea'); g.addColorStop(0.6, '#3b7fc4'); g.addColorStop(1, '#2b5f99');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(L * 0.5, 0);
  ctx.bezierCurveTo(L * 0.5, -Hh * 0.75, -L * 0.2, -Hh * 0.6, -L * 0.48, -Hh * 0.05);
  ctx.bezierCurveTo(-L * 0.2, Hh * 0.45, L * 0.3, Hh * 0.6, L * 0.5, 0);
  ctx.fill();
  // bụng
  ctx.fillStyle = 'rgba(230, 245, 255, .9)';
  ctx.beginPath();
  ctx.moveTo(L * 0.45, Hh * 0.12);
  ctx.bezierCurveTo(L * 0.3, Hh * 0.5, -L * 0.1, Hh * 0.42, -L * 0.25, Hh * 0.18);
  ctx.bezierCurveTo(-L * 0.05, Hh * 0.28, L * 0.3, Hh * 0.3, L * 0.45, Hh * 0.12);
  ctx.fill();
  // vây ngực
  ctx.fillStyle = '#2f6fb3';
  ctx.beginPath(); ctx.ellipse(L * 0.12, Hh * 0.3, L * 0.1, Hh * 0.08, 0.6, 0, Math.PI * 2); ctx.fill();
  // má hồng + mắt
  ctx.fillStyle = 'rgba(255, 140, 170, .45)';
  ctx.beginPath(); ctx.arc(L * 0.3, Hh * 0.12, Hh * 0.08, 0, Math.PI * 2); ctx.fill();
  eye(ctx, L * 0.3, -Hh * 0.08, Hh * 0.06);
}

// ====================================================================
//                              GAME CLIENT
// ====================================================================
let state = null;

export default {
  async mount(root, api) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(link);

    root.innerHTML = `
      <div class="aq">
        <canvas width="${W}" height="${H}"></canvas>
        <div class="aq-hud">
          <div class="aq-top">
            <div class="aq-title">🐠 BỂ CÁ CỦA CẢ NHÀ 🐠</div>
            <div class="aq-goal">
              <div class="aq-goal-label"><span>❤️ Thả tim mở <b>Tiệc bong bóng</b></span><span class="aq-goal-num">0 / 0</span></div>
              <div class="aq-goal-bar"><div class="aq-goal-fill"></div></div>
            </div>
          </div>
          <div class="aq-howto"><span>💬 Bình luận = thả cá</span><span>❤️ Tim = cho cá ăn</span><span>🎁 Quà = cá lớn lên</span></div>
          <div class="aq-lb empty"><h3>🏆 Cá lớn nhất bể</h3><ol></ol></div>
          <div class="aq-banners"></div>
          <div class="aq-party">🎉 TIỆC BONG BÓNG 🎉</div>
          <div class="aq-tiers"></div>
        </div>
      </div>`;

    const el = sel => root.querySelector(sel);
    const canvas = el('canvas');
    const ctx = canvas.getContext('2d');

    state = {
      api, root, ctx, link,
      fish: new Map(), // id -> fish object (vị trí tính ở client)
      food: [],
      bubbles: [],
      sparks: [],
      says: new Map(), // id -> { text, until }
      party: 0,
      t: 0,
      raf: 0,
      ui: {
        goalNum: el('.aq-goal-num'), goalFill: el('.aq-goal-fill'), lb: el('.aq-lb'), lbList: el('.aq-lb ol'),
        banners: el('.aq-banners'), party: el('.aq-party'), tiers: el('.aq-tiers'),
      },
      weeds: Array.from({ length: 14 }, (_, i) => ({ x: 40 + i * 75 + rnd(-20, 20), h: rnd(120, 300), hue: rnd(95, 150), ph: rnd(0, 6) })),
      rocks: Array.from({ length: 7 }, () => ({ x: rnd(0, W), w: rnd(80, 190), h: rnd(40, 90), c: rnd(30, 55) })),
    };

    applySnapshot(api.snapshot);

    api.on('reset', applySnapshot);
    api.on('fish:add', f => addFish(f, true));
    api.on('fish:remove', ({ id }) => {
      const f = state.fish.get(id);
      if (f) f.leaving = true; // bơi ra khỏi màn hình rồi mới xoá
    });
    api.on('fish:update', f => updateFish(f));
    api.on('fish:wave', ({ id }) => { const f = state.fish.get(id); if (f) f.pop = 1.25; });
    api.on('fish:say', ({ id, text }) => state.says.set(id, { text, until: state.t + 5 }));
    api.on('fish:gift', ({ fish, giftName, coins, evolved, from }) => {
      const f = updateFish(fish);
      if (f) { burst(f.x, f.y, evolved ? 60 : 18, evolved ? 'evolve' : 'gift'); f.pop = evolved ? 1.6 : 1.2; }
      if (evolved && fish.tier >= 2 && api.music) api.music.sting('levelup');
      if (evolved && fish.tier >= 2) banner(`✨ <b>${esc(fish.name)}</b> → ${TIER_ICON[fish.tier]} <b>${esc(tierName(fish.tier))}</b>!`, 'evolve', 6);
      else if (evolved) banner(`🎁 <b>${esc(fish.name)}</b> tặng ${esc(giftName)} → ${TIER_ICON[fish.tier]} ${esc(tierName(fish.tier))}`, '', 4);
      else banner(`🎁 <b>${esc(fish.name)}</b> tặng ${esc(giftName)}`, '', 4);
    });
    api.on('fish:update', f => { if (f.follower) banner(`⭐ <b>${esc(f.name)}</b> đã theo dõi`, 'follow', 4); });
    api.on('bubbles', ({ id }) => { const f = state.fish.get(id); if (f) for (let i = 0; i < 25; i++) spawnBubble(f.x + rnd(-30, 30), f.y + rnd(-20, 20), rnd(8, 22)); });
    api.on('food', ({ id, portions }) => {
      const f = state.fish.get(id);
      const cx = f ? f.x : rnd(200, 880);
      for (let i = 0; i < portions * 5; i++) state.food.push({ x: clamp(cx + rnd(-160, 160), 60, 1020), y: TANK.top - rnd(0, 120), vy: rnd(40, 80), hue: rnd(20, 50) });
      if (state.food.length > 220) state.food.splice(0, state.food.length - 220);
    });
    api.on('goal', renderGoal);
    api.on('leaderboard', renderLeaderboard);
    api.on('party', ({ seconds }) => {
      state.party = seconds;
      state.ui.party.classList.add('on');
      if (api.music) { api.music.setIntensity(1); api.music.sting('win'); }
    });

    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      render();
      state.raf = requestAnimationFrame(loop);
    };
    state.raf = requestAnimationFrame(loop);
  },

  onSettings() {},

  unmount() {
    if (!state) return;
    cancelAnimationFrame(state.raf);
    state.link.remove();
    state = null;
  },
};

// ---------------- dữ liệu ----------------
let tiersInfo = [];
const tierName = i => (tiersInfo[i] && tiersInfo[i].name) || '';

function applySnapshot(snap) {
  if (!snap) return;
  state.fish.clear();
  state.says.clear();
  (snap.fish || []).forEach(f => addFish(f, false));
  tiersInfo = snap.tiers || [];
  renderTiers();
  renderGoal(snap.goal);
  renderLeaderboard(snap.leaderboard);
}

function addFish(data, enter) {
  if (state.fish.has(data.id)) return updateFish(data);
  const r = seeded(data.seed || 1);
  const fromLeft = Math.random() < 0.5;
  const f = {
    ...data,
    len: TIER_LEN[data.tier] || 70,
    hue: Math.floor(r() * 360),
    phase: r() * 6,
    x: enter ? (fromLeft ? -150 : W + 150) : rnd(TANK.left + 80, TANK.right - 80),
    y: rnd(TANK.top + 60, TANK.bottom - 60),
    vx: 0, vy: 0, dir: fromLeft ? 1 : -1,
    tx: 0, ty: 0, retarget: 0, pop: enter ? 1.3 : 1, leaving: false,
  };
  pickTarget(f);
  state.fish.set(f.id, f);
  if (enter) for (let i = 0; i < 10; i++) spawnBubble(f.x, f.y, rnd(6, 14));
  return f;
}

function updateFish(data) {
  const f = state.fish.get(data.id) || addFish(data, true);
  Object.assign(f, { name: data.name, tier: data.tier, coins: data.coins, follower: data.follower });
  f.len = TIER_LEN[data.tier] || 70;
  f.leaving = false;
  return f;
}

function pickTarget(f) {
  const margin = f.len * 0.6;
  // cá lớn bơi tầng giữa, cá nhỏ đi khắp bể
  const top = TANK.top + margin + (f.tier >= 4 ? 120 : 0);
  const bottom = TANK.bottom - margin - (f.tier >= 4 ? 80 : 0);
  f.tx = rnd(TANK.left + margin, TANK.right - margin);
  f.ty = rnd(top, bottom);
  f.retarget = rnd(3, 8);
}

// ---------------- hiệu ứng ----------------
function spawnBubble(x, y, r) {
  state.bubbles.push({ x, y, r, vy: rnd(60, 130), ph: rnd(0, 6), party: state.party > 0 });
  if (state.bubbles.length > 400) state.bubbles.shift();
}
function burst(x, y, n, kind) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const sp = rnd(80, kind === 'evolve' ? 420 : 220);
    state.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.6, 1.3), max: 1.3, hue: kind === 'evolve' ? rnd(180, 300) : rnd(30, 60) });
  }
}
function banner(html, kind = '', life = 4) {
  const b = document.createElement('div');
  b.className = `aq-banner ${kind}`;
  b.style.setProperty('--life', `${life}s`);
  b.innerHTML = html;
  state.ui.banners.prepend(b);
  while (state.ui.banners.children.length > 4) state.ui.banners.lastChild.remove();
  setTimeout(() => b.remove(), (life + 0.6) * 1000);
}

// ---------------- HUD ----------------
function renderGoal(g) {
  if (!g || !state) return;
  state.ui.goalNum.textContent = `${g.progress.toLocaleString('vi-VN')} / ${g.target.toLocaleString('vi-VN')}`;
  state.ui.goalFill.style.width = `${clamp((g.progress / g.target) * 100, 0, 100)}%`;
}
function renderLeaderboard(list) {
  if (!state) return;
  list = list || [];
  state.ui.lb.classList.toggle('empty', list.length === 0);
  state.ui.lbList.innerHTML = list.map((p, i) =>
    `<li><span class="n">${i + 1}. ${esc(p.name)}</span><span class="t">${TIER_ICON[p.tier]} ${p.coins} xu</span></li>`).join('');
}
function renderTiers() {
  const box = state.ui.tiers;
  box.innerHTML = '';
  tiersInfo.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'aq-tier';
    d.innerHTML = `<canvas width="240" height="140"></canvas><div class="nm">${esc(t.name)}</div><div class="c">${i === 0 ? 'Bình luận' : `🎁 ${t.coins} xu`}</div>`;
    box.appendChild(d);
    const c = d.querySelector('canvas').getContext('2d');
    const len = i === 5 ? 210 : i >= 3 ? 190 : 150;
    drawFish(c, { x: 120, y: 72, dir: 1, vy: 0, len, pop: 1, tier: i, hue: 300, phase: 0, seed: 12345 }, 0);
  });
}

// ---------------- mô phỏng ----------------
function update(dt) {
  state.t += dt;
  const t = state.t;
  const speedMul = state.party > 0 ? 1.8 : 1;

  if (state.party > 0) {
    state.party -= dt;
    if (Math.random() < 0.6) spawnBubble(rnd(0, W), TANK.bottom + 40, rnd(10, 30));
    if (state.party <= 0) {
      state.ui.party.classList.remove('on');
      if (state.api.music) state.api.music.setIntensity(0.6);
    }
  }
  if (Math.random() < 0.08) spawnBubble(rnd(60, 1020), SAND_Y, rnd(4, 10));

  // thức ăn rơi
  for (const p of state.food) {
    p.y += p.vy * dt;
    p.x += Math.sin(t * 2 + p.y * 0.01) * 10 * dt;
    if (p.y > SAND_Y - 8) { p.y = SAND_Y - 8; p.vy = 0; p.ground = (p.ground || 0) + dt; }
  }
  state.food = state.food.filter(p => !p.eaten && (p.ground || 0) < 6);

  for (const f of [...state.fish.values()]) {
    // mục tiêu: thức ăn gần nhất (nếu có) hoặc điểm ngẫu nhiên
    let target = null;
    if (!f.leaving && state.food.length) {
      let best = 340 * 340;
      for (const p of state.food) {
        const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2;
        if (d < best) { best = d; target = p; }
      }
    }
    let tx, ty;
    if (f.leaving) { tx = f.dir > 0 ? W + 400 : -400; ty = f.y; }
    else if (target) { tx = target.x; ty = target.y; }
    else {
      f.retarget -= dt;
      if (f.retarget <= 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 30) pickTarget(f);
      tx = f.tx; ty = f.ty;
    }
    const dx = tx - f.x;
    const dy = ty - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    const maxSp = TIER_SPEED[f.tier] * speedMul * (target ? 1.8 : 1) * (f.leaving ? 2.2 : 1);
    const steer = 1.6;
    f.vx += ((dx / dist) * maxSp - f.vx) * steer * dt;
    f.vy += ((dy / dist) * maxSp * 0.6 - f.vy) * steer * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (Math.abs(f.vx) > 8) f.dir = f.vx > 0 ? 1 : -1;
    f.pop += (1 - f.pop) * Math.min(1, dt * 3);

    if (target && dist < f.len * 0.35) { target.eaten = true; f.pop = Math.max(f.pop, 1.15); }
    if (f.leaving && (f.x < -350 || f.x > W + 350)) { state.fish.delete(f.id); state.says.delete(f.id); }
    if (f.tier === 5 && Math.random() < dt * 0.4) spawnBubble(f.x + f.dir * f.len * 0.3, f.y - f.len * 0.15, rnd(6, 14));
  }

  for (const b of state.bubbles) { b.y -= b.vy * dt; b.x += Math.sin(t * 3 + b.ph) * 20 * dt; }
  state.bubbles = state.bubbles.filter(b => b.y > TANK.top - 120);

  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.94; s.vy *= 0.94; s.life -= dt; }
  state.sparks = state.sparks.filter(s => s.life > 0);

  for (const [id, s] of state.says) if (s.until < t) state.says.delete(id);
}

// ---------------- vẽ ----------------
function render() {
  const { ctx, t } = state;
  // nước
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const shift = state.party > 0 ? Math.sin(t * 2) * 30 : 0;
  g.addColorStop(0, `hsl(${195 + shift}, 75%, 34%)`);
  g.addColorStop(0.5, `hsl(${205 + shift}, 80%, 22%)`);
  g.addColorStop(1, `hsl(${215 + shift}, 85%, 11%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // tia sáng
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = 120 + i * 180 + Math.sin(t * 0.3 + i) * 60;
    const lg = ctx.createLinearGradient(x, 0, x + 150, H * 0.75);
    lg.addColorStop(0, 'rgba(180, 230, 255, .10)');
    lg.addColorStop(1, 'rgba(180, 230, 255, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 260, H * 0.8); ctx.lineTo(x + 40, H * 0.8); ctx.fill();
  }
  ctx.restore();

  // cát + đá
  const sg = ctx.createLinearGradient(0, SAND_Y - 40, 0, H);
  sg.addColorStop(0, '#d9c08a'); sg.addColorStop(1, '#8e7445');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(0, SAND_Y);
  for (let x = 0; x <= W; x += 60) ctx.lineTo(x, SAND_Y + Math.sin(x * 0.01) * 18);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  for (const r of state.rocks) {
    ctx.fillStyle = `hsl(210, 10%, ${r.c}%)`;
    ctx.beginPath(); ctx.ellipse(r.x, SAND_Y + 10, r.w / 2, r.h / 2, 0, Math.PI, 0); ctx.fill();
  }

  // rong
  for (const w of state.weeds) {
    ctx.strokeStyle = `hsl(${w.hue}, 55%, 32%)`;
    ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w.x, SAND_Y + 10);
    for (let k = 1; k <= 6; k++) {
      const yy = SAND_Y + 10 - (w.h * k) / 6;
      ctx.lineTo(w.x + Math.sin(t * 1.2 + w.ph + k * 0.6) * k * 6, yy);
    }
    ctx.stroke();
  }

  // thức ăn
  for (const p of state.food) {
    ctx.fillStyle = `hsl(${p.hue}, 70%, 55%)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
  }

  // cá (nhỏ vẽ trước, lớn vẽ sau để nằm trên)
  const list = [...state.fish.values()].sort((a, b) => a.tier - b.tier);
  for (const f of list) drawFish(ctx, f, t);
  for (const f of list) drawLabel(ctx, f);

  // bong bóng
  for (const b of state.bubbles) {
    ctx.strokeStyle = b.party ? `hsla(${(b.ph * 60 + t * 80) % 360}, 90%, 70%, .8)` : 'rgba(220, 245, 255, .55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2); ctx.fill();
  }

  // tia lấp lánh
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of state.sparks) {
    ctx.fillStyle = `hsla(${s.hue}, 100%, 65%, ${s.life / s.max})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // bong bóng lời nói
  for (const [id, s] of state.says) {
    const f = state.fish.get(id);
    if (f) drawSpeech(ctx, f, s.text);
  }
}

function drawLabel(ctx, f) {
  const y = f.y + f.len * (f.tier === 5 ? 0.28 : 0.3) + 26;
  const name = (f.follower ? '⭐ ' : '') + f.name;
  ctx.font = `${f.tier >= 3 ? 700 : 600} ${f.tier >= 3 ? 28 : 24}px "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (f.tier >= 2) {
    const w = ctx.measureText(name).width + 24;
    ctx.fillStyle = f.tier >= 4 ? 'rgba(255, 190, 40, .85)' : 'rgba(0, 0, 0, .45)';
    roundRect(ctx, f.x - w / 2, y - 18, w, 36, 18);
    ctx.fill();
    ctx.fillStyle = f.tier >= 4 ? '#2a1800' : '#fff';
    ctx.fillText(name, f.x, y + 1);
  } else {
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(name, f.x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, f.x, y);
  }
}

function drawSpeech(ctx, f, text) {
  ctx.font = '600 26px "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.min(520, ctx.measureText(text).width + 32);
  const x = clamp(f.x, w / 2 + 10, W - w / 2 - 10);
  const y = f.y - f.len * 0.35 - 40;
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  roundRect(ctx, x - w / 2, y - 24, w, 48, 20);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(f.x - 10, y + 22); ctx.lineTo(f.x, y + 38); ctx.lineTo(f.x + 10, y + 22); ctx.fill();
  ctx.fillStyle = '#123';
  let shown = text;
  while (ctx.measureText(shown).width > w - 28 && shown.length > 3) shown = shown.slice(0, -2);
  if (shown !== text) shown = shown.slice(0, -1) + '…';
  ctx.fillText(shown, x, y + 1);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
