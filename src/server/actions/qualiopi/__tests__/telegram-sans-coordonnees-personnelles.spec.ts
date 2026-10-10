/**
 * Lot S4 — Telegram est un canal tiers : aucun message envoyé depuis les zones
 * Qualiopi et espace formateur n'y interpole de coordonnée personnelle ni de
 * donnée bancaire.
 *
 * ⚠️ Le NOM du bénéficiaire reste aujourd'hui dans les deux messages
 * « besoin d'adaptation » de `portail.ts` — un test existant l'exige
 * (`declaration-besoin-sans-handicap.spec.ts`). Ils sont figés ici : toute
 * NOUVELLE interpolation de nom échoue, et retirer celles-là demande une
 * décision, pas un correctif au passage.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

const RACINES = [
  "src/server/actions/qualiopi",
  "src/server/qualiopi",
  "src/server/formateur",
  "src/server/actions/formateur",
  "src/app/api/formateur",
  "src/app/api/espace-formateur",
];

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__") continue;
      sortie.push(...fichiers(chemin));
    } else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/** Les corps des appels `sendTelegram({ … })`, approximés aux 15 lignes qui suivent. */
function appelsTelegram(): Array<{ fichier: string; corps: string }> {
  const sortie: Array<{ fichier: string; corps: string }> = [];
  for (const racine of RACINES) {
    for (const f of fichiers(join(process.cwd(), racine))) {
      const lignes = readFileSync(f, "utf-8").split("\n");
      lignes.forEach((l, i) => {
        if (/\bsendTelegram\(\s*\{?/.test(l) && !/^\s*(\/\/|\*|import)/.test(l)) {
          sortie.push({
            fichier: relative(process.cwd(), f),
            corps: lignes.slice(i, i + 15).join("\n"),
          });
        }
      });
    }
  }
  return sortie;
}

describe("Telegram — aucune coordonnée personnelle ni bancaire", () => {
  const appels = appelsTelegram();

  it("le relevé trouve bien des appels (le test regarde quelque chose)", () => {
    expect(appels.length).toBeGreaterThan(0);
  });

  it("🔴 aucun e-mail, téléphone, adresse ni IBAN interpolé", () => {
    const fautifs = appels
      .filter(({ corps }) =>
        /\$\{[^}]*\b(email|telephone|phone|adresse|iban|bic|rib)\b[^}]*\}/i.test(corps),
      )
      .map((a) => a.fichier);
    expect(fautifs).toEqual([]);
  });

  it("les noms interpolés se limitent aux deux messages connus de portail.ts", () => {
    const avecNom = appels
      .filter(({ corps }) => /\$\{[^}]*\.(nom|prenom)\b[^}]*\}/.test(corps))
      .map((a) => a.fichier);
    expect(avecNom).toEqual([
      "src/server/actions/qualiopi/portail.ts",
      "src/server/actions/qualiopi/portail.ts",
    ]);
  });
});
