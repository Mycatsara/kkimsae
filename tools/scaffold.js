// 뼈대 페이지 생성 — 홈·카테고리·이전 글 모음·검색·404·robots.txt 를 다시 만든다.
// AUTO 구간은 비워 두므로 실행 뒤 반드시 `node tools/buildlist.js`로 채운다. 글 페이지는 `node tools/publish.js <원고> --rebuild`.
// 사용: node tools/scaffold.js
const L = require("./lib");

function shell({ title, description, url, active, body, noindex = false, jsonld = [], side = true, narrow = false }) {
  const inner = side ? `<div class="layout">\n<main>\n${body}\n</main>\n${L.sidebarShell()}\n</div>` : `<main${narrow ? ' class="narrow"' : ""}>\n${body}\n</main>`;
  const script = side ? `\n<script src="/site.js?v=20260906"></script>` : "";
  return `${L.head({ title, description, url, noindex, jsonld })}
<body>
<div class="wrap">
${L.header(active)}
${inner}
${L.footer()}
</div>${script}
</body>
</html>
`;
}

// 홈: 2열 카드 + 사이드바
L.write("index.html", shell({
  title: L.SITE.name,
  description: L.SITE.description,
  url: "/", active: "home",
  jsonld: [{ "@context": "https://schema.org", "@type": "WebSite", name: L.SITE.name, url: L.SITE.url + "/", description: L.SITE.tagline, inLanguage: "ko" }],
  body: `<div class="home-intro"><p class="eyebrow">낌새 · 부동산 이야기</p><h1>${L.SITE.tagline}</h1><p>${L.SITE.description}</p></div>
<div class="list home-list">
<!-- AUTO:HOME:START -->
<!-- AUTO:HOME:END -->
</div>`,
}));

// 기존 분류는 그대로 두고, 새 세 분류를 더한다.
for (const c of L.CATS) {
  L.write(`${c.slug}/index.html`, shell({
    title: c.name, description: `${c.name} — ${c.desc}${c.desc.endsWith('.') ? '' : '.'} 낌새의 ${c.name} 글 모음.`, url: `/${c.slug}/`, active: c.slug,
    jsonld: [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: L.SITE.url + "/" },
      { "@type": "ListItem", position: 2, name: c.name, item: `${L.SITE.url}/${c.slug}/` } ] }],
    body: `<div class="cathead">${L.isMain(c.slug) ? '' : '<p class="eyebrow"><a href="/archive.html">이전 글 모아보기</a></p>'}<h1>${L.esc(c.name)}</h1><p>${L.esc(c.desc)}</p></div>
<div class="list">
<!-- AUTO:LIST:START -->
<!-- AUTO:LIST:END -->
</div>`,
  }));
}

L.write("archive.html", shell({
  title: "이전 글 모아보기", description: "낌새에서 이전에 다룬 경제·금융, 이맘때, 게임, 일상 글을 기존 분류와 주소 그대로 모았습니다.", url: "/archive.html",
  body: `<div class="cathead"><p class="eyebrow">낌새의 기록</p><h1>이전 글 모아보기</h1><p>그동안 다룬 글을 기존 분류 그대로 모았습니다. 새 부동산 글은 <a href="/">홈</a>에서 만나실 수 있습니다.</p></div>
<nav class="archive-cats" aria-label="이전 글 분류">${L.ARCHIVE_CATS.map(c => `<a href="/${c.slug}/">${L.esc(c.name)}</a>`).join('')}</nav>
<div class="list">
<!-- AUTO:ARCHIVE:START -->
<!-- AUTO:ARCHIVE:END -->
</div>`,
}));

// 검색: search.json(buildlist가 생성)을 읽어 제목·설명·태그에서 찾는다. 서버 없이 브라우저에서만 동작
L.write("search.html", shell({
  title: "검색", description: "청약·분양, 집값·시세, 재개발·교통 글과 이전 글을 찾아보세요.", url: "/search.html", active: "search", noindex: true,
  body: `<div class="cathead"><h1 id="sq">검색</h1><p id="scount"></p></div>
<form class="search search-tools" action="/search.html" method="get">
<label class="sr" for="search-query">검색어</label><input id="search-query" type="search" name="q" placeholder="찾는 말을 입력하세요">
<label class="sr" for="search-scope">검색 범위</label><select id="search-scope" name="scope"><option value="realestate">부동산 글</option><option value="all">전체 글</option></select><button type="submit">찾기</button>
</form>
<p class="search-help">전체 글을 선택하면 이전에 다룬 글도 함께 검색합니다.</p>
<div class="cards" id="sres"></div>
<script src="/assets/search.js?v=20261012" defer></script>`,
}));

// 404 (GitHub Pages가 없는 주소에 자동으로 보여줌)
L.write("404.html", shell({
  title: "이 주소엔 글이 없습니다", description: "주소가 바뀌었거나 글을 내린 경우입니다.", url: "/404.html", noindex: true, side: false, narrow: true,
  body: `<article class="page">
  <div class="phead"><h1>이 주소엔 글이 없습니다</h1></div>
  <div class="body">
<p>주소가 바뀌었거나, 글을 내렸거나, 링크가 잘못 걸린 경우입니다.</p>
<p><a href="/">홈</a>으로 가서 최근 글부터 보시거나, 아래 세 주제 중 찾던 곳으로 가 보세요. 예전 글은 <a href="/archive.html">이전 글 모아보기</a>에서 찾을 수 있습니다.</p>
<ul>
${L.MAIN_CATS.map((c) => `<li><a href="/${c.slug}/">${L.esc(c.name)}</a> — ${L.esc(c.desc)}</li>`).join("\n")}
</ul>
  </div>
</article>`,
}));

L.write("robots.txt", `#DaumWebMasterTool:2ae6fcaf614379d2e4ece8cfcdd23d2388a53b44eb08ffa53184a4f39fc34e81:8NlEA5zh8WXgoRgf+MLlog==
User-agent: *\nAllow: /\nDisallow: /search.html\n\nSitemap: ${L.SITE.url}/sitemap.xml\n`);

console.log("뼈대 생성: index.html, archive.html, " + L.CATS.map((c) => `${c.slug}/index.html`).join(", ") + ", search.html, 404.html, robots.txt → 이어서 node tools/buildlist.js");
