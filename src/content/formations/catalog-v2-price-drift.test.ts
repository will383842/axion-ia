/**
 * Garde anti-dérive — prix en prose de `catalog-v2.ts` ⊆ `FORMATION_PRICE_MATRIX`.
 *
 * Contexte (chantier rangement prix 2026-06-21) : les `metaDescriptionFr` /
 * `accrocheFr` de `catalog-v2.ts` contiennent des montants € en dur (« 1 200 €
 * HT », « 4 900 € HT »…). On NE peut PAS les tokeniser (`{{price:…}}`) : contrai-
 * rement au blog et aux villes, le rendu des formations n'applique PAS
 * `resolvePriceTokens` → un token y resterait littéral (régression).
 *
 * À défaut de tokenisation, on GARANTIT l'absence de dérive : tout montant € en
 * prose DOIT correspondre à une valeur réelle de `FORMATION_PRICE_MATRIX` (le
 * SSOT prix formations de `pricing.ts`). Si quelqu'un modifie un prix du SSOT
 * sans mettre à jour la prose (ou inversement), ce test échoue → plus de prix
 * obsolète affiché.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FORMATION_PRICE_MATRIX } from "../pricing";

function matrixValues(): ReadonlySet<number> {
  const out = new Set<number>();
  for (const gamme of Object.values(FORMATION_PRICE_MATRIX)) {
    for (const duree of Object.values(gamme)) {
      for (const v of Object.values(duree)) {
        if (typeof v === "number") out.add(v);
      }
    }
  }
  return out;
}

describe("Garde anti-dérive — prix prose catalog-v2 ⊆ FORMATION_PRICE_MATRIX", () => {
  it("chaque montant € en prose existe dans la matrice SSOT", () => {
    const file = path.resolve(process.cwd(), "src/content/formations/catalog-v2.ts");
    const text = readFileSync(file, "utf8");
    const values = matrixValues();
    const offenders: string[] = [];
    let scanned = 0;

    text.split(/\r?\n/).forEach((line, i) => {
      const t = line.trimStart();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return; // commentaires
      // Montants « 1 200 € », « 990 € », espaces normaux/insécables/fins.
      for (const m of line.matchAll(/(\d[\d   ]*\d|\d)\s*€/g)) {
        const n = Number.parseInt((m[1] ?? "").replace(/\D/g, ""), 10);
        if (Number.isNaN(n)) continue;
        scanned += 1;
        if (!values.has(n)) {
          offenders.push(`  L${i + 1}: ${n} €  →  "${line.trim().slice(0, 72)}"`);
        }
      }
    });

    // Offre AXION = 100 % « Sur devis » : AUCUN montant en euros ne doit
    // apparaître en prose (prix décidés plus tard, hors catalogue). Ce garde
    // empêche toute réintroduction accidentelle d'un prix en dur.
    expect(scanned, "offre « Sur devis » : aucun prix € ne doit figurer dans le catalogue").toBe(0);

    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `\n${offenders.length} prix en prose ABSENT(S) de FORMATION_PRICE_MATRIX (dérive !) — mets à jour la prose OU le SSOT :\n${offenders.join("\n")}\n`,
    ).toHaveLength(0);
  });
});
