/**
 * ⛔ SANS DATE DE PRÉAVIS, TOUT CLIENT ACTIF EST REFUSÉ (PR 5 ; décision de
 * Will du 29/09).
 *
 * `PREAVIS_SOUS_TRAITANTS` vaut `null` tant que le préavis n'est pas envoyé :
 * alors AUCUN client actif ne s'enregistre, quelle que soit la date, et le
 * bandeau dit qu'il n'y a pas encore de date. Chaque relation de la règle B3
 * suffit à rendre actif (on en essaie deux de natures différentes).
 *
 * Mutation qui rougit : traiter `preavis === null` comme « pas de préavis,
 * donc libre » dans `preavisEnCours` → 409 devient 200.
 * Contre-témoin : la déclaration réelle vaut aujourd'hui `null` — le 3e cas
 * s'exécute sans date injectée, sur la vraie constante.
 * Angle mort : le jour où la date est posée, le 3e cas ne décrit plus l'état
 * réel ; il vérifie alors seulement que la déclaration est lue.
 */

import { describe, expect, it } from "vitest";

import { PREAVIS_SOUS_TRAITANTS, preavisEnCours } from "../preavis-clients-actifs";
import { listerRencontresDuJour } from "../rencontres-du-jour";
import { creerOuReprendreSession } from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  JOUR,
  semerAppareil,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

function clientActifPar(relation: string) {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const client = db.semer("client", { raisonSociale: "Client Actif Fictif" });
  db.semer(relation, { clientId: client["id"] });
  const { rencontreId } = semerRencontreTest(db, {
    clientId: String(client["id"]),
    estTestInterne: false,
  });
  return { db, appareil: { id: appareilId, adminUserId }, rencontreId };
}

describe("⛔ sans date de préavis, tout client actif est refusé", () => {
  it("préavis non posé : « en cours » pour toujours", () => {
    expect(preavisEnCours(T0, null)).toBe(true);
    expect(preavisEnCours(new Date(T0.getTime() + 3650 * JOUR), null)).toBe(true);
  });

  it.each(["devis", "trainingSession"])(
    "client actif par « %s », préavis nul : 409 et bandeau sans date",
    async (relation) => {
      const { db, appareil, rencontreId } = clientActifPar(relation);
      const r = await creerOuReprendreSession(commePrisma(db), {
        appareil,
        corps: corpsSession(rencontreId),
        mode: "ouvert",
        maintenant: new Date(T0.getTime() + 365 * JOUR),
        preavis: null,
      });
      expect(r.statut).toBe(409);
      expect(r.corps["erreur"]).toBe("client_actif_preavis_en_cours");
      expect(String(r.corps["message"])).toMatch(/pas encore envoyé/);
      const liste = await listerRencontresDuJour(commePrisma(db), {
        maintenant: T0,
        mode: "ouvert",
        preavis: null,
      });
      expect(liste[0]?.preavis).toEqual({ finLe: null });
    },
  );

  it("sur la vraie déclaration (aujourd'hui `null`) : refusé aussi", async () => {
    const { db, appareil, rencontreId } = clientActifPar("dossierFinancement");
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId),
      mode: "ouvert",
      maintenant: T0,
    });
    expect(r.statut === 409).toBe(preavisEnCours(T0, PREAVIS_SOUS_TRAITANTS));
    if (PREAVIS_SOUS_TRAITANTS === null) expect(r.statut).toBe(409);
  });
});
