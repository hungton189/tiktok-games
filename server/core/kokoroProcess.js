'use strict';
/**
 * Tự bật server Kokoro (tts-server/kokoro_server.py) cùng lúc với game.
 *   - Bỏ qua nếu chưa cài (chưa có tts-server/.venv) hoặc server đã chạy sẵn (vd mở bằng start_kokoro.command).
 *   - Tắt game thì tắt luôn Kokoro do mình bật.
 * Muốn tắt tính năng: đặt biến môi trường KOKORO_AUTOSTART=0
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TTS_DIR = path.join(__dirname, '..', '..', 'tts-server');

class KokoroProcess {
  constructor({ getUrl }) {
    this.getUrl = getUrl;
    this.child = null;
  }

  _python() {
    const p = process.platform === 'win32'
      ? path.join(TTS_DIR, '.venv', 'Scripts', 'python.exe')
      : path.join(TTS_DIR, '.venv', 'bin', 'python');
    return fs.existsSync(p) ? p : null;
  }

  async _isRunning() {
    try {
      const res = await fetch(`${String(this.getUrl()).replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async start() {
    if (process.env.KOKORO_AUTOSTART === '0') return;
    const python = this._python();
    if (!python) {
      console.log('[kokoro] Chưa cài Kokoro (chạy tts-server/setup_kokoro.command) => dùng Edge');
      return;
    }
    if (await this._isRunning()) {
      console.log('[kokoro] Server Kokoro đã chạy sẵn');
      return;
    }
    const port = new URL(this.getUrl()).port || '5005';
    console.log('[kokoro] Đang bật server Kokoro...');
    this.child = spawn(python, ['kokoro_server.py'], {
      cwd: TTS_DIR,
      env: { ...process.env, KOKORO_PORT: port, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = chunk => String(chunk).split('\n').filter(Boolean).forEach(l => console.log(`[kokoro] ${l}`));
    this.child.stdout.on('data', log);
    this.child.stderr.on('data', log);
    this.child.on('exit', code => {
      if (this.child) console.warn(`[kokoro] Server Kokoro đã dừng (mã ${code})`);
      this.child = null;
    });
    this.child.on('error', e => console.warn(`[kokoro] Không bật được: ${e.message}`));
  }

  stop() {
    const child = this.child;
    this.child = null;
    if (child) child.kill();
  }
}

module.exports = { KokoroProcess };
