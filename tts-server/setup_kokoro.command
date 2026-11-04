#!/bin/bash
# Cài Kokoro tiếng Việt (chạy 1 lần). Cần Python 3.10+ và git.
cd "$(dirname "$0")"
set -e

PY=python3
if ! command -v $PY >/dev/null 2>&1; then
  echo "Chưa có python3. Cài Python 3.10+ tại https://www.python.org/downloads/"
  read -p "Nhấn Enter để thoát..."; exit 1
fi
$PY -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' || {
  echo "Cần Python 3.10 trở lên (hiện tại: $($PY --version))."
  read -p "Nhấn Enter để thoát..."; exit 1
}

echo "==> Tạo môi trường Python riêng (.venv)"
[ -d .venv ] || $PY -m venv .venv
source .venv/bin/activate
pip install --upgrade pip

echo "==> Tải mã nguồn Kokoro-Vietnamese"
if [ -d Kokoro-Vietnamese ]; then
  (cd Kokoro-Vietnamese && git pull --ff-only || true)
else
  git clone --depth 1 https://github.com/iamdinhthuan/Kokoro-Vietnamese.git
fi

echo "==> Cài thư viện (torch khá nặng, có thể mất vài phút)"
pip install torch soundfile
pip install -e ./Kokoro-Vietnamese

echo "==> Tải model và đọc thử (lần đầu tải vài trăm MB từ HuggingFace)"
python - <<'EOF'
import soundfile as sf
from kokoro_vietnamese import KokoroVietnamese
tts = KokoroVietnamese(device="cpu", voice="diem_trinh")
audio, _ = tts.synthesize("Xin chào cả nhà, chào mừng đến với bể cá.")
sf.write("test_kokoro.wav", audio, 24000)
print("OK - đã tạo file tts-server/test_kokoro.wav")
EOF

echo ""
echo "Cài xong! Từ giờ chỉ cần nhấp đúp start_kokoro.command trước khi chạy game."
read -p "Nhấn Enter để đóng..."
