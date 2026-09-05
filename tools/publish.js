// 낌새 글 게시 도구 — 승인된 원고 md 한 편을 HTML로 만들고 목록·sitemap·feed까지 갱신한다.
// 사용:
//   node tools/publish.js <원고.md> --dry            계획표만 출력(제목·주소·날짜·이미지). 실행 전 운영자 확인용
//   node tools/publish.js <원고.md>                  게시 파일 생성 (커밋·푸시는 /publish 스킬 단계에서)
//   node tools/publish.js <원고.md> --date 2026-09-06 게시일 지정(기본 오늘)
//   node tools/publish.js <원고.md> --update         이미 게시된 글 수정 — 게시일 유지, 수정일 = 오늘
// 원고 머리말: title, slug, category(돈·생활|시즌·일정|게임|일상), tags, description, images(원고 폴더 기준 상대경로)
// 이미지: PNG/JPG/WEBP → 폭 1200 webp(300KB 이하)로 압축해 /img/에 둔다(sharp). 원본은 원고 폴더(비공개)에 그대로.
// 하루 상한: posts.json에 같은 게시일 글이 이미 2편이면 중단한다(우회 옵션 없음 — 날짜를 옮기려면 운영자 확인 후 --date).
const fs = require("fs");
const path = require("path");
const L = require("./lib");

const DAILY_MAX = 2;
const MAX_BYTES = 300 * 1024;
const WIDTH = 1200;

function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; }

async function prepareImage(srcPath, destName) {
  const dest = path.join(L.ROOT, "img", destName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let sharp;
  try { sharp = require("sharp"); } catch { throw new Error("sharp가 없습니다 — Documents 폴더에서 `npm install sharp` 1회 실행"); }
  let q = 82;
  let buf;
  do {
    buf = await sharp(srcPath).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
    q -= 8;
  } while (buf.length > MAX_BYTES && q >= 40);
  if (buf.length > MAX_BYTES) throw new Error(`이미지가 300KB를 넘음(${Math.round(buf.length / 1024)}KB): ${srcPath}`);
  fs.writeFileSync(dest, buf);
  const size = L.webpSize(buf);
  return { src: `/img/${destName}`, w: size.w, h: size.h, bytes: buf.length };
}

async function run() {
  const mdPath = process.argv[2];
  if (!mdPath || mdPath.startsWith("--")) { console.log("사용법: node tools/publish.js <원고.md> [--dry] [--date YYYY-MM-DD] [--update]"); process.exit(1); }
  const dry = process.argv.includes("--dry");
  const update = process.argv.includes("--update");
  const { front, body } = L.parseFront(fs.readFileSync(mdPath, "utf8"));
  for (const k of ["title", "slug", "category", "description"]) if (!front[k]) throw new Error(`머리말에 ${k}가 없습니다`);
  const cat = L.catByName(front.category);
  if (!cat) throw new Error(`카테고리가 잘못됨: ${front.category} (돈·생활 / 시즌·일정 / 게임 / 일상)`);
  if (!/^[a-z0-9-]+$/.test(front.slug)) throw new Error(`slug는 영문 소문자·숫자·하이픈만: ${front.slug}`);
  if (front.description.length < 50 || front.description.length > 160) console.warn(`주의: description ${front.description.length}자 — 검색 결과용은 80~125자가 알맞다`);

  const data = JSON.parse(L.read("tools/posts.json"));
  const existing = data.posts.find((p) => p.slug === front.slug);
  if (existing && !update) throw new Error(`이미 게시된 slug입니다: ${front.slug} — 수정이면 --update`);
  if (!existing && update) throw new Error(`--update인데 게시된 글이 없음: ${front.slug}`);

  const date = update ? existing.date : arg("--date") || L.today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`날짜 형식 오류: ${date}`);
  const modified = update ? L.today() : undefined;

  // 하루 상한 (새 글만)
  if (!update) {
    const sameDay = data.posts.filter((p) => p.date === date).length;
    if (sameDay >= DAILY_MAX) throw new Error(`하루 ${DAILY_MAX}편 상한 — ${date}에 이미 ${sameDay}편 게시됨. 내일 게시하거나 운영자 확인 후 --date로 날짜 지정`);
  }

  // 이미지 계획
  const mdDir = path.dirname(path.resolve(mdPath));
  const imgPlan = front.images.map((rel, i) => {
    const src = path.resolve(mdDir, rel);
    if (!fs.existsSync(src)) throw new Error(`이미지 파일 없음: ${src}`);
    const ext = ".webp";
    const destName = `${front.slug}-${String(i + 1).padStart(2, "0")}${ext}`;
    return { key: path.basename(rel), src, destName };
  });
  const bodyImgs = [...body.matchAll(/^!\[([^\]]*)\]\(([^)]+)\)$/gm)].map((m) => path.basename(m[2]));
  for (const k of bodyImgs) if (!imgPlan.find((p) => p.key === k)) throw new Error(`본문 이미지 ${k}가 머리말 images에 없음`);
  if (bodyImgs.length !== front.images.length) console.warn(`주의: 머리말 images ${front.images.length}장, 본문 삽입 ${bodyImgs.length}장`);

  const url = `${L.SITE.url}/${cat.slug}/${front.slug}.html`;
  console.log(`\n[계획표]\n 제목   : ${front.title}\n 주소   : ${url}\n 카테고리: ${cat.name}\n 게시일 : ${date}${modified ? ` (수정일 ${modified})` : ""}\n 태그   : ${front.tags.join(", ") || "-"}\n 설명   : ${front.description}\n 이미지 : ${imgPlan.length ? imgPlan.map((p) => `${p.key} → /img/${p.destName}`).join(" / ") : "없음"}\n 오늘 게시 편수: ${data.posts.filter((p) => p.date === date).length + (update ? 0 : 1)}/${DAILY_MAX}`);
  if (dry) { console.log("\n--dry: 파일은 만들지 않았습니다."); return; }

  // 이미지 변환
  const imageMap = {};
  for (const p of imgPlan) {
    const r = await prepareImage(p.src, p.destName);
    imageMap[p.key] = r;
    console.log(` 이미지 ${p.destName} ${r.w}×${r.h} ${Math.round(r.bytes / 1024)}KB`);
  }

  // 본문 변환 → 글 파일
  const bodyHtml = L.mdToHtml(body, imageMap);
  const first = imgPlan[0] ? imageMap[imgPlan[0].key] : undefined;
  const post = { slug: front.slug, category: cat.slug, date, title: front.title, description: front.description, tags: front.tags };
  if (modified) post.modified = modified;
  if (first) post.image = { src: first.src, w: first.w, h: first.h };
  if (existing && existing.related) post.related = existing.related;
  L.write(`${cat.slug}/${front.slug}.html`, L.postPage(post, bodyHtml));

  // posts.json 갱신
  if (existing) Object.assign(existing, post); else data.posts.unshift(post);
  L.write("tools/posts.json", JSON.stringify(data, null, 2) + "\n");

  // 목록·sitemap·feed
  const r = require("./buildlist").build();
  console.log(` 목록 갱신: 글 ${r.posts}편 · 파일 ${r.changed}개`);
  console.log(`\n생성 완료 → ${cat.slug}/${front.slug}.html\n다음: node tools/readcheck.js ${cat.slug}/${front.slug}.html → 링크 확인 → 커밋·푸시 → 실사이트 200 확인 → node tools/indexnow.js ${url}`);
}

run().catch((e) => { console.error("실패:", e.message); process.exit(1); });
