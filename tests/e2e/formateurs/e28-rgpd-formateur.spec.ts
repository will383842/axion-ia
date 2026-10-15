// @formateurs E28 — Export (art. 15) et effacement (art. 17) d'un formateur
// indépendant dont l'adresse est aussi celle d'un apporteur d'affaires.
//
// Contrôle clé : pseudonymisation sans lien contractuel, preuves légales
// gardées, identité de facturation gardée tant qu'une obligation légale existe
// (relevé payé, virement dû) ; la fiche apporteur à la même adresse n'est PAS
// touchée par l'effacement du formateur ; geste réservé au super-administrateur.
//
// ÉCART consigné (le code de main fait foi) : le plan dit « anonymisation
// DIFFÉRÉE si virement dû ». Le code ne diffère rien : avec un virement dû (ou
// tout autre lien contractuel), l'effacement CONSERVE l'identité au titre de
// l'obligation légale (`conserve_obligation_legale`), retire le téléphone et
// coupe les accès — et aucune anonymisation n'est programmée pour après le
// paiement. Le test constate ce comportement.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Fiche {
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  adresseProfessionnelle: string | null;
  accesVersion: number;
  documents: Array<{ type: string; archiveAt: string | null }>;
}
interface Identite {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string;
}
interface Observations {
  identites: { f1: Identite; f2: Identite; f3: Identite };
  export1: {
    email: string;
    telephone: string | null;
    iban: string | null;
    pieces: string[];
  } | null;
  exportApporteurAvant: boolean;
  refusAdmin: string;
  apresRefus: Fiche;
  sansMot: { ok: boolean; error?: string };
  eff1: {
    ok: boolean;
    resultat?: { formateur: string; piecesMasquees: number; piecesLegalesIntactes: number };
  };
  apres1: Fiche;
  apporteurAvant: Record<string, unknown>;
  apporteurApres: Record<string, unknown>;
  export1Apres: unknown;
  exportApporteurApres: boolean;
  journal1: unknown[];
  eff2: Observations["eff1"];
  apres2: Fiche;
  virementDu: boolean;
  eff3: Observations["eff1"];
  apres3: Fiche;
  virementToujoursDu: boolean;
}

const MARQUEUR = "[erased-rgpd-art17]";

test.describe("@formateurs E28 — RGPD d'un formateur indépendant", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("e28-rgpd", {});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("l'export art. 15 rend la fiche du formateur ET celle de l'apporteur", () => {
    expect(o.export1).toMatchObject({
      email: o.identites.f1.email,
      telephone: o.identites.f1.telephone,
      pieces: ["cv", "kbis_avis_sirene"],
    });
    expect(o.exportApporteurAvant).toBe(true);
  });

  test("l'effacement est réservé au super-administrateur et exige le mot", () => {
    expect(o.refusAdmin).toMatch(/forbidden/);
    expect(o.apresRefus).toMatchObject({ nom: o.identites.f1.nom, accesVersion: 0 });
    expect(o.sansMot).toEqual({ ok: false, error: "Confirmation requise : saisir « EFFACER »." });
  });

  test("sans lien : pseudonymisé, preuve légale intacte, pièce masquée mais gardée", () => {
    expect(o.eff1).toEqual({
      ok: true,
      resultat: { formateur: "efface", piecesMasquees: 1, piecesLegalesIntactes: 1 },
    });
    expect(o.apres1).toMatchObject({
      nom: MARQUEUR,
      prenom: MARQUEUR,
      email: `erased:${o.identites.f1.id}@erased.local`,
      telephone: null,
      adresseProfessionnelle: null,
      accesVersion: 1,
    });
    const docs = Object.fromEntries(o.apres1.documents.map((d) => [d.type, d.archiveAt]));
    expect(docs["kbis_avis_sirene"]).toBeNull();
    expect(docs["cv"]).not.toBeNull();
    expect(o.apres1.documents).toHaveLength(2);
    expect(o.export1Apres).toBeNull();
  });

  test("l'apporteur à la même adresse n'est pas touché", () => {
    const { id: _id, ...avant } = o.apporteurAvant;
    expect(o.apporteurApres).toEqual(avant);
    expect(o.exportApporteurApres).toBe(true);
  });

  test("le journal de l'effacement ne porte que des comptes", () => {
    expect(o.journal1).toEqual([
      { formateur: "efface", piecesMasquees: 1, piecesLegalesIntactes: 1 },
    ]);
    const texte = JSON.stringify(o.journal1);
    for (const v of [o.identites.f1.email, o.identites.f1.nom, o.identites.f1.telephone]) {
      expect(texte).not.toContain(v);
    }
  });

  test("avec un relevé payé : identité de facturation gardée, téléphone retiré, accès coupés", () => {
    expect(o.eff2.resultat?.formateur).toBe("conserve_obligation_legale");
    expect(o.apres2).toMatchObject({
      nom: o.identites.f2.nom,
      email: o.identites.f2.email,
      telephone: null,
      accesVersion: 1,
    });
    const docs = Object.fromEntries(o.apres2.documents.map((d) => [d.type, d.archiveAt]));
    expect(docs["contrat_sous_traitance"]).toBeNull();
    expect(docs["autre"]).not.toBeNull();
  });

  test("ÉCART constaté — virement dû : identité conservée, rien de « différé »", () => {
    expect(o.virementDu).toBe(true);
    expect(o.eff3.resultat?.formateur).toBe("conserve_obligation_legale");
    expect(o.apres3).toMatchObject({ nom: o.identites.f3.nom, email: o.identites.f3.email });
    // Le virement reste dû et payable : l'effacement n'a rien cassé côté argent.
    expect(o.virementToujoursDu).toBe(true);
  });
});
