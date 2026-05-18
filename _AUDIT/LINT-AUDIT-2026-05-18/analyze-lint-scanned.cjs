const fs = require('fs');
const txt = fs.readFileSync('C:/Users/willi/AppData/Local/Temp/lint-report.json', 'utf8');
const i = txt.indexOf('[{');
let j = txt.length;
for (let k = txt.length - 1; k > i; k--) { if (txt[k] === ']') { j = k + 1; break; } }
const data = JSON.parse(txt.slice(i, j));

const ROOT = 'C:\\Users\\willi\\Documents\\Projets\\Axion-IA\\axionia\\';
const scanned = {};
let inNodeModules = 0;
for (const f of data) {
  let rel = f.filePath.startsWith(ROOT) ? f.filePath.slice(ROOT.length) : f.filePath;
  rel = rel.replace(/\\/g, '/');
  if (rel.includes('/node_modules/')) inNodeModules++;
  let top = rel.split('/')[0];
  if (top === '.claude') {
    if (rel.includes('/node_modules/')) top = '.claude/worktrees/**/node_modules/**';
    else if (rel.includes('/prisma/generated/')) top = '.claude/worktrees/**/prisma/generated/**';
    else if (rel.includes('/.next/')) top = '.claude/worktrees/**/.next/**';
    else if (rel.includes('/_AUDIT/')) top = '.claude/worktrees/**/_AUDIT/**';
    else if (rel.includes('/src/components/ui/')) top = '.claude/worktrees/**/src/components/ui/**';
    else top = '.claude/worktrees/** (other)';
  }
  scanned[top] = (scanned[top] || 0) + 1;
}
console.log('TOTAL SCANNED:', data.length);
console.log('SCANNED BUT IN node_modules:', inNodeModules);
console.log('');
console.log('=== FILES SCANNED BY BUCKET ===');
Object.entries(scanned).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v.toString().padStart(6), k));
