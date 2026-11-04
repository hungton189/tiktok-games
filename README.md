# 🎮 Live TikTok Games

Nền tảng chạy **game tương tác cho TikTok Live**. Người xem bình luận, thả tim, follow, share, tặng quà, và mỗi hành động đó tạo ra hiệu ứng trong game, kèm giọng AI đọc tên người xem.

Dự án được thiết kế **đa game dạng plugin**. Mỗi game nằm trong một thư mục riêng, còn phần kết nối TikTok, giả lập, giọng đọc, lọc nội dung, lưu dữ liệu và trang Admin thì **dùng chung**.

Game đầu tiên là **🐠 Bể cá chung**:

| Người xem làm gì | Trong bể cá |
|---|---|
| Vào live / bình luận | Thả 1 con cá mang tên mình. Bình luận hiện thành bong bóng lời nói |
| Thả tim | Rắc thức ăn, cá bơi tới ăn. Tim góp vào mục tiêu chung **Tiệc bong bóng** |
| Follow | Cá được gắn ⭐ |
| Share | Cá thổi bong bóng |
| Tặng quà | Cộng dồn xu, cá **lớn lên theo bậc cố định**: Bảy màu → Cá vàng (1 xu) → Cá hề (10) → Koi (50) → Cá rồng (200) → Cá voi xanh (1000) |

Cá và điểm được lưu lại, nên người xem quay lại buổi live sau vẫn thấy cá của mình.

Game thứ hai là **🏁 Đại hội đua thú**. Mỗi ván tự chạy theo vòng lặp: **chọn phe 30s → đua khoảng 40–60s → công bố kết quả 15s**.

| Người xem làm gì | Trong cuộc đua |
|---|---|
| Bình luận `1` `2` `3` `4` (hoặc tên con vật) | Chọn phe cổ vũ. Chỉ đổi phe được khi đang ở pha chọn phe |
| Thả tim, share, follow, tặng quà | Cộng điểm cổ vũ, con vật phe mình chạy nhanh hơn. Quà ≥ 99 xu thì con vật **lướt siêu tốc** 3 giây |
| Chưa chọn phe mà thả tim / tặng quà | Tự được xếp vào phe ít người nhất |

- **Cân bằng:** tốc độ tăng theo căn bậc hai của điểm cổ vũ và có trần tối đa. Con bị bỏ xa được hỗ trợ đuổi kịp. Có sự kiện ngẫu nhiên (vũng bùn, gió xuôi). Đoạn nước rút cuối thì điểm cổ vũ x2.
- **Không thưởng theo kết quả:** chọn đúng phe thắng không được gì. Người cổ vũ nhiều nhất của phe thắng chỉ được gọi tên. Bảng "Cổ động viên nhiệt nhất" tính theo điểm cổ vũ (cả tim lẫn quà), không quy đổi được ra gì.
- Tên và emoji 4 con vật đổi được trong Admin, ví dụ đổi thành 🐕 🐎.

Game thứ ba là **🦆 Đua vịt trên sông**: **đăng ký 45s → đua khoảng 45s → kết quả 15s**. Người xem bình luận (hoặc follow, share) để thả 1 con vịt mang tên mình xuống sông. Game có 2 chế độ, chọn trong Admin:

| | 🎲 Bốc thăm (`random`) | 📣 Đua cổ vũ (`cheer`) |
|---|---|---|
| Ai thắng | Hoàn toàn ngẫu nhiên, mọi vịt cơ hội như nhau | Chủ vịt thả tim, bình luận lúc đua thì vịt **của mình** bơi nhanh hơn (tăng chậm dần, tối đa x1,3), vẫn còn may rủi từ dòng nước |
| Tim | Nước xiết hơn cho tất cả vịt | Cổ vũ vịt của mình |
| Dùng làm công cụ bốc thăm | ✅ Được (nhập danh sách tên tay) | ❌ Không nên |

- **Quà không ảnh hưởng gì tới cuộc đua** ở cả 2 chế độ. Người tặng chỉ được AI cảm ơn và có tên trên dải **🙏 Vinh danh**.
- **Người thắng chỉ được vinh danh:** đội vương miện trên màn kết quả và lên bảng **👑 Vua vịt**.
- Đã chạy thử nhiều ván:
  - Chế độ bốc thăm: mỗi vịt thắng khoảng 10%/10 vịt.
  - Chế độ cổ vũ: khi 4 người cùng cổ vũ với mức 20/10/5/2 tim mỗi giây, tỉ lệ thắng là 59/31/8/2%.
- Dòng sông có dòng xiết, xoáy nước, đá ngầm ngẫu nhiên. Camera chạy theo nhóm dẫn đầu, có bảng dẫn đầu và bản đồ thu nhỏ.
- Game không có giải thưởng. Nếu bạn tự treo giải thưởng thật cho người thắng, đó là hình thức khuyến mại may rủi. Hãy tìm hiểu quy định và luật của TikTok trước khi làm.

---

## 🚀 Chạy

Yêu cầu: **Node.js 18+**.

```bash
npm install
npm start
```

Trên macOS có thể nhấp đúp vào `start.command`. Trên Windows dùng `start.bat`.

- **Admin**: http://localhost:3000/admin.html — kết nối TikTok, bật giả lập, đổi game, chỉnh cài đặt
- **Overlay**: http://localhost:3000/overlay.html — đưa vào OBS / TikTok LIVE Studio
  - Browser Source, kích thước **1080 × 1920**
  - Tick *Control audio via OBS* để nghe được giọng đọc
  - Thêm `?transparent` vào URL nếu muốn nền trong suốt (với game hỗ trợ)

> Bản xem trước trong trang Admin bị tắt tiếng để không đọc 2 lần cùng OBS. Muốn nghe thử thì mở overlay ở tab riêng.

### 🗣️ Giọng đọc

Có 2 loại giọng, chọn trong mục *Giọng đọc AI* của trang Admin:

| | Kokoro tiếng Việt (mặc định) | Microsoft Edge |
|---|---|---|
| Chạy ở đâu | Trên máy bạn, không cần Internet | Máy chủ Microsoft, cần Internet |
| Giọng | 14 giọng (Diễm Trinh, Hưng Thịnh, Mai Linh…) | Hoài My, Nam Minh |
| Cần cài thêm | Python 3.10+ và git | Không |

Kokoro dùng model cộng đồng [Kokoro-Vietnamese](https://github.com/iamdinhthuan/Kokoro-Vietnamese) (Apache-2.0). Kokoro gốc của hexgrad không có tiếng Việt.

Cài Kokoro (chỉ làm 1 lần):

1. Nhấp đúp `tts-server/setup_kokoro.command`. Bước này tạo môi trường Python riêng, cài thư viện, tải model và đọc thử ra file `tts-server/test_kokoro.wav`.
2. Mỗi lần live, nhấp đúp `tts-server/start_kokoro.command` **trước**, để cửa sổ đó mở, rồi mới chạy `start.command`.

Nếu server Kokoro chưa bật hoặc bị lỗi, game tự chuyển sang giọng Edge (có thể tắt tuỳ chọn này trong Admin). Với Kokoro, chữ số được tự đọc thành chữ ("1000" thành "một nghìn"). File âm thanh được cache trong `data/tts-cache/`.

### 🎵 Nhạc nền

Mỗi game có nhạc nền riêng, chỉnh trong mục *Nhạc nền* của trang Admin:

- **Nhạc tự tạo (mặc định):** trình duyệt tự soạn và phát nhạc lúc chạy, bằng Web Audio. Không dùng bài hát của ai nên **không lo bản quyền** khi live.
  - Bể cá dùng phong cách **êm dịu** (pad, đàn gảy, tiếng bong bóng). Lúc có tiệc bong bóng thì nhạc rộn hơn, cá lớn thì có đoạn nhạc ngắn.
  - Đua thú dùng phong cách **sôi động** (trống, bass, giai điệu 8-bit). Nhạc vừa phải lúc chọn phe, mạnh lúc đua, có nhạc chiến thắng khi về đích.
- **File nhạc của tôi:** bỏ mp3 vào `music/<id-game>/` hoặc `music/shared/` (xem `music/README.md`). Chỉ dùng nhạc bạn có quyền phát.
- Khi AI đọc, nhạc **tự nhỏ lại** rồi to lên sau đó.
- Game mới chọn phong cách bằng `meta.music: 'calm' | 'upbeat'`. Trong client có thể gọi `api.music.setIntensity(0..1)` và `api.music.sting('win')`.

**Kết nối TikTok** dùng thư viện không chính thức `tiktok-live-connector`, cần dịch vụ ký request của Euler Stream. Gói miễn phí có giới hạn lượt. Nếu bị giới hạn, lấy API key tại eulerstream.com rồi nhập vào trang Admin.

---

## 🧱 Kiến trúc

```
TikTok Live ─┐
             ├─► Connector ─► Lọc nội dung ─► GameManager ─► game đang chạy (server.js)
Giả lập ─────┘    (chuẩn hoá       (Safety)                         │ ctx.emit / ctx.say
                   LiveEvent)                                         ▼
                                                    Socket.io ─► Overlay ─► client/index.js của game
                                                         └─────► Admin
```

```
live-tiktok-games/
├── server/
│   ├── index.js                 # khởi động, nối các thành phần, socket cho Admin/Overlay
│   └── core/
│       ├── events.js            # định dạng sự kiện chuẩn LiveEvent
│       ├── connectors/
│       │   ├── tiktok.js        # TikTok Live → LiveEvent (TikTok đổi gì chỉ sửa file này)
│       │   └── simulator.js     # sự kiện giả để test
│       ├── gameManager.js       # nạp game từ thư mục games/, bật/tắt, chuyển sự kiện, tick 10 lần/giây
│       ├── tts.js               # hàng đợi giọng đọc có ưu tiên + provider Kokoro/Edge
│       ├── vnNumber.js          # đọc số thành chữ tiếng Việt
│       ├── safety.js            # lọc từ cấm, link, số điện thoại
│       └── store.js             # lưu JSON trong data/ (sau này đổi sang SQLite chỉ sửa file này)
├── public/                      # Admin + khung Overlay dùng chung
├── games/
│   ├── duckrace/                # 🦆 Đua vịt trên sông
│   ├── race/                    # 🏁 Đại hội đua thú
│   ├── aquarium/                # 🐠 Bể cá
│   │   ├── server.js            #   logic game
│   │   └── client/              #   phần hiển thị (index.js, style.css, ảnh...)
│   └── _template/               # mẫu để tạo game mới (bị bỏ qua khi nạp)
├── tts-server/                  # server giọng Kokoro tiếng Việt (Python)
├── music/                       # (tuỳ chọn) file nhạc nền của bạn
└── data/                        # tự tạo: cài đặt, dữ liệu game, cache giọng đọc
```

### Sự kiện chuẩn (`LiveEvent`)

```js
{ type: 'join' | 'chat' | 'like' | 'gift' | 'follow' | 'share',
  user: { id, name, avatar },
  text,      // chat (đã lọc)
  count,     // like
  coins, giftName, giftCount,  // gift (coins = tổng xu)
  source: 'tiktok' | 'simulator', ts }
```

---

## ➕ Thêm game mới

1. Copy `games/_template` thành `games/<ten-game>` (tên thư mục không bắt đầu bằng `_`).
2. Trong `server.js`, sửa `meta.id` cho **trùng tên thư mục**, rồi viết logic trong `create(ctx)`:

```js
function create(ctx) {
  return {
    getSnapshot() { /* trạng thái để overlay vẽ lại khi tải trang */ },
    onEvent(evt) { /* xử lý LiveEvent */ },
    onTick(dt) { /* 10 lần/giây */ },
    onSettingsChange(settings) {},
    onAdminAction(actionId) {},
    onStart() {}, onStop() {},
  };
}
```

   Các công cụ có trong `ctx`:
   - `ctx.emit(type, payload)`: gửi tin cho phần hiển thị
   - `ctx.say(text, { priority })`: cho AI đọc
   - `ctx.store.get/set`: lưu dữ liệu riêng của game
   - `ctx.settings`: cài đặt hiện tại

3. Trong `client/index.js`, export `{ mount(root, api), unmount() }`. Dùng `api.on(type, fn)` để nhận tin, `api.snapshot` để vẽ trạng thái ban đầu. Sân khấu cố định **1080×1920**.
4. Khởi động lại server. Game mới tự xuất hiện trong ô chọn game của trang Admin.
5. Các khoá trong `defaultSettings` tự hiện thành ô chỉnh trên Admin. `settingsSchema` dùng để đặt nhãn tiếng Việt và giới hạn giá trị.

---

## 🛡️ Nguyên tắc an toàn (áp dụng cho mọi game)

- Phần thưởng **chỉ là hình ảnh, điểm ảo và được gọi tên**. Không có tính năng đổi điểm ra tiền, thẻ cào hay quà.
- Tặng quà luôn cho **kết quả cố định**, không quay, không bốc ngẫu nhiên.
- Không dùng từ ngữ cá cược ("cược", "kèo", "tỷ lệ"…). Bộ lọc mặc định đã che các từ này, cùng với link và số điện thoại.
- Overlay luôn hiện dòng *"Trò chơi giải trí · Điểm và vật phẩm không có giá trị quy đổi"*.
- Cá giả lập không bao giờ được lưu xuống đĩa. Tắt server là mất, hoặc xoá ngay bằng nút "🧪 Xoá cá giả lập" trước khi live thật.
