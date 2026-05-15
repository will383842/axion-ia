/**
 * AGENT 7 — In-content links audit (E2E NAV CTA Perfection 2026-05-15)
 *
 * Pour chaque page de l'échantillon :
 *   - Fetch HTML production (UA browser)
 *   - Si HTTP != 200 → marqué comme "fetch_failed" (compté gate rouge)
 *   - Extrait <a> de <main> ou <article>, hors header/footer/nav
 *   - Calcule métriques (densité, anti-patterns anchors, noopener, anchors brisées, etc.)
 *
 * Output :
 *   - agent7-incontent-links.tsv (1 ligne par page)
 *   - agent7-anchor-quality.md (top anti-patterns, exemples)
 *   - agent7-broken-anchors.md (anchors #section qui ne résolvent pas)
 *   - agent7-summary.json (score + métriques agrégées)
 *
 * AUDIT-ONLY : aucun side-effect au-delà de l'écriture des livrables.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { JSDOM, VirtualConsole } = require('jsdom');

function silentConsole() {
  const vc = new VirtualConsole();
  // Swallow all jsdom warnings (script errors, CSP, fetch fails)
  vc.on('jsdomError', () => {});
  vc.on('error', () => {});
  vc.on('warn', () => {});
  vc.on('info', () => {});
  vc.on('dir', () => {});
  return vc;
}

const OUT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(OUT_DIR, 'data');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Cible 30 pages échantillon stratifié — voir prompt Agent 7
const SAMPLE = [
  // Articles factory — pas de /fr/actualites/{slug} en prod (DB vide).
  // Fallback documenté : 3 articles présents sur /fr/blog/{slug}.
  { url: 'https://axion-ia.com/fr/blog/3-quick-wins-2026', type: 'article', note: 'blog fallback' },
  { url: 'https://axion-ia.com/fr/blog/ia-custom-quand-vraiment', type: 'article', note: 'blog fallback' },
  { url: 'https://axion-ia.com/fr/blog/pourquoi-auditer-avant-implementer', type: 'article', note: 'blog fallback' },
  // 5 emplacements articles factory cibles non disponibles en prod → tracés explicit :
  { url: 'https://axion-ia.com/fr/actualites', type: 'article-listing', note: 'listing — pas de slugs visibles' },
  { url: 'https://axion-ia.com/fr/blog', type: 'article-listing', note: 'listing FR' },

  // 5 cas-concrets
  { url: 'https://axion-ia.com/fr/cas-concrets/industrie-comptabilite', type: 'case-study' },
  { url: 'https://axion-ia.com/fr/cas-concrets/cabinet-juridique-comptes-rendus', type: 'case-study' },
  { url: 'https://axion-ia.com/fr/cas-concrets/retail-tickets-sav', type: 'case-study' },
  { url: 'https://axion-ia.com/fr/cas-concrets/banque-onboarding', type: 'case-study' },
  { url: 'https://axion-ia.com/fr/cas-concrets/tpe-artisan-prospection', type: 'case-study' },

  // 5 FAQ
  { url: 'https://axion-ia.com/fr/faq/definition', type: 'faq' },
  { url: 'https://axion-ia.com/fr/faq/modules', type: 'faq' },
  { url: 'https://axion-ia.com/fr/faq/data-security', type: 'faq' },
  { url: 'https://axion-ia.com/fr/faq/tools', type: 'faq' },
  { url: 'https://axion-ia.com/fr/faq/billing', type: 'faq' },

  // 5 KB V4 — route publique /fr/connaissances/[slug] NON IMPLÉMENTÉE en code.
  // Documenté comme finding structurel ; on tente quand même pour confirmer.
  { url: 'https://axion-ia.com/fr/connaissances/definition', type: 'kb', note: 'route publique non implémentée' },
  { url: 'https://axion-ia.com/fr/connaissances/modules', type: 'kb', note: 'route publique non implémentée' },
  { url: 'https://axion-ia.com/fr/connaissances/data-security', type: 'kb', note: 'route publique non implémentée' },
  { url: 'https://axion-ia.com/fr/connaissances/tools', type: 'kb', note: 'route publique non implémentée' },
  { url: 'https://axion-ia.com/fr/connaissances/billing', type: 'kb', note: 'route publique non implémentée' },

  // 5 pSEO villes
  { url: 'https://axion-ia.com/fr/implantations/ile-de-france/paris', type: 'pseo-city' },
  { url: 'https://axion-ia.com/fr/implantations/auvergne-rhone-alpes/lyon', type: 'pseo-city' },
  { url: 'https://axion-ia.com/fr/audit/par-ville/marseille', type: 'pseo-city' },
  { url: 'https://axion-ia.com/fr/interventions/par-ville/toulouse', type: 'pseo-city' },
  { url: 'https://axion-ia.com/fr/implementation/par-ville/bordeaux', type: 'pseo-city' },

  // 2 guides
  { url: 'https://axion-ia.com/fr/guide-ia', type: 'guide' },
  { url: 'https://axion-ia.com/fr/stack-ia', type: 'guide' },
];

const CLICK_HERE_PATTERNS = [
  /^cliquez\s*ici$/i,
  /^cliquer\s*ici$/i,
  /^ici$/i,
  /^voir\s*plus$/i,
  /^en\s*savoir\s*plus$/i, // <- toléré si descriptif ailleurs, mais isolé = mauvais
  /^ce\s*lien$/i,
  /^this\s*link$/i,
  /^click\s*here$/i,
  /^here$/i,
  /^read\s*more$/i,
  /^learn\s*more$/i,
  /^more$/i,
];
// Variante softer pour la table (limite la sévérité)
const STRICT_CLICK_HERE = [
  /^cliquez\s*ici$/i,
  /^cliquer\s*ici$/i,
  /^ici$/i,
  /^voir\s*plus$/i,
  /^ce\s*lien$/i,
  /^this\s*link$/i,
  /^click\s*here$/i,
  /^here$/i,
];

// Concurrents à signaler si liens externes pointent dessus
const COMPETITOR_HOSTS = [
  'mckinsey.com', 'bcg.com', 'deloitte.com', 'accenture.com', 'kpmg.com',
  'pwc.com', 'ey.com', 'capgemini.com', 'wavestone.com', 'eleven-strategy.com',
];

// Hosts internes considérés comme première-partie (non externes)
const INTERNAL_HOSTS = [
  'axion-ia.com', 'www.axion-ia.com',
];

// Tier-1 services (in-content target). Vise au moins 1 lien vers ces destinations
// dans les articles / FAQ / case studies / KB.
const TIER1_PATHS = [
  '/audit',
  '/interventions',
  '/implementation',
  '/reserver',
  '/contact',
];

function fetchUrl(urlStr, redirectsLeft = 5) {
  return new Promise((resolve) => {
    const u = new URL(urlStr);
    const req = https.request({
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      timeout: 25000,
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const next = new URL(res.headers.location, urlStr).toString();
        res.resume();
        resolve(fetchUrl(next, redirectsLeft - 1));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body, headers: res.headers, finalUrl: urlStr });
      });
    });
    req.on('error', (err) => resolve({ status: 0, body: '', error: err.message, finalUrl: urlStr }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', error: 'timeout', finalUrl: urlStr }); });
    req.end();
  });
}

function headUrl(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      // Force HTTPS for internal checks
      const req = https.request({
        method: 'HEAD',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { 'User-Agent': UA },
        timeout: 15000,
      }, (res) => {
        resolve({ status: res.statusCode, headers: res.headers });
        res.resume();
      });
      req.on('error', (err) => resolve({ status: 0, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
      req.end();
    } catch (e) {
      resolve({ status: 0, error: e.message });
    }
  });
}

function isInternalHref(href, pageUrl) {
  if (href.startsWith('/')) return true;
  if (href.startsWith('#')) return false; // anchor only
  if (/^(mailto|tel|javascript):/i.test(href)) return false;
  try {
    const u = new URL(href, pageUrl);
    return INTERNAL_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function isExternalHref(href, pageUrl) {
  if (href.startsWith('/')) return false;
  if (href.startsWith('#')) return false;
  if (/^(mailto|tel|javascript):/i.test(href)) return false;
  try {
    const u = new URL(href, pageUrl);
    return !INTERNAL_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function pointsToTier1(href, pageUrl) {
  let pathname;
  try {
    const u = new URL(href, pageUrl);
    if (!INTERNAL_HOSTS.includes(u.hostname)) {
      // Relative href; only pathname
      if (!href.startsWith('/')) return false;
      pathname = href.split('?')[0].split('#')[0];
    } else {
      pathname = u.pathname;
    }
  } catch {
    if (href.startsWith('/')) pathname = href.split('?')[0].split('#')[0];
    else return false;
  }
  const stripped = pathname.replace(/^\/(fr|en)(?=\/|$)/, '');
  return TIER1_PATHS.some(t => stripped === t || stripped.startsWith(t + '/'));
}

function isCompetitorHref(href, pageUrl) {
  try {
    const u = new URL(href, pageUrl);
    if (INTERNAL_HOSTS.includes(u.hostname)) return false;
    return COMPETITOR_HOSTS.some(host => u.hostname === host || u.hostname.endsWith('.' + host));
  } catch { return false; }
}

function normalizeText(s) {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

function detectClickHere(text) {
  const t = normalizeText(text);
  if (!t) return 'empty';
  if (STRICT_CLICK_HERE.some(re => re.test(t))) return 'strict-click-here';
  if (CLICK_HERE_PATTERNS.some(re => re.test(t))) return 'weak-anchor';
  if (t.length === 1) return 'too-short';
  if (/^\s*(>|→|→|»)\s*$/.test(t)) return 'only-arrow';
  return null;
}

async function extractInContentLinks(html, pageUrl) {
  // Next.js 16 streaming RSC : le contenu réel est injecté via <template id="B:N">
  // puis $RC(...) scripts. Sans `runScripts: 'dangerously'`, <main> reste squelette.
  let dom;
  try {
    dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: pageUrl, virtualConsole: silentConsole() });
  } catch (e) {
    // fallback sans scripts si erreur
    dom = new JSDOM(html, { url: pageUrl, virtualConsole: silentConsole() });
  }
  // Tick microtâches React streaming
  await new Promise(r => setTimeout(r, 350));

  const doc = dom.window.document;
  let root = doc.querySelector('main') || doc.querySelector('article') || doc.body;
  if (!root) return { links: [], pageIds: [], rootKind: 'none', hasMain: false, hasArticle: false };
  let rootKind = root.tagName.toLowerCase();

  const clone = root.cloneNode(true);
  clone.querySelectorAll('header, footer, nav').forEach(n => n.remove());

  const anchors = Array.from(clone.querySelectorAll('a[href]'));
  const links = anchors.map(a => ({
    href: a.getAttribute('href') || '',
    text: normalizeText(a.textContent || ''),
    ariaLabel: a.getAttribute('aria-label') || '',
    title: a.getAttribute('title') || '',
    rel: a.getAttribute('rel') || '',
    target: a.getAttribute('target') || '',
    isImage: !!a.querySelector('img, svg'),
  }));

  const pageIds = Array.from(doc.querySelectorAll('[id]')).map(n => n.id).filter(Boolean);

  try { dom.window.close(); } catch {}

  return { links, pageIds, rootKind, hasMain: !!doc.querySelector('main'), hasArticle: !!doc.querySelector('article'), mainInnerLen: root.innerHTML.length };
}

async function auditPage(entry) {
  const res = await fetchUrl(entry.url);
  const out = {
    url: entry.url,
    type: entry.type,
    note: entry.note || '',
    status: res.status,
    fetchError: res.error || '',
    rootKind: '',
    hasMain: false,
    hasArticle: false,
    internalCount: 0,
    externalCount: 0,
    toServiceCount: 0,
    toTier1Hrefs: [],
    clickHereCount: 0,
    clickHereExamples: [],
    weakAnchorCount: 0,
    weakAnchorExamples: [],
    emptyAnchorCount: 0,
    noopenerMissingCount: 0,
    noopenerMissingExamples: [],
    competitorLinks: [],
    brokenAnchors: [],
    duplicatedHrefs: [],
    topRepeatedAnchorText: [],
    densityPer1000Chars: 0,
    gateRouge: [],
    gateOrange: [],
    anchorTexts: [],
  };

  if (res.status !== 200 || !res.body) {
    out.gateRouge.push(`fetch-failed:${res.status}`);
    return out;
  }

  const { links, pageIds, rootKind, hasMain, hasArticle, mainInnerLen } = await extractInContentLinks(res.body, entry.url);
  out.rootKind = rootKind;
  out.hasMain = hasMain;
  out.hasArticle = hasArticle;

  // Texte principal : ré-extraire avec scripts pour densité réelle
  let textLen = 0;
  try {
    const dom2 = new JSDOM(res.body, { runScripts: 'dangerously', pretendToBeVisual: true, url: entry.url, virtualConsole: silentConsole() });
    await new Promise(r => setTimeout(r, 350));
    const root = dom2.window.document.querySelector('main') || dom2.window.document.querySelector('article') || dom2.window.document.body;
    textLen = (root.textContent || '').replace(/\s+/g, ' ').trim().length;
    try { dom2.window.close(); } catch {}
  } catch {}
  if (textLen > 0) {
    out.densityPer1000Chars = Math.round((links.length / textLen) * 1000 * 100) / 100;
  }

  const hrefCounts = new Map();
  const anchorTextCounts = new Map();

  for (const link of links) {
    const href = link.href;
    // count for dup
    hrefCounts.set(href, (hrefCounts.get(href) || 0) + 1);

    const anchorText = link.text || link.ariaLabel || (link.isImage ? '<image>' : '');
    if (anchorText) {
      anchorTextCounts.set(anchorText, (anchorTextCounts.get(anchorText) || 0) + 1);
    }
    if (anchorText && anchorText !== '<image>') {
      out.anchorTexts.push(anchorText);
    }

    // empty anchor
    if (!link.text && !link.ariaLabel && !link.title && !link.isImage) {
      out.emptyAnchorCount++;
    }

    // click here detection (only on actual text, ignore pure image anchors)
    if (link.text && !link.isImage) {
      const verdict = detectClickHere(link.text);
      if (verdict === 'strict-click-here') {
        out.clickHereCount++;
        if (out.clickHereExamples.length < 5) {
          out.clickHereExamples.push({ text: link.text, href });
        }
      } else if (verdict === 'weak-anchor' || verdict === 'too-short' || verdict === 'only-arrow') {
        out.weakAnchorCount++;
        if (out.weakAnchorExamples.length < 5) {
          out.weakAnchorExamples.push({ text: link.text, href, verdict });
        }
      }
    }

    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (id && !pageIds.includes(id)) {
        out.brokenAnchors.push({ href, anchor: anchorText });
      }
      continue;
    }
    if (/^(mailto|tel|javascript):/i.test(href)) continue;

    if (isInternalHref(href, entry.url)) {
      out.internalCount++;
      if (pointsToTier1(href, entry.url)) {
        out.toServiceCount++;
        if (out.toTier1Hrefs.length < 8) out.toTier1Hrefs.push(href);
      }
    } else if (isExternalHref(href, entry.url)) {
      out.externalCount++;
      const rel = (link.rel || '').toLowerCase();
      const target = (link.target || '').toLowerCase();
      // Best practice : si target="_blank", rel doit contenir noopener (noreferrer recommandé)
      // Audit strict : tout lien externe doit avoir noopener (Lighthouse SEO).
      const hasNoopener = /\bnoopener\b/.test(rel);
      const hasNoreferrer = /\bnoreferrer\b/.test(rel);
      if (!hasNoopener) {
        out.noopenerMissingCount++;
        if (out.noopenerMissingExamples.length < 5) {
          out.noopenerMissingExamples.push({ href, rel, target, anchor: anchorText });
        }
      }
      if (target === '_blank' && (!hasNoopener || !hasNoreferrer)) {
        // déjà compté, juste noter
      }
      if (isCompetitorHref(href, entry.url)) {
        out.competitorLinks.push({ href, anchor: anchorText });
      }
    }
  }

  // Repeated anchor text
  const sortedTexts = Array.from(anchorTextCounts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);
  out.topRepeatedAnchorText = sortedTexts.slice(0, 5).map(([t, c]) => ({ text: t, count: c }));

  // Duplicates href >=3 (sauf TOC) — sans contexte TOC, on flagge brut
  for (const [href, count] of hrefCounts) {
    if (count >= 3 && !href.startsWith('#')) {
      out.duplicatedHrefs.push({ href, count });
    }
  }

  // Gates
  const isContentType = ['article', 'case-study', 'faq', 'kb'].includes(entry.type);
  if (isContentType && out.toServiceCount === 0 && links.length > 0) {
    out.gateRouge.push('zero-link-to-tier1-service');
  }
  if (out.clickHereCount > 0) {
    out.gateRouge.push('click-here-found');
  }
  if (out.noopenerMissingCount > 0) {
    out.gateRouge.push('external-without-noopener');
  }
  if (out.brokenAnchors.length > 0) {
    out.gateRouge.push('broken-anchor-id');
  }
  if (links.length > 0) {
    const topRepeat = sortedTexts[0];
    if (topRepeat && topRepeat[1] / links.length > 0.3) {
      out.gateOrange.push(`identical-anchor-text-${Math.round(topRepeat[1] / links.length * 100)}pct`);
    }
  }
  if (out.competitorLinks.length > 0) {
    out.gateOrange.push('competitor-external-link');
  }

  return out;
}

async function main() {
  const argFilter = process.argv[2] || '';
  const targets = argFilter
    ? SAMPLE.filter(s => s.url.includes(argFilter))
    : SAMPLE;
  const results = [];
  console.log(`Auditing ${targets.length} pages...`);
  let i = 0;
  for (const t of targets) {
    i++;
    process.stdout.write(`[${i}/${targets.length}] ${t.url}\n`);
    const r = await auditPage(t);
    results.push(r);
    // Sauvegarde incrémentale (utile si arrêt en cours)
    fs.writeFileSync(
      path.join(OUT_DIR, 'data', 'agent7-raw.json'),
      JSON.stringify(results, null, 2)
    );
    // petit délai pour ne pas saturer CF
    await new Promise(r => setTimeout(r, 800));
  }

  // ---- TSV
  const tsvHeader = [
    'page', 'type', 'http_status', 'root_kind',
    'internal_count', 'external_count', 'to_service_count',
    'has_clickHere', 'weak_anchor_count', 'empty_anchor_count',
    'noopener_missing_count', 'broken_anchors_count',
    'duplicated_hrefs_count', 'repeated_anchor_top_pct',
    'density_per_1000_chars',
    'gate_rouge', 'gate_orange',
  ].join('\t');
  const tsvLines = [tsvHeader];
  for (const r of results) {
    const total = r.internalCount + r.externalCount;
    const topRepeat = r.topRepeatedAnchorText[0];
    const pct = total > 0 && topRepeat ? Math.round(topRepeat.count / total * 100) : 0;
    tsvLines.push([
      r.url,
      r.type,
      r.status,
      r.rootKind,
      r.internalCount,
      r.externalCount,
      r.toServiceCount,
      r.clickHereCount > 0 ? 'YES' : 'no',
      r.weakAnchorCount,
      r.emptyAnchorCount,
      r.noopenerMissingCount,
      r.brokenAnchors.length,
      r.duplicatedHrefs.length,
      pct,
      r.densityPer1000Chars,
      r.gateRouge.join(';'),
      r.gateOrange.join(';'),
    ].join('\t'));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'agent7-incontent-links.tsv'), tsvLines.join('\n') + '\n');

  // ---- Broken anchors MD
  const brokenLines = [
    '# Agent 7 — Broken in-content #anchors',
    '',
    'Anchors `#section` qui ne correspondent à aucun `[id]` rendu côté serveur dans la page.',
    'Critère : héritage P0 (rouge) si > 0.',
    '',
  ];
  let totalBroken = 0;
  for (const r of results) {
    if (!r.brokenAnchors || r.brokenAnchors.length === 0) continue;
    brokenLines.push(`## ${r.url}`);
    for (const b of r.brokenAnchors) {
      brokenLines.push(`- \`${b.href}\` — anchor text: « ${b.anchor || '<empty>'} »`);
      totalBroken++;
    }
    brokenLines.push('');
  }
  if (totalBroken === 0) {
    brokenLines.push('_Aucun anchor cassé détecté sur l\'échantillon._');
  } else {
    brokenLines.unshift(`> **Total anchors brisés** : ${totalBroken}`);
    brokenLines.unshift('');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'agent7-broken-anchors.md'), brokenLines.join('\n') + '\n');

  // ---- Anchor quality MD
  const qualityLines = [
    '# Agent 7 — Anchor text quality',
    '',
    'Anti-patterns détectés sur les liens in-content (`<main>`/`<article>`, hors header/footer/nav).',
    '',
    '## Légende',
    '- `strict-click-here` : « cliquez ici », « ici », « voir plus », « click here » (gate rouge)',
    '- `weak-anchor` : « en savoir plus », « read more », « more » (orange — toléré occasionnellement)',
    '- `too-short` : 1 caractère',
    '- `only-arrow` : juste « → » ou « » »',
    '- `empty` : texte vide et aucun aria-label',
    '',
  ];

  let totalClick = 0;
  let totalWeak = 0;
  let totalEmpty = 0;
  for (const r of results) {
    if (r.clickHereCount > 0 || r.weakAnchorCount > 0 || r.emptyAnchorCount > 0) {
      qualityLines.push(`## ${r.url}`);
      if (r.clickHereCount > 0) {
        qualityLines.push(`- **strict-click-here** : ${r.clickHereCount}`);
        for (const ex of r.clickHereExamples) {
          qualityLines.push(`  - « ${ex.text} » → \`${ex.href}\``);
        }
      }
      if (r.weakAnchorCount > 0) {
        qualityLines.push(`- **weak/short** : ${r.weakAnchorCount}`);
        for (const ex of r.weakAnchorExamples) {
          qualityLines.push(`  - [${ex.verdict}] « ${ex.text} » → \`${ex.href}\``);
        }
      }
      if (r.emptyAnchorCount > 0) {
        qualityLines.push(`- **empty anchor (no text, no aria-label)** : ${r.emptyAnchorCount}`);
      }
      if (r.topRepeatedAnchorText.length > 0) {
        qualityLines.push(`- **repeated anchor text top 5** :`);
        for (const t of r.topRepeatedAnchorText) {
          qualityLines.push(`  - « ${t.text} » × ${t.count}`);
        }
      }
      qualityLines.push('');
    }
    totalClick += r.clickHereCount;
    totalWeak += r.weakAnchorCount;
    totalEmpty += r.emptyAnchorCount;
  }

  qualityLines.splice(2, 0,
    `**Totaux échantillon** : strict-click-here=${totalClick} | weak=${totalWeak} | empty=${totalEmpty}`,
    ''
  );

  // Recommandations standards
  qualityLines.push('---');
  qualityLines.push('## Recommandations SEO/AEO');
  qualityLines.push('- Remplacer `cliquez ici` par anchor descriptif (mots-clés cible + verbe).');
  qualityLines.push('- Varier les anchors vers la même cible (3-4 formulations).');
  qualityLines.push('- Anchor vide (icône seule) → ajouter `aria-label` descriptif.');
  qualityLines.push('- « En savoir plus » accepté si la cible est claire dans le contexte adjacent (ex : card avec titre).');
  fs.writeFileSync(path.join(OUT_DIR, 'agent7-anchor-quality.md'), qualityLines.join('\n') + '\n');

  // ---- Summary JSON
  const summary = {
    audited: results.length,
    pages_ok: results.filter(r => r.status === 200).length,
    pages_failed: results.filter(r => r.status !== 200).map(r => ({ url: r.url, status: r.status, type: r.type, note: r.note })),
    gate_rouge_counts: {
      'fetch-failed': results.filter(r => r.gateRouge.some(g => g.startsWith('fetch-failed'))).length,
      'zero-link-to-tier1-service': results.filter(r => r.gateRouge.includes('zero-link-to-tier1-service')).length,
      'click-here-found': results.filter(r => r.gateRouge.includes('click-here-found')).length,
      'external-without-noopener': results.filter(r => r.gateRouge.includes('external-without-noopener')).length,
      'broken-anchor-id': results.filter(r => r.gateRouge.includes('broken-anchor-id')).length,
    },
    gate_orange_counts: {
      'identical-anchor-text-30pct+': results.filter(r => r.gateOrange.some(g => g.startsWith('identical-anchor-text'))).length,
      'competitor-external-link': results.filter(r => r.gateOrange.includes('competitor-external-link')).length,
    },
    totals: {
      total_internal_links: results.reduce((s, r) => s + r.internalCount, 0),
      total_external_links: results.reduce((s, r) => s + r.externalCount, 0),
      total_tier1_targets: results.reduce((s, r) => s + r.toServiceCount, 0),
      total_click_here: results.reduce((s, r) => s + r.clickHereCount, 0),
      total_weak: results.reduce((s, r) => s + r.weakAnchorCount, 0),
      total_noopener_missing: results.reduce((s, r) => s + r.noopenerMissingCount, 0),
      total_broken_anchors: results.reduce((s, r) => s + r.brokenAnchors.length, 0),
      total_competitor_links: results.reduce((s, r) => s + r.competitorLinks.length, 0),
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'agent7-summary.json'), JSON.stringify(summary, null, 2));

  console.log('--- DONE ---');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error('FATAL', err);
  process.exit(1);
});
