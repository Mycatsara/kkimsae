// 낌새 공용 라이브러리 — 사이트 설정, 원고(md) → HTML 변환, 머리·바닥·카드 조각.
// buildlist.js · publish.js · page.js · scaffold.js가 전부 이 파일을 쓴다. 디자인 값은 assets/style.css에만 있다.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.KKIMSAE_ROOT || path.join(__dirname, "..");

const SITE = {
  name: "낌새",
  host: "kkimsae.com",
  url: "https://kkimsae.com",
  tagline: "해마다 다시 찾는 답",
  email: "ydj00383@naver.com",
  ga: "G-DMKX2LWWTB",
  google: "Um4UH--ivJ-Jy4bCHmzmd6xOOJ6AHSTpz61yAmZcy60",
  naver: "5c8a1a935296a50cae8fb1a5c6abe4511c5c43fa",
  og: "/og.png",
  lang: "ko",
};

// 카테고리 4개 — 폴더 이름(slug)이 주소가 된다: /money/글.html (9/6 운영자 결정: 이름은 낌새식으로, 주소는 유지)
const CATS = [
  { slug: "money", name: "경제·금융", desc: "지원금, 수당, 세금, 요금. 해마다 다시 계산하게 되는 것" },
  { slug: "season", name: "이맘때", desc: "설·추석, 수능, 세일, 신청 기간. 날짜가 정해져 있어 미리 준비하면 편한 것" },
  { slug: "game", name: "게임", desc: "정기 세일, 시즌 이벤트, 발매 일정. 놓치면 다음 해까지 기다려야 하는 것" },
  { slug: "daily", name: "일상", desc: "김장, 난방비, 환절기 준비, 대청소. 철이 바뀔 때마다 다시 찾게 되는 것" },
];
const catBySlug = (s) => CATS.find((c) => c.slug === s);
const catByName = (n) => CATS.find((c) => c.name === n || c.slug === n);

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s, "utf8"); };
const exists = (f) => fs.existsSync(path.join(ROOT, f));

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtDate(iso) { const [y, m, d] = iso.split("-").map(Number); return `${y}년 ${m}월 ${d}일`; }
function rfc822(iso) { return new Date(iso + "T09:00:00+09:00").toUTCString(); }

// ---------- 원고 머리말 ----------
// ---\ntitle: …\nslug: …\ncategory: 경제·금융\ntags: a, b\ndescription: …\nimages: img/a.webp, img/b.webp\n---
function parseFront(md) {
  const m = md.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("머리말(---)이 없습니다");
  const front = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (k) front[k[1]] = k[2].trim();
  }
  const list = (v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
  front.tags = list(front.tags);
  front.images = list(front.images);
  return { front, body: m[2] };
}

// ---------- 인라인 ----------
function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, a, u) => `<a href="${esc(u)}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ""}>${a}</a>`);
  return t;
}

// ---------- 본문 md → HTML ----------
// imageMap: { "unemp-01.webp": { src:"/img/unemp-01.webp", w:1200, h:675 } } — 원고의 ![alt](img/unemp-01.webp)와 파일명으로 짝
function mdToHtml(body, imageMap = {}) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [];
  let imgCount = 0;
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    const t = l.trim();
    let m;
    if (!t) { flush(); i++; continue; }
    if ((m = t.match(/^(#{2,3})\s+(.*)$/))) { flush(); const lv = m[1].length; out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); i++; continue; }
    if (/^---+$/.test(t)) { flush(); out.push("<hr>"); i++; continue; }
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) {
      flush();
      const key = path.basename(m[2]);
      const img = imageMap[key];
      if (!img) throw new Error(`이미지 없음: ${m[2]} (머리말 images와 파일을 확인)`);
      if (!m[1].trim()) throw new Error(`이미지 alt가 비어 있음: ${m[2]}`);
      imgCount++;
      const first = imgCount === 1;
      out.push(`<figure class="fig${first ? " hero" : ""}"><img src="${img.src}" width="${img.w}" height="${img.h}" alt="${esc(m[1])}"${first ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></figure>`);
      i++; continue;
    }
    if (/^>/.test(t)) { flush(); const q = []; while (i < lines.length && /^>/.test(lines[i].trim())) { q.push(lines[i].trim().replace(/^>\s?/, "")); i++; } out.push(`<blockquote>${q.join("\n").split(/\n\s*\n/).map((p) => `<p>${inline(p.replace(/\n/g, " "))}</p>`).join("")}</blockquote>`); continue; }
    if (/^\|/.test(t)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) rows.push(lines[i].trim()), i++;
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const bodyRows = rows.slice(1).filter((r) => !/^\|\s*:?-+/.test(r));
      const tr = (r) => { const cs = cells(r); const total = /^\*\*(합계|총|하루 지급액|계)/.test(cs[0]) || /^(합계|총계|계)$/.test(cs[0].replace(/\*\*/g, "")); return `<tr${total ? ' class="total"' : ""}>${cs.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`; };
      out.push(`<div class="tblwrap"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${bodyRows.map(tr).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^([-*]|\d+\.)\s+/.test(t)) {
      flush();
      const ordered = /^\d+\./.test(t);
      const items = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, "")); i++; }
      out.push(`<${ordered ? "ol" : "ul"}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    para.push(t); i++;
  }
  flush();
  return out.join("\n");
}

// ---------- 이미지 크기(webp) ----------
function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const tag = buf.toString("ascii", 12, 16);
  if (tag === "VP8X") return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  if (tag === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (tag === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  return null;
}

// ---------- 페이지 조각 ----------
function head({ title, description, url, image, type = "website", jsonld = [], noindex = false, dateModified }) {
  const full = title === SITE.name ? `${SITE.name} — ${SITE.tagline}` : `${title} — ${SITE.name}`;
  const img = SITE.url + (image || SITE.og);
  const abs = SITE.url + url;
  return `<!DOCTYPE html>
<html lang="${SITE.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">${noindex ? '\n<meta name="robots" content="noindex">' : ""}
<link rel="canonical" href="${abs}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="${image ? 1200 : 1200}">
<meta property="og:image:height" content="${image ? 675 : 630}">
<meta name="twitter:card" content="summary_large_image">
<meta name="google-site-verification" content="${SITE.google}">
<meta name="naver-site-verification" content="${SITE.naver}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" sizes="32x32" type="image/png">
<link rel="alternate" type="application/rss+xml" title="${SITE.name}" href="${SITE.url}/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
<script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.ga}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${SITE.ga}');</script>
</head>`;
}

// 머리: 왼쪽 제목·태그라인, 오른쪽 메뉴(카테고리 4 + "소개" 펼침 메뉴에 소개·개인정보처리방침·연락) — 9/6 운영자 요청(눈치 홈과 같은 배치)
const INFO_PAGES = [{ href: "/about.html", slug: "about", name: "소개" }, { href: "/privacy.html", slug: "privacy", name: "개인정보처리방침" }, { href: "/contact.html", slug: "contact", name: "연락" }];
function header(active = "") {
  const cats = CATS.map((c) => `<a href="/${c.slug}/"${c.slug === active ? ' class="on"' : ""}>${c.name}</a>`).join("");
  const infoOn = INFO_PAGES.some((p) => p.slug === active);
  const info = `<details class="dd"${infoOn ? " open" : ""}><summary${infoOn ? ' class="on"' : ""}>소개</summary><div class="dd-menu">${INFO_PAGES.map((p) => `<a href="${p.href}"${p.slug === active ? ' class="on"' : ""}>${p.name}</a>`).join("")}</div></details>`;
  return `<header class="site">
  <div class="brand"><a class="title" href="/">${SITE.name}</a><p class="desc">${SITE.tagline}</p></div>
  <nav class="menu" aria-label="주요 메뉴">${cats}${info}</nav>
</header>`;
}

function footer() {
  return `<footer class="site">
  <div class="flinks">${INFO_PAGES.map((p) => `<a href="${p.href}">${p.name}</a>`).join("")}</div>
  <p class="copy">© 2026 ${SITE.name} · ${SITE.tagline}</p>
</footer>`;
}

const postUrl = (p) => `/${p.category}/${p.slug}.html`;

// 목록 카드 (홈·카테고리·검색): 이미지 → 제목 → 날짜 → 발췌 3줄 → 카테고리 칩
function card(p) {
  const cat = catBySlug(p.category);
  const thumb = p.image ? `\n  <img class="thumb" src="${esc(p.image.src)}" width="${p.image.w}" height="${p.image.h}" alt="" loading="lazy" decoding="async">` : "";
  return `<a class="card" href="${postUrl(p)}">${thumb}
  <h2>${esc(p.title)}</h2>
  <p class="meta"><time datetime="${p.date}">${fmtDate(p.date)}</time></p>
  <p class="excerpt">${esc(p.description)}</p>
  <span class="chip">${esc(cat.name)}</span>
</a>`;
}

// 사이드바 (홈·카테고리·글): 최근 글 6 · 카테고리(편수) · 검색. 내용은 buildlist가 AUTO:SIDE 사이에 채운다
function sidebarShell() {
  return `<aside class="side">
<!-- AUTO:SIDE:START -->
<!-- AUTO:SIDE:END -->
</aside>`;
}
function sidebar(posts) {
  const recent = posts.slice(0, 6).map((p) => `      <li><a href="${postUrl(p)}">${p.image ? `<img src="${esc(p.image.src)}" width="56" height="56" alt="" loading="lazy" decoding="async">` : `<span class="noimg"></span>`}<span><span class="t">${esc(p.title)}</span><span class="d">${fmtDate(p.date)}</span></span></a></li>`).join("\n");
  const cats = CATS.map((c) => { const n = posts.filter((p) => p.category === c.slug).length; return `      <li><a href="/${c.slug}/">${esc(c.name)} <span class="n">(${n})</span></a></li>`; }).join("\n");
  return `<div class="widget">
  <h3>최근 글</h3>
  <ul class="recent">
${recent || '      <li class="none">아직 글이 없습니다</li>'}
  </ul>
</div>
<div class="widget">
  <h3>카테고리</h3>
  <ul class="cats">
${cats}
  </ul>
</div>
<div class="widget">
  <h3>검색</h3>
  <form class="search" action="/search.html" method="get"><input type="search" name="q" placeholder="찾는 말" aria-label="검색어"><button type="submit">찾기</button></form>
</div>`;
}

// 글 하단 "이어서 읽을 글"
function nextBlock(items) {
  if (!items.length) return "";
  return `<div class="next">
  <h2>이어서 읽을 글</h2>
  <ul class="plist">
${items.map((p) => `    <li><a href="${postUrl(p)}"><span class="t">${esc(p.title)}</span><span class="d">${fmtDate(p.date)}</span></a></li>`).join("\n")}
  </ul>
</div>`;
}

// 글 한 편의 완성 HTML
function postPage(p, bodyHtml) {
  const cat = catBySlug(p.category);
  const url = postUrl(p);
  const modified = p.modified || p.date;
  const jsonld = [
    {
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: p.title, description: p.description,
      datePublished: p.date, dateModified: modified,
      image: p.image ? SITE.url + p.image.src : SITE.url + SITE.og,
      author: { "@type": "Organization", name: SITE.name, url: SITE.url },
      publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
      mainEntityOfPage: SITE.url + url,
      inLanguage: "ko", keywords: (p.tags || []).join(", "), articleSection: cat.name,
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE.url + "/" },
      { "@type": "ListItem", position: 2, name: cat.name, item: `${SITE.url}/${cat.slug}/` },
      { "@type": "ListItem", position: 3, name: p.title, item: SITE.url + url },
    ] },
  ];
  const dateLine = modified !== p.date ? `${fmtDate(p.date)} 게시 · ${fmtDate(modified)} 수정` : `${fmtDate(p.date)} 게시`;
  return `${head({ title: p.title, description: p.description, url, image: p.image && p.image.src, type: "article", jsonld })}
<body>
<div class="wrap">
${header(cat.slug)}
<div class="layout">
<main>
<article>
  <p class="crumb"><a href="/">홈</a><span>›</span><a href="/${cat.slug}/">${esc(cat.name)}</a></p>
  <div class="phead">
    <a class="chip" href="/${cat.slug}/">${esc(cat.name)}</a>
    <h1>${esc(p.title)}</h1>
    <p class="meta"><time datetime="${p.date}">${dateLine}</time></p>
  </div>
  <div class="body">
${bodyHtml}
  </div>
  <div class="pfoot">${(p.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
  <!-- AUTO:NEXT:START -->
  <!-- AUTO:NEXT:END -->
</article>
</main>
${sidebarShell()}
</div>
${footer()}
</div>
</body>
</html>
`;
}

// 소개·개인정보처리방침·연락 같은 페이지 (사이드바 없음, 본문 760px)
function pagePage({ title, description, slug, noindex = false }, bodyHtml, active = "") {
  const url = `/${slug}.html`;
  return `${head({ title, description, url, noindex })}
<body>
<div class="wrap">
${header(active || slug)}
<main class="narrow">
<article class="page">
  <div class="phead"><h1>${esc(title)}</h1></div>
  <div class="body">
${bodyHtml}
  </div>
</article>
</main>
${footer()}
</div>
</body>
</html>
`;
}

module.exports = { ROOT, SITE, CATS, INFO_PAGES, catBySlug, catByName, esc, read, write, exists, today, fmtDate, rfc822, parseFront, inline, mdToHtml, webpSize, head, header, footer, postUrl, card, nextBlock, sidebarShell, sidebar, postPage, pagePage };
