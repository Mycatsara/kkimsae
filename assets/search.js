// 기존 q만 있는 검색 주소는 전체 글 검색으로 유지한다.
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var q = (params.get('q') || '').trim();
  var scope = params.get('scope') === 'realestate' ? 'realestate' : 'all';
  var h = document.getElementById('sq'), c = document.getElementById('scount'), box = document.getElementById('sres');
  document.getElementById('search-query').value = q;
  document.getElementById('search-scope').value = scope;
  var sideQuery = document.querySelector('.side input[name=q]');
  if (sideQuery) sideQuery.value = q;
  if (!q) {
    c.textContent = '검색어를 입력하고 부동산 글 또는 전체 글을 선택해 주세요.';
    return;
  }
  h.textContent = '“' + q + '” 검색 결과';
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var fmt = function (d) { var a = d.split('-'); return a[0] + '년 ' + Number(a[1]) + '월 ' + Number(a[2]) + '일'; };
  fetch('/search.json').then(function (r) {
    if (!r.ok) throw new Error('search unavailable');
    return r.json();
  }).then(function (list) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hit = list.filter(function (p) {
      if (scope === 'realestate' && p.scope !== 'realestate') return false;
      var t = (p.t + ' ' + p.d + ' ' + p.g + ' ' + p.c).toLowerCase();
      return words.every(function (w) { return t.indexOf(w) > -1; });
    });
    c.textContent = (scope === 'realestate' ? '부동산 글' : '전체 글') + ' · ' + (hit.length ? hit.length + '편' : '맞는 글이 없습니다. 검색 범위나 검색어를 바꿔 보세요.');
    box.innerHTML = hit.map(function (p) {
      return '<a class="card" href="' + esc(p.u) + '">' + (p.i ? '<img class="thumb" src="' + esc(p.i) + '" alt="" loading="lazy">' : '') + '<h2>' + esc(p.t) + '</h2><p class="meta"><time datetime="' + esc(p.dt) + '">' + fmt(p.dt) + '</time></p><p class="excerpt">' + esc(p.d) + '</p><span class="chip">' + esc(p.c) + '</span></a>';
    }).join('');
  }).catch(function () { c.textContent = '검색 자료를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; });
})();
