'use strict';
/**
 * Connector GIẢ LẬP: tạo người xem và sự kiện ngẫu nhiên để test game mà không cần lên live.
 * Dữ liệu giả CHỈ tồn tại ở chế độ này — không bao giờ trộn vào dữ liệu thật.
 */
const { EventEmitter } = require('events');
const { makeEvent } = require('../events');

const FIRST = ['Minh', 'Lan', 'Hùng', 'Thảo', 'Tuấn', 'Ngọc', 'Bảo', 'Vy', 'Khang', 'My', 'Phúc', 'Trang', 'Đạt', 'Hà', 'Nam', 'Linh', 'Quân', 'Yến', 'Sơn', 'Chi'];
const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Phan'];
// có cả số 1-4 để test game chọn phe (vd Đua thú)
const CHATS = ['1', '2', '3', '4', 'Cá đẹp quá', 'Thả cá cho mình với', 'Hello cả nhà', 'Bể cá chill ghê', 'Con cá vàng dễ thương quá', 'Mình mới vào nè', 'Cá của mình đâu rồi', 'Thư giãn thật sự', '❤️❤️❤️', 'Chúc mọi người buổi tối vui vẻ'];
const GIFTS = [
  { name: 'Hoa hồng', coins: 1 },
  { name: 'TikTok', coins: 1 },
  { name: 'Kem', coins: 1 },
  { name: 'Tim Korea', coins: 5 },
  { name: 'Bánh donut', coins: 30 },
  { name: 'Mũ & túi', coins: 99 },
  { name: 'Mây cầu vồng', coins: 299 },
];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

function fakeUser(i) {
  const name = `${rand(LAST)} ${rand(FIRST)}`;
  return { id: `sim_${i}_${Math.random().toString(36).slice(2, 7)}`, name, avatar: '' };
}

class SimulatorConnector extends EventEmitter {
  constructor() {
    super();
    this.timer = null;
    this.users = [];
    this.speed = 1;
    this._n = 0;
  }

  get running() {
    return !!this.timer;
  }

  start(speed = 1) {
    this.stop();
    this.speed = Math.max(0.2, Math.min(5, Number(speed) || 1));
    const loop = () => {
      this.tick();
      this.timer = setTimeout(loop, (400 + Math.random() * 900) / this.speed);
    };
    loop();
    this.emit('status', { running: true, speed: this.speed });
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.emit('status', { running: false, speed: this.speed });
  }

  _pickUser(forceNew = false) {
    if (forceNew || this.users.length < 3 || Math.random() < 0.15) {
      const u = fakeUser(++this._n);
      this.users.push(u);
      if (this.users.length > 80) this.users.shift();
      this.emit('event', makeEvent('join', u));
      return u;
    }
    return rand(this.users);
  }

  tick() {
    const r = Math.random();
    const u = this._pickUser();
    if (r < 0.35) this.emit('event', makeEvent('chat', u, { text: rand(CHATS) }));
    else if (r < 0.75) this.emit('event', makeEvent('like', u, { count: 1 + Math.floor(Math.random() * 15) }));
    else if (r < 0.80) this.emit('event', makeEvent('follow', u));
    else if (r < 0.84) this.emit('event', makeEvent('share', u));
    else if (r < 0.95) {
      const g = Math.random() < 0.85 ? rand(GIFTS.slice(0, 4)) : rand(GIFTS.slice(4));
      this.emit('event', makeEvent('gift', u, { coins: g.coins, giftName: g.name, giftCount: 1 }));
    }
  }

  /** Bắn 1 sự kiện thủ công từ trang Admin */
  manual(type, { coins, text, count, newUser } = {}) {
    const u = this._pickUser(!!newUser || type === 'join');
    if (type === 'join') return;
    const extra = {};
    if (type === 'chat') extra.text = text || rand(CHATS);
    if (type === 'like') extra.count = Number(count) || 10;
    if (type === 'gift') {
      const c = Number(coins) || 1;
      const g = GIFTS.find(x => x.coins === c) || { name: `Quà ${c} xu`, coins: c };
      Object.assign(extra, { coins: c, giftName: g.name, giftCount: 1 });
    }
    this.emit('event', makeEvent(type, u, extra));
  }
}

module.exports = { SimulatorConnector };
