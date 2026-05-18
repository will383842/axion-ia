const fs = require('fs');
const txt = fs.readFileSync('C:/Users/willi/AppData/Local/Temp/lint-report.json', 'utf8');
const i = txt.indexOf('[{');
let j = txt.length;
for (let k = txt.length - 1; k > i; k--) { if (txt[k] === ']') { j = k + 1; break; } }
const data = JSON.parse(txt.slice(i, j));

const ROOT = 'C:\\Users\\willi\\Documents\\Projets\\Axion-IA\\axionia\\';
const byRulePerLoc = {};
for (const f of data) {
  if (!f.messages.length) continue;
  let rel = f.filePath.startsWith(ROOT) ? f.filePath.slice(ROOT.length) : f.filePath;
  rel = rel.replace(/\\/g, '/');
  let loc = 'src-or-other';
  if (rel.includes('.claude/worktrees/')) {
    if (rel.includes('/prisma/generated/')) loc = 'wt/prisma/generated';
    else if (rel.includes('/src/components/ui/')) loc = 'wt/src/components/ui';
    else if (rel.includes('/_AUDIT/')) loc = 'wt/_AUDIT';
    else loc = 'wt/other';
  }
  for (const m of f.messages) {
    if (m.severity !== 2) continue;
    const key = loc + ' | ' + (m.ruleId || 'parse');
    byRulePerLoc[key] = (byRulePerLoc[key] || 0) + 1;
  }
}
Object.entries(byRulePerLoc).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v.toString().padStart(5), k));
