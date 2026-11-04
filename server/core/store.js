'use strict';
/**
 * Kho lưu trữ đơn giản bằng file JSON (không cần cài database).
 * Mỗi "namespace" là 1 file trong thư mục data/, ví dụ data/aquarium.json.
 * Ghi file có trì hoãn (debounce) để không ghi đĩa liên tục khi live đông.
 * Khi cần lên SQLite/Postgres sau này: chỉ cần viết lại file này, giữ nguyên API get/set/update/all.
 */
const fs = require('fs');
const path = require('path');

class Store {
  constructor(dir, name, defaults = {}) {
    this.file = path.join(dir, `${name}.json`);
    fs.mkdirSync(dir, { recursive: true });
    this.data = { ...defaults };
    try {
      if (fs.existsSync(this.file)) this.data = { ...defaults, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch (e) {
      console.error(`[store] Không đọc được ${this.file}, dùng dữ liệu mặc định:`, e.message);
    }
    this._timer = null;
  }

  get(key, fallback) {
    return key in this.data ? this.data[key] : fallback;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
    return value;
  }

  update(key, fn, fallback) {
    return this.set(key, fn(this.get(key, fallback)));
  }

  all() {
    return this.data;
  }

  replace(obj) {
    this.data = obj;
    this.save();
  }

  save(immediate = false) {
    clearTimeout(this._timer);
    const write = () => {
      try {
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
        fs.renameSync(tmp, this.file);
      } catch (e) {
        console.error('[store] Lỗi ghi file:', e.message);
      }
    };
    if (immediate) write();
    else this._timer = setTimeout(write, 1500);
  }

  flush() {
    if (this._timer) this.save(true);
  }
}

module.exports = { Store };
