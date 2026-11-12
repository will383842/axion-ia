// L'EN-TÊTE COMMUN NE PROMET AUCUN DÉLAI DE RÉPONSE (Williams, 11/11/2026).
//
// « Il ne faut pas dire réponse sous 48 h, ça me limite trop. » L'en-tête est sur
// toutes les pages : son bouton « Nous écrire » portait le délai dans son nom
// accessible (`cta.contactAria`), et le bloc d'appel à l'action de l'accueil le
// répétait (`home.ctaBlockMicroProofs`). Les deux sont sans délai, en français
// comme en anglais.
//
// ⚠️ Cette garde ne lit QUE ces deux clés. Les autres « 48 h » du site (devis,
// rapport, audit, page Contact, presse) attendent la décision de Williams : elles
// sont listées dans la PR, pas modifiées ici.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Messages = Record<string, unknown>;

function lire(locale: "fr" | "en"): Messages {
  return JSON.parse(
    readFileSync(join(process.cwd(), "src", "messages", `${locale}.json`), "utf8"),
  ) as Messages;
}

/** Toutes les valeurs de la clé `nom`, où qu'elle soit dans l'arbre des messages. */
function valeursDe(noeud: unknown, nom: string, trouvees: string[] = []): string[] {
  if (noeud && typeof noeud === "object") {
    for (const [cle, valeur] of Object.entries(noeud as Record<string, unknown>)) {
      if (cle === nom && typeof valeur === "string") trouvees.push(valeur);
      else valeursDe(valeur, nom, trouvees);
    }
  }
  return trouvees;
}

const DELAI =
  /\d+\s?(h\b|heures?|hours?|jours?|days?)|réponse sous|reply within|ouvrées?|business/i;

describe("l'en-tête commun ne promet aucun délai de réponse", () => {
  it("le nom accessible du bouton est « Nous écrire », sans délai (FR et EN)", () => {
    expect(valeursDe(lire("fr"), "contactAria")).toEqual(["Nous écrire"]);
    expect(valeursDe(lire("en"), "contactAria")).toEqual(["Email us"]);
  });

  it("les micro-preuves gardent « Aucun engagement · 100 % personnalisé », sans délai", () => {
    expect(valeursDe(lire("fr"), "ctaBlockMicroProofs")).toEqual([
      "Aucun engagement · 100 % personnalisé",
    ]);
    expect(valeursDe(lire("en"), "ctaBlockMicroProofs")).toEqual([
      "No commitment · 100% personalised",
    ]);
  });

  it("⛔ aucune des deux clés ne reprend un délai, dans aucune langue", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const cle of ["contactAria", "ctaBlockMicroProofs"]) {
        for (const valeur of valeursDe(lire(locale), cle)) {
          expect(valeur, `${locale}.${cle}`).not.toMatch(DELAI);
        }
      }
    }
  });

  it("l'en-tête lit bien cette clé pour ses deux boutons (bureau et mobile)", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "nav", "Header.tsx"),
      "utf8",
    );
    expect(source.match(/aria-label=\{t\("cta\.contactAria"\)\}/g)?.length).toBe(2);
    expect(source).not.toMatch(/48\s?h/);
  });
});
