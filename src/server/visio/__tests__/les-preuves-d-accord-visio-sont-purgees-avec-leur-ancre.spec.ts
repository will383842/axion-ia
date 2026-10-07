// @vitest-environment node

/**
 * Les échéances de conservation du dossier et des preuves d'accord suivent
 * leurs ancres (chantier visio, PR 8 ; B1, ADR 0056).
 *
 * - prospect : dernière rencontre (ou dernier fait) + 3 ans ;
 * - client (facture émise ou devis accepté) : max(rencontre TENUE, facture,
 *   devis) + 5 ans — une rencontre simplement planifiée ne prolonge rien ;
 * - fiche absorbée : échéance de l'absorbante, chaîne comprise ;
 * - rencontre jamais rattachée : sa date + 3 ans ;
 * - preuve d'accord : fin du dossier + 5 ans. La purge actuelle ne couvrait
 *   NI `enregistrement_consentements` NI `consent_events`
 *   « enregistrement-visio-annonce » (`src/lib/consents/index.ts` le disait :
 *   « aucune purge ne la vise encore ») : les deux sont désormais visées.
 *
 * Angle mort : les requêtes elles-mêmes (Prisma) ne sont exercées que par la
 * lecture du source ; une base réelle les exercerait (Gate D, non étendue ici).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type AncresDossier,
  echeancesAvecFusions,
  finConservationDossier,
  finConservationPreuve,
  finConservationRencontreOrpheline,
  regimeDossier,
} from "../conservation";

const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const VIDE: AncresDossier = {
  derniereRencontre: null,
  derniereRencontreTenue: null,
  dernierFait: null,
  derniereFacture: null,
  dernierDevisAccepte: null,
};

describe("les échéances suivent leurs ancres", () => {
  it("un prospect : 3 ans après sa dernière rencontre ou son dernier fait", () => {
    const a = { ...VIDE, derniereRencontre: d("2026-10-01"), dernierFait: d("2027-02-01") };
    expect(regimeDossier(a)).toBe("prospect");
    expect(finConservationDossier(a)).toEqual(d("2030-02-01"));
  });

  it("🔴 un client : 5 ans après la plus récente de ses ancres, rencontre TENUE seulement", () => {
    const a = {
      ...VIDE,
      derniereRencontre: d("2029-01-01"), // planifiée, jamais tenue : ne compte pas
      derniereRencontreTenue: d("2026-10-01"),
      derniereFacture: d("2027-03-15"),
      dernierDevisAccepte: d("2026-12-01"),
    };
    expect(regimeDossier(a)).toBe("client");
    expect(finConservationDossier(a)).toEqual(d("2032-03-15"));
  });

  it("une fiche sans aucune ancre n'a pas d'échéance (rien à purger)", () => {
    expect(finConservationDossier(VIDE)).toBeNull();
  });

  it("🔴 une fiche absorbée prend l'échéance de l'absorbante, chaîne comprise", () => {
    const propres = new Map<string, Date | null>([
      ["A", d("2029-01-01")],
      ["B", d("2031-01-01")],
      ["C", d("2033-01-01")],
    ]);
    const absorbeePar = new Map([
      ["A", "B"],
      ["B", "C"],
    ]);
    const r = echeancesAvecFusions(propres, absorbeePar);
    expect(r.get("A")).toEqual(d("2033-01-01"));
    expect(r.get("B")).toEqual(d("2033-01-01"));
    expect(r.get("C")).toEqual(d("2033-01-01"));
  });

  it("une boucle de fusions (impossible en principe) ne tourne pas sans fin", () => {
    const propres = new Map<string, Date | null>([
      ["A", d("2029-01-01")],
      ["B", d("2030-01-01")],
    ]);
    const r = echeancesAvecFusions(
      propres,
      new Map([
        ["A", "B"],
        ["B", "A"],
      ]),
    );
    expect(r.size).toBe(2);
  });

  it("une rencontre jamais rattachée : sa date + 3 ans", () => {
    expect(finConservationRencontreOrpheline(d("2026-10-05"))).toEqual(d("2029-10-05"));
  });

  it("🔴 une preuve d'accord : fin du dossier + 5 ans", () => {
    expect(finConservationPreuve(d("2031-03-15"))).toEqual(d("2036-03-15"));
  });

  it("🔴 la purge vise les DEUX formes de preuve — et elle n'est PLUS planifiée (Will, 2026-10-07)", () => {
    const erase = readFileSync(join(process.cwd(), "src/lib/rgpd-erase.ts"), "utf8");
    const debut = erase.indexOf("export async function purgerPreuvesAccordEchues(");
    expect(debut).toBeGreaterThan(0);
    const corps = erase.slice(debut, erase.indexOf("\n}\n", debut));
    expect(corps).toMatch(/enregistrementConsentement\.deleteMany/);
    expect(corps).toMatch(/consentEvent\.deleteMany/);
    expect(corps).toMatch(/CONSENT_FORM_REFS\.enregistrementVisioAnnonce/);
    expect(corps).toMatch(/finConservationPreuve\(/);
    const worker = readFileSync(
      join(process.cwd(), "src/server/queue/workers/retention-purge-worker.ts"),
      "utf8",
    );
    // « coupe tous les effacements » : la fonction reste, son appel planifié
    // est retiré du worker.
    expect(worker).not.toMatch(/purgerPreuvesAccordEchues\s*\(/);
  });
});
