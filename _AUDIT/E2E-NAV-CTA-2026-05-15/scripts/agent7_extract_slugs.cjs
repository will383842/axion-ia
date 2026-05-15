const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function extractSlugs(htmlPath, hrefPattern) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const anchors = doc.querySelectorAll('a[href]');
  const slugs = new Set();
  anchors.forEach(a => {
    const href = a.getAttribute('href');
    const m = href.match(hrefPattern);
    if (m) slugs.add(m[1]);
  });
  return Array.from(slugs);
}

const tmpRoot = process.argv[2] || '/tmp';

console.log('--- /fr/actualites ---');
console.log(extractSlugs(path.join(tmpRoot, 'actualites.html'), /^\/fr\/actualites\/([a-z0-9-]+)$/).join('\n'));
console.log('\n--- /fr/cas-concrets ---');
console.log(extractSlugs(path.join(tmpRoot, 'cas-concrets.html'), /^\/fr\/cas-concrets\/([a-z0-9-]+)$/).join('\n'));
console.log('\n--- /fr/faq ---');
console.log(extractSlugs(path.join(tmpRoot, 'faq.html'), /^\/fr\/faq\/([a-z0-9-]+)$/).join('\n'));
console.log('\n--- /fr/connaissances ---');
console.log(extractSlugs(path.join(tmpRoot, 'connaissances.html'), /^\/fr\/connaissances\/([a-z0-9-]+)$/).join('\n'));
