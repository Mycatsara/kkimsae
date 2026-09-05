// 가독성 검사 (경고만 출력, 자동 수정 없음)
// 사용: node tools/readcheck.js <원고.md 또는 guide/xxx.html>
// 기준: 글쓰기규칙.md + 가독성 원칙(문장 짧게, 문단 500~1000자, 같은 어미 반복 금지, AI투 금지)
// AI투·번역투 항목은 claude-forge humanize-korean(MIT) 패턴 표에서 우리 글에 맞는 것만 골라 반영.
//   채택 안 함: 연결어미 뒤 쉼표(우리 글은 대조·나열이라 정상), "해야 합니다"(법적 의무 서술),
//               불릿·볼드 제거(정보성 글엔 필요). 자세한 판단 근거는 글쓰기규칙.md 참조.
// 임계값은 "지금 글은 통과, 앞으로 흐트러지면 경고"로 잡았다.
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.log('사용: node tools/readcheck.js <파일>'); process.exit(1); }
let raw = fs.readFileSync(file, 'utf8');

// 보이지 않는 문자 (AI 생성물에 섞이는 제로폭·특수 공백). 2026-09-04 추가, 출처: watermarks-remover(MIT) 검사 항목
// 검사 대상은 원본 전체(태그 포함) — 복사 붙여넣기·검색엔진에서 깨질 수 있어 본문뿐 아니라 어디에 있어도 경고
const INVISIBLE = { 0x200B: '제로폭 공백', 0x200C: '제로폭 비결합', 0x200D: '제로폭 결합', 0x2060: '단어 결합', 0xFEFF: 'BOM',
  0x200E: '좌→우 표시', 0x200F: '우→좌 표시', 0x00A0: '줄바꿈 없는 공백', 0x202F: '좁은 줄바꿈 없는 공백', 0x00AD: '소프트 하이픈', 0x2028: '줄 구분자', 0x2029: '문단 구분자' };
const invisibleWarn = [];
{
  const c = {};
  for (let i = 0; i < raw.length; i++) { const k = raw.charCodeAt(i); if (INVISIBLE[k] && !(i === 0 && k === 0xFEFF)) c[k] = (c[k] || 0) + 1; }
  Object.keys(c).forEach(k => invisibleWarn.push(`[보이지 않는 문자] U+${(+k).toString(16).toUpperCase().padStart(4, '0')} ${INVISIBLE[k]} ${c[k]}개 — 삭제 또는 일반 공백으로`));
}

// HTML이면 본문(article 또는 main)만 추출 후 태그 제거
if (/\.html?$/i.test(file)) {
  const m = raw.match(/<article[\s\S]*?<\/article>/i) || raw.match(/<main[\s\S]*?<\/main>/i);
  raw = (m ? m[0] : raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
} else {
  // md: 제목·메타·구분선·표·코드 제외
  raw = raw.split('\n').filter(l => !/^(#|메타 설명|---|\||```)/.test(l.trim())).join('\n');
}

const paras = raw.split(/\n\s*\n|\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 0);
const warn = [...invisibleWarn];
const LONG_SENT = 70;   // 모바일 3줄 이상 (규칙: 두 줄 넘기지 않기, 약간 여유)
const LONG_PARA = 1000; // 문단 상한
const SHORT_PARA_SKIP = 30; // 소제목·캡션 등은 제외

let allSents = [];
paras.forEach((p, i) => {
  if (p.length > LONG_PARA) warn.push(`[문단 ${i + 1}] ${p.length}자 — 1,000자 초과. 나누기 권장: "${p.slice(0, 30)}…"`);
  const sents = p.split(/(?<=[.!?。])\s+/).map(s => s.trim()).filter(Boolean);
  sents.forEach(s => {
    if (s.length > LONG_SENT) warn.push(`[긴 문장 ${s.length}자] ${s.slice(0, 60)}…`);
    allSents.push(s);
  });
});

// 같은 어미 연속 (마지막 3글자 기준, 구두점 제거) 4회 이상
let run = 1;
for (let i = 1; i < allSents.length; i++) {
  const tail = s => s.replace(/[.!?。"”’)\]]+$/, '').slice(-3);
  if (tail(allSents[i]) === tail(allSents[i - 1])) { run++; if (run === 4) warn.push(`[어미 반복] "…${tail(allSents[i])}" 4문장 연속: ${allSents[i].slice(0, 40)}…`); }
  else run = 1;
}

// 금지 표현 (글쓰기규칙) — 1회만 나와도 확인
const banned = ['여러분', '알아보겠습니다', '하는 것이 중요합니다', '결론적으로', '에 대해 알아보', '무조건', '100%', '절대', '지금 아니면', '한정'];
banned.forEach(b => {
  const n = (raw.match(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (n) warn.push(`[표현 점검] "${b}" ${n}회 — 규칙상 금지/주의 표현. 사실 단정이면 유지, 아니면 수정`);
});

// AI투·번역투 (임계 초과 시에만 경고)
const tells = [
  ['이중피동', /(되어지|지어지|불려지|보여지|쓰여지)/g, 1, '"~되어진다"는 이중피동. "~된다"로'],
  ['가지고 있다', /가지고 있/g, 3, '번역투. "~이 있다/~하다"로 줄이기'],
  ['시사·주목 상투어', /(시사하는 바|주목할 만)/g, 1, '삭제하거나 구체적 결론으로'],
  ['본질적·핵심적', /(본질적으로|핵심적으로)/g, 1, '삭제'],
  ['과장어', /(파격적|압도적|획기적|치명적)/g, 1, '구체적 수치·사실로 대체'],
  ['"~인 것입니다"', /(인 것입니다|한 것입니다|인 것이다|한 것이다)/g, 2, '평서형으로 ("~입니다")'],
  ['문두 접속사', /(^|[.!?]\s)(또한|따라서|즉|게다가|더욱이|아울러|나아가)/g, 5, '대부분 빼도 흐름이 이어짐'],
  ['"~것입니다" 남용', /(것입니다|것이다)/g, 5, '현재형 단정으로'],
  ['추측 표현 남용', /(보입니다|듯합니다|듯한|것으로 보)/g, 4, '단정할 수 있으면 단정하기'],
  ['"~할 수 있다" 남용', /할 수 있/g, 8, '가능하면 평서형으로'],
  ['지시대명사 남용', /(그것|그들|그녀)/g, 4, '이름·명사로 바꾸거나 생략'],
  ['따옴표 강조', /'[^']{1,20}'/g, 10, '핵심 용어 위주로 (법률·전문 용어 구분 인용은 정상)'],
];
tells.forEach(([name, re, limit, fix]) => {
  const n = (raw.match(re) || []).length;
  if (n >= limit) warn.push(`[AI투 ${name}] ${n}회 (임계 ${limit}) — ${fix}`);
});

const total = raw.replace(/\s/g, '').length;
console.log(`파일: ${file}\n공백 제외 ${total}자 · 문단 ${paras.filter(p => p.length > SHORT_PARA_SKIP).length}개 · 문장 ${allSents.length}개 · 평균 문장 ${Math.round(allSents.reduce((a, s) => a + s.length, 0) / Math.max(1, allSents.length))}자`);
if (!warn.length) console.log('경고 없음'); else { console.log(`경고 ${warn.length}건:`); warn.forEach(w => console.log(' - ' + w)); }
