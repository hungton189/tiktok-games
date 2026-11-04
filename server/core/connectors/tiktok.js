'use strict';
/**
 * Connector TikTok Live: nhận sự kiện thật từ phòng live và đổi về LiveEvent chuẩn.
 * Dùng thư viện không chính thức "tiktok-live-connector" => TikTok đổi giao thức thì chỉ cần sửa file này.
 * Thư viện cần dịch vụ ký request của Euler Stream; gói miễn phí có giới hạn lượt.
 * Nếu bị giới hạn, đăng ký API key tại eulerstream.com và nhập vào trang Admin (không lách/bẻ khoá).
 */
const { EventEmitter } = require('events');
const { makeEvent } = require('../events');

// ---- Lấy dữ liệu an toàn: thư viện có nhiều phiên bản, cấu trúc dữ liệu hơi khác nhau ----
function pickUser(data) {
  const u = data.user || data;
  const id = u.uniqueId || u.displayId || u.userId || u.idStr || data.uniqueId || '';
  const name = u.nickname || data.nickname || id;
  const avatar =
    u.profilePictureUrl ||
    data.profilePictureUrl ||
    (u.avatarThumb && u.avatarThumb.urlList && u.avatarThumb.urlList[0]) ||
    (u.avatarLarge && u.avatarLarge.urlList && u.avatarLarge.urlList[0]) ||
    (u.profilePicture && u.profilePicture.url && u.profilePicture.url[0]) ||
    '';
  return { id: String(id || name || ''), name: String(name || ''), avatar: String(avatar || '') };
}

function pickGift(data) {
  const g = data.giftDetails || data.gift || {};
  return {
    giftType: g.giftType ?? g.type ?? data.giftType,
    diamond: Number(g.diamondCount ?? data.diamondCount ?? 1) || 1,
    name: g.giftName || g.name || data.giftName || 'Quà',
    repeat: Number(data.repeatCount || 1) || 1,
    repeatEnd: !!data.repeatEnd,
  };
}

class TikTokConnector extends EventEmitter {
  constructor() {
    super();
    this.conn = null;
    this.status = 'disconnected'; // disconnected | connecting | connected | error
    this.username = '';
    this.error = null;
  }

  _setStatus(status, error = null) {
    this.status = status;
    this.error = error;
    this.emit('status', { status, username: this.username, error });
  }

  async connect(username, { signApiKey } = {}) {
    await this.disconnect();
    this.username = String(username || '').replace(/^@/, '').trim();
    if (!this.username) return this._setStatus('error', 'Chưa nhập username TikTok');

    let TikTokLiveConnection, WebcastEvent;
    try {
      ({ TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector'));
    } catch (e) {
      return this._setStatus('error', 'Chưa cài thư viện tiktok-live-connector (chạy npm install)');
    }

    const options = { processInitialData: false, enableExtendedGiftInfo: false };
    if (signApiKey) options.signApiKey = signApiKey;
    const conn = new TikTokLiveConnection(this.username, options);
    this.conn = conn;
    this._setStatus('connecting');

    const emit = (type, data, extra = {}) => {
      const user = pickUser(data);
      if (!user.id) return;
      this.emit('event', makeEvent(type, user, extra, 'tiktok'));
    };

    conn.on(WebcastEvent.MEMBER, d => emit('join', d));
    conn.on(WebcastEvent.CHAT, d => emit('chat', d, { text: String(d.comment ?? d.content ?? '') }));
    conn.on(WebcastEvent.LIKE, d => emit('like', d, { count: Number(d.likeCount ?? d.count ?? 1) || 1 }));
    conn.on(WebcastEvent.FOLLOW, d => emit('follow', d));
    conn.on(WebcastEvent.SHARE, d => emit('share', d));
    conn.on(WebcastEvent.GIFT, d => {
      const g = pickGift(d);
      // Quà dạng "combo" (giftType 1): chỉ tính khi combo kết thúc, tránh cộng trùng
      if (g.giftType === 1 && !g.repeatEnd) return;
      emit('gift', d, { coins: g.diamond * g.repeat, giftName: g.name, giftCount: g.repeat });
    });
    conn.on(WebcastEvent.STREAM_END, () => this._setStatus('disconnected', 'Buổi live đã kết thúc'));
    conn.on('disconnected', () => { if (this.conn === conn) this._setStatus('disconnected'); });
    conn.on('error', err => console.warn('[tiktok] lỗi:', err && err.message));

    try {
      const state = await conn.connect();
      if (this.conn !== conn) return;
      console.log(`[tiktok] Đã kết nối phòng live @${this.username} (roomId ${state && state.roomId})`);
      this._setStatus('connected');
    } catch (err) {
      if (this.conn !== conn) return;
      const msg = String((err && err.message) || err);
      let friendly = msg;
      if (/offline|not live|isn't online|UserOffline/i.test(msg)) friendly = `@${this.username} hiện không live`;
      else if (/rate|limit|429/i.test(msg)) friendly = 'Dịch vụ ký request đang giới hạn lượt — thử lại sau hoặc nhập Sign API key';
      this.conn = null;
      this._setStatus('error', friendly);
    }
  }

  async disconnect() {
    const conn = this.conn;
    this.conn = null;
    if (conn) {
      try { await conn.disconnect(); } catch (_) {}
      this._setStatus('disconnected');
    }
  }
}

module.exports = { TikTokConnector };
