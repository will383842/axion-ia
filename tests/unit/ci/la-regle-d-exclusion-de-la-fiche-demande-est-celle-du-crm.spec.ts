// @vitest-environment node
/**
 * La fiche prospect des demandes écrites recopie la règle « adresse exclue du CRM »
 * (`estExclueParEnvironnement`, `src/features/dossier-client/fiche-demande.ts`) au lieu d'importer
 * `@/server/crm-sync` (garde PA-12). Une copie dérive en silence : ce test compare les deux règles
 * sur les mêmes valeurs d'environnement et les mêmes adresses, et rougit dès qu'elles divergent.
 */

import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => false }));

import { estExclueParEnvironnement } from "@/features/dossier-client/fiche-demande";
import { estExclueDuCrm } from "@/server/crm-sync/exclusions";

const empreinte = (a: string) => createHash("sha256").update(a.trim().toLowerCase()).digest("hex");

const ADRESSES = [
  "maison@exemple-fictif.fr",
  "  Maison@Exemple-Fictif.FR  ",
  "autre@exemple-fictif.fr",
  "",
  "pas une adresse",
];

const ENVIRONNEMENTS: ReadonlyArray<readonly [string, string | undefined]> = [
  ["absent", undefined],
  ["vide", ""],
  ["une empreinte", empreinte("maison@exemple-fictif.fr")],
  ["empreinte en majuscules", empreinte("maison@exemple-fictif.fr").toUpperCase()],
  [
    "deux empreintes, espaces",
    ` ${empreinte("autre@exemple-fictif.fr")} , ${empreinte("maison@exemple-fictif.fr")} `,
  ],
  ["une adresse collée en clair (ignorée)", "maison@exemple-fictif.fr"],
  ["empreinte tronquée (ignorée)", empreinte("maison@exemple-fictif.fr").slice(0, 63)],
  ["virgules seules", ",,,"],
];

afterEach(() => {
  vi.unstubAllEnvs();
});

function regler(valeur: string | undefined): void {
  if (valeur === undefined) vi.stubEnv("CRM_SYNC_EXCLUSIONS_SHA256", undefined as never);
  else vi.stubEnv("CRM_SYNC_EXCLUSIONS_SHA256", valeur);
}

describe("la règle d'exclusion de la fiche des demandes est celle du CRM", () => {
  for (const [nom, valeur] of ENVIRONNEMENTS) {
    it(`même verdict pour chaque adresse — environnement : ${nom}`, () => {
      regler(valeur);
      for (const adresse of ADRESSES) {
        expect(estExclueParEnvironnement(adresse), `adresse « ${adresse} »`).toBe(
          estExclueDuCrm(adresse),
        );
      }
    });
  }

  it("témoin : l'adresse de la maison est bien exclue par les DEUX règles (sinon le test ne prouve rien)", () => {
    regler(empreinte("maison@exemple-fictif.fr"));
    expect(estExclueDuCrm("maison@exemple-fictif.fr")).toBe(true);
    expect(estExclueParEnvironnement("maison@exemple-fictif.fr")).toBe(true);
    expect(estExclueDuCrm("autre@exemple-fictif.fr")).toBe(false);
    expect(estExclueParEnvironnement("autre@exemple-fictif.fr")).toBe(false);
  });
});
