/**
 * ⛔ Inventaire statique des gardes « hors clients » (lot F-CAL-1, 2026-10-09).
 *
 * Toute exclusion des familles CLIENT (e-mails « appel de découverte »), du CRM
 * des ventes, du dossier client et de la visio enregistrée passe par
 * `estEchangeHorsClients(ParNom)` / `HORS_ECHANGES_HORS_CLIENTS(_PAR_NOM)` —
 * apporteur OU formateur. Les prédicats « apporteur » seuls ne servent plus
 * qu'à SÉLECTIONNER les apporteurs (fiche, rattachement, invitation, classement).
 *
 * Ce fichier fige les deux listes. Un nouveau lecteur d'`estAppelApporteur`
 * doit s'y déclarer — et la question à se poser en l'ajoutant est : « est-ce
 * que j'exclus des clients ? » Si oui, c'est `estEchangeHorsClients`.
 *
 * Inventaire produit par :
 *   git grep -lE "HORS_APPELS_APPORTEUR|SEULS_APPELS_APPORTEUR|estAppelApporteur|
 *     estRendezVousApporteur|estEchangeHorsClients|HORS_ECHANGES_HORS_CLIENTS" -- src
 *
 * Angle mort : le scanner lit les SOURCES (`src/**`, hors tests) et ignore les
 * commentaires ; une garde recodée sous un autre nom ne se verrait pas.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DEFINITION = "src/server/calendly/appel-apporteur.ts";

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (nom === "__tests__" || nom === "node_modules" || nom === "generated") continue;
    if (statSync(chemin).isDirectory()) fichiers(chemin, acc);
    else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

/** Le code sans ses commentaires. */
function code(texte: string): string {
  return texte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const SOURCES: ReadonlyArray<readonly [string, string]> = fichiers(join(RACINE, "src")).map(
  (f) => [relative(RACINE, f).split(sep).join("/"), code(readFileSync(f, "utf8"))] as const,
);

function porteurs(motif: RegExp): string[] {
  return SOURCES.filter(([c, t]) => c !== DEFINITION && motif.test(t))
    .map(([c]) => c)
    .sort();
}

/** Les fichiers qui EXCLUENT des familles client / CRM / dossier / visio. */
const BASCULES = [
  "src/app/api/calendly/client-event/route.ts",
  "src/server/calendly/rappels-appel.ts",
  "src/server/crm-sync/index.ts",
  "src/server/crm-sync/reconcile.ts",
  "src/server/visio/liste-blanche-types.ts",
].sort();

/** Les lecteurs d'`estAppelApporteur` qui SÉLECTIONNENT des apporteurs. */
const SELECTION_APPORTEUR_PAR_NOM = [
  "src/app/[locale]/(admin)/[adminPrefix]/contacts/appels/[id]/page.tsx",
  "src/features/admin-rendezvous/issue-apporteur-envoi.ts",
  "src/features/commercial-application/archivage-auto-apporteurs.ts",
  "src/features/commercial-application/invitation-apporteur.ts",
  // Classement par le nom : « apporteur » d'abord, une valeur d'enum.
  "src/server/calendly/type-rendez-vous.ts",
  // Motif de refus « apporteur » ; le formateur est refusé à la ligne suivante
  // par `estRendezVousDuDossier`, qui lit `estEchangeHorsClientsParNom`.
  "src/server/visio/sessions.ts",
].sort();

/** Les lecteurs d'`estRendezVousApporteur` qui SÉLECTIONNENT des apporteurs. */
const SELECTION_APPORTEUR = [
  "src/features/admin-calendly/actions.ts",
  "src/features/admin-rendezvous/issue-apporteur-actions.ts",
  "src/server/calendly/enrich.ts",
  "src/server/calendly/fiche-rendez-vous-apporteur.ts",
  "src/server/calendly/rattachement-apporteur.ts",
  "src/server/calendly/type-effectif.ts",
].sort();

describe("⛔ inventaire des gardes hors clients", () => {
  it("contre-témoin : le scanner voit la définition", () => {
    const def = SOURCES.find(([c]) => c === DEFINITION);
    expect(def?.[1]).toMatch(/export const HORS_ECHANGES_HORS_CLIENTS\b/);
  });

  it("aucun import de l'alias déprécié HORS_APPELS_APPORTEUR(_PAR_NOM) hors de sa définition", () => {
    expect(porteurs(/\bHORS_APPELS_APPORTEUR(_PAR_NOM)?\b/)).toEqual([]);
  });

  it("les exclusions client / CRM / dossier / visio lisent toutes le prédicat commun", () => {
    expect(
      porteurs(/\b(estEchangeHorsClients(ParNom)?|HORS_ECHANGES_HORS_CLIENTS(_PAR_NOM)?)\b/),
    ).toEqual(BASCULES);
  });

  it("SEULS_APPELS_APPORTEUR ne sert qu'aux passages apporteur des rappels", () => {
    expect(porteurs(/\bSEULS_APPELS_APPORTEUR(_PAR_NOM)?\b/)).toEqual([
      "src/server/calendly/rappels-appel.ts",
    ]);
  });

  it("estAppelApporteur : seulement des sélections d'apporteurs", () => {
    expect(porteurs(/\bestAppelApporteur\b/)).toEqual(SELECTION_APPORTEUR_PAR_NOM);
  });

  it("estRendezVousApporteur : seulement des sélections d'apporteurs", () => {
    expect(porteurs(/\bestRendezVousApporteur\b/)).toEqual(SELECTION_APPORTEUR);
  });

  it("aucun fichier ne double les deux familles (exclusion ET sélection par le nom seul)", () => {
    const deux = BASCULES.filter((f) => SELECTION_APPORTEUR_PAR_NOM.includes(f));
    expect(deux).toEqual([]);
  });
});
