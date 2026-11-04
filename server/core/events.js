'use strict';
/**
 * Định dạng sự kiện CHUẨN dùng chung cho mọi game.
 * Connector (TikTok, giả lập, sau này YouTube/Facebook...) đều phải đổi dữ liệu gốc về dạng này.
 * Game chỉ làm việc với LiveEvent, không bao giờ đụng dữ liệu gốc của TikTok.
 *
 * @typedef {Object} LiveUser
 * @property {string} id        - định danh duy nhất (uniqueId của TikTok)
 * @property {string} name      - tên hiển thị (đã làm sạch)
 * @property {string} avatar    - URL ảnh đại diện ('' nếu không có)
 *
 * @typedef {Object} LiveEvent
 * @property {'join'|'chat'|'like'|'gift'|'follow'|'share'} type
 * @property {LiveUser} user
 * @property {string} [text]      - chat: nội dung bình luận (đã lọc)
 * @property {number} [count]     - like: số tim trong lần gửi này
 * @property {number} [coins]     - gift: tổng xu (diamond) = đơn giá x số lượng
 * @property {string} [giftName]  - gift: tên quà
 * @property {number} [giftCount] - gift: số lượng
 * @property {'tiktok'|'simulator'} source
 * @property {number} ts
 */

const EVENT_TYPES = ['join', 'chat', 'like', 'gift', 'follow', 'share'];

function makeEvent(type, user, extra = {}, source = 'simulator') {
  if (!EVENT_TYPES.includes(type)) throw new Error(`Loại sự kiện không hợp lệ: ${type}`);
  return {
    type,
    user: {
      id: String(user.id || user.name || `anon_${Date.now()}`),
      name: String(user.name || user.id || 'Ẩn danh'),
      avatar: String(user.avatar || ''),
    },
    ...extra,
    source,
    ts: Date.now(),
  };
}

module.exports = { EVENT_TYPES, makeEvent };
