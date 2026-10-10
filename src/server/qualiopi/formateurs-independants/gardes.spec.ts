/**
 * Garde provisoire d'activation (lot S1, ADR 0066) — pure, sans base.
 */

import { describe, it, expect } from "vitest";
import {
  echeanceCalculee,
  MANQUES,
  peutActiverFormateurIndependant,
  pieceGardeeProbante,
  type FormateurPourActivation,
} from "./gardes";
import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";

const MAINTENANT = new Date("2026-10-10T10:00:00Z");
const JOUR = 24 * 3600 * 1000;
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);

function piece(
  type: DocumentConformite["type"],
  extra: Partial<DocumentConformite> = {},
): DocumentConformite {
  return {
    type,
    statutValidation: "valide",
    fichierUrl: "https://stockage.example/piece.pdf",
    dateEmission: ilYa(20),
    dateExpiration: null,
    ...extra,
  };
}

function complet(extra: Partial<FormateurPourActivation> = {}): FormateurPourActivation {
  return {
    statut: "sous_traitant",
    sousTraitantVerifieAt: ilYa(5),
    sousTraitantNda: "84691234569",
    sousTraitantContratSigneAt: ilYa(4),
    pieces: [piece("attestation_vigilance_urssaf"), piece("kbis_avis_sirene")],
    ...extra,
  };
}

describe("peutActiverFormateurIndependant", () => {
  it("un dossier complet est activable", () => {
    expect(peutActiverFormateurIndependant(complet(), MAINTENANT)).toEqual({ activable: true });
  });

  it("un dossier VIDE liste les cinq manques, dans l'ordre", () => {
    const v = peutActiverFormateurIndependant(
      {
        statut: "sous_traitant",
        sousTraitantVerifieAt: null,
        sousTraitantNda: null,
        sousTraitantContratSigneAt: null,
        pieces: [],
      },
      MAINTENANT,
    );
    expect(v).toEqual({
      activable: false,
      manques: [
        MANQUES.controleRegistre,
        MANQUES.nda,
        MANQUES.contrat,
        MANQUES.vigilance,
        MANQUES.sirene,
      ],
    });
  });

  it("un NDA fait d'espaces ne compte pas", () => {
    const v = peutActiverFormateurIndependant(complet({ sousTraitantNda: "   " }), MAINTENANT);
    expect(v).toEqual({ activable: false, manques: [MANQUES.nda] });
  });

  it("une attestation de vigilance de plus de 6 mois bloque, même « valable jusqu'en 2099 »", () => {
    const v = peutActiverFormateurIndependant(
      complet({
        pieces: [
          piece("attestation_vigilance_urssaf", {
            dateEmission: ilYa(190),
            dateExpiration: new Date("2099-12-31T00:00:00Z"),
          }),
          piece("kbis_avis_sirene"),
        ],
      }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES.vigilance] });
  });

  it("une pièce émise dans le futur ne prouve rien", () => {
    const v = peutActiverFormateurIndependant(
      complet({
        pieces: [
          piece("attestation_vigilance_urssaf", { dateEmission: new Date("2099-01-01") }),
          piece("kbis_avis_sirene"),
        ],
      }),
      MAINTENANT,
    );
    expect(v.activable).toBe(false);
  });

  it("une pièce sans date d'émission ne prouve rien", () => {
    const v = peutActiverFormateurIndependant(
      complet({
        pieces: [
          piece("attestation_vigilance_urssaf"),
          piece("kbis_avis_sirene", { dateEmission: null }),
        ],
      }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES.sirene] });
  });

  it("une pièce en attente ou rejetée (archivée comprise) ne compte pas", () => {
    const v = peutActiverFormateurIndependant(
      complet({
        pieces: [
          piece("attestation_vigilance_urssaf", { statutValidation: "en_attente" }),
          piece("kbis_avis_sirene", { statutValidation: "rejete" }),
        ],
      }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES.vigilance, MANQUES.sirene] });
  });

  it("un avis SIRENE de plus de 3 mois bloque", () => {
    const v = peutActiverFormateurIndependant(
      complet({
        pieces: [
          piece("attestation_vigilance_urssaf"),
          piece("kbis_avis_sirene", { dateEmission: ilYa(100) }),
        ],
      }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES.sirene] });
  });

  it("un contrat signé « demain » ne compte pas", () => {
    const v = peutActiverFormateurIndependant(
      complet({ sousTraitantContratSigneAt: new Date(MAINTENANT.getTime() + JOUR) }),
      MAINTENANT,
    );
    expect(v).toEqual({ activable: false, manques: [MANQUES.contrat] });
  });

  it.each(["salarie", "dirigeant"])(
    "un %s est activable sans aucune pièce (INCHANGÉ)",
    (statut) => {
      const v = peutActiverFormateurIndependant(
        {
          statut,
          sousTraitantVerifieAt: null,
          sousTraitantNda: null,
          sousTraitantContratSigneAt: null,
          pieces: [],
        },
        MAINTENANT,
      );
      expect(v).toEqual({ activable: true });
    },
  );

  it("un statut inconnu échoue FERMÉ", () => {
    const v = peutActiverFormateurIndependant(complet({ statut: "stagiaire" }), MAINTENANT);
    expect(v).toEqual({ activable: false, manques: [MANQUES.statutInconnu] });
  });

  it("une donnée malformée échoue FERMÉE au lieu de lever", () => {
    const v = peutActiverFormateurIndependant(
      complet({ pieces: null as unknown as DocumentConformite[] }),
      MAINTENANT,
    );
    expect(v.activable).toBe(false);
  });
});

describe("échéances calculées", () => {
  it("vigilance : émission + 6 mois ; SIRENE : émission + 3 mois", () => {
    const e = new Date("2026-04-15T00:00:00Z");
    expect(echeanceCalculee("attestation_vigilance_urssaf", e)).toEqual(
      new Date("2026-10-15T00:00:00Z"),
    );
    expect(echeanceCalculee("kbis_avis_sirene", e)).toEqual(new Date("2026-07-15T00:00:00Z"));
    expect(echeanceCalculee("kbis_avis_sirene", null)).toBeNull();
  });

  it("l'échéance la plus proche l'emporte : une date saisie plus courte s'applique", () => {
    const p = piece("attestation_vigilance_urssaf", { dateExpiration: ilYa(1) });
    expect(pieceGardeeProbante(p, "attestation_vigilance_urssaf", MAINTENANT)).toBe(false);
  });
});
