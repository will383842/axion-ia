/**
 * ⛔ DEUX FICHES DE MÊME SIREN NE PEUVENT PAS ÊTRE CRÉÉES (plan §3.17, B18).
 *
 * Par la vraie porte `creerOuRetrouverClient`, sur une base en mémoire :
 *   · même SIREN qu'une fiche vivante → REFUS, aucune écriture, même avec un
 *     motif de « créer quand même » (il n'existe pas pour ce signal) ;
 *   · le verrou consultatif par SIREN est pris AVANT la recherche ;
 *   · le SIREN dérivé du SIRET suffit à bloquer (c'est l'action qui dérive).
 *
 * Les deux créations SIMULTANÉES (deux connexions) sont prouvées sur une vraie
 * base, en Gate D (`scripts/ci/gate-d-visio.ts`).
 *
 * Mutation qui fait rougir : retirer le `return { statut: "refuse_siren" … }`
 * de la porte, ou le signal `siren` de `signalEntre`.
 * Contre-témoin : une fiche ABSORBÉE par une fusion vivante ne bloque pas ; un
 * SIREN différent ne bloque pas.
 * Angle mort : un SIREN saisi faux (autre entreprise) ne bloque rien — la clé
 * de Luhn est contrôlée à la saisie, pas l'existence de l'entreprise.
 */

import { describe, expect, it } from "vitest";
import { creerOuRetrouverClient } from "../porte-client";
import { baseEnMemoire, commePrisma, ficheClient } from "./_base-en-memoire";

// Fictif, clé de Luhn valide (le dépôt est public : aucun vrai SIREN).
const SIREN = "732829320";

function base() {
  const existante = ficheClient({
    numero: "AXI-CLI-004",
    raisonSociale: "Martin Industrie",
    siren: SIREN,
  });
  return { db: baseEnMemoire({ clients: [existante] }), existante };
}

describe("⛔ deux fiches de même SIREN ne peuvent pas être créées", () => {
  it("même SIREN → refus nommant la fiche existante, rien n'est écrit", async () => {
    const { db } = base();
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Martin Industrie SAS", siren: SIREN },
      null,
      { parAdminId: "admin-1" },
    );
    expect(r.statut).toBe("refuse_siren");
    if (r.statut !== "refuse_siren") return;
    expect(r.fiche.numero).toBe("AXI-CLI-004");
    expect(r.message).toContain("AXI-CLI-004");
    expect(db.etat.clients).toHaveLength(1);
  });

  it("un motif de « créer quand même » n'y change rien", async () => {
    const { db } = base();
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Autre nom", siren: SIREN },
      null,
      { parAdminId: "admin-1", motifCreationForcee: "je veux absolument une seconde fiche" },
    );
    expect(r.statut).toBe("refuse_siren");
    expect(db.etat.clients).toHaveLength(1);
    expect(db.etat.journal).toEqual([]);
  });

  it("le verrou par SIREN est pris avant la recherche", async () => {
    const { db } = base();
    await creerOuRetrouverClient(commePrisma(db), { raisonSociale: "X", siren: SIREN }, null, {
      parAdminId: null,
    });
    expect(db.verrous[0]).toContain("pg_advisory_xact_lock(hashtext(");
    expect(db.verrous[0]).toContain(`client-siren:${SIREN}`);
  });

  it("contre-témoin : une fiche absorbée par une fusion vivante ne bloque pas", async () => {
    const { db, existante } = base();
    db.etat.fusionsVivantes.add(existante.id);
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Martin Industrie", siren: SIREN },
      null,
      { parAdminId: null },
    );
    expect(r.statut).toBe("cree");
    expect(db.etat.clients).toHaveLength(2);
  });

  it("contre-témoin : un SIREN différent crée la fiche", async () => {
    const { db } = base();
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Autre société", siren: "552100554" },
      null,
      { parAdminId: null },
    );
    expect(r.statut).toBe("cree");
    if (r.statut !== "cree") return;
    expect(r.numero).toBe("AXI-CLI-005");
  });
});
