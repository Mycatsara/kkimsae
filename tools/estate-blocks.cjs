'use strict';
// Presentation only: explicit labels select a component; article wording is preserved.
function renderEstateBlock(lines, inline) {
  const first = (lines[0] || '').trim();
  const marker = first.match(/^\[!(핵심|팁|주의|질문)\]\s*(.*)$/);
  const label = first.match(/^\*\*(핵심|팁|주의)\*\*\s*[:：]?\s*(.*)$/);
  const match = marker || label;
  if (!match) return null;
  const [kind, title] = [match[1], match[2]];
  const paragraphs = text => text.split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('');
  if (kind === '질문') {
    if (!title || !lines.slice(1).join('').trim()) return null;
    return `<section class="estate-question"><h3 class="estate-question__title"><span class="estate-question__badge" aria-hidden="true">Q</span>${inline(title)}</h3><div class="estate-question__answer">${paragraphs(lines.slice(1).join('\n'))}</div></section>`;
  }
  const body = [title, ...lines.slice(1)].join('\n').trim();
  if (!body) return null;
  const variant = {핵심:'key',팁:'tip',주의:'caution'}[kind];
  return `<aside class="estate-note estate-note--${variant}" aria-label="${kind}"><p class="estate-note__label">${kind}</p><div class="estate-note__body">${paragraphs(body)}</div></aside>`;
}
function wrapEstateArticle(html, site) {
  if (!['noonchii', 'kkimsae'].includes(site)) throw Error('Unknown article design');
  return `<div class="estate-article estate-article--${site}">\n${html}\n</div>`;
}
module.exports = {renderEstateBlock, wrapEstateArticle};
