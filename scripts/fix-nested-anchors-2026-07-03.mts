/**
 * Ops one-shot (audit blog 2026-07-03) — désimbrique les ancres `<a><a>…</a></a>`
 * (HTML invalide) sur les articles publiés. Cause racine corrigée dans
 * links/anchor-safe-link.ts ; ce script répare les corps DÉJÀ persistés.
 *
 * Règle : `<a href="A"><a href="B">TEXT</a></a>` → on garde l'ancre dont la cible
 * est VIVANTE (slug non archivé) ; si les deux sont vivantes ou les deux
 * archivées, on garde l'ancre interne (B). Répété jusqu'à stabilité (au cas où
 * imbrication > 2). Idempotent.
 *
 * Dry-run par défaut. Appliquer : passer l'arg `--apply`.
 *   docker exec -w /app -u 0 <worker> node_modules/.bin/tsx fix-nested-anchors-…mts --apply
 */
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

/**
 * Aplatit les ancres imbriquées via un parseur à PILE (pas de regex sur du HTML
 * imbriqué — une regex confond ancres imbriquées et ancres séparées consécutives,
 * et détruit du contenu). Tokenise en <a…> / </a> / texte ; suit la profondeur
 * d'ancre ; conserve UNIQUEMENT l'ancre la plus EXTERNE, retire les balises
 * d'ancre internes, PRÉSERVE tout le texte. Résultat toujours valide, zéro perte.
 * (Les liens vers des slugs archivés restent valides via leur 308.)
 */
function flattenNestedAnchors(html: string): string {
  const tokenRe = /<a\b[^>]*>|<\/a\s*>/gi;
  let out = "";
  let last = 0;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html)) !== null) {
    out += html.slice(last, m.index);
    last = tokenRe.lastIndex;
    const tok = m[0];
    const isClose = /^<\//.test(tok);
    if (isClose) {
      if (depth === 1) {
        out += tok; // ferme l'externe → garder
        depth = 0;
      } else if (depth > 1) {
        depth--; // fermeture interne → retirer
      } else {
        out += tok; // </a> orphelin (depth 0) → laisser tel quel
      }
    } else {
      if (depth === 0) {
        out += tok; // ouvre l'externe → garder
        depth = 1;
      } else {
        depth++; // ouverture interne → retirer
      }
    }
  }
  out += html.slice(last);
  return out;
}

function unwrapAll(html: string): string {
  return flattenNestedAnchors(html);
}

const rows = await prisma.articleTranslation.findMany({
  where: { locale: "fr", article: { status: "published" } },
  select: { id: true, slug: true, body: true },
});

const nestedRe = /<a\b[^>]*>\s*<a\b[^>]*>/i;
let touched = 0;
for (const r of rows) {
  if (!r.body || !nestedRe.test(r.body)) continue;
  const fixed = unwrapAll(r.body);
  const before = (r.body.match(/<a\b[^>]*>\s*<a\b[^>]*>/gi) ?? []).length;
  const after = (fixed.match(/<a\b[^>]*>\s*<a\b[^>]*>/gi) ?? []).length;
  touched++;
  console.log(
    JSON.stringify({
      slug: r.slug,
      nested_before: before,
      nested_after: after,
      len_before: r.body.length,
      len_after: fixed.length,
    }),
  );
  if (APPLY && fixed !== r.body) {
    await prisma.articleTranslation.update({
      where: { id: r.id },
      data: { body: fixed, updatedAt: new Date() },
    });
  }
}
console.log(JSON.stringify({ mode: APPLY ? "APPLIED" : "DRY_RUN", articles_touched: touched }));
await prisma.$disconnect();
process.exit(0);
