/**
 * Étape 3 (C4), décision (b) de Will — la règle PROVISOIRE d'activation suit la porte de
 * contresignature :
 *   - l'attestation URSSAF n'est exigée qu'au seuil de vigilance (`vigilanceExigible`) ;
 *   - l'avis SIRENE / extrait Kbis n'est plus une pièce exigée (le registre public est
 *     relu à la contresignature : c'est lui qui prouve l'entreprise active).
 * Cumul absent ou illisible : l'attestation reste exigée (garde fermée).
 */

import { describe, expect, it } from "vitest";

import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";

import { MANQUES, peutActiverFormateurIndependant, type FormateurPourActivation } from "../gardes";

const MAINTENANT = new Date("2026-10-14T10:00:00Z");
const JOUR = 24 * 3600 * 1000;
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);

const attestation: DocumentConformite = {
  type: "attestation_vigilance_urssaf",
  statutValidation: "valide",
  fichierUrl: "r2://a.pdf",
  dateEmission: ilYa(20),
  dateExpiration: null,
};

function sansPiece(extra: Partial<FormateurPourActivation> = {}): FormateurPourActivation {
  return {
    statut: "sous_traitant",
    sousTraitantVerifieAt: ilYa(5),
    sousTraitantNda: "84691234569",
    sousTraitantContratSigneAt: ilYa(4),
    contratsSousTraitance: [{ statutSignature: "signee", annuleeAt: null }],
    finCollaborationAt: null,
    pieces: [],
    ...extra,
  };
}

describe("activation provisoire alignée sur la contresignature", () => {
  it("sous le seuil (2 700 €), sans attestation ni Kbis : activable", () => {
    expect(
      peutActiverFormateurIndependant(sansPiece({ cumulHonorairesHtCents: 270_000 }), MAINTENANT),
    ).toEqual({ activable: true });
  });

  it("à l'approche (4 200 €) : activable (l'attestation est seulement demandée)", () => {
    expect(
      peutActiverFormateurIndependant(sansPiece({ cumulHonorairesHtCents: 420_000 }), MAINTENANT),
    ).toEqual({ activable: true });
  });

  it("au seuil (5 000 €) sans attestation : refusé, avec le seul manque de l'attestation", () => {
    expect(
      peutActiverFormateurIndependant(sansPiece({ cumulHonorairesHtCents: 500_000 }), MAINTENANT),
    ).toEqual({ activable: false, manques: [MANQUES.vigilance] });
  });

  it("au seuil AVEC attestation, sans Kbis : activable", () => {
    expect(
      peutActiverFormateurIndependant(
        sansPiece({ cumulHonorairesHtCents: 680_000, pieces: [attestation] }),
        MAINTENANT,
      ),
    ).toEqual({ activable: true });
  });

  it("cumul absent ou illisible : l'attestation reste exigée (garde fermée)", () => {
    for (const f of [sansPiece(), sansPiece({ cumulHonorairesHtCents: null })]) {
      expect(peutActiverFormateurIndependant(f, MAINTENANT)).toEqual({
        activable: false,
        manques: [MANQUES.vigilance],
      });
    }
  });

  it("le message de la console dit le seuil", () => {
    expect(MANQUES.vigilance).toMatch(/5\s000 € HT/);
  });
});
