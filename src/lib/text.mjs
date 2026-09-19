// Small dependency-free helpers for turning WordPress's HTML fragments into
// plain text for <title>/description tags. Not a full HTML5 entity table -
// just what actually shows up in this dataset (Gutenberg mostly emits
// numeric entities, titles use a handful of named ones).

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  bull: '•', trade: '™', copy: '©', reg: '®',
};

export function decodeEntities(s) {
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

export function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).trim();
}

export function truncate(s, n = 160) {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  return collapsed.length <= n ? collapsed : collapsed.slice(0, n - 1).trimEnd() + '…';
}
