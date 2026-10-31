// 주치의 off 사진 읽기: 재활평가관리의 '당직·오프 달력'을 캡처한 사진에서 칸 안의 작은 글씨 "(RM8 OFF)", "(RM6 연차)", "(RM7 오후반차)"를 읽는다.
//  1) 사진의 굵은 선으로 달력 칸을 찾고 2) 칸마다 kor+eng로 줄을 나눈 뒤 3) 괄호 줄만 의미를 해석한다.
//  글자 모양이 비슷한 숫자(6·8·9)는 틀릴 수 있어서, 확실하지 않은 줄은 sure:false로 돌려주고 화면에서 사람이 고치게 한다.
const path = require('path');
const { nativeImage } = require('electron');
const unpacked = p => p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
const LANG = unpacked(path.join(__dirname, '..', '..', 'assets', 'ocr'));
const DOCS = ['4', '6', '7', '8', '9'];
const cluster = a => { const o = []; for (const v of a) { const l = o[o.length - 1]; if (l && v - l.e <= 2) l.e = v; else o.push({ s: v, e: v }); } return o.map(c => Math.round((c.s + c.e) / 2)); };
const DIGIT = { 4: '4', 6: '6', 7: '7', 8: '8', 9: '9' };      // 6·8·9는 작은 글씨에서 S·E·&·3 따위로 잘못 읽히는 일이 많아(시험 사진에서 절반 이상), 깨끗한 숫자로 읽힌 것만 믿고 나머지는 사람이 고르게 한다

// 한 줄의 글자 → { doctor, kind, sure } (해석 못 하면 null)
function parseLine(t) {
  const kind = /오후|반차/.test(t) ? 'pm' : /OFF|0FF|연차|연자|면차|OF/i.test(t) ? 'off' : null; if (!kind) return null;
  const m = t.match(/R\s*M\s*([0-9A-Za-z&$])/); const d = m ? DIGIT[m[1]] : null;
  return { doctor: d || '', kind, sure: !!d && DOCS.includes(d) };
}

async function readCalendar({ file, year, month, onProgress }) {
  const { createWorker, PSM } = require('tesseract.js');
  const img = nativeImage.createFromPath(file); if (img.isEmpty()) throw new Error('사진을 열 수 없습니다(png·jpg·bmp만 가능, webp는 불가)');
  const { width: W, height: H } = img.getSize(), bmp = img.toBitmap(), g = i => bmp[i * 4] * 0.114 + bmp[i * 4 + 1] * 0.587 + bmp[i * 4 + 2] * 0.299;
  const rl = [], cl = [];
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (g(y * W + x) < 110) n++; if (n > W * 0.45) rl.push(y); }
  for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) if (g(y * W + x) < 110) n++; if (n > H * 0.45) cl.push(x); }
  const ys = cluster(rl), xs = cluster(cl), weeks = Math.floor((ys.length - 2) / 3);
  if (xs.length < 8 || weeks < 4) throw new Error('달력 칸을 찾지 못했습니다. 요일 머리글부터 마지막 주까지 굵은 테두리가 보이도록 캡처해 주세요.');
  const wk = { langPath: LANG, cacheMethod: 'none', gzip: true, workerPath: unpacked(require.resolve('tesseract.js/src/worker-script/node/index.js')), corePath: unpacked(path.dirname(require.resolve('tesseract.js-core/package.json'))) };
  const w = await createWorker(['kor', 'eng'], 1, wk); await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  const w0 = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(), S = 3, items = [];
  try {
    for (let k = 0; k < weeks; k++) {
      onProgress && onProgress(k, weeks);
      const top = ys[2 + 3 * k] + 3, bot = ys[3 + 3 * k] - 3, wbot = ys[4 + 3 * k] - 3;
      for (let c = 1; c < 7; c++) {
        const x0 = xs[c] + 4, x1 = xs[c + 1] - 4, y1 = c === 6 ? wbot : bot, cw = x1 - x0, ch = y1 - top; if (cw < 10 || ch < 10) continue;
        const crop = img.crop({ x: x0, y: top, width: cw, height: ch }).resize({ width: cw * S, height: ch * S, quality: 'best' });
        const R = await w.recognize(crop.toPNG(), {}, { blocks: true });
        const lines = (R.data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
        const date = new Date(Date.UTC(year, month - 1, 1 + k * 7 + c - w0)).toISOString().slice(0, 10);
        for (const ln of lines) {
          const t = ln.text.replace(/\s+/g, ' ').trim(); if (!/[()]/.test(t) && !/OFF|연차|반차/.test(t)) continue;
          const p = parseLine(t); if (p) items.push({ date, ...p, raw: t });
        }
      }
    }
  } finally { await w.terminate(); }
  return { items, weeks };
}
module.exports = { readCalendar, parseLine };
