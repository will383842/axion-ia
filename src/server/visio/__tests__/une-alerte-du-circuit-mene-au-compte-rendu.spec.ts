// @vitest-environment node
/**
 * ⛔ UNE ALERTE DU CIRCUIT MÈNE AU COMPTE RENDU (sans taper d'URL).
 *
 * La vue du compte rendu (`rendez-vous?compteRendu=<rencontreId>`) porte la
 * lecture, la validation et le retrait de l'accord (B2). Avant ce correctif,
 * rien n'y menait : les alertes posaient `cibleType: "Rencontre"`, absent de
 * la table des liens (`lien-cible.ts`), donc SANS lien ; et la page du
 * rendez-vous annonçait un compte rendu « à venir ». Le chemin est désormais :
 * alerte → page du rendez-vous → « Ouvrir le compte rendu ».
 *
 * Mutations qui rougissent : retirer `Rencontre` de `SEGMENT_PAR_CIBLE` ;
 * changer le `cibleType` posé par `alerterParLaConsole` ; retirer le lien
 * `?compteRendu=` de la page du rendez-vous. Contre-témoin : une alerte sans
 * rendez-vous (suspension du circuit) ne porte aucune cible. Angle mort :
 * l'existence de la page est lue sur le disque par `lien-cible.spec.ts`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const creees: Array<Record<string, unknown>> = [];
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: async (a: Record<string, unknown>) => {
    creees.push(a);
  },
}));

import { lienCible } from "@/server/qualiopi/alertes/lien-cible";
import { alerterParLaConsole } from "../circuit";

const BASE = "/fr/console-secrete";
const RENCONTRE = "3f1c2a4e-9b7d-4c1e-8a2f-5d6e7f8a9b0c";

describe("une alerte du circuit mène au compte rendu", () => {
  it("l'alerte d'un rendez-vous porte une cible qui a un lien", async () => {
    creees.length = 0;
    await alerterParLaConsole({
      code: "visio.etape_en_echec",
      niveau: "important",
      titre: "t",
      message: "m",
      rencontreId: RENCONTRE,
    });
    const a = creees[0]!;
    expect(lienCible(a["cibleType"] as string, a["cibleId"] as string, BASE)).toBe(
      `${BASE}/rendez-vous/rencontres/${RENCONTRE}`,
    );
  });

  it("contre-témoin : une alerte sans rendez-vous ne porte aucune cible", async () => {
    creees.length = 0;
    await alerterParLaConsole({
      code: "visio.circuit_suspendu",
      niveau: "critique",
      titre: "t",
      message: "m",
      rencontreId: null,
    });
    expect(creees[0]!["cibleType"]).toBeUndefined();
  });

  it("la page du rendez-vous ouvre la vue du compte rendu", () => {
    const page = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/rencontres/[rencontreId]/page.tsx",
      ),
      "utf8",
    );
    expect(page).toContain("?compteRendu=${r.id}");
    const onglet = readFileSync(
      path.resolve(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx"),
      "utf8",
    );
    expect(onglet).toMatch(/demande\["compteRendu"\]/);
  });
});
