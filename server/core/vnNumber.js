'use strict';
/**
 * Đọc số thành chữ tiếng Việt: 1000 => "một nghìn", 21 => "hai mươi mốt".
 * Dùng cho giọng Kokoro (bộ chuyển chữ→âm của Kokoro tiếng Việt không tự đọc chữ số).
 */
const U = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ'];

function read3(n, full) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const out = [];
  if (h > 0 || full) out.push(U[h], 'trăm');
  if (t === 0) {
    if (u > 0 && (h > 0 || full)) out.push('linh');
  } else if (t === 1) out.push('mười');
  else out.push(U[t], 'mươi');
  if (u > 0) {
    if (u === 1 && t > 1) out.push('mốt');
    else if (u === 5 && t > 0) out.push('lăm');
    else out.push(U[u]);
  }
  return out.join(' ');
}

function readNumber(num) {
  let n = Math.floor(Math.abs(Number(num)));
  if (!Number.isFinite(n)) return String(num);
  if (n === 0) return 'không';
  if (n >= 1e12) return String(num); // quá lớn: giữ nguyên
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(read3(groups[i], i < groups.length - 1), SCALES[i]);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Thay mọi số trong câu bằng chữ. "1.000" / "1,000" được hiểu là một nghìn. */
function numbersToWords(text) {
  return String(text)
    .replace(/\d{1,3}(?:[.,]\d{3})+(?!\d)/g, m => m.replace(/[.,]/g, ''))
    .replace(/\d+/g, m => readNumber(m));
}

module.exports = { readNumber, numbersToWords };
