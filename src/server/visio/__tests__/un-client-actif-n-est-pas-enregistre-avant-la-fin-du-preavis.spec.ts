/**
 * ⛔ UN CLIENT ACTIF N'EST PAS ENREGISTRÉ AVANT LA FIN DU PRÉAVIS (PR 5 ;
 * décision de Will du 29/09, LOTS-EXECUTION §0, ligne « Préavis »).
 *
 * Un client ACTIF (règle B3 : ici, un devis) dont la rencontre est RANGÉE chez
 * lui (`clientId`) : tant que `aujourd'hui < finLe`, `POST sessions` répond
 * 409 `client_actif_preavis_en_cours` avec la date, en visio comme en dictée ;
 * `POST sessions/[id]/accord` aussi (rencontre rangée chez lui après le
 * démarrage) ; la liste du jour porte le bandeau. Le lendemain de `finLe`, il
 * s'enregistre.
 *
 * Mutation qui rougit : retirer le contrôle `blocagePreavis` de
 * `motifDeRefus` → 1er cas (200 au lieu de 409) ; le retirer de
 * `declarerAccord` → 3e cas.
 * Contre-témoin : même client après `finLe` → accepté.
 * Angle mort : la date réelle (`PREAVIS_SOUS_TRAITANTS`) est posée à la main
 * après l'envoi ; ici, la règle, avec une date injectée.
 */

import { describe, expect, it } from "vitest";

import { listerRencontresDuJour } from "../liste-enregistreur";
import { creerOuReprendreSession, declarerAccord } from "../sessions";
import { CODE_REFUS_PREAVIS, refusPourPreavis } from "../visio-annonce";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  JOUR,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const PREAVIS = {
  envoyeLe: new Date(T0.getTime() - 10 * JOUR).toISOString(),
  finLe: new Date(T0.getTime() + 20 * JOUR).toISOString(),
};

function clientActif() {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const client = db.semer("client", { raisonSociale: "Client Actif Fictif" });
  db.semer("devis", { clientId: client["id"] });
  const { rencontreId } = semerRencontreTest(db, {
    clientId: String(client["id"]),
    estTestInterne: false,
  });
  return { db, appareil: { id: appareilId, adminUserId }, rencontreId };
}

describe("⛔ un client actif n'est pas enregistré avant la fin du préavis", () => {
  it("POST sessions : 409 client_actif_preavis_en_cours, date dans le message, rien de créé", async () => {
    const { db, appareil, rencontreId } = clientActif();
    for (const nature of ["visio", "dictee"] as const) {
      const r = await creerOuReprendreSession(commePrisma(db), {
        appareil,
        corps: corpsSession(rencontreId, { nature }),
        mode: "ouvert",
        maintenant: T0,
        preavis: PREAVIS,
      });
      expect(r.statut).toBe(409);
      expect(r.corps["erreur"]).toBe("client_actif_preavis_en_cours");
      expect(String(r.corps["message"])).toMatch(/avant le \d{2}\/\d{2}\/2026 : notes à la main/);
    }
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("la liste du jour porte le bandeau avec la date de fin", async () => {
    const { db } = clientActif();
    const liste = await listerRencontresDuJour(commePrisma(db), {
      maintenant: T0,
      mode: "ouvert",
      preavis: PREAVIS,
    });
    expect(liste[0]?.preavis).toEqual({ finLe: new Date(PREAVIS.finLe).toISOString() });
  });

  it("POST accord : une rencontre rangée chez un client actif après le démarrage est refusée", async () => {
    const { db, appareil, rencontreId } = clientActif();
    const id = semerEnregistrement(db, {
      rencontreId,
      appareilId: appareil.id,
      statut: "accord_en_attente",
    });
    const r = await declarerAccord(commePrisma(db), {
      appareil,
      enregistrementId: id,
      corps: {
        accordLe: T0.toISOString(),
        nbParticipants: 2,
        versionTexte: "annonce-v1",
        nouvellePersonne: false,
      },
      maintenant: T0,
      preavis: PREAVIS,
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("client_actif_preavis_en_cours");
    expect(db.lignes("enregistrement")[0]?.["statut"]).toBe("accord_en_attente");
    expect(db.lignes("enregistrementConsentement")).toHaveLength(0);
  });

  it("contre-témoin : le lendemain de la fin du préavis, il s'enregistre", async () => {
    const { db, appareil, rencontreId } = clientActif();
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId),
      mode: "ouvert",
      maintenant: new Date(Date.parse(PREAVIS.finLe) + JOUR),
      preavis: PREAVIS,
    });
    expect(r.statut).toBe(200);
    expect(r.corps["statut"]).toBe("accord_en_attente");
  });
});

// ── La règle pure, telle que `visio-annonce.ts` la déclare (source unique, D2 ;
//    cas repris de main, #1226) : les routes ci-dessus la branchent.
const PREAVIS_FIXE = { envoyeLe: "2026-09-30T08:00:00.000Z", finLe: "2026-10-30T08:00:00.000Z" };
const ACTIF = { valide: true, actif: true };

describe("un client actif n'est pas enregistré avant la fin du préavis (règle pure)", () => {
  it("🔴 veille de la fin : refus, code 409 et date lisible pour Will", () => {
    const r = refusPourPreavis(ACTIF, new Date("2026-10-30T07:59:59.000Z"), PREAVIS_FIXE);
    expect(r).toEqual({
      refuse: true,
      code: CODE_REFUS_PREAVIS,
      message: "Pas d'enregistrement pour ce client avant le 30/10/2026 : notes à la main.",
    });
  });

  it("🔴 une date de fin illisible refuse (jamais d'ouverture par défaut)", () => {
    const r = refusPourPreavis(ACTIF, new Date("2027-01-01"), {
      ...PREAVIS_FIXE,
      finLe: "n'importe",
    });
    expect(r.refuse).toBe(true);
  });

  it("🔑 CONTRE-TÉMOIN : préavis échu, le client actif est enregistrable", () => {
    expect(refusPourPreavis(ACTIF, new Date("2026-10-30T08:00:00.000Z"), PREAVIS_FIXE)).toEqual({
      refuse: false,
    });
  });

  it("🔑 CONTRE-TÉMOIN : un client validé mais inactif n'attend pas le préavis", () => {
    expect(
      refusPourPreavis({ valide: true, actif: false }, new Date("2026-10-01"), PREAVIS_FIXE).refuse,
    ).toBe(false);
  });
});
