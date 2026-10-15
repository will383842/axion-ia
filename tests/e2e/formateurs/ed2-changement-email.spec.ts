// @formateurs E-D2 (correction du 14/10) — Changement d'e-mail d'un indépendant.
//
// Contrôle clé : après le changement fait en console, les liens et sessions
// émis sous l'ancienne adresse sont morts, et l'ancienne adresse est prévenue
// (F61 `formateur-email-modifie`) sans que l'avis porte la nouvelle adresse.
// Chaque lien est d'abord relu AVANT le changement : il marchait (témoin).
//
// Deux défauts consignés (`test.fixme`, cf. le rapport de la PR) :
//   · V1-D-1 — le lien de réponse à une proposition de mission survivait :
//     corrigé (lot 2 de la vérification 1), le lien porte l'empreinte de l'adresse ;
//   · V1-D-2 — le lien du dossier « reçu » (lecture seule) survit (erreur du test,
//     cf. la synthèse : le jeton éprouvé n'est jamais émis par le produit).
// ÉCART consigné : une session ouverte AVANT le lot C4 (sans empreinte
// d'adresse) n'est pas jugée sur l'adresse — choix écrit dans
// `src/server/formateur/guard.ts`, qui s'éteint avec la durée de vie d'une
// session (30 jours).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { messagesCaptes, viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";
import { corpsCaptes } from "../fixtures/formateurs/securite-puits";

interface Liens {
  session: boolean;
  sessionSansEmpreinte: boolean;
  dossierA: boolean;
  dossierB: boolean;
  mission: boolean;
  missionSansEmpreinte: boolean;
  connexion?: boolean;
}
interface Observations {
  anciennes: string[];
  nouvelles: string[];
  avant: Liens;
  changementA: { data?: { id: string }; error?: string };
  changementB: { data?: { id: string }; error?: string };
  apres: Liens;
  avis: Array<{ recipient: string; status: string }>;
  versLaNouvelle: number;
  fiches: Array<{ id: string; email: string; accesVersion: number }>;
  journal: Array<{ action: string; changes: unknown }>;
}

const ATTENTE = { timeout: 30_000, intervals: [500, 1_000] };

test.describe("@formateurs E-D2 — changement d'e-mail d'un indépendant", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("ed2-changement-email", {});
  });

  test.afterAll(async () => {
    for (const a of [...(o?.anciennes ?? []), ...(o?.nouvelles ?? [])]) await viderPuitsPour(a);
    await prisma.$disconnect();
  });

  test("témoin : avant le changement, chaque lien marchait", () => {
    expect(o.avant).toEqual({
      session: true,
      sessionSansEmpreinte: true,
      dossierA: true,
      dossierB: true,
      mission: true,
      missionSansEmpreinte: true,
    });
    expect(o.changementA.error).toBeUndefined();
    expect(o.changementB.error).toBeUndefined();
  });

  test("session de l'espace, lien de connexion et lien du dossier : morts", () => {
    expect(o.apres.session).toBe(false);
    expect(o.apres.connexion).toBe(false);
    expect(o.apres.dossierA).toBe(false);
    for (const f of o.fiches) expect(o.nouvelles).toContain(f.email);
  });

  test("l'ancienne adresse est prévenue, sans la nouvelle ; rien vers la nouvelle", async () => {
    expect(o.avis.map((a) => a.status)).toEqual(["sent", "sent"]);
    expect(o.avis.map((a) => a.recipient).sort()).toEqual([...o.anciennes].sort());
    expect(o.versLaNouvelle).toBe(0);
    for (const [i, ancienne] of o.anciennes.entries()) {
      await expect.poll(async () => (await messagesCaptes(ancienne)).length, ATTENTE).toBe(1);
      for (const c of await corpsCaptes(ancienne)) expect(c).not.toContain(o.nouvelles[i] ?? "");
    }
  });

  test("le journal dit qu'une adresse a changé, jamais laquelle", () => {
    const texte = JSON.stringify(o.journal);
    for (const a of [...o.anciennes, ...o.nouvelles]) expect(texte).not.toContain(a);
  });

  test("ÉCART constaté : une session sans empreinte d'adresse (avant C4) n'est pas jugée sur l'adresse", () => {
    expect(o.apres.sessionSansEmpreinte).toBe(true);
  });

  // V1-D-1 — corrigé (lot 2). Le lien de réponse à une proposition de mission,
  // envoyé à l'ancienne adresse, ne désigne plus la mission après le changement :
  // le jeton porte l'empreinte de l'adresse (`signerJetonMission`), relue par
  // `lireMissionParJeton`. Un lien émis AVANT la correction (sans empreinte) tombe
  // aussi, dès qu'un changement d'adresse est enregistré sur la fiche.
  test("V1-D-1 — le lien de réponse à une mission est mort", () => {
    expect(o.apres.mission).toBe(false);
    expect(o.apres.missionSansEmpreinte).toBe(false);
  });

  // V1-D-2 — gravité faible. Le lien du dossier déjà envoyé (« à vérifier »)
  // affiche encore la page « Dossier reçu » (prénom) après le changement.
  // Probable : src/server/qualiopi/formateurs-independants/dossier.ts ~l. 212-219
  // (tolérance de la version précédente) combinée à
  // changement-email-console.ts (`donneesChangementEmail`, une seule version).
  test.fixme("V1-D-2 — le lien du dossier « reçu » est mort", () => {
    expect(o.apres.dossierB).toBe(false);
  });
});
