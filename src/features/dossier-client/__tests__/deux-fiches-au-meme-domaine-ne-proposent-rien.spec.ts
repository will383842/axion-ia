// @vitest-environment node
/**
 * ⛔ Deux fiches au même domaine (ou au même SIREN) ne proposent RIEN
 * (vérification V1, V1-06).
 *
 * `calculerProposition` prenait la première fiche venue (`find`, lecture sans
 * ordre) : deux filiales au même domaine professionnel, ou deux fiches
 * vivantes au même SIREN après un « Défaire », et le rendez-vous était proposé
 * à l'une ou à l'autre au hasard, sans que l'écran le dise. Ambiguïté = aucune
 * proposition : le rendez-vous reste « à classer », Will choisit.
 *
 * Mutation qui rougit : revenir à `fiches.find(...)` pour le domaine ou pour
 * le SIREN de la demande liée.
 * Contre-témoin : une seule fiche au domaine (ou au SIREN) est proposée.
 */

import { describe, expect, it } from "vitest";

import { calculerProposition, type FicheConnuePourRattachement } from "../rattacher";

/** SIREN inventé, à la clé de Luhn juste (aucune entreprise réelle). */
const SIREN = "123456782";

function ficheDe(id: string, p: Partial<FicheConnuePourRattachement> = {}) {
  return {
    id,
    raisonSociale: `Filiale fictive ${id}`,
    siren: null,
    contactEmail: null,
    empreintes: [],
    domainesPro: [],
    ...p,
  } satisfies FicheConnuePourRattachement;
}

const SANS_INDICE = {
  emailTitulaire: null,
  emailsInvites: [],
  entrepriseDeclaree: null,
  clientDuReport: null,
  demandeLiee: null,
};

describe("⛔ deux fiches au même domaine ou au même SIREN ne proposent rien", () => {
  it("même domaine professionnel sur deux fiches : aucune proposition", () => {
    const indices = { ...SANS_INDICE, emailTitulaire: "personne@groupe-fictif.fr" };
    const fiches = [
      ficheDe("f1", { domainesPro: ["groupe-fictif.fr"] }),
      ficheDe("f2", { domainesPro: ["groupe-fictif.fr"] }),
    ];
    expect(calculerProposition(indices, fiches)).toBeNull();
  });

  it("même SIREN de la demande liée sur deux fiches : aucune proposition", () => {
    const indices = {
      ...SANS_INDICE,
      demandeLiee: { siren: SIREN, emailHash: null, raisonSociale: null },
    };
    const fiches = [ficheDe("f1", { siren: SIREN }), ficheDe("f2", { siren: SIREN })];
    expect(calculerProposition(indices, fiches)).toBeNull();
  });

  it("contre-témoin : une seule fiche au domaine, une seule au SIREN, elles sont proposées", () => {
    expect(
      calculerProposition({ ...SANS_INDICE, emailTitulaire: "personne@groupe-fictif.fr" }, [
        ficheDe("f1", { domainesPro: ["groupe-fictif.fr"] }),
        ficheDe("f2", { domainesPro: ["autre-fictif.fr"] }),
      ]),
    ).toEqual({ clientId: "f1", motif: "domaine_email" });
    expect(
      calculerProposition(
        { ...SANS_INDICE, demandeLiee: { siren: SIREN, emailHash: null, raisonSociale: null } },
        [ficheDe("f1", { siren: SIREN }), ficheDe("f2")],
      ),
    ).toEqual({ clientId: "f1", motif: "demande_liee" });
  });
});
