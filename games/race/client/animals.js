/**
 * Con vật vẽ bằng code, nhìn từ trên xuống (đầu hướng lên trên = hướng chạy), kiểu hoạt hình chibi.
 *
 * drawAnimal(ctx, kind, x, y, size, opts)
 *   kind : 'pig' | 'duck' | 'chicken' | 'buffalo'  (loại khác => vẽ emoji opts.emoji)
 *   size : chiều dài thân (px)
 *   opts : { run: pha chạy (radian, tăng dần khi chạy), color: màu áo số, number, blink: 0..1, emoji }
 */

const TAU = Math.PI * 2;

function ell(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
  ctx.fill();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function eyes(ctx, S, y, dx, r, blink = 0) {
  for (const s of [-1, 1]) {
    const x = s * dx;
    if (blink > 0.5) {
      ctx.strokeStyle = '#2a1a1a';
      ctx.lineWidth = r * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y);
      ctx.quadraticCurveTo(x, y + r * 0.6, x + r * 0.8, y);
      ctx.stroke();
      continue;
    }
    ell(ctx, x, y, r, r * 1.1, '#fff');
    ell(ctx, x, y - r * 0.15, r * 0.68, r * 0.78, '#1d1414');
    ell(ctx, x + r * 0.25, y - r * 0.45, r * 0.26, r * 0.26, '#fff');
  }
}

function blush(ctx, S, y, dx, r, color = 'rgba(255, 110, 140, .45)') {
  ell(ctx, -dx, y, r, r * 0.6, color);
  ell(ctx, dx, y, r, r * 0.6, color);
}

/** áo số trên lưng */
function bib(ctx, S, y, color, number) {
  const w = S * 0.36;
  const h = S * 0.26;
  ctx.fillStyle = color;
  rrect(ctx, -w / 2, y - h / 2, w, h, S * 0.06);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = S * 0.025;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.round(S * 0.2)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = S * 0.04;
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.strokeText(String(number), 0, y + S * 0.01);
  ctx.fillText(String(number), 0, y + S * 0.01);
}

/** 4 chân chạy theo cặp chéo */
function legs(ctx, S, run, { color, front, back, spread, w, h, feet }) {
  const a = Math.sin(run);
  const pos = [
    [-spread, front, a], [spread, front, -a],
    [-spread, back, -a], [spread, back, a],
  ];
  for (const [x, y, k] of pos) {
    const yy = y + k * S * 0.09;
    ctx.fillStyle = color;
    rrect(ctx, x - w / 2, yy - h / 2, w, h, w / 2);
    ctx.fill();
    if (feet) ell(ctx, x, yy - h / 2 + w * 0.3, w * 0.62, w * 0.45, feet);
  }
}

// ---------------------------------------------------------------- HEO
function pig(ctx, S, o) {
  const run = o.run;
  legs(ctx, S, run, { color: '#e97a9c', front: -S * 0.16, back: S * 0.26, spread: S * 0.27, w: S * 0.13, h: S * 0.2, feet: '#b9506f' });
  // đuôi xoăn
  ctx.strokeStyle = '#e97a9c';
  ctx.lineWidth = S * 0.035;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tw = Math.sin(run * 2) * 0.6;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const r = S * 0.07 * (1 - t * 0.5);
    const ang = t * TAU * 1.4 + tw;
    const px = Math.cos(ang) * r;
    const py = S * 0.52 + t * S * 0.06 + Math.sin(ang) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  // thân
  const g = ctx.createRadialGradient(-S * 0.1, -S * 0.05, S * 0.05, 0, S * 0.08, S * 0.5);
  g.addColorStop(0, '#ffd3df');
  g.addColorStop(1, '#f48fb1');
  ell(ctx, 0, S * 0.1, S * 0.34, S * 0.42, g);
  bib(ctx, S, S * 0.14, o.color, o.number);
  // đầu
  const hg = ctx.createRadialGradient(-S * 0.06, -S * 0.42, S * 0.03, 0, -S * 0.32, S * 0.3);
  hg.addColorStop(0, '#ffe0ea');
  hg.addColorStop(1, '#f7a1bd');
  ell(ctx, 0, -S * 0.32, S * 0.27, S * 0.24, hg);
  // tai (vẫy theo nhịp chạy), vẽ đè lên đầu
  const flap = Math.sin(run * 2) * 0.12;
  for (const sd of [-1, 1]) {
    ctx.save();
    ctx.translate(sd * S * 0.19, -S * 0.47);
    ctx.rotate(sd * (0.55 + flap));
    ctx.fillStyle = '#f27aa2';
    ctx.beginPath();
    ctx.moveTo(-S * 0.085, S * 0.05);
    ctx.quadraticCurveTo(-S * 0.02, -S * 0.17, S * 0.02, -S * 0.15);
    ctx.quadraticCurveTo(S * 0.09, -S * 0.02, S * 0.085, S * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffb8cc';
    ctx.beginPath();
    ctx.moveTo(-S * 0.04, S * 0.03);
    ctx.quadraticCurveTo(0, -S * 0.1, S * 0.04, S * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  blush(ctx, S, -S * 0.27, S * 0.17, S * 0.05);
  eyes(ctx, S, -S * 0.38, S * 0.1, S * 0.05, o.blink);
  // mõm
  ell(ctx, 0, -S * 0.22, S * 0.11, S * 0.075, '#f27aa2');
  ell(ctx, -S * 0.04, -S * 0.22, S * 0.022, S * 0.03, '#a8405f');
  ell(ctx, S * 0.04, -S * 0.22, S * 0.022, S * 0.03, '#a8405f');
}

// ---------------------------------------------------------------- VỊT
function duck(ctx, S, o) {
  const run = o.run;
  // chân màng cam
  const a = Math.sin(run);
  for (const [s, k] of [[-1, a], [1, -a]]) {
    const y = S * 0.3 + k * S * 0.1;
    ctx.fillStyle = '#ff9d1e';
    ctx.beginPath();
    ctx.moveTo(s * S * 0.13, y - S * 0.1);
    ctx.lineTo(s * S * 0.13 - S * 0.09, y + S * 0.06);
    ctx.lineTo(s * S * 0.13 + S * 0.09, y + S * 0.06);
    ctx.closePath();
    ctx.fill();
  }
  // đuôi
  ell(ctx, 0, S * 0.45, S * 0.1, S * 0.08, '#ffe066');
  // cánh vỗ
  const flap = Math.sin(run * 2) * 0.35;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * S * 0.27, S * 0.08);
    ctx.rotate(s * (0.25 + flap));
    ell(ctx, s * S * 0.06, S * 0.02, S * 0.1, S * 0.24, '#ffc93a');
    ctx.restore();
  }
  // thân
  const g = ctx.createRadialGradient(-S * 0.08, -S * 0.02, S * 0.05, 0, S * 0.1, S * 0.45);
  g.addColorStop(0, '#fff6b8');
  g.addColorStop(1, '#ffd43b');
  ell(ctx, 0, S * 0.12, S * 0.3, S * 0.38, g);
  bib(ctx, S, S * 0.16, o.color, o.number);
  // đầu
  const hg = ctx.createRadialGradient(-S * 0.06, -S * 0.4, S * 0.03, 0, -S * 0.3, S * 0.26);
  hg.addColorStop(0, '#fffbd6');
  hg.addColorStop(1, '#ffd84d');
  ell(ctx, 0, -S * 0.3, S * 0.23, S * 0.22, hg);
  // chỏm tóc
  ctx.strokeStyle = '#ffcc1a';
  ctx.lineWidth = S * 0.035;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -S * 0.5);
  ctx.quadraticCurveTo(S * 0.08, -S * 0.62, S * 0.02, -S * 0.66);
  ctx.stroke();
  blush(ctx, S, -S * 0.26, S * 0.15, S * 0.045);
  eyes(ctx, S, -S * 0.36, S * 0.09, S * 0.048, o.blink);
  // mỏ
  ctx.fillStyle = '#ff8c1a';
  rrect(ctx, -S * 0.11, -S * 0.27, S * 0.22, S * 0.1, S * 0.05);
  ctx.fill();
  ctx.strokeStyle = '#d96a00';
  ctx.lineWidth = S * 0.015;
  ctx.beginPath();
  ctx.moveTo(-S * 0.09, -S * 0.22);
  ctx.lineTo(S * 0.09, -S * 0.22);
  ctx.stroke();
}

// ---------------------------------------------------------------- GÀ
function chicken(ctx, S, o) {
  const run = o.run;
  // chân vàng mảnh
  const a = Math.sin(run);
  ctx.strokeStyle = '#f2a516';
  ctx.lineWidth = S * 0.045;
  ctx.lineCap = 'round';
  for (const [s, k] of [[-1, a], [1, -a]]) {
    const y = S * 0.32 + k * S * 0.11;
    ctx.beginPath();
    ctx.moveTo(s * S * 0.11, S * 0.2);
    ctx.lineTo(s * S * 0.11, y);
    ctx.moveTo(s * S * 0.11 - S * 0.06, y + S * 0.03);
    ctx.lineTo(s * S * 0.11, y - S * 0.02);
    ctx.lineTo(s * S * 0.11 + S * 0.06, y + S * 0.03);
    ctx.stroke();
  }
  // đuôi lông
  const sway = Math.sin(run * 2) * 0.15;
  const tails = [['#2f7d4f', -0.45], ['#b8321e', 0], ['#2f7d4f', 0.45]];
  for (const [c, ang] of tails) {
    ctx.save();
    ctx.translate(0, S * 0.36);
    ctx.rotate(ang + sway);
    ell(ctx, 0, S * 0.14, S * 0.06, S * 0.17, c);
    ctx.restore();
  }
  // cánh
  const flap = Math.sin(run * 2) * 0.3;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * S * 0.25, S * 0.08);
    ctx.rotate(s * (0.2 + flap));
    ell(ctx, s * S * 0.05, 0, S * 0.09, S * 0.21, '#c9763a');
    ctx.restore();
  }
  // thân nâu cam
  const g = ctx.createRadialGradient(-S * 0.08, 0, S * 0.04, 0, S * 0.1, S * 0.42);
  g.addColorStop(0, '#ffcf8f');
  g.addColorStop(1, '#e0843d');
  ell(ctx, 0, S * 0.1, S * 0.28, S * 0.35, g);
  bib(ctx, S, S * 0.14, o.color, o.number);
  // mào đỏ
  ctx.fillStyle = '#e8352a';
  for (const [dx, r] of [[-0.07, 0.06], [0, 0.075], [0.07, 0.06]]) ell(ctx, S * dx, -S * 0.52, S * r, S * r, '#e8352a');
  // đầu
  const hg = ctx.createRadialGradient(-S * 0.05, -S * 0.38, S * 0.03, 0, -S * 0.3, S * 0.24);
  hg.addColorStop(0, '#ffe2b8');
  hg.addColorStop(1, '#f0a35a');
  ell(ctx, 0, -S * 0.32, S * 0.2, S * 0.21, hg);
  eyes(ctx, S, -S * 0.37, S * 0.085, S * 0.045, o.blink);
  // mỏ + yếm
  ctx.fillStyle = '#ffb21a';
  ctx.beginPath();
  ctx.moveTo(-S * 0.06, -S * 0.27);
  ctx.lineTo(S * 0.06, -S * 0.27);
  ctx.lineTo(0, -S * 0.17);
  ctx.closePath();
  ctx.fill();
  ell(ctx, 0, -S * 0.14, S * 0.04, S * 0.05, '#e8352a');
}

// ---------------------------------------------------------------- TRÂU
function buffalo(ctx, S, o) {
  const run = o.run;
  legs(ctx, S, run, { color: '#3e4650', front: -S * 0.14, back: S * 0.3, spread: S * 0.3, w: S * 0.15, h: S * 0.22, feet: '#22272d' });
  // đuôi
  ctx.strokeStyle = '#3e4650';
  ctx.lineWidth = S * 0.03;
  ctx.beginPath();
  ctx.moveTo(0, S * 0.5);
  ctx.quadraticCurveTo(Math.sin(run * 2) * S * 0.1, S * 0.62, Math.sin(run * 2) * S * 0.06, S * 0.7);
  ctx.stroke();
  ell(ctx, Math.sin(run * 2) * S * 0.06, S * 0.71, S * 0.035, S * 0.05, '#22272d');
  // thân to
  const g = ctx.createRadialGradient(-S * 0.1, 0, S * 0.05, 0, S * 0.1, S * 0.5);
  g.addColorStop(0, '#8a94a0');
  g.addColorStop(1, '#4b545f');
  ell(ctx, 0, S * 0.12, S * 0.37, S * 0.44, g);
  bib(ctx, S, S * 0.16, o.color, o.number);
  // sừng cong lớn
  ctx.strokeStyle = '#efe2c4';
  ctx.lineWidth = S * 0.075;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * S * 0.12, -S * 0.48);
    ctx.quadraticCurveTo(s * S * 0.42, -S * 0.5, s * S * 0.4, -S * 0.72);
    ctx.stroke();
  }
  // tai ngang
  for (const s of [-1, 1]) ell(ctx, s * S * 0.25, -S * 0.36, S * 0.09, S * 0.045, '#59626d', s * -0.3);
  // đầu
  const hg = ctx.createRadialGradient(-S * 0.05, -S * 0.42, S * 0.03, 0, -S * 0.32, S * 0.3);
  hg.addColorStop(0, '#9aa4ae');
  hg.addColorStop(1, '#56606b');
  ell(ctx, 0, -S * 0.33, S * 0.22, S * 0.24, hg);
  eyes(ctx, S, -S * 0.4, S * 0.1, S * 0.045, o.blink);
  // mõm sáng + vòng mũi
  ell(ctx, 0, -S * 0.2, S * 0.15, S * 0.09, '#c9c2b6');
  ell(ctx, -S * 0.05, -S * 0.2, S * 0.022, S * 0.028, '#3a332b');
  ell(ctx, S * 0.05, -S * 0.2, S * 0.022, S * 0.028, '#3a332b');
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = S * 0.02;
  ctx.beginPath();
  ctx.arc(0, -S * 0.15, S * 0.04, 0, Math.PI);
  ctx.stroke();
}

const DRAWERS = { pig, duck, chicken, buffalo };
export const ANIMAL_KINDS = Object.keys(DRAWERS);

export function drawAnimal(ctx, kind, x, y, size, opts = {}) {
  const o = { run: 0, color: '#ff4d6d', number: 1, blink: 0, emoji: '❓', hop: 0, ...opts };
  ctx.save();
  ctx.translate(x, y);
  // bóng đổ (không nảy theo con vật)
  ell(ctx, 0, size * 0.18, size * 0.36, size * 0.48, 'rgba(0,0,0,.22)');
  ctx.translate(0, -o.hop);
  // nhún: co giãn nhẹ theo nhịp chạy
  const sq = 1 + Math.sin(o.run * 2) * 0.035;
  ctx.scale(1 / sq, sq);
  const fn = DRAWERS[kind];
  if (fn) fn(ctx, size, o);
  else {
    ctx.font = `${Math.round(size * 0.9)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.emoji, 0, 0);
  }
  ctx.restore();
}
