'use strict';
/**
 * MẪU GAME MỚI — copy cả thư mục _template thành games/<ten-game>/ rồi sửa.
 * (Thư mục bắt đầu bằng "_" sẽ không được nạp, nên nhớ đổi tên.)
 *
 * Game nhận sự kiện CHUẨN (đã lọc nội dung) qua onEvent(evt):
 *   evt.type : 'join' | 'chat' | 'like' | 'gift' | 'follow' | 'share'
 *   evt.user : { id, name, avatar }
 *   evt.text (chat) · evt.count (like) · evt.coins, evt.giftName (gift)
 *
 * ctx (do nền tảng cung cấp):
 *   ctx.emit(type, payload)   gửi tin cho phần hiển thị (client/index.js)
 *   ctx.say(text, {priority}) cho AI đọc ('low' | 'normal' | 'high' | 'critical')
 *   ctx.store                 lưu trữ riêng của game: get/set/update (file data/games/<id>.json)
 *   ctx.settings              cài đặt hiện tại (chỉnh được trên trang Admin)
 *   ctx.log(...)              ghi log
 *
 * NGUYÊN TẮC AN TOÀN: phần thưởng chỉ là hình ảnh / điểm ảo / được gọi tên.
 * Không có tính năng đổi điểm ra tiền hay quà, không có kết quả may rủi khi tặng quà.
 */

const meta = {
  id: 'my-game', // PHẢI trùng tên thư mục
  name: 'Game mẫu',
  description: 'Mô tả ngắn hiển thị trên trang Admin.',
  version: '0.1.0',
  music: 'calm', // nhạc nền tự tạo: 'calm' (êm) hoặc 'upbeat' (sôi động)
  adminActions: [{ id: 'reset', label: 'Đặt lại', confirm: 'Chắc chắn đặt lại?' }],
};

// Mọi khoá ở đây tự hiện thành ô chỉnh trên trang Admin (number / boolean / text)
const defaultSettings = {
  likesGoal: 500,
  readGifts: true,
};

const settingsSchema = {
  likesGoal: { label: 'Mục tiêu tim', min: 10, step: 10 },
  readGifts: { label: 'Đọc lời cảm ơn khi tặng quà' },
};

function create(ctx) {
  let likes = ctx.store.get('likes', 0);

  return {
    onStart() {},

    /** Trạng thái đầy đủ để overlay vẽ lại khi vừa mở / tải lại trang */
    getSnapshot() {
      return { likes, goal: ctx.settings.likesGoal };
    },

    onEvent(evt) {
      if (evt.type === 'chat') ctx.emit('chat', { name: evt.user.name, text: evt.text });
      if (evt.type === 'like') {
        likes += evt.count;
        ctx.store.set('likes', likes);
        ctx.emit('likes', { likes, goal: ctx.settings.likesGoal });
      }
      if (evt.type === 'gift' && ctx.settings.readGifts) ctx.say(`Cảm ơn ${evt.user.name} đã tặng ${evt.giftName}!`);
    },

    /** Gọi 10 lần/giây — dùng cho bộ đếm giờ, vòng chơi... */
    onTick(dt) {},

    onSettingsChange(settings) {
      ctx.emit('likes', { likes, goal: settings.likesGoal });
    },

    onAdminAction(action) {
      if (action === 'reset') {
        likes = 0;
        ctx.store.set('likes', 0);
        ctx.emit('likes', { likes, goal: ctx.settings.likesGoal });
      }
    },

    onStop() {},
  };
}

module.exports = { meta, defaultSettings, settingsSchema, create };
