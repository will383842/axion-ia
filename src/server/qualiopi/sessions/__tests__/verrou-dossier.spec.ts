/**
 * ADR 0060 — le prédicat du verrou, testé en table.
 *
 * Chaque ligne est un cas que le dirigeant ou le certificateur peut poser :
 * « deux attestations pour A et aucune pour B, c'est clos ? » — non.
 */

import { describe, expect, it } from "vitest";
import {
  etatVerrouDossier,
  manquantsPourClore,
  phaseDossier,
  texteEtatVerrou,
  messageDossierClos,
  type EntreeVerrouDossier,
  type InscriptionVerrouEntree,
  type EvenementDossierEntree,
} from "../verrou-dossier";

const MAINTENANT = new Date("2026-09-30T12:00:00Z");
const REALISEE = new Date("2026-09-10T16:00:00Z");
const ATTEST_A = new Date("2026-09-12T08:00:00Z");
const ATTEST_B = new Date("2026-09-14T08:00:00Z");

function inscription(
  p: Partial<InscriptionVerrouEntree> & { id: string },
): InscriptionVerrouEntree {
  return {
    statut: "presente",
    stagiaire: `Stagiaire ${p.id}`,
    sortieAt: null,
    attestation: { type: "attestation", annuleeAt: null, createdAt: ATTEST_A },
    jetonEmargementValideJusquA: null,
    ...p,
  };
}

function entree(p: Partial<EntreeVerrouDossier> = {}): EntreeVerrouDossier {
  return {
    statut: "realisee",
    realiseeLe: REALISEE,
    inscriptions: [
      inscription({ id: "A" }),
      inscription({
        id: "B",
        attestation: { type: "attestation", annuleeAt: null, createdAt: ATTEST_B },
      }),
    ],
    evenements: [],
    maintenant: MAINTENANT,
    ...p,
  };
}

const reouv = (
  d: string,
  motif = "Correction du nom sur l'attestation",
): EvenementDossierEntree => ({
  type: "reouverture",
  createdAt: new Date(d),
  auteurNom: "Williams Jullin",
  motif,
});
const reverr = (d: string): EvenementDossierEntree => ({
  type: "reverrouillage",
  createdAt: new Date(d),
  auteurNom: "Williams Jullin",
  motif: null,
});

describe("etatVerrouDossier — table des cas", () => {
  const cas: Array<[string, EntreeVerrouDossier, string]> = [
    ["réalisée avec toutes les attestations → clos", entree(), "clos"],
    [
      "une inscription sans attestation → a_recueillir",
      entree({
        inscriptions: [inscription({ id: "A" }), inscription({ id: "B", attestation: null })],
      }),
      "a_recueillir",
    ],
    [
      "attestation annulée → ne compte pas",
      entree({
        inscriptions: [
          inscription({ id: "A" }),
          inscription({
            id: "B",
            attestation: {
              type: "attestation",
              annuleeAt: new Date("2026-09-20"),
              createdAt: ATTEST_B,
            },
          }),
        ],
      }),
      "a_recueillir",
    ],
    [
      "inscription en abandon sans attestation → ne bloque pas",
      entree({
        inscriptions: [
          inscription({ id: "A" }),
          inscription({
            id: "B",
            statut: "abandon",
            attestation: null,
            sortieAt: new Date("2026-09-09"),
          }),
        ],
      }),
      "clos",
    ],
    [
      "inscription exclue sans attestation → ne bloque pas",
      entree({
        inscriptions: [
          inscription({ id: "A" }),
          inscription({ id: "B", statut: "exclu", attestation: null }),
        ],
      }),
      "clos",
    ],
    [
      "jeton d'émargement encore valide → pas clos",
      entree({
        inscriptions: [
          inscription({ id: "A", jetonEmargementValideJusquA: new Date("2026-09-30T20:00:00Z") }),
        ],
      }),
      "a_recueillir",
    ],
    [
      "jeton expiré → ne retient rien",
      entree({
        inscriptions: [
          inscription({ id: "A", jetonEmargementValideJusquA: new Date("2026-09-30T11:00:00Z") }),
        ],
      }),
      "clos",
    ],
    [
      "dernier événement = réouverture → rouvert",
      entree({ evenements: [reouv("2026-09-28T10:00:00Z")] }),
      "rouvert",
    ],
    [
      "réouverture même avec des manques → rouvert",
      entree({
        inscriptions: [inscription({ id: "A", attestation: null })],
        evenements: [reouv("2026-09-28T10:00:00Z")],
      }),
      "rouvert",
    ],
    [
      "réouverture puis reverrouillage → clos",
      entree({ evenements: [reouv("2026-09-28T10:00:00Z"), reverr("2026-09-29T10:00:00Z")] }),
      "clos",
    ],
    [
      "deux réouvertures, reverrouillage entre les deux → rouvert",
      entree({
        evenements: [
          reouv("2026-09-26T10:00:00Z"),
          reverr("2026-09-27T10:00:00Z"),
          reouv("2026-09-28T10:00:00Z"),
        ],
      }),
      "rouvert",
    ],
    ["annulée → hors_parcours", entree({ statut: "annulee" }), "hors_parcours"],
    ["reportée → hors_parcours", entree({ statut: "reportee" }), "hors_parcours"],
    ["planifiée → en_preparation", entree({ statut: "planifiee" }), "en_preparation"],
    ["en cours → en_cours", entree({ statut: "en_cours" }), "en_cours"],
  ];

  it.each(cas)("%s", (_titre, e, attendu) => {
    expect(etatVerrouDossier(e).etat).toBe(attendu);
  });

  it("deux attestations pour A et zéro pour B → PAS clos (rapprochement par inscription)", () => {
    // A porte deux pièces au registre, B aucune : un simple comptage (2 ≥ 2)
    // conclurait « complet ». Le rapprochement par `attestationDocumentId` non.
    const e = entree({
      inscriptions: [inscription({ id: "A" }), inscription({ id: "B", attestation: null })],
    });
    const etat = etatVerrouDossier(e);
    expect(etat.etat).toBe("a_recueillir");
    if (etat.etat !== "a_recueillir") return;
    expect(etat.manquants).toEqual([
      { enrollmentId: "B", stagiaire: "Stagiaire B", raison: "attestation_absente" },
    ]);
  });

  it("une pièce d'un autre type désignée comme attestation ne compte pas", () => {
    const e = entree({
      inscriptions: [
        inscription({
          id: "A",
          attestation: { type: "convocation", annuleeAt: null, createdAt: ATTEST_A },
        }),
      ],
    });
    expect(etatVerrouDossier(e).etat).toBe("a_recueillir");
  });

  it("le manquant est NOMMÉ dans le texte", () => {
    const e = entree({
      inscriptions: [
        inscription({ id: "A" }),
        inscription({ id: "B", stagiaire: "Simone Blanc", attestation: null }),
      ],
    });
    expect(texteEtatVerrou(etatVerrouDossier(e))).toContain("Simone Blanc — attestation à émettre");
  });

  it("clos : depuis = la plus récente des dates réalisée / attestation / sortie", () => {
    const etat = etatVerrouDossier(entree());
    expect(etat).toEqual({ etat: "clos", depuis: ATTEST_B });
    const sortieTardive = new Date("2026-09-20T10:00:00Z");
    const etat2 = etatVerrouDossier(
      entree({
        inscriptions: [
          inscription({ id: "A" }),
          inscription({ id: "C", statut: "abandon", sortieAt: sortieTardive }),
        ],
      }),
    );
    expect(etat2).toEqual({ etat: "clos", depuis: sortieTardive });
  });

  it("réouverture puis reverrouillage : depuis = date du reverrouillage", () => {
    const etat = etatVerrouDossier(
      entree({ evenements: [reouv("2026-09-28T10:00:00Z"), reverr("2026-09-29T10:00:00Z")] }),
    );
    expect(etat).toEqual({ etat: "clos", depuis: new Date("2026-09-29T10:00:00Z") });
  });

  it("rouvert expose par, depuis et motif", () => {
    const etat = etatVerrouDossier(entree({ evenements: [reouv("2026-09-28T10:00:00Z")] }));
    expect(etat).toEqual({
      etat: "rouvert",
      depuis: new Date("2026-09-28T10:00:00Z"),
      par: "Williams Jullin",
      motif: "Correction du nom sur l'attestation",
    });
    expect(texteEtatVerrou(etat)).toContain(
      "28/09/2026 à 12:00 (heure de Paris) par Williams Jullin",
    );
    expect(texteEtatVerrou(etat)).toContain("« Correction du nom sur l'attestation »");
  });

  it("manquantsPourClore ignore les événements (c'est la liste du reverrouillage)", () => {
    const e = entree({
      inscriptions: [inscription({ id: "A", attestation: null })],
      evenements: [reouv("2026-09-28T10:00:00Z")],
    });
    expect(manquantsPourClore(e).map((m) => m.raison)).toEqual(["attestation_absente"]);
  });
});

describe("phaseDossier", () => {
  it.each([
    ["planifiee", { etat: "en_preparation" }, "preparer"],
    ["en_cours", { etat: "en_cours" }, "jour_j"],
    ["realisee", { etat: "a_recueillir", manquants: [] }, "apres"],
    ["realisee", { etat: "rouvert", depuis: MAINTENANT, par: "X", motif: "y" }, "apres"],
    ["realisee", { etat: "clos", depuis: MAINTENANT }, "cloturee"],
    ["annulee", { etat: "hors_parcours", statut: "annulee" }, "hors_parcours"],
  ] as const)("%s / %o → %s", (statut, etat, phase) => {
    expect(phaseDossier(statut, etat)).toBe(phase);
  });
});

describe("messageDossierClos", () => {
  it("donne la date et invite à rouvrir", () => {
    const m = messageDossierClos(new Date("2026-09-14T08:00:00Z"));
    expect(m).toContain("Dossier clos le 14/09/2026");
    expect(m).toContain("Rouvrir le dossier");
  });
});
