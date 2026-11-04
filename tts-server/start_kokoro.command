#!/bin/bash
# Bật server giọng đọc Kokoro tiếng Việt (để cửa sổ này mở trong lúc live).
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  echo "Chưa cài Kokoro. Nhấp đúp setup_kokoro.command trước."
  read -p "Nhấn Enter để thoát..."; exit 1
fi
source .venv/bin/activate
# Mac chip M có thể thử: export KOKORO_DEVICE=mps
python kokoro_server.py
