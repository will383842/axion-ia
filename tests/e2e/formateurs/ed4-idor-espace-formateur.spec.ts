// @formateurs E-D4 (correction du 14/10) — IDOR dans l'espace formateur.
//
// Un formateur connecté (A, vraie session de l'espace) vise le dossier, les
// pièces, le kit, les relevés et le bilan d'un AUTRE formateur (B), par l'URL
// ou par le formulaire. Attendu : réponse NEUTRE partout — la même que pour un
// objet qui n'existe pas — et rien d'écrit chez B.
//
// Chaque tentative a son TÉMOIN (la même requête sur l'objet de A) : la réponse
// neutre doit DIFFÉRER du témoin, sinon elle ne prouverait rien.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Http {
  statut: number;
  corps: string;
}
interface Observations {
  r: {
    dossier_url: { cible: boolean; temoin: boolean };
    dossier_formulaire: { cible: string; temoin: string };
    piece: { cible: Http; temoin: Http };
    piece_inexistante: { cible: Http };
    kit: { cible: Http; temoin: Http };
    releve: { cible: string; temoin: string };
    bilan: { cible: string; temoin: string };
  };
  telephoneB: string;
  bApres: { telephone: string | null; codePostalPro: string | null };
  releveBApres: { contesteeAt: string | null };
}

const NEUTRE_404 = { statut: 404, corps: JSON.stringify({ error: "not_found" }) };

test.describe("@formateurs E-D4 — un formateur ne lit ni n'écrit chez un autre", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("ed4-idor", {});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("dossier par l'URL : page neutre (témoin : le sien s'ouvre)", () => {
    expect(o.r.dossier_url).toEqual({ cible: false, temoin: true });
  });

  test("dossier par le formulaire : « lien non valable », rien d'écrit chez B", () => {
    expect(JSON.parse(o.r.dossier_formulaire.cible)).toEqual({
      ok: false,
      message: "Ce lien n'est pas valable",
    });
    expect(JSON.parse(o.r.dossier_formulaire.temoin)).toEqual({ ok: true });
    expect(o.bApres).toEqual({ telephone: o.telephoneB, codePostalPro: null });
  });

  test("pièce de B : 404 identique à une pièce qui n'existe pas", () => {
    expect(o.r.piece.cible).toEqual(NEUTRE_404);
    expect(o.r.piece_inexistante.cible).toEqual(NEUTRE_404);
    // Témoin : sa propre pièce passe la garde (le PDF manque au banc, c'est tout).
    expect(o.r.piece.temoin.corps).not.toEqual(NEUTRE_404.corps);
  });

  test("kit d'une session de B : introuvable (témoin : la sienne passe la garde)", () => {
    expect(o.r.kit.cible).toEqual({
      statut: 404,
      corps: JSON.stringify({ error: "kit_introuvable" }),
    });
    expect(o.r.kit.temoin.corps).not.toContain("kit_introuvable");
  });

  test("relevé de B : « introuvable », et rien n'est contesté chez B", () => {
    expect(o.r.releve.cible).toContain("signale=introuvable");
    expect(o.r.releve.temoin).not.toContain("signale=introuvable");
    expect(o.releveBApres.contesteeAt).toBeNull();
  });

  test("bilan d'une session de B : « introuvable »", () => {
    expect(o.r.bilan.cible).toContain("bilan=introuvable");
    expect(o.r.bilan.temoin).not.toContain("bilan=introuvable");
  });
});
