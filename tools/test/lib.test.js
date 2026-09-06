// 변환기·조각 테스트 — node --test tools/test/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib");

test("parseFront: 머리말과 본문을 나누고 tags·images를 배열로", () => {
  const { front, body } = L.parseFront("---\ntitle: 제목\nslug: a-b\ncategory: 경제·금융\ntags: 실업급여, 고용보험\nimages: img/a.webp, img/b.webp\ndescription: 설명\n---\n\n본문 첫 줄\n");
  assert.equal(front.title, "제목");
  assert.equal(front.slug, "a-b");
  assert.deepEqual(front.tags, ["실업급여", "고용보험"]);
  assert.deepEqual(front.images, ["img/a.webp", "img/b.webp"]);
  assert.equal(body.trim(), "본문 첫 줄");
});

test("parseFront: 머리말 없으면 오류", () => {
  assert.throws(() => L.parseFront("본문만"), /머리말/);
});

test("inline: 굵게·링크·코드, 외부 링크는 새 창", () => {
  assert.equal(L.inline("**굵게**와 `코드`"), "<strong>굵게</strong>와 <code>코드</code>");
  assert.equal(L.inline("[홈](/)"), '<a href="/">홈</a>');
  assert.equal(L.inline("[고용보험](https://www.ei.go.kr)"), '<a href="https://www.ei.go.kr" target="_blank" rel="noopener">고용보험</a>');
  assert.equal(L.inline("<script>"), "&lt;script&gt;");
});

test("mdToHtml: 제목·문단·목록·인용·구분선", () => {
  const h = L.mdToHtml("## 소제목\n\n문단 하나.\n이어지는 줄.\n\n- 항목1\n- 항목2\n\n1. 첫째\n2. 둘째\n\n> 인용문\n\n---\n\n### 작은 제목");
  assert.match(h, /<h2>소제목<\/h2>/);
  assert.match(h, /<p>문단 하나\. 이어지는 줄\.<\/p>/);
  assert.match(h, /<ul><li>항목1<\/li><li>항목2<\/li><\/ul>/);
  assert.match(h, /<ol><li>첫째<\/li><li>둘째<\/li><\/ol>/);
  assert.match(h, /<blockquote><p>인용문<\/p><\/blockquote>/);
  assert.match(h, /<hr>/);
  assert.match(h, /<h3>작은 제목<\/h3>/);
});

test("mdToHtml: 표는 가로 스크롤 상자에 담고 합계 행에 total", () => {
  const h = L.mdToHtml("| 구분 | 금액 |\n|---|---|\n| 기본 | 1만원 |\n| 합계 | 2만원 |");
  assert.match(h, /<div class="tblwrap"><table><thead><tr><th>구분<\/th><th>금액<\/th><\/tr><\/thead>/);
  assert.match(h, /<tr><td>기본<\/td><td>1만원<\/td><\/tr>/);
  assert.match(h, /<tr class="total"><td>합계<\/td>/);
});

test("mdToHtml: 이미지는 figure, 첫 장은 hero+fetchpriority, 둘째는 lazy", () => {
  const map = { "a.webp": { src: "/img/x-01.webp", w: 1200, h: 675 }, "b.webp": { src: "/img/x-02.webp", w: 1200, h: 675 } };
  const h = L.mdToHtml("![첫 장면](img/a.webp)\n\n글\n\n![둘째 장면](img/b.webp)", map);
  assert.match(h, /<figure class="fig hero"><img src="\/img\/x-01.webp" width="1200" height="675" alt="첫 장면" fetchpriority="high" decoding="async"><\/figure>/);
  assert.match(h, /<figure class="fig"><img src="\/img\/x-02.webp" width="1200" height="675" alt="둘째 장면" loading="lazy" decoding="async"><\/figure>/);
});

test("mdToHtml: 이미지 파일 없음·alt 비어 있음은 오류", () => {
  assert.throws(() => L.mdToHtml("![a](img/none.webp)", {}), /이미지 없음/);
  assert.throws(() => L.mdToHtml("![](img/a.webp)", { "a.webp": { src: "/img/a.webp", w: 1, h: 1 } }), /alt/);
});

test("fmtDate·rfc822·postUrl", () => {
  assert.equal(L.fmtDate("2026-09-06"), "2026년 9월 6일");
  assert.match(L.rfc822("2026-09-06"), /^Sun, 06 Sep 2026/);
  assert.equal(L.postUrl({ category: "money", slug: "a" }), "/money/a.html");
});

test("카테고리: 한글 이름·슬러그 양쪽으로 찾기", () => {
  assert.equal(L.catByName("경제·금융").slug, "money");
  assert.equal(L.catByName("season").name, "이맘때");
  assert.equal(L.catByName("없음"), undefined);
});

test("card: 대표 이미지 → 제목 → 날짜 → 설명 → 카테고리 칩", () => {
  const h = L.card({ slug: "a", category: "game", date: "2026-09-06", title: "제목 <b>", description: "설명", image: { src: "/img/a-01.webp", w: 1200, h: 675 } });
  assert.match(h, /^<a class="card" href="\/game\/a.html">/);
  assert.match(h, /<img class="thumb" src="\/img\/a-01.webp" width="1200" height="675" alt="" loading="lazy"/);
  assert.match(h, /<h2>제목 &lt;b&gt;<\/h2>/);
  assert.match(h, /<time datetime="2026-09-06">2026년 9월 6일<\/time>/);
  assert.match(h, /<span class="chip">게임<\/span>\s*<\/a>$/);
});

test("header·footer: 메뉴 오른쪽에 카테고리 4 + 소개 펼침(소개·개인정보처리방침·연락), 바닥에 RSS 링크 없음", () => {
  const h = L.header("privacy");
  assert.match(h, /<details class="dd" open><summary class="on">소개<\/summary>/);
  assert.match(h, /<a href="\/privacy.html" class="on">개인정보처리방침<\/a>/);
  assert.match(h, /<a href="\/money\/">경제·금융<\/a>/);
  const f = L.footer();
  assert.doesNotMatch(f, /feed\.xml|RSS/);
  assert.match(f, /개인정보처리방침/);
});

test("sidebar: 최근 글 6개·카테고리 편수·검색 폼", () => {
  const posts = Array.from({ length: 8 }, (_, i) => ({ slug: "p" + i, category: i % 2 ? "money" : "daily", date: "2026-09-0" + (9 - i), title: "글" + i, description: "d", image: i ? { src: "/img/p.webp", w: 1200, h: 675 } : undefined }));
  const s = L.sidebar(posts);
  assert.equal((s.match(/<li><a href="\/(money|daily)\/p\d\.html">/g) || []).length, 6);
  assert.match(s, /<span class="noimg"><\/span>/);
  assert.match(s, /경제·금융 <span class="n">\(4\)<\/span>/);
  assert.match(s, /이맘때 <span class="n">\(0\)<\/span>/);
  assert.match(s, /<form class="search" action="\/search.html" method="get">/);
  assert.match(L.sidebar([]), /아직 글이 없습니다/);
});

test("postPage: 머리·JSON-LD·AUTO:NEXT 마커·수정일 표기", () => {
  const p = { slug: "a", category: "money", date: "2026-09-06", modified: "2026-09-10", title: "제목", description: "설명", tags: ["t1"], image: { src: "/img/a-01.webp", w: 1200, h: 675 } };
  const h = L.postPage(p, "<p>본문</p>");
  assert.match(h, /<title>제목 — 낌새<\/title>/);
  assert.match(h, /<link rel="canonical" href="https:\/\/kkimsae.com\/money\/a.html">/);
  assert.match(h, /"@type":"BlogPosting"/);
  assert.match(h, /"datePublished":"2026-09-06","dateModified":"2026-09-10"/);
  assert.match(h, /"@type":"BreadcrumbList"/);
  assert.match(h, /2026년 9월 6일 게시 · 2026년 9월 10일 수정/);
  assert.match(h, /<!-- AUTO:NEXT:START -->\s*<!-- AUTO:NEXT:END -->/);
  assert.match(h, /<aside class="side">\s*<!-- AUTO:SIDE:START -->\s*<!-- AUTO:SIDE:END -->/);
  assert.match(h, /<a href="\/money\/" class="on">경제·금융<\/a>/);
  assert.match(h, /G-DMKX2LWWTB/);
  assert.match(h, /google-site-verification/);
  assert.doesNotMatch(h, /noindex/);
});

test("pagePage: noindex 옵션", () => {
  const h = L.pagePage({ title: "T", slug: "x", description: "d", noindex: true }, "<p>b</p>");
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.match(h, /<h1>T<\/h1>/);
});
