/**
 * Lot S4 — inventaire FIGÉ des points d'entrée de l'espace formateur.
 *
 * Tout fichier source qui appelle `requireFormateurAction`,
 * `getFormateurSession` ou signe / vérifie un jeton `formateur_*` est une porte
 * vers des données qui n'appartiennent qu'à un formateur. Chacune doit répondre
 * « introuvable » à l'identique pour ce qui n'est pas à lui.
 *
 * Ce test échoue dès qu'une entrée apparaît ou disparaît : l'ajouter ici est un
 * geste CONSCIENT, après avoir vérifié qu'elle ne distingue pas « inconnu » de
 * « pas à vous » (cf. `l-espace-formateur-repond-introuvable-a-l-identique.spec.ts`).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";

const MOTIF = /requireFormateurAction|getFormateurSession|scope:\s*["']formateur_/;

const INVENTAIRE = [
  "src/app/[locale]/espace-formateur/_coquille.tsx",
  "src/app/[locale]/espace-formateur/connexion/page.tsx",
  "src/app/api/espace-formateur/documents/[id]/route.ts",
  "src/app/api/espace-formateur/kit/[sessionId]/route.ts",
  "src/app/api/formateur/contrat-travail/[id]/route.ts",
  "src/app/api/formateur/lettre-mission/[id]/route.ts",
  "src/server/actions/formateur/coaching.actions.ts",
  "src/server/actions/qualiopi/contrat-travail-signature.ts",
  "src/server/actions/qualiopi/emargement-formateur.ts",
  "src/server/actions/qualiopi/lettre-mission-signature.ts",
  "src/server/actions/qualiopi/mission-formateur.ts",
  "src/server/actions/qualiopi/releve-signature.ts",
  "src/server/formateur/guard.ts",
  "src/server/formateur/magic-link.ts",
  "src/server/qualiopi/trainers/message-apres-delai.ts",
  "src/server/qualiopi/trainers/mission-formateur.ts",
];

function sources(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules" || nom === "generated") continue;
      sortie.push(...sources(chemin));
    } else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe("inventaire des entrées de l'espace formateur", () => {
  it("la liste est exactement celle-ci — toute nouvelle entrée s'ajoute consciemment", () => {
    const trouves = sources(join(process.cwd(), "src"))
      .filter((f) => MOTIF.test(readFileSync(f, "utf-8")))
      .map((f) => relative(process.cwd(), f).split(sep).join("/"))
      .sort();
    expect(trouves).toEqual([...INVENTAIRE].sort());
  });
});
