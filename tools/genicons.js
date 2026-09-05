// favicon.svg · favicon.png(32px) · og.png(1200×630) 생성 — 귀 아이콘(디자인규칙 2절). 아이콘을 바꿀 때만 다시 실행.
// 사용: node tools/genicons.js   (sharp 필요 — Documents 폴더의 node_modules를 쓴다)
const fs = require("fs");
const path = require("path");
const L = require("./lib");

const EAR = (stroke = "#1B1A17", main = "#8B3A2F") => `<path d="M14 27c0-4 2-6 4-8 3-3 4-5 4-9a7 7 0 0 0-14 0" fill="#fff" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/><path d="M13 12a4 4 0 0 1 6-3" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/><path d="M28 8a9 9 0 0 1 0 14" fill="none" stroke="${main}" stroke-width="2.2" stroke-linecap="round"/><path d="M32 4a15 15 0 0 1 0 22" fill="none" stroke="${main}" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>`;

// favicon: 미색 둥근 바탕 + 귀
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#ECEEE7"/><g transform="translate(1 5)">${EAR()}</g></svg>`;
// og: 미색 바탕, 왼쪽 큰 귀, 오른쪽 사이트명(글자는 Malgun Gothic — 없으면 sans-serif)
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#ECEEE7"/>
<rect x="60" y="60" width="1080" height="510" rx="28" fill="#FFFFFF" stroke="#D9DDD0" stroke-width="3"/>
<g transform="translate(150 175) scale(7)">${EAR()}</g>
<text x="500" y="330" font-family="'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-weight="900" font-size="150" fill="#1B1A17" letter-spacing="-6">낌새</text>
<rect x="500" y="352" width="300" height="26" fill="#FFE86B"/>
<text x="500" y="440" font-family="'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-weight="700" font-size="44" fill="#5F5B52">미리 알아채는 블로그</text>
<text x="500" y="500" font-family="'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-weight="700" font-size="30" fill="#8B3A2F">kkimsae.com</text>
</svg>`;

(async () => {
  const sharp = require("sharp");
  L.write("favicon.svg", favicon);
  await sharp(Buffer.from(favicon)).resize(32, 32).png().toFile(path.join(L.ROOT, "favicon.png"));
  await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(path.join(L.ROOT, "og.png"));
  const kb = (f) => Math.round(fs.statSync(path.join(L.ROOT, f)).size / 1024);
  console.log(`favicon.svg · favicon.png(${kb("favicon.png")}KB) · og.png(${kb("og.png")}KB) 생성`);
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
