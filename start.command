#!/bin/bash
# macOS: nhấp đúp để chạy. Lần đầu có thể cần: chuột phải > Open.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Chưa cài Node.js. Tải tại https://nodejs.org (bản LTS)."
  read -p "Nhấn Enter để thoát..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Đang cài thư viện lần đầu..."
  npm install || { read -p "Cài thư viện lỗi. Nhấn Enter để thoát..."; exit 1; }
fi
(sleep 2; open "http://localhost:3000/admin.html") &
npm start
