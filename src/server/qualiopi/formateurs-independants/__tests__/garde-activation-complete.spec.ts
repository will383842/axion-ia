/**
 * Règle COMPLÈTE d'activation (lot L9, 08c §a) — pure, sans base.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { VERSION_CONTRAT_CADRE_AVEC_CODE } from "@/server/qualiopi/documents/signature/contrat-cadre-signature";

import {
  MANQUES_COMPLETS,
  VERSION_MINIMALE_CONTRAT_INDEPENDANT,
  peutActiverFormateurIndependantComplet,
  regleActivationApplicable,
  type FaitsActivationComplete,
} from "../garde-activation-complete";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");
const JOUR = 24 * 3600 * 1000;
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);
const ATTESTATION = "11111111-1111-4111-8111-111111111111";

function complet(extra: Partial<FaitsActivationComplete> = {}): FaitsActivationComplete {
  return {
    statut: "sous_traitant",
    finCollaborationAt: null,
    siret: "12345678900011",
    ndaVerifieListeAt: ilYa(2),
    regimeTvaHonoraires: "franchise",
    ibanPresent: true,
    declarationsVersion: "1",
    habilitationsActives: 1,
    contrats: [{ version: 3, statutSignature: "signee", annuleeAt: null, siret: "12345678900011" }],
    controles: [
      {
        verdict: "vert",
        source: "registre_entreprises+liste_of",
        verifieAt: ilYa(1),
        createdAt: ilYa(1),
        siret: "12345678900011",
      },
    ],
    pieces: [
      {
        id: ATTESTATION,
        type: "attestation_vigilance_urssaf",
        statutValidation: "valide",
        fichierUrl: "r2://a.pdf",
        dateEmission: ilYa(10),
        dateExpiration: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "cv",
        statutValidation: "valide",
        fichierUrl: "r2://cv.pdf",
        dateEmission: ilYa(100),
        dateExpiration: null,
      },
    ],
    preuvesVigilance: [{ trainerDocumentId: ATTESTATION, resultat: "valide" }],
    ...extra,
  };
}

describe("peutActiverFormateurIndependantComplet", () => {
  it("un dossier complet est activable", () => {
    expect(peutActiverFormateurIndependantComplet(complet(), MAINTENANT)).toEqual({
      activable: true,
    });
  });

  it("la version minimale est celle de la signature avec code (L7c)", () => {
    expect(VERSION_MINIMALE_CONTRAT_INDEPENDANT).toBe(VERSION_CONTRAT_CADRE_AVEC_CODE);
  });

  it("un dossier vide liste les manques dans l'ordre des huit conditions", () => {
    const v = peutActiverFormateurIndependantComplet(
      complet({
        siret: null,
        ndaVerifieListeAt: null,
        regimeTvaHonoraires: null,
        ibanPresent: false,
        declarationsVersion: null,
        habilitationsActives: 0,
        contrats: [],
        controles: [],
        pieces: [],
        preuvesVigilance: [],
        finCollaborationAt: ilYa(1),
      }),
      MAINTENANT,
    );
    expect(v).toEqual({
      activable: false,
      manques: [
        MANQUES_COMPLETS.contrat,
        MANQUES_COMPLETS.controle,
        MANQUES_COMPLETS.siret,
        MANQUES_COMPLETS.nda,
        MANQUES_COMPLETS.vigilance,
        MANQUES_COMPLETS.cv,
        MANQUES_COMPLETS.tva,
        MANQUES_COMPLETS.iban,
        MANQUES_COMPLETS.declarations,
        MANQUES_COMPLETS.habilitation,
        MANQUES_COMPLETS.fin,
      ],
    });
  });

  it("un contrat seulement signé par le formateur (partielle) ne suffit pas", () => {
    const v = peutActiverFormateurIndependantComplet(
      complet({ contrats: [{ version: 3, statutSignature: "partielle", annuleeAt: null }] }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.contrat] });
  });

  it("un contrat v2 contresigné ou un v3 annulé ne suffit pas", () => {
    for (const c of [
      { version: 2, statutSignature: "signee", annuleeAt: null },
      { version: 3, statutSignature: "signee", annuleeAt: ilYa(1) },
    ]) {
      expect(
        peutActiverFormateurIndependantComplet(complet({ contrats: [c] }), MAINTENANT),
      ).toEqual({ activable: false, manques: [MANQUES_COMPLETS.contrat] });
    }
  });

  it("un rouge, un orange non validé ou un contrôle de plus de 30 jours refusent", () => {
    const base = complet().controles[0]!;
    for (const controles of [
      [{ ...base, verdict: "rouge" as const }],
      [{ ...base, verdict: "orange" as const }],
      [{ ...base, verifieAt: ilYa(31), createdAt: ilYa(31) }],
    ]) {
      const v = peutActiverFormateurIndependantComplet(complet({ controles }), MAINTENANT);
      expect(v.activable).toBe(false);
      if (!v.activable) expect(v.manques).toContain(MANQUES_COMPLETS.controle);
    }
  });

  it("un orange VALIDÉ par un humain passe, numéro de déclaration compris", () => {
    const base = complet().controles[0]!;
    const v = peutActiverFormateurIndependantComplet(
      complet({
        ndaVerifieListeAt: null,
        controles: [
          { ...base, verdict: "orange", createdAt: ilYa(1) },
          {
            ...base,
            verdict: "orange",
            source: "validation_administrateur",
            createdAt: new Date(ilYa(1).getTime() + 1000),
          },
        ],
      }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: true });
  });

  it("le SIRET de la fiche doit être celui du dernier contrôle", () => {
    const v = peutActiverFormateurIndependantComplet(
      complet({
        siret: "99999999900011",
        // Contrat au SIRET de la fiche : seul l'écart avec le contrôle est en cause.
        contrats: [
          { version: 3, statutSignature: "signee", annuleeAt: null, siret: "99999999900011" },
        ],
      }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.siret] });
  });

  it("C4 — le SIRET inscrit dans le contrat contresigné doit être celui de la fiche", () => {
    // La fiche a changé de SIRET après la contresignature (fiche ET contrôle à jour) :
    // le contrat porte encore l'ancienne entreprise.
    const nouveau = "98765432100022";
    const v = peutActiverFormateurIndependantComplet(
      complet({
        siret: nouveau,
        controles: [
          {
            verdict: "vert",
            source: "registre_entreprises+liste_of",
            verifieAt: ilYa(1),
            createdAt: ilYa(1),
            siret: nouveau,
          },
        ],
      }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.siretContrat] });
  });

  it("C4 — un contrat sans SIRET lisible est refusé (garde fermée)", () => {
    for (const siret of [null, undefined]) {
      const v = peutActiverFormateurIndependantComplet(
        complet({ contrats: [{ version: 3, statutSignature: "signee", annuleeAt: null, siret }] }),
        MAINTENANT,
      );
      expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.siretContrat] });
    }
  });

  it("C4 — sans contrat contresigné, un seul manque (pas de doublon SIRET)", () => {
    const v = peutActiverFormateurIndependantComplet(complet({ contrats: [] }), MAINTENANT);
    expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.contrat] });
  });

  it("une attestation validée SANS preuve de vérification ne suffit pas", () => {
    const v = peutActiverFormateurIndependantComplet(complet({ preuvesVigilance: [] }), MAINTENANT);
    expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.vigilance] });
  });

  it("une preuve « invalide » ne prouve rien", () => {
    const v = peutActiverFormateurIndependantComplet(
      complet({ preuvesVigilance: [{ trainerDocumentId: ATTESTATION, resultat: "invalide" }] }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.vigilance] });
  });

  it("un CV de plus de 24 mois, non validé ou sans fichier ne suffit pas", () => {
    const cv = complet().pieces[1]!;
    for (const p of [
      { ...cv, dateEmission: ilYa(800) },
      { ...cv, statutValidation: "en_attente" as const },
      { ...cv, fichierUrl: null },
    ]) {
      const v = peutActiverFormateurIndependantComplet(
        complet({ pieces: [complet().pieces[0]!, p] }),
        MAINTENANT,
      );
      expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.cv] });
    }
  });

  it("salariés et dirigeants : hors périmètre, activables sans examen", () => {
    for (const statut of ["salarie", "dirigeant"]) {
      expect(
        peutActiverFormateurIndependantComplet(
          complet({ statut, contrats: [], controles: [] }),
          MAINTENANT,
        ),
      ).toEqual({ activable: true });
    }
  });

  it("un statut inconnu ou une donnée illisible ferment la garde", () => {
    expect(peutActiverFormateurIndependantComplet(complet({ statut: "?" }), MAINTENANT)).toEqual({
      activable: false,
      manques: [MANQUES_COMPLETS.statutInconnu],
    });
    const v = peutActiverFormateurIndependantComplet(
      complet({ controles: null as never }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES_COMPLETS.erreur] });
  });
});

describe("regleActivationApplicable", () => {
  it("interrupteurs absents (position sûre) : la règle PROVISOIRE de S1, comme aujourd'hui", () => {
    expect(regleActivationApplicable({ activation_auto: false, garde_activation: true })).toBe(
      "provisoire",
    );
  });

  it("activation_auto allumé : la règle complète", () => {
    expect(regleActivationApplicable({ activation_auto: true, garde_activation: true })).toBe(
      "complete",
    );
  });

  it("garde_activation coupée : la règle provisoire", () => {
    expect(regleActivationApplicable({ activation_auto: true, garde_activation: false })).toBe(
      "provisoire",
    );
  });
});
