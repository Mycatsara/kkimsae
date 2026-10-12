const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../../assets/search.js'), 'utf8');
const posts = [
  { t: '부동산 청약', d: '공통 질문', g: '', c: '청약,분양', u: '/cheongyak/a.html', dt: '2026-10-12', scope: 'realestate' },
  { t: '이전 질문', d: '공통 질문', g: '', c: '일상', u: '/daily/old.html', dt: '2026-09-01', scope: 'archive' },
];
async function search(query, fail = false) {
  const nodes = Object.fromEntries(['sq', 'scount', 'sres', 'search-query', 'search-scope'].map(id => [id, { value: '', textContent: '', innerHTML: '' }]));
  vm.runInNewContext(code, {
    URLSearchParams, location: { search: query },
    document: { getElementById: id => nodes[id], querySelector: () => null },
    fetch: async () => ({ ok: !fail, json: async () => posts }),
  });
  await new Promise(resolve => setImmediate(resolve));
  return nodes;
}
test('검색 범위를 바꾸면 부동산 1편과 이전 글 포함 2편을 각각 찾는다', async () => {
  const current = await search('?q=공통&scope=realestate');
  assert.match(current.sres.innerHTML, /cheongyak\/a.html/);
  assert.doesNotMatch(current.sres.innerHTML, /daily\/old.html/);
  assert.equal(current['search-scope'].value, 'realestate');
  const oldUrl = await search('?q=공통');
  assert.match(oldUrl.sres.innerHTML, /cheongyak\/a.html/);
  assert.match(oldUrl.sres.innerHTML, /daily\/old.html/);
  assert.equal(oldUrl['search-scope'].value, 'all');
});
test('검색 자료 실패를 글 0편으로 표시하지 않고 오류로 설명한다', async () => {
  const result = await search('?q=공통&scope=all', true);
  assert.match(result.scount.textContent, /검색 자료를 불러오지 못했습니다/);
  assert.equal(result.sres.innerHTML, '');
});
