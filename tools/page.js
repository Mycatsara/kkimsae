// 페이지(소개·개인정보처리방침·연락·404) 생성 — 원고 md → /{slug}.html
// 사용: node tools/page.js <페이지.md>   (머리말: title, slug, description, [noindex: true], [menu: about])
// 원고 원본은 Documents/원고대기/낌새/페이지_*.md (비공개 저장소). 문구를 고치면 다시 실행한다.
const fs = require("fs");
const L = require("./lib");

const mdPath = process.argv[2];
if (!mdPath) { console.log("사용법: node tools/page.js <페이지.md>"); process.exit(1); }
try {
  const { front, body } = L.parseFront(fs.readFileSync(mdPath, "utf8"));
  for (const k of ["title", "slug", "description"]) if (!front[k]) throw new Error(`머리말에 ${k}가 없습니다`);
  const html = L.pagePage({ title: front.title, slug: front.slug, description: front.description, noindex: front.noindex === "true" }, L.mdToHtml(body), front.menu || "");
  L.write(`${front.slug}.html`, html);
  console.log(`생성 → ${front.slug}.html`);
} catch (e) { console.error("실패:", e.message); process.exit(1); }
