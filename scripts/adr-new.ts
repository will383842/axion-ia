// Quickly scaffold a new ADR file under docs/adr/NNNN-slug.md.
import fs from "node:fs";
import path from "node:path";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: pnpm adr:new <kebab-case-slug>");
  process.exit(1);
}

const dir = path.resolve("docs/adr");
fs.mkdirSync(dir, { recursive: true });

const existing = fs
  .readdirSync(dir)
  .filter((f) => /^\d{4}-/.test(f))
  .map((f) => parseInt(f.slice(0, 4), 10))
  .filter((n) => Number.isFinite(n));
const next = (existing.length ? Math.max(...existing) : 0) + 1;
const id = String(next).padStart(4, "0");
const target = path.join(dir, `${id}-${slug}.md`);

const today = new Date().toISOString().slice(0, 10);
const tpl = `# ADR ${id} — ${slug.replace(/-/g, " ")}

- **Statut** : Proposé
- **Date** : ${today}
- **Auteur** : Will + Claude

## Contexte

…

## Décision

…

## Conséquences

**Positives**

- …

**Négatives**

- …

## Alternatives considérées

- …
`;

fs.writeFileSync(target, tpl, "utf-8");
console.warn(`Created ${path.relative(process.cwd(), target)}`);
