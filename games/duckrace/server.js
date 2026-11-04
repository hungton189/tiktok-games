'use strict';
/**
 * GAME: ĐUA VỊT TRÊN SÔNG (kiểu "tool random bằng đua vịt")
 *
 * Vòng chơi:  ĐĂNG KÝ (45s) -> ĐUA (~45s) -> KẾT QUẢ (15s) -> lặp lại
 *  - Bình luận bất kỳ (hoặc đúng từ khoá nếu đặt) => thả 1 con vịt mang tên mình xuống sông.
 *
 * 2 CHẾ ĐỘ (chọn trong Admin, ô "mode"):
 *  - random : BỐC THĂM. Kết quả hoàn toàn ngẫu nhiên, mỗi vịt cơ hội như nhau. Tim chỉ làm nước
 *             xiết hơn cho tất cả. Dùng được như công cụ bốc thăm (nhập danh sách tên tay).
 *  - cheer  : ĐUA CỔ VŨ. Chủ vịt thả tim / bình luận trong lúc đua thì vịt CỦA MÌNH bơi nhanh hơn
 *             (tăng chậm dần, có giới hạn), vẫn còn yếu tố dòng nước ngẫu nhiên.
 *
 * QUÀ TẶNG: ở cả 2 chế độ, quà KHÔNG ảnh hưởng gì tới cuộc đua. Người tặng chỉ được AI cảm ơn
 * và có tên trên dải "Vinh danh". Người thắng chỉ được vinh danh (bảng Vua vịt), không có phần thưởng.
 */
const crypto = require('crypto');

const meta = {
  id: 'duckrace',
  name: 'Đua vịt trên sông',
  description: 'Bình luận để thả vịt mang tên mình xuống sông. 2 chế độ: bốc thăm ngẫu nhiên hoặc đua cổ vũ (tim/bình luận giúp vịt của mình). Quà không ảnh hưởng cuộc đua, chỉ được vinh danh.',
  version: '1.0.0',
  music: 'upbeat',
  adminActions: [
    { id: 'start', label: '▶️ Thả vịt ngay (bắt đầu đua)' },
    { id: 'skip', label: '⏭️ Sang pha tiếp theo' },
    { id: 'clearSim', label: '🧪 Xoá vịt giả lập' },
    { id: 'reset', label: '🗑️ Xoá bảng Vua vịt', danger: true, confirm: 'Xoá toàn bộ thống kê thắng?' },
  ],
};

const defaultSettings = {
  mode: 'random',
  lobbySeconds: 45,
  raceSeconds: 45,
  resultSeconds: 15,
  maxDucks: 40,
  joinKeyword: '',
  manualNames: '',
  manualOnly: false,
  likeFlowBoost: 0.25,
  cheerPerLike: 1,
  cheerPerComment: 4,
  cheerStrength: 0.05,
  cheerMax: 1.3,
  readJoins: true,
  readGifts: true,
  commentary: true,
};

const settingsSchema = {
  mode: { label: 'Chế độ chơi', options: [['random', '🎲 Bốc thăm (ngẫu nhiên)'], ['cheer', '📣 Đua cổ vũ (tim giúp vịt của mình)']] },
  lobbySeconds: { label: 'Thời gian đăng ký (giây)', min: 10, max: 600, step: 1 },
  raceSeconds: { label: 'Thời gian đua chuẩn (giây)', min: 15, max: 180, step: 1 },
  resultSeconds: { label: 'Thời gian công bố kết quả (giây)', min: 5, max: 120, step: 1 },
  maxDucks: { label: 'Số vịt tối đa mỗi ván (đông hơn thì chọn ngẫu nhiên)', min: 2, max: 60, step: 1 },
  joinKeyword: { label: 'Từ khoá để tham gia (để trống = bình luận gì cũng được)' },
  manualNames: { label: 'Danh sách tên nhập tay (cách nhau dấu phẩy)' },
  manualOnly: { label: 'Chỉ đua danh sách nhập tay (người xem không tham gia)' },
  likeFlowBoost: { label: '[Bốc thăm] Tim làm nước chảy nhanh thêm cho tất cả (0.25 = 25%)', min: 0, max: 1, step: 0.05 },
  cheerPerLike: { label: '[Cổ vũ] Điểm cổ vũ / 1 tim', min: 0, step: 0.5 },
  cheerPerComment: { label: '[Cổ vũ] Điểm cổ vũ / 1 bình luận', min: 0, step: 0.5 },
  cheerStrength: { label: '[Cổ vũ] Độ mạnh (x căn bậc 2 điểm gần đây)', min: 0, max: 0.5, step: 0.01 },
  cheerMax: { label: '[Cổ vũ] Tốc độ tối đa nhờ cổ vũ (lần)', min: 1, max: 3, step: 0.05 },
  readJoins: { label: 'Đọc tên người thả vịt' },
  readGifts: { label: 'Đọc lời cảm ơn khi tặng quà (vinh danh)' },
  commentary: { label: 'MC AI bình luận trận đua' },
};

const rand = () => crypto.randomInt(0, 1_000_000) / 1_000_000;
const SPECIAL_EVENTS = ['rapids', 'whirlpool', 'rock'];

function create(ctx) {
  const S = () => ctx.settings;
  const store = ctx.store;
  let wins = store.get('wins', {}); // id -> { name, wins }
  for (const id of Object.keys(wins)) if (id.startsWith('sim_')) delete wins[id];
  let races = store.get('races', 0);

  let phase = 'lobby';
  let phaseEnd = 0;
  let round = races + 1;
  let entrants = new Map(); // id -> { id, name, sim }
  let ducks = []; // trong ván: { id, name, p, speed, target, effect, effectUntil, finishedAt, heat, boost, seed }
  let raceTime = 0;
  let flow = 0; // độ "xiết" do tim, 0..1
  let finishOrder = [];
  let result = null;
  let leader = null;
  let lastComment = 0;
  let lastJoinRead = 0;
  let stateTimer = 0;
  let nextEventAt = 0;
  let honors = []; // tên người tặng quà gần đây (chỉ để vinh danh)
  const isCheer = () => S().mode === 'cheer';
  const HEAT_TAU = 3;

  function seedOf(id) {
    let h = 2166136261;
    for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return (h >>> 0) % 100000;
  }

  function manualList() {
    return String(S().manualNames || '').split(/[,\n]/).map(s => ctx.safety.cleanName(s.trim(), 20)).filter(s => s && s !== 'Bạn ẩn danh');
  }

  function lobbyList() {
    const list = [...entrants.values()];
    for (const name of manualList()) {
      const id = `manual_${name}`;
      if (!entrants.has(id)) list.push({ id, name, manual: true });
    }
    return list;
  }

  function topWinners() {
    return Object.values(wins).sort((a, b) => b.wins - a.wins).slice(0, 5);
  }

  function lobbyPayload() {
    const list = lobbyList();
    return { count: list.length, recent: list.slice(-12).map(e => ({ id: e.id, name: e.name, seed: seedOf(e.id) })) };
  }

  function ducksPayload(full = false) {
    return ducks.map(d => (full
      ? { id: d.id, name: d.name, p: +d.p.toFixed(4), seed: d.seed, effect: d.effect, f: finishOrder.indexOf(d.id) + 1, b: +d.boost.toFixed(2) }
      : { id: d.id, p: +d.p.toFixed(4), effect: d.effect, f: finishOrder.indexOf(d.id) + 1, b: +d.boost.toFixed(2) }));
  }

  function snapshot() {
    return {
      phase,
      round,
      timeLeft: Math.max(0, Math.ceil((phaseEnd - Date.now()) / 1000)),
      lobby: lobbyPayload(),
      ducks: ducksPayload(true),
      result,
      flow,
      topWinners: topWinners(),
      maxDucks: S().maxDucks,
      lobbySeconds: S().lobbySeconds,
      mode: isCheer() ? 'cheer' : 'random',
      honors,
    };
  }

  const say = (t, p = 'normal', key) => ctx.say(t, { priority: p, dedupeKey: key });

  // ---------------- pha ----------------
  function startLobby() {
    phase = 'lobby';
    round = races + 1;
    entrants = new Map();
    ducks = [];
    result = null;
    finishOrder = [];
    flow = 0;
    phaseEnd = Date.now() + S().lobbySeconds * 1000;
    ctx.emit('phase', snapshot());
    say(S().manualOnly
      ? `Ván ${round} chuẩn bị thả vịt!`
      : `Ván ${round} đua vịt bắt đầu đăng ký! ${S().joinKeyword ? `Bình luận ${S().joinKeyword}` : 'Bình luận bất kỳ'} để thả vịt của bạn xuống sông.`, 'high');
  }

  function startRace() {
    let list = lobbyList();
    if (list.length < 2) {
      phaseEnd = Date.now() + 10000; // chưa đủ người thì chờ thêm
      ctx.emit('phase', snapshot());
      return;
    }
    // đông quá thì chọn ngẫu nhiên công bằng
    if (list.length > S().maxDucks) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [list[i], list[j]] = [list[j], list[i]];
      }
      list = list.slice(0, S().maxDucks);
    }
    ducks = list.map(e => ({ id: e.id, name: e.name, sim: e.sim, seed: seedOf(e.id), p: 0, speed: 1, target: 1, retarget: 0, effect: null, effectUntil: 0, finishedAt: 0, heat: 0, boost: 1 }));
    phase = 'race';
    raceTime = 0;
    leader = null;
    nextEventAt = 3 + rand() * 3;
    phaseEnd = Date.now() + S().raceSeconds * 3000;
    ctx.emit('phase', snapshot());
    say(isCheer()
      ? `${ducks.length} chú vịt xuất phát! Thả tim và bình luận để cổ vũ vịt của bạn!`
      : `${ducks.length} chú vịt đã xuống nước. Ba, hai, một, thả vịt!`, 'critical');
  }

  function finishRace() {
    phase = 'result';
    phaseEnd = Date.now() + S().resultSeconds * 1000;
    races += 1;
    store.set('races', races);
    const order = [...ducks].sort((a, b) => (a.finishedAt || 1e9) - (b.finishedAt || 1e9) || b.p - a.p);
    const w = order[0];
    if (!w.sim && !w.id.startsWith('manual_')) {
      const r = (wins[w.id] ||= { name: w.name, wins: 0 });
      r.name = w.name;
      r.wins += 1;
      store.set('wins', wins);
    }
    result = { winner: { id: w.id, name: w.name, seed: w.seed }, top: order.slice(0, 5).map(d => ({ id: d.id, name: d.name, seed: d.seed })), total: ducks.length };
    ctx.emit('phase', snapshot());
    say(`Về nhất là vịt của ${w.name}! Chúc mừng ${w.name}!`, 'critical');
  }

  function nextPhase() {
    if (phase === 'lobby') startRace();
    else if (phase === 'race') finishRace();
    else startLobby();
  }

  // ---------------- tham gia ----------------
  function join(user, source) {
    if (phase !== 'lobby' || S().manualOnly) return false;
    if (entrants.has(user.id)) return false;
    entrants.set(user.id, { id: user.id, name: user.name, sim: source === 'simulator' });
    ctx.emit('joined', { id: user.id, name: user.name, seed: seedOf(user.id), count: lobbyList().length });
    const now = Date.now();
    if (S().readJoins && now - lastJoinRead > 5000) {
      lastJoinRead = now;
      say(`Vịt của ${user.name} đã xuống nước!`, 'low', 'join');
    }
    return true;
  }

  function wantsJoin(text) {
    const kw = String(S().joinKeyword || '').trim().toLowerCase();
    if (!kw) return true;
    return String(text || '').toLowerCase().includes(kw);
  }

  // ---------------- mô phỏng ----------------
  function tickRace(dt) {
    raceTime += dt;
    const base = 1 / S().raceSeconds;
    flow = Math.max(0, flow - dt * 0.08); // tim "nguội" dần
    const flowMul = isCheer() ? 1 : 1 + flow * S().likeFlowBoost;
    const cheer = isCheer();
    const maxP = Math.max(...ducks.map(d => d.p));
    const minP = Math.min(...ducks.map(d => d.p));

    for (const d of ducks) {
      if (d.finishedAt) continue;
      // tốc độ ngẫu nhiên đổi mượt theo thời gian (dòng nước)
      d.retarget -= dt;
      if (d.retarget <= 0) {
        d.target = 0.7 + rand() * 0.65;
        d.retarget = 0.8 + rand() * 1.6;
      }
      d.speed += (d.target - d.speed) * Math.min(1, dt * 1.5);
      let mul = d.speed;
      // giữ cả đàn gần nhau để tới cuối mới ngã ngũ
      const spread = maxP - minP;
      if (spread > 0.04) mul *= 1 + 0.35 * ((maxP - d.p) / spread - 0.5) * Math.min(1, spread * 6);
      if (d.effect && raceTime > d.effectUntil) d.effect = null;
      if (d.effect === 'rapids') mul *= 1.9;
      if (d.effect === 'whirlpool') mul *= 0.15;
      if (d.effect === 'rock') mul *= 0.45;
      // chế độ cổ vũ: điểm cổ vũ gần đây của chủ vịt => nhanh hơn (căn bậc 2, có trần)
      d.heat *= Math.exp(-dt / HEAT_TAU);
      d.boost = cheer ? Math.min(S().cheerMax, 1 + S().cheerStrength * Math.sqrt(d.heat)) : 1;
      mul *= d.boost;
      d.p = Math.min(1, d.p + base * mul * flowMul * dt);
      if (d.p >= 1) {
        d.finishedAt = raceTime;
        finishOrder.push(d.id);
        if (finishOrder.length === 1) ctx.emit('finish', { id: d.id, name: d.name });
      }
    }

    // sự kiện dòng sông ngẫu nhiên (chia đều cho mọi vịt)
    if (raceTime >= nextEventAt) {
      nextEventAt = raceTime + 1.5 + rand() * 2.5;
      const alive = ducks.filter(d => !d.finishedAt && !d.effect && d.p < 0.93);
      if (alive.length) {
        const d = alive[Math.floor(rand() * alive.length)];
        const kind = SPECIAL_EVENTS[Math.floor(rand() * SPECIAL_EVENTS.length)];
        d.effect = kind;
        d.effectUntil = raceTime + (kind === 'whirlpool' ? 2 : kind === 'rock' ? 1.2 : 2.2);
        ctx.emit('event', { id: d.id, kind });
      }
    }

    // bình luận đổi người dẫn đầu
    const lead = ducks.reduce((b, d) => (d.p > b.p ? d : b), ducks[0]);
    if (lead && lead.id !== leader && raceTime > 5) {
      leader = lead.id;
      const now = Date.now();
      if (S().commentary && now - lastComment > 7000) {
        lastComment = now;
        say(`Vịt của ${lead.name} đang dẫn đầu!`, 'low', 'comment');
      }
    }
    // kết thúc khi con đầu về đích + 3 giây (để thấy thứ hạng 2, 3), hoặc tất cả về
    const first = ducks.find(d => d.id === finishOrder[0]);
    if (first && (raceTime - first.finishedAt > 3 || ducks.every(d => d.finishedAt))) finishRace();
  }

  /** Chế độ cổ vũ: chỉ chủ vịt mới cổ vũ được vịt của mình */
  function cheerOwn(user, points, kind) {
    const d = ducks.find(x => x.id === user.id);
    if (!d || d.finishedAt || points <= 0) return;
    d.heat += points;
    if (kind === 'chat' || Math.random() < 0.3) ctx.emit('cheer', { id: d.id, kind });
  }

  return {
    onStart() {
      startLobby();
    },
    getSnapshot: snapshot,

    onEvent(evt) {
      const { user } = evt;
      switch (evt.type) {
        case 'chat':
          if (phase === 'lobby') {
            if (wantsJoin(evt.text)) join(user, evt.source);
          } else if (phase === 'race' && isCheer()) {
            cheerOwn(user, S().cheerPerComment, 'chat');
          }
          break;
        case 'follow':
        case 'share':
          join(user, evt.source);
          break;
        case 'like':
          if (phase === 'race' && isCheer()) cheerOwn(user, evt.count * S().cheerPerLike, 'like');
          else if (phase === 'race') flow = Math.min(1, flow + evt.count * 0.004);
          ctx.emit('hearts', { count: Math.min(5, Math.ceil(evt.count / 5)) });
          break;
        case 'gift': {
          // Quà KHÔNG ảnh hưởng cuộc đua (không nhanh hơn, không tăng cơ hội). Chỉ vinh danh.
          honors = [user.name, ...honors.filter(n => n !== user.name)].slice(0, 8);
          ctx.emit('thanks', { name: user.name, giftName: evt.giftName, honors });
          if (S().readGifts) say(`Cảm ơn ${user.name} đã tặng ${evt.giftName}!`, 'normal', `gift:${user.id}`);
          break;
        }
        default:
          break;
      }
    },

    onTick(dt) {
      if (phase === 'race') tickRace(dt);
      if (Date.now() >= phaseEnd) nextPhase();
      stateTimer += dt;
      if (stateTimer >= 0.1) {
        stateTimer = 0;
        ctx.emit('state', { phase, timeLeft: Math.max(0, Math.ceil((phaseEnd - Date.now()) / 1000)), ducks: phase === 'race' ? ducksPayload() : undefined, flow, count: phase === 'lobby' ? lobbyList().length : ducks.length });
      }
    },

    onSettingsChange() {
      ctx.emit('phase', snapshot());
    },

    onAdminAction(action) {
      if (action === 'start' && phase === 'lobby') startRace();
      if (action === 'skip') nextPhase();
      if (action === 'clearSim') {
        for (const [id, e] of entrants) if (e.sim) entrants.delete(id);
        ctx.emit('phase', snapshot());
      }
      if (action === 'reset') {
        wins = {};
        races = 0;
        store.replace({ wins, races });
        startLobby();
      }
    },

    onStop() {
      store.set('wins', wins);
      store.set('races', races);
    },
  };
}

module.exports = { meta, defaultSettings, settingsSchema, create };
