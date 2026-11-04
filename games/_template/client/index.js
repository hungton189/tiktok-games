/**
 * Phần hiển thị của game mẫu. Overlay gọi mount() khi game được bật, unmount() khi đổi game.
 * Sân khấu cố định 1080x1920 px. Có thể dùng DOM, Canvas, hay thư viện (PixiJS...) tuỳ ý.
 */
let el = null;

export default {
  mount(root, api) {
    root.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;color:#fff;background:#1b2838">
        <div style="font-size:64px;font-weight:800">Game mẫu</div>
        <div class="likes" style="font-size:48px"></div>
        <div class="chat" style="font-size:36px;opacity:.85"></div>
      </div>`;
    el = { likes: root.querySelector('.likes'), chat: root.querySelector('.chat') };

    const showLikes = ({ likes, goal }) => (el.likes.textContent = `❤️ ${likes} / ${goal}`);
    showLikes({ likes: api.snapshot.likes, goal: api.snapshot.goal });

    // nhận tin nhắn do server gửi bằng ctx.emit(type, payload)
    api.on('likes', showLikes);
    api.on('chat', ({ name, text }) => (el.chat.textContent = `${name}: ${text}`));
  },

  unmount() {
    el = null;
  },
};
