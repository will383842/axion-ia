/**
 * CLIQUET — la date de version du règlement intérieur suit son TEXTE.
 *
 * ## Le défaut (analyse d'écarts du 02/10/2026, B1)
 *
 * La page affichait « Mise à jour · 6 mai 2026 » alors que le règlement avait
 * changé le 24/08, les 13, 15 et 30/09 — dont l'article sur les violences, que
 * le stagiaire doit pouvoir dater. Le PDF imprimait comme « version » la date du
 * tirage. Un règlement remis dont la version est fausse ne prouve pas quelle
 * règle était opposable à quelle date.
 *
 * ## Ce que ce fichier garde
 *
 * `REGLEMENT_INTERIEUR_VERSION.empreinte` est le SHA-256 du contenu publié
 * (FR + EN). Changer le texte sans reprendre la date ET l'empreinte rougit ici.
 * ➡️ Si ce test rougit : mettre `iso`, `libelleFr` et `libelleEn` à la date du
 * changement, puis recopier l'empreinte affichée dans le message d'échec.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getLegal } from "@/content/legal";
import { REGLEMENT_INTERIEUR_VERSION as V } from "@/content/reglement-interieur-version";

function empreinteDuTexte(): string {
  const p = getLegal("reglement-interieur");
  return createHash("sha256")
    .update(JSON.stringify({ fr: p.fr, en: p.en }))
    .digest("hex");
}

describe("règlement intérieur — la date de version suit le texte", () => {
  it("le texte publié n'a pas changé depuis la date affichée", () => {
    const actuelle = empreinteDuTexte();
    expect(
      actuelle,
      `le texte du règlement intérieur a changé : mettez la date de version à jour ` +
        `(src/content/reglement-interieur-version.ts) et l'empreinte à ${actuelle}`,
    ).toBe(V.empreinte);
  });

  it("les trois écritures de la date disent le même jour", () => {
    const d = new Date(`${V.iso}T12:00:00Z`);
    const fr = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(d);
    const en = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(d);
    expect(V.libelleFr).toBe(fr.replace(/^1 /, "1er "));
    expect(V.libelleEn).toBe(en);
  });

  it("🔴 la page ne réaffiche pas une date en dur, et le PDF imprime la version, pas le jour du tirage", () => {
    const page = readFileSync(
      join(process.cwd(), "src", "app", "[locale]", "reglement-interieur", "page.tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/lastUpdated=\{isFr \? "/);
    expect(page).toContain("REGLEMENT_INTERIEUR_VERSION.iso");

    const producteurs = readFileSync(
      join(process.cwd(), "src", "server", "qualiopi", "documents", "production", "producteurs.ts"),
      "utf8",
    );
    const bloc = producteurs.slice(
      producteurs.indexOf("export async function produireReglementInterieur"),
      producteurs.indexOf("// 10. Programme"),
    );
    expect(bloc).toContain("const dateVersion = REGLEMENT_INTERIEUR_VERSION.libelleFr;");
  });
});
