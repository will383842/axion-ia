// L6 — S3 : relances du dossier (F9). Une déclaration du registre des campagnes, éteinte
// tant que `dossier_en_ligne` ET `relances_auto` ne sont pas TOUS DEUX allumés.
import { describe, expect, it } from "vitest";

import { decisionCampagne } from "@/lib/relances/campagne";
import { REGISTRE_CAMPAGNES } from "@/server/relances/registre-campagnes";

import {
  CAMPAGNE_RELANCE_DOSSIER,
  REGLE_RELANCE_DOSSIER,
  faitsRelanceDossier,
  type LigneRelanceDossier,
} from "../relance-dossier";
import { jetonDossierFormateurValide } from "../jeton-dossier";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JOUR = 86_400_000;
// Un mardi, 10 h à Paris.
const ORIGINE = new Date("2026-10-13T08:00:00.000Z");

function ligne(p: Partial<LigneRelanceDossier> = {}): LigneRelanceDossier {
  return {
    id: ID,
    email: "marie@exemple.fr",
    prenom: "Marie",
    accesVersion: 2,
    dossierModifiable: true,
    fermee: false,
    origine: { id: "0b1c2d3e-0000-4000-8000-000000000001", at: ORIGINE },
    relances: [],
    adresseMorte: false,
    opposition: false,
    ...p,
  };
}

function decision(l: LigneRelanceDossier, maintenant: Date) {
  const f = faitsRelanceDossier(l, maintenant)!;
  return decisionCampagne({ etat: f.etat, maintenant, regle: REGLE_RELANCE_DOSSIER });
}

describe("relances du dossier (S3, F9)", () => {
  it("déclarée au registre, éteinte derrière dossier_en_ligne ET relances_auto", () => {
    expect(REGISTRE_CAMPAGNES).toContain(CAMPAGNE_RELANCE_DOSSIER);
    expect(CAMPAGNE_RELANCE_DOSSIER.interrupteurs).toEqual(["dossier_en_ligne", "relances_auto"]);
    expect(CAMPAGNE_RELANCE_DOSSIER.gabarit).toBe("formateur-dossier-relance");
  });

  it("rien avant J+3 ; J+3 puis J+7 ; plus rien après deux relances", () => {
    expect(decision(ligne(), new Date(ORIGINE.getTime() + 2 * JOUR)).envoyer).toBe(false);
    const j3 = decision(ligne(), new Date(ORIGINE.getTime() + 3 * JOUR));
    expect(j3).toMatchObject({ envoyer: true, etape: "j3" });
    const j7 = decision(
      ligne({ relances: [new Date(ORIGINE.getTime() + 3 * JOUR)] }),
      new Date(ORIGINE.getTime() + 7 * JOUR),
    );
    expect(j7).toMatchObject({ envoyer: true, etape: "j7" });
    const fin = decision(
      ligne({
        relances: [new Date(ORIGINE.getTime() + 3 * JOUR), new Date(ORIGINE.getTime() + 7 * JOUR)],
      }),
      new Date(ORIGINE.getTime() + 9 * JOUR),
    );
    expect(fin.envoyer).toBe(false);
  });

  it("rien après 14 jours", () => {
    expect(decision(ligne(), new Date(ORIGINE.getTime() + 15 * JOUR)).envoyer).toBe(false);
  });

  it("dossier envoyé, fiche fermée, adresse morte, opposition, effacée : arrêt", () => {
    const t = new Date(ORIGINE.getTime() + 3 * JOUR);
    for (const p of [
      { dossierModifiable: false },
      { fermee: true },
      { adresseMorte: true },
      { opposition: true },
      { email: "x@erased.local" },
    ]) {
      expect(decision(ligne(p), t).envoyer).toBe(false);
    }
  });

  it("sans lien envoyé, pas de relance ; le lien est celui de la version COURANTE", () => {
    expect(faitsRelanceDossier(ligne({ origine: null }), ORIGINE)).toBeNull();
    const f = faitsRelanceDossier(ligne(), ORIGINE)!;
    const jeton = String(f.payload.lien).split("/").at(-1)!;
    expect(jetonDossierFormateurValide(ID, 2, jeton, ORIGINE)).toBe(true);
    expect(jetonDossierFormateurValide(ID, 1, jeton, ORIGINE)).toBe(false);
    expect(f.destinataire).toBe("marie@exemple.fr");
    expect(f.personneId).toBe(ID);
  });
});
