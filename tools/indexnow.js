// IndexNow — 새 글 주소를 네이버·빙에 알린다. 키 파일은 사이트 루트 /{key}.txt (공개 파일).
// 사용법: node tools/indexnow.js https://kkimsae.com/money/a.html [더 많은 주소...]
// 설정: tools/indexnow.json  { "host": "kkimsae.com", "key": "32자키" }
// 반드시 실사이트가 200을 돌려준 뒤에 보낸다(반영 전에 보내면 엔진이 404를 받고 무시).
// 응답: 200/202 접수 · 400 형식 오류 · 403 키 불일치 · 422 키 파일 위치가 루트가 아니거나 호스트 다름 · 429 너무 자주
const https = require("https");
const fs = require("fs");
const path = require("path");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "indexnow.json"), "utf8"));

function post(body) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify(body));
    const r = https.request("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": data.length, "User-Agent": "kkimsae-publish/1.0" }, timeout: 30000 }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, body: b.slice(0, 300) }));
    });
    r.on("error", (e) => resolve({ status: "ERR", body: e.message })); r.on("timeout", () => { r.destroy(); resolve({ status: "ERR", body: "timeout" }); });
    r.write(data); r.end();
  });
}
async function notify(urls) {
  const list = urls.filter((u) => { try { return new URL(u).host === cfg.host; } catch { return false; } });
  if (!list.length) return { status: "SKIP", body: "이 사이트 주소가 아님" };
  return post({ host: cfg.host, key: cfg.key, keyLocation: `https://${cfg.host}/${cfg.key}.txt`, urlList: list });
}
if (require.main === module) (async () => {
  const urls = process.argv.slice(2);
  if (!urls.length) { console.log("사용법: node tools/indexnow.js <url> [url...]"); process.exit(1); }
  const r = await notify(urls);
  const ok = r.status === 200 || r.status === 202;
  console.log("IndexNow(네이버·빙):", r.status, ok ? `OK — ${urls.length}건` : r.body);
  process.exit(ok ? 0 : 1);
})();
module.exports = { notify };
