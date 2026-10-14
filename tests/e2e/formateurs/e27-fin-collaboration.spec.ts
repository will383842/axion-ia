// @formateurs E27 — Fin de collaboration (F47).
//
// Contrôle clé : propositions fermées, lettres et contrats non signés annulés,
// jetons de signature révoqués, relevés (e-mails d'argent) encore envoyés ; le
// formateur n'est plus affectable ni réactivable ; un décès n'envoie pas F47 ;
// rien n'est supprimé.
//
// Le geste est l'action RÉELLE de la console, jouée sous `tsx` avec une session
// administrateur (`fixtures/formateurs/securite-serveur/`), interrupteur
// `fin_collaboration` et textes validés posés par la console.
//
// ÉCART consigné (le code de main fait foi) : le plan parle d'un « PDF de
// notification ». Aucun PDF n'est produit à la fin de collaboration : F47 est
// un e-mail sans pièce jointe. Le test le CONSTATE (aucune pièce générée) au
// lieu de chercher un PDF qui n'existe pas.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Photo {
  docs: Array<{ id: string; type: string; statutSignature: string; annuleeAt: string | null }>;
  jetons: Array<{ documentGenereId: string; revokedAt: string | null }>;
  missions: Array<{ statut: string }>;
  trainer: {
    actif: boolean;
    finCollaborationAt: string | null;
    finCollaborationMotif: string | null;
    accesVersion: number;
  };
}

interface Observations {
  fin: { data?: { email: string; close: boolean; desactivee: boolean }; error?: string };
  avantA: Photo;
  apresA: Photo;
  f47: string[];
  virement: string;
  relance: string;
  affectation: string[];
  reactivation: { ok: boolean; manques?: string[] };
  secondeFin: { error?: string };
  journal: { avant: number; apres: number };
  finB: { data?: { email: string; close: boolean } };
  envoisB: string[];
  apresB: Photo;
  argentApresDeces: string;
  pdfDeNotification: number;
  adresses: string[];
}

test.describe("@formateurs E27 — fin de collaboration", () => {
  // Un seul passage du scénario pour tous les constats : un seul worker.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("e27-fin-collaboration", {});
  });

  test.afterAll(async () => {
    for (const a of o?.adresses ?? []) await viderPuitsPour(a);
    await prisma.$disconnect();
  });

  test("la fin sans préavis est enregistrée, close et désactive", () => {
    expect(o.fin).toEqual({ data: { email: "envoye", close: true, desactivee: true } });
    expect(o.apresA.trainer).toMatchObject({ actif: false, finCollaborationMotif: "siret_cesse" });
    expect(o.apresA.trainer.finCollaborationAt).not.toBeNull();
    // Les liens du dossier (signés sur `accesVersion`) sont morts.
    expect(o.apresA.trainer.accesVersion).toBe(o.avantA.trainer.accesVersion + 1);
  });

  test("propositions fermées, pièces non signées annulées, jetons révoqués", () => {
    expect(o.avantA.missions.map((m) => m.statut)).toEqual(["en_attente"]);
    expect(o.apresA.missions.map((m) => m.statut)).toEqual(["retiree"]);

    const signee = (p: Photo) => p.docs.find((d) => d.statutSignature === "signee");
    for (const d of o.apresA.docs) {
      if (d.statutSignature === "signee") expect(d.annuleeAt, d.type).toBeNull();
      else expect(d.annuleeAt, d.type).not.toBeNull();
    }
    for (const j of o.apresA.jetons) {
      if (j.documentGenereId === signee(o.apresA)?.id) expect(j.revokedAt).toBeNull();
      else expect(j.revokedAt).not.toBeNull();
    }
  });

  test("F47 part par la file ; les relevés partent encore, les relances non", () => {
    expect(o.f47).toEqual(["sent"]);
    expect(o.virement).toBe("envoye");
    expect(o.relance).toBe("fin-de-collaboration");
  });

  test("plus affectable, ni réactivable, ni « terminable » deux fois", () => {
    expect(o.affectation.length).toBeGreaterThan(0);
    expect(o.reactivation.ok).toBe(false);
    expect(o.reactivation.manques).toContain(
      "La collaboration avec ce formateur est terminée : sa fiche ne peut pas être réactivée.",
    );
    expect(o.secondeFin).toEqual({ error: "La fin de cette collaboration est déjà décidée." });
  });

  test("décès : aucun F47, et les pièces ouvertes sont tout de même fermées", () => {
    expect(o.finB).toEqual({ data: { email: "aucun", close: true, desactivee: true } });
    expect(o.envoisB).toEqual([]);
    expect(o.apresB.trainer.finCollaborationMotif).toBe("deces");
    expect(o.apresB.jetons.every((j) => j.revokedAt !== null)).toBe(true);
  });

  test("rien n'est supprimé, tout est journalisé", () => {
    expect(o.apresA.docs.map((d) => d.id).sort()).toEqual(o.avantA.docs.map((d) => d.id).sort());
    expect(o.apresA.jetons).toHaveLength(o.avantA.jetons.length);
    expect(o.apresA.missions).toHaveLength(o.avantA.missions.length);
    expect(o.journal.apres).toBeGreaterThan(o.journal.avant);
  });

  test("ÉCART constaté : aucun « PDF de notification » n'est produit", () => {
    expect(o.pdfDeNotification).toBe(0);
  });
});
