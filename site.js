// 낌새 목록 페이지 스크립트 — 제목 목록(ol.post-list.archive)이 data-page-size를 넘으면 페이지 번호를 만든다.
// 주소에 ?page=N 을 붙여 뒤로 가기·공유가 되게 한다. 점검용: ?psize=3 (한 쪽 편수 임시 변경)
// 규칙 원문: Documents/기록/홈목록화면_적용안내.md (taxtool 9/6 확정)
(function () {
  var ol = document.querySelector("ol.post-list.archive");
  if (!ol) return;
  var params = new URLSearchParams(location.search);
  var size = parseInt(params.get("psize") || ol.getAttribute("data-page-size") || "10", 10);
  var items = Array.prototype.slice.call(ol.children);
  if (!(size > 0) || items.length <= size) return;
  var pages = Math.ceil(items.length / size);
  var cur = Math.min(Math.max(parseInt(params.get("page") || "1", 10) || 1, 1), pages);
  var pager = document.createElement("nav");
  pager.className = "pager";
  pager.setAttribute("aria-label", "페이지");
  ol.parentNode.insertBefore(pager, ol.nextSibling);
  function show(n) {
    cur = n;
    items.forEach(function (li, i) { li.hidden = Math.floor(i / size) !== n - 1; });
    pager.innerHTML = "";
    for (var p = 1; p <= pages; p++) {
      var a = document.createElement("a");
      a.textContent = p;
      var q = new URLSearchParams(location.search); if (p === 1) q.delete("page"); else q.set("page", p);
      var qs = q.toString();
      a.href = location.pathname + (qs ? "?" + qs : "");
      if (p === cur) { a.className = "on"; a.setAttribute("aria-current", "page"); }
      a.addEventListener("click", function (e) { e.preventDefault(); history.pushState(null, "", this.getAttribute("href")); show(parseInt(this.textContent, 10)); ol.scrollIntoView({ block: "start" }); });
      pager.appendChild(a);
    }
  }
  show(cur);
  window.addEventListener("popstate", function () { var n = parseInt(new URLSearchParams(location.search).get("page") || "1", 10) || 1; show(Math.min(Math.max(n, 1), pages)); });
})();
