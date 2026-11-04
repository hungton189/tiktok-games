'use strict';
/**
 * GAME: BỂ CÁ CHUNG
 * - Bình luận / vào live  => thả 1 con cá mang tên mình vào bể
 * - Thả tim               => rắc thức ăn, góp vào mục tiêu chung "Tiệc bong bóng"
 * - Follow                => cá được gắn ngôi sao
 * - Share                 => cá thổi bong bóng
 * - Tặng quà              => cộng dồn xu, cá lớn lên theo BẬC CỐ ĐỊNH (không có ngẫu nhiên)
 * Cá và tổng xu được lưu lại, người xem quay lại buổi sau vẫn thấy cá của mình.
 */

const TIERS = [
  { key: 'guppy', name: 'Cá bảy màu' },
  { key: 'goldfish', name: 'Cá vàng' },
  { key: 'clownfish', name: 'Cá hề' },
  { key: 'koi', name: 'Cá Koi' },
  { key: 'arowana', name: 'Cá rồng' },
  { key: 'whale', name: 'Cá voi xanh' },
];

const meta = {
  id: 'aquarium',
  name: 'Bể cá chung',
  description: 'Bình luận để thả cá mang tên mình, thả tim cho cá ăn, tặng quà để cá lớn lên. Cá được lưu qua các buổi live.',
  version: '1.0.0',
  music: 'calm', // phong cách nhạc nền tự tạo (xem public/js/music.js)
  adminActions: [
    { id: 'party', label: '🎉 Thử tiệc bong bóng' },
    { id: 'empty', label: '🧹 Cho cá rời bể (giữ điểm)' },
    { id: 'clearSim', label: '🧪 Xoá cá giả lập' },
    { id: 'reset', label: '🗑️ Xoá toàn bộ dữ liệu bể cá', danger: true, confirm: 'Xoá hết cá và điểm của mọi người? Không hoàn tác được.' },
  ],
};

const defaultSettings = {
  maxVisibleFish: 45,
  idleMinutes: 20,
  goalLikes: 1000,
  likesPerFood: 15,
  tier1Coins: 1,
  tier2Coins: 10,
  tier3Coins: 50,
  tier4Coins: 200,
  tier5Coins: 1000,
  readWelcome: true,
  readGifts: true,
  readFollow: true,
  partySeconds: 12,
};

const settingsSchema = {
  maxVisibleFish: { label: 'Số cá tối đa trên màn hình', min: 5, max: 120, step: 1 },
  idleMinutes: { label: 'Cá rời bể sau (phút không tương tác)', min: 1, max: 600, step: 1 },
  goalLikes: { label: 'Mục tiêu tim cho tiệc bong bóng', min: 50, step: 50 },
  likesPerFood: { label: 'Số tim / 1 lần rắc thức ăn', min: 1, step: 1 },
  tier1Coins: { label: `Xu để thành ${TIERS[1].name}`, min: 1, step: 1 },
  tier2Coins: { label: `Xu để thành ${TIERS[2].name}`, min: 1, step: 1 },
  tier3Coins: { label: `Xu để thành ${TIERS[3].name}`, min: 1, step: 1 },
  tier4Coins: { label: `Xu để thành ${TIERS[4].name}`, min: 1, step: 1 },
  tier5Coins: { label: `Xu để thành ${TIERS[5].name}`, min: 1, step: 1 },
  readWelcome: { label: 'Đọc tên người mới thả cá' },
  readGifts: { label: 'Đọc lời cảm ơn khi tặng quà' },
  readFollow: { label: 'Đọc lời cảm ơn khi follow' },
  partySeconds: { label: 'Thời gian tiệc bong bóng (giây)', min: 3, max: 60, step: 1 },
};

const MAX_STORED_FISH = 5000;

function create(ctx) {
  const { store } = ctx;
  /** @type {Record<string, any>} tất cả cá từng được thả (lưu file) */
  const fishes = store.get('fish', {});
  // cá giả lập (id "sim_...") không bao giờ được lưu; dọn sạch nếu bản cũ lỡ lưu
  for (const id of Object.keys(fishes)) if (id.startsWith('sim_') || fishes[id].sim) delete fishes[id];
  const visible = new Set(); // id cá đang ở trên màn hình
  let goal = store.get('goal', { progress: 0, level: 0 });
  let likeBucket = 0;
  let lastWelcomeAt = 0;
  let lastLeaderboardKey = '';
  let goalDirty = false;
  let sweepTimer = 0;

  const S = () => ctx.settings;
  const thresholds = () => [0, S().tier1Coins, S().tier2Coins, S().tier3Coins, S().tier4Coins, S().tier5Coins];
  const tierOf = coins => {
    const th = thresholds();
    let t = 0;
    for (let i = 1; i < th.length; i++) if (coins >= th[i]) t = i;
    return t;
  };

  function persist() {
    // chỉ lưu cá của người xem thật, dữ liệu giả lập chỉ tồn tại trong RAM
    const real = {};
    for (const [id, f] of Object.entries(fishes)) if (!f.sim) real[id] = f;
    store.set('fish', real);
  }

  function publicFish(f) {
    return { id: f.id, name: f.name, tier: f.tier, coins: f.coins, follower: !!f.follower, seed: f.seed };
  }

  function seedOf(id) {
    let h = 2166136261;
    for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return (h >>> 0) % 100000;
  }

  /** Đảm bảo người xem có cá và cá đang ở trên màn hình. Trả về { fish, isNew, returned } */
  function ensureFish(user, source) {
    let f = fishes[user.id];
    let isNew = false;
    let returned = false;
    if (!f) {
      f = fishes[user.id] = { id: user.id, name: user.name, coins: 0, tier: 0, follower: false, seed: seedOf(user.id), firstSeen: Date.now(), sim: source === 'simulator' };
      isNew = true;
    }
    f.name = user.name || f.name;
    f.lastActive = Date.now();
    if (!visible.has(f.id)) {
      if (!isNew) returned = true;
      makeRoom();
      visible.add(f.id);
      ctx.emit('fish:add', publicFish(f));
    }
    return { fish: f, isNew, returned };
  }

  /** Bể đầy: cho con cá nhỏ nhất + lâu không tương tác nhất rời bể (vẫn lưu điểm) */
  function makeRoom() {
    while (visible.size >= S().maxVisibleFish) {
      let victim = null;
      for (const id of visible) {
        const f = fishes[id];
        if (!victim || f.tier < victim.tier || (f.tier === victim.tier && f.lastActive < victim.lastActive)) victim = f;
      }
      if (!victim) break;
      removeVisible(victim.id);
    }
  }

  function removeVisible(id) {
    if (visible.delete(id)) ctx.emit('fish:remove', { id });
  }

  function leaderboard() {
    return Object.values(fishes)
      .filter(f => f.coins > 0)
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 5)
      .map(f => ({ id: f.id, name: f.name, coins: f.coins, tier: f.tier }));
  }

  function pushLeaderboard(force = false) {
    const lb = leaderboard();
    const key = JSON.stringify(lb);
    if (force || key !== lastLeaderboardKey) {
      lastLeaderboardKey = key;
      ctx.emit('leaderboard', lb);
    }
  }

  function goalPayload() {
    return { progress: goal.progress, target: S().goalLikes, level: goal.level };
  }

  function tiersPayload() {
    const th = thresholds();
    return TIERS.map((t, i) => ({ ...t, coins: th[i] }));
  }

  function startParty(reason) {
    ctx.emit('party', { seconds: S().partySeconds, reason });
  }

  function prune() {
    const ids = Object.keys(fishes);
    if (ids.length <= MAX_STORED_FISH) return;
    // xoá bớt cá chưa từng tặng quà, lâu không quay lại nhất
    ids.map(id => fishes[id])
      .filter(f => f.coins === 0 && !visible.has(f.id))
      .sort((a, b) => a.lastActive - b.lastActive)
      .slice(0, ids.length - MAX_STORED_FISH)
      .forEach(f => delete fishes[f.id]);
  }

  return {
    onStart() {
      ctx.log(`Bể cá có ${Object.keys(fishes).length} cá đã lưu`);
    },

    getSnapshot() {
      return {
        fish: [...visible].map(id => publicFish(fishes[id])),
        goal: goalPayload(),
        leaderboard: leaderboard(),
        tiers: tiersPayload(),
      };
    },

    onEvent(evt) {
      const { user } = evt;
      switch (evt.type) {
        case 'join': {
          const { fish, isNew, returned } = ensureFish(user, evt.source);
          const now = Date.now();
          if ((isNew || returned) && S().readWelcome && now - lastWelcomeAt > 6000) {
            lastWelcomeAt = now;
            ctx.say(isNew ? `Chào ${fish.name}, cá của bạn đã vào bể rồi nè!` : `${fish.name} đã quay lại bể cá!`, { priority: 'low', dedupeKey: 'welcome' });
          }
          if (!isNew && !returned) ctx.emit('fish:wave', { id: fish.id });
          break;
        }
        case 'chat': {
          const { fish } = ensureFish(user, evt.source);
          ctx.emit('fish:say', { id: fish.id, text: evt.text });
          break;
        }
        case 'like': {
          const { fish } = ensureFish(user, evt.source);
          likeBucket += evt.count;
          const per = Math.max(1, S().likesPerFood);
          if (likeBucket >= per) {
            const portions = Math.min(6, Math.floor(likeBucket / per));
            likeBucket -= portions * per;
            ctx.emit('food', { id: fish.id, portions });
          }
          goal.progress += evt.count;
          goalDirty = true;
          if (goal.progress >= S().goalLikes) {
            goal.progress = 0;
            goal.level += 1;
            startParty('goal');
            ctx.say(`Tuyệt vời! Cả nhà đã thả đủ ${S().goalLikes} tim. Tiệc bong bóng lần thứ ${goal.level} bắt đầu!`, { priority: 'high' });
          }
          break;
        }
        case 'follow': {
          const { fish } = ensureFish(user, evt.source);
          if (!fish.follower) {
            fish.follower = true;
            ctx.emit('fish:update', publicFish(fish));
            if (S().readFollow) ctx.say(`Cảm ơn ${fish.name} đã theo dõi, cá của bạn được gắn ngôi sao!`, { priority: 'normal' });
          }
          persist();
          break;
        }
        case 'share': {
          const { fish } = ensureFish(user, evt.source);
          ctx.emit('bubbles', { id: fish.id });
          break;
        }
        case 'gift': {
          const { fish } = ensureFish(user, evt.source);
          const before = fish.tier;
          fish.coins += evt.coins;
          fish.tier = tierOf(fish.coins);
          const evolved = fish.tier > before;
          ctx.emit('fish:gift', { fish: publicFish(fish), giftName: evt.giftName, coins: evt.coins, evolved, from: before });
          if (evolved) {
            ctx.say(`Cảm ơn ${fish.name} đã tặng ${evt.giftName}. Cá của bạn đã lớn thành ${TIERS[fish.tier].name}!`, { priority: fish.tier >= 4 ? 'critical' : 'high' });
          } else if (S().readGifts) {
            ctx.say(`Cảm ơn ${fish.name} đã tặng ${evt.giftName}!`, { priority: 'normal', dedupeKey: `gift:${fish.id}` });
          }
          if (fish.tier === TIERS.length - 1 && evolved) startParty('whale');
          persist();
          pushLeaderboard();
          break;
        }
      }
    },

    onTick(dt) {
      if (goalDirty) {
        goalDirty = false;
        ctx.emit('goal', goalPayload());
        store.set('goal', goal);
      }
      sweepTimer += dt;
      if (sweepTimer >= 10) {
        sweepTimer = 0;
        const limit = Date.now() - S().idleMinutes * 60000;
        for (const id of [...visible]) {
          const f = fishes[id];
          // cá từ Koi trở lên ở lại lâu gấp 3
          const bonus = f.tier >= 3 ? 2 * S().idleMinutes * 60000 : 0;
          if (f.lastActive + bonus < limit) removeVisible(id);
        }
        prune();
        persist();
      }
    },

    onSettingsChange() {
      // ngưỡng xu có thể đổi => tính lại bậc cá cho mọi người
      for (const f of Object.values(fishes)) f.tier = tierOf(f.coins);
      persist();
      ctx.emit('reset', this.getSnapshot());
    },

    onAdminAction(action) {
      if (action === 'party') startParty('admin');
      if (action === 'empty') {
        for (const id of [...visible]) removeVisible(id);
      }
      if (action === 'clearSim') {
        for (const [id, f] of Object.entries(fishes)) if (f.sim) { removeVisible(id); delete fishes[id]; }
        pushLeaderboard(true);
      }
      if (action === 'reset') {
        for (const k of Object.keys(fishes)) delete fishes[k];
        visible.clear();
        goal = { progress: 0, level: 0 };
        store.replace({ fish: fishes, goal });
        ctx.emit('reset', this.getSnapshot());
      }
    },

    onStop() {
      persist();
      store.set('goal', goal);
    },
  };
}

module.exports = { meta, defaultSettings, settingsSchema, create, TIERS };
