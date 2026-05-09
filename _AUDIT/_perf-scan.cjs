#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const sigs = [
  '@sentry', 'sentry-replay', 'react-dom', 'next-intl', 'framer-motion', 'motion',
  '@radix-ui', 'lucide-react', 'react/jsx', 'web-vitals', '@tiptap', 'tiptap',
  '@tanstack', 'tanstack', 'zod', 'zustand', 'react-hook-form', '@react-email',
  'turbopack-runtime', 'plausible', 'react-server-dom', 'scheduler',
];

function scan(file) {
  const c = fs.readFileSync(file, 'utf8');
  console.log('\n=== ' + path.basename(file) + ' (' + (c.length/1024).toFixed(1) + ' KB chars) ===');
  for (const s of sigs) {
    const idx = c.indexOf(s);
    if (idx === -1) continue;
    let count = 0;
    let pos = 0;
    while ((pos = c.indexOf(s, pos)) !== -1) {
      count++;
      pos += s.length;
    }
    console.log('  ' + s.padEnd(28) + ' ' + count + ' hits  (first @ ' + idx + ')');
  }
}

const targets = process.argv.slice(2);
for (const t of targets) {
  scan(t);
}
