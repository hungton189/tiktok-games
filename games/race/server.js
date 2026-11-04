'use strict';
/**
 * GAME: ĐẠI HỘI ĐUA THÚ
 *
 * Vòng chơi tự động:  CHỌN PHE (30s) -> ĐUA (~60s) -> KẾT QUẢ (15s) -> lặp lại
 *  - Bình luận 1/2/3/4 (hoặc tên con vật) để vào phe cổ vũ. Chỉ đổi phe được lúc đang chọn phe.
 *  - Tim, share, follow, quà = "điểm cổ vũ" làm con vật phe mình chạy nhanh hơn.
 *  - Người chưa chọn phe mà thả tim/tặng quà => tự xếp vào phe ít người nhất.
 *
 * AN TOÀN (khác với cá cược):
 *  - Không có phần thưởng nào theo KẾT QUẢ. Không ai "được" gì vì chọn đúng phe thắng.
 *  - Điểm cổ vũ chỉ đến từ việc tham gia, chỉ để xếp hạng/được gọi tên, không quy đổi được.
 *  - Không dùng từ ngữ cá cược trong lời đọc hay trên màn hình.
 *
 * CÂN BẰNG (để 1 người tặng quà lớn không quyết định tất cả):
 *  - Tốc độ tăng theo CĂN BẬC HAI của điểm cổ vũ gần đây, có trần tối đa.
 *  - Con bị bỏ xa được cộng thêm tốc độ (đuổi kịp), ván nào cũng sát nút.
 *  - Sự kiện ngẫu nhiên nhỏ (vũng bùn, gió xuôi) tạo bất ngờ.
 */

const meta = {
  id: 'race',
  name: 'Đại hội đua thú',
  description: 'Bình luận 1–4 để chọn phe, thả tim và tặng quà để cổ vũ con vật phe mình chạy nhanh hơn. Vòng chơi tự động lặp lại.',
  version: '1.0.0',
  music: 'upbeat', // phong cách nhạc nền tự tạo (xem public/js/music.js)
  adminActions: [
    { id: 'skip', label: '⏭️ Sang pha tiếp theo' },
    { id: 'clearSim', label: '🧪 Xoá dữ liệu giả lập' },
    { id: 'reset', label: '🗑️ Xoá thống kê & bảng xếp hạng', danger: true, confirm: 'Xoá toàn bộ thống kê thắng và bảng cổ động viên?' },
  ],
};

const defaultSettings = {
  lane1Name: 'Heo', lane1Emoji: '🐷', lane1Animal: 'pig',
  lane2Name: 'Vịt', lane2Emoji: '🦆', lane2Animal: 'duck',
  lane3Name: 'Gà', lane3Emoji: '🐓', lane3Animal: 'chicken',
  lane4Name: 'Trâu', lane4Emoji: '🐃', lane4Animal: 'buffalo',
  lobbySeconds: 30,
  raceSeconds: 55,
  resultSeconds: 15,
  pointsPerLike: 1,
  pointsPerCoin: 20,
  pointsPerShare: 15,
  pointsPerFollow: 20,
  boostStrength: 0.09,
  maxSpeedMultiplier: 2.6,
  catchUp: 2.5,
  sprintPercent: 15,
  superGiftCoins: 99,
  randomEvents: true,
  commentary: true,
};

const settingsSchema = {
  lane1Name: { label: 'Làn 1 – tên' }, lane1Emoji: { label: 'Làn 1 – emoji' }, lane1Animal: { label: 'Làn 1 – hình vẽ (pig, duck, chicken, buffalo; khác = dùng emoji)' },
  lane2Name: { label: 'Làn 2 – tên' }, lane2Emoji: { label: 'Làn 2 – emoji' }, lane2Animal: { label: 'Làn 2 – hình vẽ' },
  lane3Name: { label: 'Làn 3 – tên' }, lane3Emoji: { label: 'Làn 3 – emoji' }, lane3Animal: { label: 'Làn 3 – hình vẽ' },
  lane4Name: { label: 'Làn 4 – tên' }, lane4Emoji: { label: 'Làn 4 – emoji' }, lane4Animal: { label: 'Làn 4 – hình vẽ' },
  lobbySeconds: { label: 'Thời gian chọn phe (giây)', min: 10, max: 120, step: 1 },
  raceSeconds: { label: 'Thời gian đua chuẩn (giây, khi không ai cổ vũ)', min: 20, max: 180, step: 1 },
  resultSeconds: { label: 'Thời gian công bố kết quả (giây)', min: 5, max: 60, step: 1 },
  pointsPerLike: { label: 'Điểm cổ vũ / 1 tim', min: 0, step: 0.5 },
  pointsPerCoin: { label: 'Điểm cổ vũ / 1 xu quà', min: 0, step: 1 },
  pointsPerShare: { label: 'Điểm cổ vũ / 1 share', min: 0, step: 1 },
  pointsPerFollow: { label: 'Điểm cổ vũ / 1 follow', min: 0, step: 1 },
  boostStrength: { label: 'Độ mạnh tăng tốc (x căn bậc 2 điểm)', min: 0, max: 1, step: 0.01 },
  maxSpeedMultiplier: { label: 'Tốc độ tối đa (lần)', min: 1, max: 6, step: 0.1 },
  catchUp: { label: 'Hỗ trợ con bị bỏ xa', min: 0, max: 10, step: 0.1 },
  sprintPercent: { label: 'Đoạn nước rút cuối (%, cổ vũ x2)', min: 0, max: 50, step: 1 },
  superGiftCoins: { label: 'Quà từ bao nhiêu xu thì "lướt siêu tốc"', min: 1, step: 1 },
  randomEvents: { label: 'Sự kiện ngẫu nhiên (vũng bùn, gió xuôi)' },
  commentary: { label: 'MC AI bình luận trận đua' },
};

const HEAT_TAU = 3; // giây: điểm cổ vũ "nguội" dần sau ~3s
const LANES = 4;

function create(ctx) {
  const S = () => ctx.settings;
  const store = ctx.store;

  // ---------- dữ liệu lâu dài (chỉ người xem thật) ----------
  let stats = store.get('stats', { races: 0, wins: [0, 0, 0, 0] });
  let fans = store.get('fans', {}); // id -> { id, name, points }
  for (const id of Object.keys(fans)) if (id.startsWith('sim_')) delete fans[id];

  // ---------- trạng thái ván ----------
  let phase = 'lobby'; // lobby | race | result
  let phaseEnd = Date.now() + S().lobbySeconds * 1000;
  let round = stats.races + 1;
  let members = new Map(); // userId -> laneIndex (chỉ trong ván này)
  let names = new Map(); // userId -> name
  let roundPoints = new Map(); // userId -> điểm cổ vũ ván này
  let lanes = makeLanes();
  let raceTime = 0;
  let nextEventAt = 0;
  let leader = -1;
  let lastCommentAt = 0;
  let sprintAnnounced = false;
  let result = null;
  let stateTimer = 0;
  let fansDirty = false;

  function laneInfo(i) {
    const s = S();
    return { name: s[`lane${i + 1}Name`], emoji: s[`lane${i + 1}Emoji`], animal: s[`lane${i + 1}Animal`] };
  }

  function makeLanes() {
    return Array.from({ length: LANES }, () => ({ p: 0, heat: 0, mult: 1, effect: null, effectUntil: 0, dashUntil: 0, jitter: 0, jitterTarget: 0, finishedAt: 0 }));
  }

  function memberCounts() {
    const c = [0, 0, 0, 0];
    for (const l of members.values()) c[l]++;
    return c;
  }

  function lanesPayload() {
    const counts = memberCounts();
    return lanes.map((l, i) => ({ ...laneInfo(i), members: counts[i], p: +l.p.toFixed(4), mult: +l.mult.toFixed(2), effect: l.effect, dash: l.dashUntil > raceTime }));
  }

  function topFans(n = 5) {
    return Object.values(fans).sort((a, b) => b.points - a.points).slice(0, n).map(f => ({ name: f.name, points: Math.round(f.points) }));
  }

  function snapshot() {
    return {
      phase,
      round,
      timeLeft: Math.max(0, Math.ceil((phaseEnd - Date.now()) / 1000)),
      lanes: lanesPayload(),
      wins: stats.wins,
      topFans: topFans(),
      result,
      sprintPercent: S().sprintPercent,
    };
  }

  function say(text, priority = 'normal', dedupeKey) {
    ctx.say(text, { priority, dedupeKey });
  }

  // ---------- chuyển pha ----------
  function startLobby() {
    phase = 'lobby';
    round = stats.races + 1;
    members = new Map();
    roundPoints = new Map();
    lanes = makeLanes();
    result = null;
    phaseEnd = Date.now() + S().lobbySeconds * 1000;
    ctx.emit('phase', snapshot());
    say(`Ván ${round} chuẩn bị! Bình luận số 1, 2, 3 hoặc 4 để chọn phe cổ vũ.`, 'high');
  }

  function startRace() {
    phase = 'race';
    raceTime = 0;
    leader = -1;
    sprintAnnounced = false;
    nextEventAt = 8 + Math.random() * 8;
    phaseEnd = Date.now() + S().raceSeconds * 2500; // trần thời gian an toàn
    ctx.emit('phase', snapshot());
    say('Ba, hai, một, xuất phát!', 'critical');
  }

  function finishRace(winner) {
    phase = 'result';
    phaseEnd = Date.now() + S().resultSeconds * 1000;
    stats.races += 1;
    stats.wins[winner] += 1;
    store.set('stats', stats);

    // MVP = người cổ vũ nhiều điểm nhất của phe thắng (ghi nhận, không có phần thưởng)
    let mvp = null;
    for (const [id, pts] of roundPoints) {
      if (members.get(id) !== winner) continue;
      if (!mvp || pts > mvp.points) mvp = { name: names.get(id), points: Math.round(pts) };
    }
    const order = lanes.map((l, i) => ({ i, p: l.p })).sort((a, b) => b.p - a.p).map(x => x.i);
    result = { winner, order, mvp, round };
    ctx.emit('phase', snapshot());

    const w = laneInfo(winner).name;
    if (mvp) say(`${w} về nhất! Cổ động viên nhiệt tình nhất của đội ${w} là ${mvp.name}. Cảm ơn bạn!`, 'critical');
    else say(`${w} về nhất ván ${round}!`, 'critical');
  }

  function nextPhase() {
    if (phase === 'lobby') startRace();
    else if (phase === 'race') {
      const best = lanes.reduce((b, l, i) => (l.p > lanes[b].p ? i : b), 0);
      finishRace(best);
    } else startLobby();
  }

  // ---------- người xem ----------
  function pickLaneFromText(text) {
    const t = String(text || '').trim().toLowerCase();
    const m = t.match(/^\s*([1-4])\b/) || t.match(/^(?:số|so|phe|đội|doi)\s*([1-4])\b/);
    if (m) return Number(m[1]) - 1;
    for (let i = 0; i < LANES; i++) {
      const name = laneInfo(i).name.toLowerCase();
      if (name && (t === name || t.startsWith(name + ' ') || t === `đội ${name}` || t === `phe ${name}`)) return i;
    }
    return -1;
  }

  function smallestLane() {
    const c = memberCounts();
    let best = 0;
    for (let i = 1; i < LANES; i++) if (c[i] < c[best]) best = i;
    return best;
  }

  function join(user, lane, auto = false) {
    const prev = members.get(user.id);
    names.set(user.id, user.name);
    if (prev === lane) return;
    if (prev !== undefined && phase !== 'lobby') return; // đang đua thì không đổi phe
    members.set(user.id, lane);
    ctx.emit('joined', { lane, name: user.name, auto, switched: prev !== undefined });
  }

  /** Lấy phe của người xem, chưa có thì tự xếp vào phe ít người nhất */
  function laneOf(user) {
    if (!members.has(user.id)) join(user, smallestLane(), true);
    return members.get(user.id);
  }

  function addSupport(user, points, kind, extra = {}, source) {
    if (points <= 0) return;
    const lane = laneOf(user);
    const sprint = phase === 'race' && lanes[lane].p >= 1 - S().sprintPercent / 100;
    const pts = sprint ? points * 2 : points;
    if (phase === 'race') lanes[lane].heat += pts;
    roundPoints.set(user.id, (roundPoints.get(user.id) || 0) + pts);
    if (source !== 'simulator') {
      const f = (fans[user.id] ||= { id: user.id, name: user.name, points: 0 });
      f.name = user.name;
      f.points += pts;
      fansDirty = true;
    }
    ctx.emit('support', { lane, name: user.name, kind, points: Math.round(pts), sprint, ...extra });
  }

  // ---------- mô phỏng cuộc đua ----------
  function tickRace(dt) {
    raceTime += dt;
    const s = S();
    const base = 1 / s.raceSeconds;
    const leadP = Math.max(...lanes.map(l => l.p));

    lanes.forEach((l, i) => {
      l.heat *= Math.exp(-dt / HEAT_TAU);
      // nhiễu nhỏ, mượt, để các con không chạy đều như máy
      if (Math.random() < dt * 0.8) l.jitterTarget = (Math.random() - 0.5) * 0.24;
      l.jitter += (l.jitterTarget - l.jitter) * Math.min(1, dt * 2);

      let mult = 1 + l.jitter + s.boostStrength * Math.sqrt(l.heat);
      mult += Math.min(0.6, s.catchUp * Math.max(0, leadP - l.p)); // đuổi kịp
      if (l.effect && raceTime > l.effectUntil) l.effect = null;
      if (l.effect === 'mud') mult *= 0.55;
      if (l.effect === 'wind') mult *= 1.35;
      mult = Math.min(mult, s.maxSpeedMultiplier);
      if (l.dashUntil > raceTime) mult = Math.max(mult, s.maxSpeedMultiplier * 1.15);
      l.mult = Math.max(0.3, mult);
      l.p = Math.min(1, l.p + base * l.mult * dt);
      if (l.p >= 1 && !l.finishedAt) l.finishedAt = raceTime;
    });

    // sự kiện ngẫu nhiên
    if (s.randomEvents && raceTime >= nextEventAt) {
      nextEventAt = raceTime + 10 + Math.random() * 10;
      const i = Math.floor(Math.random() * LANES);
      const kind = Math.random() < 0.5 ? 'mud' : 'wind';
      lanes[i].effect = kind;
      lanes[i].effectUntil = raceTime + 3;
      ctx.emit('event', { lane: i, kind });
      if (s.commentary) say(kind === 'mud' ? `Ối, ${laneInfo(i).name} sa vào vũng bùn!` : `Gió xuôi đẩy ${laneInfo(i).name} lên!`, 'low', 'comment');
    }

    // bình luận đổi người dẫn đầu
    const now = Date.now();
    const lead = lanes.reduce((b, l, i) => (l.p > lanes[b].p ? i : b), 0);
    if (lead !== leader && raceTime > 4) {
      leader = lead;
      if (s.commentary && now - lastCommentAt > 7000) {
        lastCommentAt = now;
        say(`${laneInfo(lead).name} đang dẫn đầu!`, 'low', 'comment');
      }
    }
    if (!sprintAnnounced && leadP >= 1 - s.sprintPercent / 100) {
      sprintAnnounced = true;
      ctx.emit('sprint', {});
      say('Vào nước rút! Cổ vũ được nhân đôi!', 'high');
    }

    // về đích: ai chạm vạch trước (cùng tick thì ai vượt xa hơn)
    const done = lanes.map((l, i) => ({ i, l })).filter(x => x.l.p >= 1);
    if (done.length) {
      done.sort((a, b) => a.l.finishedAt - b.l.finishedAt);
      finishRace(done[0].i);
    }
  }

  return {
    onStart() {
      startLobby();
    },

    getSnapshot: snapshot,

    onEvent(evt) {
      const s = S();
      const user = evt.user;
      switch (evt.type) {
        case 'chat': {
          const lane = pickLaneFromText(evt.text);
          if (lane >= 0) {
            if (phase === 'lobby' || !members.has(user.id)) join(user, lane);
            else ctx.emit('chat', { lane: members.get(user.id), name: user.name, text: evt.text });
          } else if (members.has(user.id)) {
            ctx.emit('chat', { lane: members.get(user.id), name: user.name, text: evt.text });
          }
          break;
        }
        case 'like':
          addSupport(user, evt.count * s.pointsPerLike, 'like', { count: evt.count }, evt.source);
          break;
        case 'share':
          addSupport(user, s.pointsPerShare, 'share', {}, evt.source);
          break;
        case 'follow':
          addSupport(user, s.pointsPerFollow, 'follow', {}, evt.source);
          break;
        case 'gift': {
          const lane = laneOf(user);
          const superGift = evt.coins >= s.superGiftCoins;
          addSupport(user, evt.coins * s.pointsPerCoin, 'gift', { giftName: evt.giftName, coins: evt.coins, superGift }, evt.source);
          const team = laneInfo(lane).name;
          if (superGift && phase === 'race') {
            lanes[lane].dashUntil = raceTime + 3;
            say(`${user.name} tặng ${evt.giftName}, đội ${team} lướt siêu tốc!`, 'high');
          } else {
            say(`Cảm ơn ${user.name} đã tặng ${evt.giftName} cổ vũ đội ${team}!`, 'normal', `gift:${user.id}`);
          }
          break;
        }
        default:
          break;
      }
    },

    onTick(dt) {
      if (phase === 'race') tickRace(dt);
      if (phase !== 'race' && Date.now() >= phaseEnd) {
        // chưa ai vào phe thì chờ thêm, tránh đua với khán đài trống
        if (phase === 'lobby' && members.size === 0) phaseEnd = Date.now() + 10000;
        else nextPhase();
      } else if (phase === 'race' && Date.now() >= phaseEnd) nextPhase();

      stateTimer += dt;
      if (stateTimer >= 0.1) {
        stateTimer = 0;
        ctx.emit('state', { phase, timeLeft: Math.max(0, Math.ceil((phaseEnd - Date.now()) / 1000)), lanes: lanesPayload() });
      }
      if (fansDirty) {
        fansDirty = false;
        store.set('fans', fans);
        ctx.emit('topFans', topFans());
      }
    },

    onSettingsChange() {
      ctx.emit('phase', snapshot());
    },

    onAdminAction(action) {
      if (action === 'skip') nextPhase();
      if (action === 'clearSim') {
        for (const id of [...members.keys()]) if (id.startsWith('sim_')) members.delete(id);
        ctx.emit('phase', snapshot());
      }
      if (action === 'reset') {
        stats = { races: 0, wins: [0, 0, 0, 0] };
        fans = {};
        store.replace({ stats, fans });
        startLobby();
      }
    },

    onStop() {
      store.set('stats', stats);
      store.set('fans', fans);
    },
  };
}

module.exports = { meta, defaultSettings, settingsSchema, create };
