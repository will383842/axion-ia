// @formateurs V2-S01 (vérification n° 2, sécurité) — IDOR, ce qu'E-D4 ne visait pas.
//
// Un formateur connecté (A) vise chez un autre (B) la lettre de mission (ancrée
// sur B, ou seulement sur la session que B anime), le contrat de travail, et les
// demandes de changement de compte bancaire et d'adresse (identifiant de B glissé
// dans le formulaire). Attendu : la réponse d'un identifiant INCONNU, à l'octet
// près, et rien d'écrit chez B. Chaque URL a son témoin (l'objet de A passe la
// garde : « pdf_unavailable », jamais « not_found »).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Http {
  statut: number;
  corps: string;
}
interface Observations {
  allumage: { ok: boolean };
  r: {
    lettre: { cible: Http; temoin: Http };
    lettre_par_session: Http;
    lettre_inconnue: Http;
    contrat: { cible: Http; temoin: Http };
    contrat_inconnu: Http;
    iban: string;
    adresse: string;
  };
  demandesChezA: string[];
  demandesChezB: number;
  adresses: string[];
}

const neutre = (h: Http) => ({ statut: h.statut, corps: h.corps });

test.describe("@formateurs V2-S01 — lettres, contrats et demandes d'un autre formateur", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s01-idor-lettres-et-demandes");
  });

  test.afterAll(async () => {
    for (const a of o?.adresses ?? []) await viderPuitsPour(a);
    await prisma.$disconnect();
  });

  test("lettre de mission de B : la réponse d'un identifiant inconnu (témoin : la sienne passe)", () => {
    expect(o.r.lettre_inconnue).toMatchObject({ statut: 404, corps: '{"error":"not_found"}' });
    expect(neutre(o.r.lettre.cible)).toEqual(neutre(o.r.lettre_inconnue));
    expect(neutre(o.r.lettre_par_session)).toEqual(neutre(o.r.lettre_inconnue));
    expect(o.r.lettre.temoin.corps).not.toBe(o.r.lettre_inconnue.corps);
  });

  test("contrat de travail de B : la réponse d'un identifiant inconnu (témoin : le sien passe)", () => {
    expect(o.r.contrat_inconnu).toMatchObject({ statut: 404, corps: '{"error":"not_found"}' });
    expect(neutre(o.r.contrat.cible)).toEqual(neutre(o.r.contrat_inconnu));
    expect(o.r.contrat.temoin.corps).not.toBe(o.r.contrat_inconnu.corps);
  });

  test("demandes de changement : l'identifiant glissé est ignoré, rien chez B", () => {
    expect(o.allumage.ok).toBe(true);
    expect(o.r.iban).toContain("issue=demande");
    expect(o.r.adresse).toContain("issue=demande");
    expect(o.demandesChezA).toEqual(["adresse", "iban"]);
    expect(o.demandesChezB).toBe(0);
  });
});
