#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const stats = require('../.next/diagnostics/route-bundle-stats.json');

const sizeCache = new Map();
function gzSize(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  const fp = path.resolve(file.replace(/\\/g, '/'));
  if (!fs.existsSync(fp)) {
    sizeCache.set(file, 0);
    return 0;
  }
  const buf = fs.readFileSync(fp);
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  sizeCache.set(file, gz);
  return gz;
}

const rows = stats.map(r => {
  const totalGz = r.firstLoadChunkPaths.reduce((s, p) => s + gzSize(p), 0);
  return {
    route: r.route,
    rawKB: (r.firstLoadUncompressedJsBytes / 1024).toFixed(1),
    gzKB: (totalGz / 1024).toFixed(1),
    chunks: r.firstLoadChunkPaths.length,
  };
});

rows.sort((a, b) => parseFloat(b.gzKB) - parseFloat(a.gzKB));
console.log('Route'.padEnd(50), 'Raw KB'.padStart(8), 'Gz KB'.padStart(8), 'Chunks');
console.log('-'.repeat(80));
for (const r of rows) {
  console.log(r.route.padEnd(50), r.rawKB.padStart(8), r.gzKB.padStart(8), String(r.chunks).padStart(6));
}

// Stats summary
const gzVals = rows.map(r => parseFloat(r.gzKB));
const avg = gzVals.reduce((s, v) => s + v, 0) / gzVals.length;
console.log('\nMin gz:', Math.min(...gzVals).toFixed(1), 'KB');
console.log('Max gz:', Math.max(...gzVals).toFixed(1), 'KB');
console.log('Avg gz:', avg.toFixed(1), 'KB');
console.log('Routes >75 KB gz (over budget):', gzVals.filter(v => v > 75).length, '/', rows.length);
console.log('Routes >110 KB gz (over /reserver exception):', gzVals.filter(v => v > 110).length);
