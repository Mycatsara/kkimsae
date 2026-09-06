// 글 목록 자동 생성 — tools/posts.json 하나만 고치면 아래가 한 번에 갱신된다.
//   1) index.html            : 홈 최신 글 카드 (AUTO:HOME)
//   2) {category}/index.html : 카테고리별 글 카드 전체 (AUTO:LIST)
//   3) 각 글 .html           : 글 하단 "이어서 읽을 글" 3편 (AUTO:NEXT)
//   4) 홈·카테고리·글의 사이드바(최근 글·카테고리 편수·검색) (AUTO:SIDE)
//   5) sitemap.xml · feed.xml · search.json: 전체 생성
// 사용: node tools/buildlist.js          갱신
//       node tools/buildlist.js --check  갱신할 게 남아 있으면 실패(pre-commit 훅용 — 생성물 안 커밋하는 사고 방지)
// 규칙: AUTO 마커 사이만 바뀐다. 그 밖은 손대지 않는다.
const fs = require("fs");
const path = require("path");
const L = require("./lib");

const HOME_MAX = 10;
const NEXT_MAX = 3;

function fill(file, name, inner, check, optional = false) {
  const s = L.read(file);
  const re = new RegExp(`(<!-- AUTO:${name}:START -->)[\\s\\S]*?(<!-- AUTO:${name}:END -->)`);
  if (!re.test(s)) { if (optional) { console.warn(`주의: ${file}에 AUTO:${name} 마커가 없음 — 옛 틀. node tools/publish.js <원고> --rebuild 로 다시 만들 것`); return false; } throw new Error(`${file}: AUTO:${name} 마커가 없습니다`); }
  const next = s.replace(re, `$1\n${inner}\n$2`);
  if (next === s) return false;
  if (!check) L.write(file, next);
  return true;
}
function put(file, content, check) {
  if (L.exists(file) && L.read(file) === content) return false;
  if (!check) L.write(file, content);
  return true;
}

function loadPosts() {
  const data = JSON.parse(L.read("tools/posts.json"));
  const posts = data.posts.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  // 검증: 카테고리·중복·파일 존재
  const seen = new Set();
  for (const p of posts) {
    if (!L.catBySlug(p.category)) throw new Error(`posts.json: 카테고리 슬러그가 잘못됨 → ${p.slug}: ${p.category}`);
    if (seen.has(p.slug)) throw new Error(`posts.json: 슬러그 중복 → ${p.slug}`);
    seen.add(p.slug);
    if (!L.exists(`${p.category}/${p.slug}.html`)) throw new Error(`posts.json에 있으나 파일이 없음 → ${p.category}/${p.slug}.html`);
    if (p.image && !L.exists(p.image.src.replace(/^\//, ""))) throw new Error(`대표 이미지 파일이 없음 → ${p.image.src}`);
  }
  // 파일은 있는데 posts.json에 없는 글
  for (const c of L.CATS) {
    const dir = path.join(L.ROOT, c.slug);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".html") || f === "index.html") continue;
      const slug = f.replace(/\.html$/, "");
      if (!seen.has(slug)) throw new Error(`파일은 있으나 posts.json에 없음 → ${c.slug}/${f}`);
    }
  }
  return posts;
}

// 관련 글: 직접 지정(related) → 같은 카테고리 최신순 → 나머지 최신순
function related(p, posts) {
  const byS = (s) => posts.find((x) => x.slug === s);
  const picked = (p.related || []).map(byS).filter((x) => x && x.slug !== p.slug);
  const others = posts.filter((x) => x.slug !== p.slug && !picked.includes(x));
  const same = others.filter((x) => x.category === p.category);
  const rest = others.filter((x) => x.category !== p.category);
  return [...picked, ...same, ...rest].slice(0, NEXT_MAX);
}

function sitemap(posts) {
  const pages = [
    { loc: "/", lastmod: posts[0] ? posts[0].modified || posts[0].date : L.today(), priority: "1.0" },
    ...L.CATS.map((c) => { const latest = posts.find((p) => p.category === c.slug); return { loc: `/${c.slug}/`, lastmod: latest ? latest.modified || latest.date : L.today(), priority: "0.7" }; }),
    { loc: "/about.html", lastmod: "2026-09-05", priority: "0.3" },
    { loc: "/privacy.html", lastmod: "2026-09-05", priority: "0.1" },
    { loc: "/contact.html", lastmod: "2026-09-05", priority: "0.1" },
    ...posts.map((p) => ({ loc: L.postUrl(p), lastmod: p.modified || p.date, priority: "0.8" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((u) => `  <url><loc>${L.SITE.url}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
}

function feed(posts) {
  const items = posts.slice(0, 20).map((p) => `    <item>
      <title>${L.esc(p.title)}</title>
      <link>${L.SITE.url}${L.postUrl(p)}</link>
      <guid isPermaLink="true">${L.SITE.url}${L.postUrl(p)}</guid>
      <pubDate>${L.rfc822(p.date)}</pubDate>
      <category>${L.esc(L.catBySlug(p.category).name)}</category>
      <description>${L.esc(p.description)}</description>
    </item>`).join("\n");
  const last = posts[0] ? L.rfc822(posts[0].modified || posts[0].date) : L.rfc822(L.today());
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${L.SITE.name}</title>
    <link>${L.SITE.url}/</link>
    <description>${L.esc(L.SITE.tagline)}</description>
    <language>ko</language>
    <lastBuildDate>${last}</lastBuildDate>
    <atom:link href="${L.SITE.url}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

const EMPTY = `<p class="empty">아직 글이 없습니다. 곧 채워집니다.</p>`;

function build({ check = false } = {}) {
  const posts = loadPosts();
  let changed = 0;
  const changedFiles = [];
  const mark = (f, did) => { if (did) { changed++; changedFiles.push(f); } };

  const side = L.sidebar(posts);
  mark("index.html", fill("index.html", "HOME", posts.length ? posts.slice(0, HOME_MAX).map(L.card).join("\n") : EMPTY, check));
  mark("index.html", fill("index.html", "SIDE", side, check));
  if (L.exists("search.html")) mark("search.html", fill("search.html", "SIDE", side, check, true));
  for (const c of L.CATS) {
    const mine = posts.filter((p) => p.category === c.slug);
    mark(`${c.slug}/index.html`, fill(`${c.slug}/index.html`, "LIST", mine.length ? mine.map(L.card).join("\n") : EMPTY, check));
    mark(`${c.slug}/index.html`, fill(`${c.slug}/index.html`, "SIDE", side, check));
  }
  for (const p of posts) {
    const f = `${p.category}/${p.slug}.html`;
    mark(f, fill(f, "NEXT", L.nextBlock(related(p, posts)), check));
    mark(f, fill(f, "SIDE", side, check, true));
  }
  mark("sitemap.xml", put("sitemap.xml", sitemap(posts), check));
  mark("feed.xml", put("feed.xml", feed(posts), check));
  // 검색 페이지가 읽는 색인(제목·설명·태그·주소·날짜·카테고리)
  mark("search.json", put("search.json", JSON.stringify(posts.map((p) => ({ t: p.title, d: p.description, g: (p.tags || []).join(" "), u: L.postUrl(p), dt: p.date, c: L.catBySlug(p.category).name, i: p.image ? p.image.src : "" }))) + "\n", check));
  return { posts: posts.length, changed, changedFiles };
}

if (require.main === module) {
  const check = process.argv.includes("--check");
  try {
    const r = build({ check });
    if (check) {
      if (r.changed) { console.error(`buildlist --check: 갱신 안 된 파일 ${r.changed}개 → node tools/buildlist.js 실행 후 다시 커밋\n  ${r.changedFiles.join("\n  ")}`); process.exit(1); }
      console.log(`buildlist --check: 통과 (글 ${r.posts}편)`);
    } else console.log(`글 ${r.posts}편 · 갱신된 파일 ${r.changed}개${r.changed ? ": " + r.changedFiles.join(", ") : ""}`);
  } catch (e) { console.error("오류:", e.message); process.exit(1); }
}

module.exports = { build, related, sitemap, feed, loadPosts };
