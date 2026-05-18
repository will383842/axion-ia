const fs = require('fs');
const txt = fs.readFileSync('C:/Users/willi/AppData/Local/Temp/lint-report.json', 'utf8');
const i = txt.indexOf('[{');
let j = txt.length;
for (let k = txt.length - 1; k > i; k--) { if (txt[k] === ']') { j = k + 1; break; } }
const data = JSON.parse(txt.slice(i, j));

const ROOT = 'C:\\Users\\willi\\Documents\\Projets\\Axion-IA\\axionia\\';

const bucket = {};
const byRulePerBucket = {};
for (const f of data) {
  if (!f.messages.length) continue;
  let rel = f.filePath.startsWith(ROOT) ? f.filePath.slice(ROOT.length) : f.filePath;
  rel = rel.replace(/\\/g, '/');
  const parts = rel.split('/');
  let top = parts[0];
  if (top === '.claude' && parts[1] === 'worktrees') top = '.claude/worktrees/' + (parts[2] || '?').slice(0, 40);
  else if (parts[0] === 'src') top = 'src/' + (parts[1] || '?');
  let e = 0, w = 0;
  for (const m of f.messages) { if (m.severity === 2) e++; else w++; }
  if (!bucket[top]) bucket[top] = { e: 0, w: 0, files: 0 };
  bucket[top].e += e; bucket[top].w += w; bucket[top].files++;
}

console.log('=== ISSUES BY TOP-LEVEL BUCKET (errors / warnings / files) ===');
const sorted = Object.entries(bucket).sort((a, b) => b[1].e - a[1].e);
sorted.slice(0, 40).forEach(([k, v]) => console.log(v.e.toString().padStart(5), '/', v.w.toString().padStart(5), '/', v.files.toString().padStart(4), ' ', k));

console.log('');
console.log('=== SUM BY MEGA-BUCKET ===');
const mega = { '.claude/worktrees/**': { e: 0, w: 0, files: 0 }, 'src/**': { e: 0, w: 0, files: 0 }, 'other': { e: 0, w: 0, files: 0 } };
for (const [k, v] of Object.entries(bucket)) {
  let m = 'other';
  if (k.startsWith('.claude/worktrees/')) m = '.claude/worktrees/**';
  else if (k.startsWith('src/')) m = 'src/**';
  mega[m].e += v.e; mega[m].w += v.w; mega[m].files += v.files;
}
for (const [k, v] of Object.entries(mega)) console.log(v.e.toString().padStart(5), '/', v.w.toString().padStart(5), '/', v.files.toString().padStart(4), ' ', k);

console.log('');
console.log('=== TOP 30 SINGLE FILES BY ERROR COUNT ===');
const allFiles = [];
for (const f of data) {
  if (!f.messages.length) continue;
  let e = 0, w = 0;
  for (const m of f.messages) { if (m.severity === 2) e++; else w++; }
  let rel = f.filePath.startsWith(ROOT) ? f.filePath.slice(ROOT.length) : f.filePath;
  allFiles.push({ rel: rel.replace(/\\/g, '/'), e, w });
}
allFiles.sort((a, b) => b.e - a.e);
allFiles.slice(0, 30).forEach(f => console.log(f.e.toString().padStart(5), '/', f.w.toString().padStart(5), ' ', f.rel));
