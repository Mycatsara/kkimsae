// 뼈대 페이지 생성 — 홈·카테고리 4개·404·robots.txt 를 다시 만든다. (머리·바닥 문구나 메뉴를 바꿨을 때 실행)
// AUTO 구간은 비워 두므로 실행 뒤 반드시 `node tools/buildlist.js`로 채운다.
// 사용: node tools/scaffold.js
const L = require("./lib");

function shell({ title, description, url, active, body, noindex = false, jsonld = [] }) {
  return `${L.head({ title, description, url, noindex, jsonld })}
<body>
<div class="wrap">
${L.header(active)}
<main>
${body}
</main>
${L.footer()}
</div>
</body>
</html>
`;
}

// 홈
L.write("index.html", shell({
  title: L.SITE.name,
  description: "낌새는 해마다 같은 시기에 다시 검색되는 질문에 미리 답을 정리해 두는 블로그입니다. 경제·금융, 이맘때, 게임, 일상 네 칸.",
  url: "/", active: "home",
  jsonld: [{ "@context": "https://schema.org", "@type": "WebSite", name: L.SITE.name, url: L.SITE.url + "/", description: L.SITE.tagline, inLanguage: "ko" }],
  body: `<h1 class="sr">${L.SITE.name} — ${L.SITE.tagline}</h1>
<!-- AUTO:HOME:START -->
<!-- AUTO:HOME:END -->`,
}));

// 카테고리 4개
for (const c of L.CATS) {
  L.write(`${c.slug}/index.html`, shell({
    title: c.name, description: `${c.name} — ${c.desc}. 낌새의 ${c.name} 글 모음.`, url: `/${c.slug}/`, active: c.slug,
    jsonld: [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: L.SITE.url + "/" },
      { "@type": "ListItem", position: 2, name: c.name, item: `${L.SITE.url}/${c.slug}/` } ] }],
    body: `<div class="cathead"><h1>${L.esc(c.name)}</h1><p>${L.esc(c.desc)}</p></div>
<!-- AUTO:LIST:START -->
<!-- AUTO:LIST:END -->`,
  }));
}

// 404 (GitHub Pages가 없는 주소에 자동으로 보여줌)
L.write("404.html", shell({
  title: "이 주소엔 글이 없습니다", description: "주소가 바뀌었거나 글을 내린 경우입니다.", url: "/404.html", noindex: true,
  body: `<article class="page">
  <div class="phead"><h1>이 주소엔 글이 없습니다</h1></div>
  <div class="body">
<p>주소가 바뀌었거나, 글을 내렸거나, 링크가 잘못 걸린 경우입니다.</p>
<p><a href="/">홈</a>으로 가서 최근 글부터 보시거나, 아래 네 칸 중 찾던 주제에 가까운 곳으로 가 보세요.</p>
<ul>
${L.CATS.map((c) => `<li><a href="/${c.slug}/">${L.esc(c.name)}</a> — ${L.esc(c.desc)}</li>`).join("\n")}
</ul>
  </div>
</article>`,
}));

L.write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${L.SITE.url}/sitemap.xml\n`);

console.log("뼈대 생성: index.html, " + L.CATS.map((c) => `${c.slug}/index.html`).join(", ") + ", 404.html, robots.txt → 이어서 node tools/buildlist.js");
