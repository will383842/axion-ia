#!/usr/bin/env node
// Try to identify what packages are inside a chunk by scanning for module path hints
// Next 16 / Turbopack tends to embed [project]/node_modules/<pkg>/... in __turbopack_module_id__ comments
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('usage: node _perf-chunk-inspect.cjs <chunk>'); process.exit(1); }
const c = fs.readFileSync(file, 'utf8');
console.log('File:', file);
console.log('Size:', (c.length/1024).toFixed(1), 'KB');

// Strategy 1: scan for module path hints commonly found in turbopack output
const hints = [
  /\[project\]\/node_modules\/(@?[^/\s\\\"\\'`,\)]+(?:\/[^/\s\\\"\\'`,\)]+)?)/g,
  /node_modules\/(@?[a-z0-9_\-\.@]+\/[a-z0-9_\-\.@]+)\//g,
  /from "([^"]+)"/g,
  /require\("([^"]+)"\)/g,
];

const counts = {};
for (const re of hints) {
  let m;
  while ((m = re.exec(c)) !== null) {
    const k = m[1];
    if (!k) continue;
    if (k.startsWith('.') || k.startsWith('/')) continue;
    counts[k] = (counts[k] || 0) + 1;
  }
}

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('\nTop 40 module hints:');
for (const [k, v] of sorted) {
  console.log('  ' + String(v).padStart(5) + '  ' + k);
}

// Bonus: scan for big embedded strings (heuristic: react-server-dom etc)
const knownMarkers = [
  'react.element', 'react.fragment', 'react_devtools_global_hook',
  'flushSync', 'useFormState', 'useFormStatus', 'createServerReference',
  'Sentry.', 'sentryWrapped', '_sentryDebugIds',
  '__next_intl_', 'i18n.config', 'next-intl',
  'Turnstile', 'cf-turnstile',
  'plausible', '_plausible',
  'web-vitals', 'CLS', 'LCP', 'FID', 'INP',
  '__turbopack_', 'turbopack-runtime',
  'ReactCurrentDispatcher',
  '_createMdxContent', 'recmaPlugins',
];

console.log('\nMarker hits:');
for (const k of knownMarkers) {
  let pos = 0, n = 0;
  while ((pos = c.indexOf(k, pos)) !== -1) { n++; pos += k.length; }
  if (n > 0) console.log('  ' + String(n).padStart(5) + '  ' + k);
}
