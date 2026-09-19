// Small dependency-free helpers for turning WordPress's HTML fragments into
// plain text for <title>/description tags, and back into safe HTML output.
// Not a full HTML5 entity table - just what actually shows up in this
// dataset (Gutenberg mostly emits numeric entities, titles use a handful of
// named ones).
'use strict';

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  bull: '•', trade: '™', copy: '©', reg: '®',
};

function decodeEntities(s) {
  return String(s || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : m;
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).trim();
}

function truncate(s, n = 160) {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  return collapsed.length <= n ? collapsed : collapsed.slice(0, n - 1).trimEnd() + '…';
}

module.exports = { decodeEntities, escapeHtml, stripTags, truncate };
