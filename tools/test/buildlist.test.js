// buildlist 테스트 — 임시 폴더에 뼈대를 만들고 posts.json으로 목록·sitemap·feed가 채워지는지 확인
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const TOOLS = path.join(__dirname, "..");
const NODE = process.execPath;

function setup(posts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kkimsae-test-"));
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  fs.mkdirSync(path.join(root, "img"), { recursive: true });
  fs.writeFileSync(path.join(root, "tools", "posts.json"), JSON.stringify({ posts }));
  const env = { ...process.env, KKIMSAE_ROOT: root };
  execFileSync(NODE, [path.join(TOOLS, "scaffold.js")], { env });
  return { root, env };
}
function run(env, args = []) {
  try { return { code: 0, out: execFileSync(NODE, [path.join(TOOLS, "buildlist.js"), ...args], { env, stdio: ["ignore", "pipe", "pipe"] }).toString() }; }
  catch (e) { return { code: e.status, out: (e.stdout || "").toString() + (e.stderr || "").toString() }; }
}
function writePost(root, p) {
  const L = require("../lib");
  fs.writeFileSync(path.join(root, p.category, `${p.slug}.html`), L.postPage(p, "<p>본문</p>"));
  if (p.image) fs.writeFileSync(path.join(root, p.image.src.replace(/^\//, "")), "x");
}

test("글 0편: 홈·카테고리에 빈 안내, sitemap·feed 생성", () => {
  const { root, env } = setup([]);
  const r = run(env);
  assert.equal(r.code, 0, r.out);
  assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /아직 글이 없습니다/);
  assert.match(fs.readFileSync(path.join(root, "money/index.html"), "utf8"), /아직 글이 없습니다/);
  const sm = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.match(sm, /<loc>https:\/\/kkimsae.com\/<\/loc>/);
  assert.match(sm, /<loc>https:\/\/kkimsae.com\/season\/<\/loc>/);
  assert.match(sm, /<loc>https:\/\/kkimsae.com\/about.html<\/loc>/);
  assert.match(fs.readFileSync(path.join(root, "feed.xml"), "utf8"), /<rss version="2.0"/);
  assert.equal(run(env, ["--check"]).code, 0);
});

test("이전 글 3편: 이전 글 모음 최신순, 원래 분류·관련 글·sitemap·feed 유지", () => {
  const posts = [
    { slug: "old", category: "money", date: "2026-09-01", title: "옛 글", description: "d1", tags: [] },
    { slug: "new", category: "money", date: "2026-09-06", title: "새 글", description: "d2", tags: [], image: { src: "/img/new-01.webp", w: 1200, h: 675 } },
    { slug: "g", category: "game", date: "2026-09-03", title: "게임 글", description: "d3", tags: [] },
  ];
  const { root, env } = setup(posts);
  posts.forEach((p) => writePost(root, p));
  const r = run(env);
  assert.equal(r.code, 0, r.out);
  const home = fs.readFileSync(path.join(root, "archive.html"), "utf8");
  const order = ["/money/new.html", "/game/g.html", "/money/old.html"].map((u) => home.indexOf(u));
  assert.ok(order[0] < order[1] && order[1] < order[2], "이전 글 모음은 최신순");
  assert.match(home, /<img class="thumb" src="\/img\/new-01.webp"/);
  const moneyAll = fs.readFileSync(path.join(root, "money/index.html"), "utf8");
  const money = moneyAll.slice(moneyAll.indexOf("AUTO:LIST:START"), moneyAll.indexOf("AUTO:LIST:END"));
  assert.match(money, /\/money\/new.html/); assert.match(money, /\/money\/old.html/); assert.doesNotMatch(money, /\/game\/g.html/);
  assert.match(fs.readFileSync(path.join(root, "daily/index.html"), "utf8"), /아직 글이 없습니다/);
  // 관련 글: old 글에는 같은 카테고리 new가 먼저, 그 다음 g
  const old = fs.readFileSync(path.join(root, "money/old.html"), "utf8");
  const next = old.slice(old.indexOf("AUTO:NEXT:START"), old.indexOf("AUTO:NEXT:END"));
  assert.ok(next.indexOf("/money/new.html") < next.indexOf("/game/g.html"));
  assert.doesNotMatch(next, /\/money\/old.html/);
  const sm = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.match(sm, /<loc>https:\/\/kkimsae.com\/money\/new.html<\/loc><lastmod>2026-09-06<\/lastmod>/);
  const feed = fs.readFileSync(path.join(root, "feed.xml"), "utf8");
  assert.match(feed, /<title>새 글<\/title>/);
  assert.ok(feed.indexOf("새 글") < feed.indexOf("게임 글"));
  // 기존 분류와 글 사이드바에는 기존 글 수·관련 글을 보존한다.
  for (const f of ["archive.html", "game/index.html", "money/old.html"]) {
    const s = fs.readFileSync(path.join(root, f), "utf8");
    const side = s.slice(s.indexOf("AUTO:SIDE:START"), s.indexOf("AUTO:SIDE:END"));
    assert.match(side, /이전 글 최근 목록/); assert.equal((side.match(/<li><a href="\/(money|game)\/[a-z]+\.html">/g) || []).length, 3, f);
    assert.match(side, /경제·금융 <span class="n">\(2\)<\/span>/); assert.match(side, /게임 <span class="n">\(1\)<\/span>/);
  }
  const sj = JSON.parse(fs.readFileSync(path.join(root, "search.json"), "utf8"));
  assert.equal(sj.length, 3); assert.equal(sj[0].u, "/money/new.html"); assert.equal(sj[0].c, "경제·금융");
  assert.ok(sj.every(p => p.scope === 'archive'));
  const freshHome = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(freshHome, /첫 부동산 글을 준비/);
  assert.doesNotMatch(freshHome, /\/money\/new.html|\/game\/g.html/);
  assert.ok(fs.existsSync(path.join(root, "search.html")));
  // 두 번째 실행은 변화 없음, --check 통과
  assert.match(run(env).out, /갱신된 파일 0개/);
  assert.equal(run(env, ["--check"]).code, 0);
});

test("부동산 글과 이전 글의 홈·관련 목록을 구분하고 본문·메타·날짜는 보존한다", () => {
  const posts = [
    { slug: 'old', category: 'daily', date: '2026-09-06', modified: '2026-09-10', title: '기존 김장 글', description: '보존 설명', tags: ['김장'] },
    { slug: 'prices', category: 'prices', date: '2026-10-12', title: '동네 시세', description: '시세 설명', tags: [] },
    { slug: 'apply', category: 'cheongyak', date: '2026-10-12', title: '청약 질문', description: '분양 설명', tags: [], related: ['old'] },
    { slug: 'rail', category: 'development', date: '2026-10-11', title: '교통 계획', description: '교통 설명', tags: [] },
  ];
  const { root, env } = setup(posts);
  posts.forEach(p => writePost(root, p));
  const oldPath = path.join(root, 'daily/old.html');
  const before = fs.readFileSync(oldPath, 'utf8').replace(/<header class="site">[\s\S]*?<\/header>/, '<header class="site">이전 메뉴</header>');
  fs.writeFileSync(oldPath, before);
  assert.equal(run(env).code, 0);
  const after = fs.readFileSync(oldPath, 'utf8');
  for (const re of [/<head>[\s\S]*?<\/head>/, /<div class="phead">[\s\S]*?<\/div>/, /<div class="body">[\s\S]*?<\/div>/]) {
    assert.equal(after.match(re)[0], before.match(re)[0]);
  }
  assert.match(after, /집을 고르기 전, 알아둘 낌새/);
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /동네 시세/); assert.doesNotMatch(home, /기존 김장 글/);
  for (const n of ['청약,분양', '집값,시세', '재개발,교통']) assert.ok(home.includes(n));
  const archive = fs.readFileSync(path.join(root, 'archive.html'), 'utf8');
  assert.match(archive, /기존 김장 글/); assert.doesNotMatch(archive, /동네 시세/);
  const current = fs.readFileSync(path.join(root, 'cheongyak/apply.html'), 'utf8');
  const next = current.slice(current.indexOf('AUTO:NEXT:START'), current.indexOf('AUTO:NEXT:END'));
  assert.match(next, /동네 시세/); assert.match(next, /교통 계획/); assert.doesNotMatch(next, /기존 김장 글/);
  const sj = JSON.parse(fs.readFileSync(path.join(root, 'search.json'), 'utf8'));
  assert.equal(sj.filter(p => p.scope === 'realestate').length, 3);
  assert.equal(sj.filter(p => p.scope === 'archive').length, 1);
  assert.equal(run(env, ['--check']).code, 0);
});

test("쉼표가 있는 새 분류 3개를 publish --dry가 인식하고 파일은 생성하지 않는다", () => {
  const { root, env } = setup([]);
  const rows = [['청약,분양', 'cheongyak'], ['집값,시세', 'prices'], ['재개발,교통', 'development']];
  const initial = fs.readFileSync(path.join(root, 'tools/posts.json'), 'utf8');
  for (const [name, slug] of rows) {
    const md = path.join(root, 'sample.md');
    fs.writeFileSync(md, `---\ntitle: 테스트 원고\nslug: sample\ncategory: ${name}\ndescription: 분류 경로만 확인하는 격리된 시험 원고입니다. 실제 글을 만들거나 게시하지 않고 기존 등록 자료를 그대로 유지합니다.\n---\n본문`);
    const out = execFileSync(NODE, [path.join(TOOLS, 'publish.js'), md, '--dry', '--date', '2026-10-12'], { env }).toString();
    assert.ok(out.includes(`/${slug}/sample.html`));
    assert.ok(out.includes(name));
    assert.equal(fs.existsSync(path.join(root, slug, 'sample.html')), false);
  }
  assert.equal(fs.readFileSync(path.join(root, 'tools/posts.json'), 'utf8'), initial);
});

test("listBlock: 앞 4편은 사진 카드, 나머지는 번호 없는 제목 목록(data-page-size), 0편이면 빈 안내", () => {
  const { listBlock } = require("../buildlist");
  const posts = Array.from({ length: 6 }, (_, i) => ({ slug: "p" + i, category: "daily", date: "2026-09-0" + (9 - i), title: "글" + i, description: "d" }));
  const h = listBlock(posts, { cardMax: 4, pageSize: 10 });
  assert.equal((h.match(/class="card"/g) || []).length, 4);
  assert.match(h, /<ol class="post-list archive" data-page-size="10">/);
  assert.equal((h.match(/<li>/g) || []).length, 2);
  assert.match(h, /<span class="t">글4<\/span><span class="d">2026\.09\.05<\/span><span class="g">→<\/span>/);
  assert.doesNotMatch(h, /class="n"/);
  const few = listBlock(posts.slice(0, 2), { cardMax: 4, pageSize: 10 });
  assert.equal((few.match(/class="card"/g) || []).length, 2); assert.doesNotMatch(few, /post-list/);
  assert.match(listBlock([], {}), /아직 글이 없습니다/);
});

test("--check: posts.json을 바꾸고 buildlist를 안 돌리면 실패", () => {
  const posts = [{ slug: "a", category: "daily", date: "2026-09-02", title: "A", description: "d", tags: [] }];
  const { root, env } = setup(posts);
  posts.forEach((p) => writePost(root, p));
  assert.equal(run(env).code, 0);
  const b = { slug: "b", category: "daily", date: "2026-09-04", title: "B", description: "d", tags: [] };
  writePost(root, b);
  fs.writeFileSync(path.join(root, "tools", "posts.json"), JSON.stringify({ posts: [...posts, b] }));
  const r = run(env, ["--check"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /갱신 안 된 파일/);
});

test("검증 오류: 파일 없는 글, posts.json에 없는 파일, 잘못된 카테고리", () => {
  const { root, env } = setup([{ slug: "ghost", category: "money", date: "2026-09-01", title: "x", description: "d" }]);
  assert.match(run(env).out, /파일이 없음/);
  fs.writeFileSync(path.join(root, "tools", "posts.json"), JSON.stringify({ posts: [] }));
  fs.writeFileSync(path.join(root, "money", "orphan.html"), "<html></html>");
  assert.match(run(env).out, /posts.json에 없음/);
  fs.unlinkSync(path.join(root, "money", "orphan.html"));
  fs.writeFileSync(path.join(root, "tools", "posts.json"), JSON.stringify({ posts: [{ slug: "z", category: "nope", date: "2026-09-01", title: "x", description: "d" }] }));
  assert.match(run(env).out, /카테고리 슬러그가 잘못됨/);
});
