'use strict';
/**
 * Lọc nội dung trước khi hiển thị hoặc cho AI đọc.
 * - Từ "nhạy cảm pháp lý" (cá cược...) và từ tục: bị che.
 * - Link / số điện thoại: bị xoá (chống quảng cáo, lừa đảo).
 * Danh sách có thể bổ sung trong data/settings.json (safety.extraBannedWords).
 */

const DEFAULT_BANNED = [
  // vùng pháp lý: tránh mọi liên tưởng cờ bạc
  // (chỉ dùng từ có dấu / cụm rõ nghĩa để tránh che nhầm, vd "cuoc" có thể là "cuộc sống")
  'cược', 'cá độ', 'ca do', 'kèo', 'nhà cái', 'nha cai', 'tỷ lệ', 'ăn tiền', 'tài xỉu', 'tai xiu',
  'lô đề', 'lo de', 'casino',
  // tục tĩu phổ biến (bổ sung thêm theo nhu cầu)
  'đm', 'dm', 'đmm', 'dmm', 'vl', 'vcl', 'clgt', 'lồn', 'buồi', 'cặc', 'địt', 'đéo', 'fuck', 'shit',
];

const URL_RE = /(https?:\/\/\S+|www\.\S+|\b\S+\.(com|vn|net|xyz|io|me|link|top|club)\b\S*)/gi;
const PHONE_RE = /(\+?84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}/g;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class Safety {
  constructor(extraWords = []) {
    this.setWords(extraWords);
  }

  setWords(extraWords = []) {
    const words = [...new Set([...DEFAULT_BANNED, ...extraWords].map(w => w.trim().toLowerCase()).filter(Boolean))];
    // \b không hoạt động tốt với tiếng Việt có dấu => tự định nghĩa ranh giới chữ
    this.re = new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escapeRe).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  }

  /** Làm sạch text tự do (bình luận). Trả về { text, flagged } */
  cleanText(raw, maxLen = 60) {
    let text = String(raw || '').replace(/[\u0000-\u001f]/g, ' ').trim();
    let flagged = false;
    text = text.replace(URL_RE, () => { flagged = true; return '***'; });
    text = text.replace(PHONE_RE, () => { flagged = true; return '***'; });
    text = text.replace(this.re, (m, pre, word) => { flagged = true; return pre + '*'.repeat(word.length); });
    if (text.length > maxLen) text = text.slice(0, maxLen - 1) + '…';
    return { text, flagged };
  }

  /** Làm sạch tên người xem (giữ emoji, bỏ link, giới hạn độ dài) */
  cleanName(raw, maxLen = 20) {
    const { text } = this.cleanText(raw, maxLen);
    return text || 'Bạn ẩn danh';
  }

  /** Text dành cho TTS: bỏ emoji và ký tự lạ để giọng đọc không bị vấp */
  forSpeech(raw) {
    return String(raw || '')
      .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
      .replace(/[_*#@~^|<>{}[\]\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = { Safety, DEFAULT_BANNED };
