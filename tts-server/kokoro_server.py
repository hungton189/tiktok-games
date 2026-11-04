"""
Server giọng đọc Kokoro tiếng Việt cho Live TikTok Games.

Dùng model cộng đồng "Kokoro-Vietnamese" (Apache-2.0):
  https://github.com/iamdinhthuan/Kokoro-Vietnamese
Lần chạy đầu tự tải model từ HuggingFace (vài trăm MB), các lần sau chạy offline.

API (chỉ nghe trên máy này, 127.0.0.1):
  GET  /health                  -> {"ok": true, "device": "...", "voice": "..."}
  GET  /voices                  -> [{"id": "diem_trinh", "label": "Diễm Trinh"}, ...]
  POST /tts {text, voice, speed} -> audio/wav

Biến môi trường:
  KOKORO_PORT    (mặc định 5005)
  KOKORO_DEVICE  (mặc định cpu; thử "mps" trên Mac chip M nếu muốn nhanh hơn)
"""
import io
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import soundfile as sf
import torch

try:
    from kokoro_vietnamese import KokoroVietnamese, VOICES, DEFAULT_VOICE
except ImportError:
    print("Chưa cài kokoro_vietnamese. Chạy tts-server/setup_kokoro.command trước.", file=sys.stderr)
    sys.exit(1)

PORT = int(os.environ.get("KOKORO_PORT", "5005"))
DEVICE = os.environ.get("KOKORO_DEVICE", "cpu")
SAMPLE_RATE = 24000

_lock = threading.Lock()
_tts = None
_voicepacks = {}


def _load_voicepack(voice):
    """Model chỉ nạp 1 lần; đổi giọng thì chỉ nạp voicepack (rất nhẹ)."""
    if voice in _voicepacks:
        return _voicepacks[voice]
    try:
        from kokoro_vietnamese import core
        filename = core.resolve_voicepack_filename(voice, None)
        path = core._download_or_resolve(core.DEFAULT_HF_REPO_ID, core.DEFAULT_VOICEPACK_FILE, filename)
        pack = torch.load(path, map_location="cpu", weights_only=True)
    except Exception:
        # dự phòng nếu thư viện đổi cấu trúc nội bộ: tạo instance mới với giọng đó
        pack = KokoroVietnamese(device=DEVICE, voice=voice).voicepack
    _voicepacks[voice] = pack
    return pack


def get_tts(voice):
    global _tts
    if _tts is None:
        t0 = time.time()
        print(f"Đang nạp model Kokoro tiếng Việt (device={DEVICE})...", flush=True)
        _tts = KokoroVietnamese(device=DEVICE, voice=voice)
        _voicepacks[voice] = _tts.voicepack
        print(f"Đã nạp model sau {time.time() - t0:.1f}s", flush=True)
    _tts.voicepack = _load_voicepack(voice)
    return _tts


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "device": DEVICE, "loaded": _tts is not None})
        if self.path == "/voices":
            return self._json(200, [{"id": k, "label": v.get("label", k)} for k, v in VOICES.items()])
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/tts":
            return self._json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
            text = str(data.get("text", "")).strip()
            voice = str(data.get("voice") or DEFAULT_VOICE)
            speed = float(data.get("speed") or 1.0)
            if not text:
                return self._json(400, {"error": "text rỗng"})
            if voice not in VOICES:
                return self._json(400, {"error": f"không có giọng {voice}"})
            t0 = time.time()
            with _lock:
                tts = get_tts(voice)
                audio, _ = tts.synthesize(text, speed=max(0.5, min(2.0, speed)))
            buf = io.BytesIO()
            sf.write(buf, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
            wav = buf.getvalue()
            print(f"[{voice}] {time.time() - t0:.2f}s · {text[:60]}", flush=True)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.end_headers()
            self.wfile.write(wav)
        except Exception as e:  # trả lỗi rõ ràng cho Node để nó tự chuyển sang Edge
            print("Lỗi:", e, file=sys.stderr, flush=True)
            self._json(500, {"error": str(e)})

    def log_message(self, *args):
        pass  # tắt log mặc định cho gọn


if __name__ == "__main__":
    # nạp model ngay khi khởi động để câu đầu tiên trên live không bị chậm
    with _lock:
        get_tts(DEFAULT_VOICE)
        get_tts(DEFAULT_VOICE).synthesize("Xin chào.")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Server Kokoro tiếng Việt đang chạy: http://127.0.0.1:{PORT}  (Ctrl+C để tắt)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
