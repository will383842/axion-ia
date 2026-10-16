// @vitest-environment node

/**
 * Qualiopi ind. 27 — les règles PURES du registre des sous-traitants tenu par l'outil.
 *
 *   · qui entre : un formateur indépendant au contrat-cadre signé, ou actif ; jamais une
 *     fiche de test ;
 *   · le statut : actif, suspendu (fiche désactivée), sorti (date et motif) — une sortie
 *     est définitive, rien n'est jamais retiré du registre ;
 *   · le plan est IDEMPOTENT : rejoué sur son propre résultat, il ne crée rien ;
 *   · l'état des pièces suit la règle du seuil (URSSAF), la RC pro n'est pas exigée ;
 *   · les échéances des contrôles viennent de la configuration, jamais d'un chiffre posé
 *     ailleurs ;
 *   · les alertes : pièce expirée, pièce à échéance (J-30), contrôle en retard — et rien
 *     pour une ligne suspendue ou sortie.
 */

import { describe, expect, it } from "vitest";

import { SEUIL_VIGILANCE_CENTS } from "@/lib/vigilance";

import {
  CONTROLES_SOUS_TRAITANCE,
  PIECES_REGISTRE,
  ALERTE_AVANT_ECHEANCE_JOURS,
} from "../controles.config";
import {
  candidatsAlertesRegistre,
  etatControles,
  etatLigneRegistre,
  etatPieces,
  estEligible,
  planifierSynchronisation,
  statutAttendu,
  type FaitsFiche,
  type LigneExistante,
} from "../regles";

const MAINTENANT = new Date("2026-10-16T10:00:00Z");
const JOUR = 24 * 3600 * 1000;
const T1 = "11111111-1111-4111-8111-111111111111";
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function fiche(p: Partial<FaitsFiche> = {}): FaitsFiche {
  return {
    trainerId: T1,
    prenom: "Anne",
    nom: "Martin",
    statut: "sous_traitant",
    actif: true,
    estTestInterne: false,
    siret: "12345678900011",
    nda: "84691234569",
    contratSigneAt: new Date("2026-09-01T00:00:00Z"),
    activationValideeAt: new Date("2026-09-03T00:00:00Z"),
    finCollaborationAt: null,
    finCollaborationEffetAt: null,
    finCollaborationMotif: null,
    formations: ["Prompt engineering", "IA pour les RH"],
    ndaVerifieListeAt: new Date("2026-09-02T00:00:00Z"),
    ...p,
  };
}

function existanteDepuis(f: FaitsFiche): LigneExistante {
  const [plan] = planifierSynchronisation([f], [], MAINTENANT);
  if (plan?.sorte !== "creer") throw new Error("plan inattendu");
  return {
    registreId: R1,
    trainerId: f.trainerId,
    sousTraitantId: S1,
    statut: plan.statut.statut,
    statutDepuis: MAINTENANT,
    dateSortie: plan.statut.dateSortie,
    motifSortie: plan.statut.motifSortie,
    generique: { ...plan.generique, verifieDataGouvAt: plan.verifieDataGouvAt },
  };
}

describe("qui entre au registre", () => {
  it("un indépendant au contrat-cadre signé entre, même pas encore actif", () => {
    expect(estEligible(fiche({ actif: false }))).toBe(true);
  });
  it("un indépendant actif entre, même sans contrat-cadre daté", () => {
    expect(estEligible(fiche({ contratSigneAt: null }))).toBe(true);
  });
  it("ni contrat signé ni actif : n'entre pas", () => {
    expect(estEligible(fiche({ contratSigneAt: null, actif: false }))).toBe(false);
  });
  it("un salarié ou un dirigeant n'est pas un sous-traitant", () => {
    expect(estEligible(fiche({ statut: "salarie" }))).toBe(false);
    expect(estEligible(fiche({ statut: "dirigeant" }))).toBe(false);
  });
  it("une fiche de test n'entre jamais au registre que lit l'auditeur", () => {
    expect(estEligible(fiche({ estTestInterne: true }))).toBe(false);
  });
});

describe("statut au registre", () => {
  it("actif", () => {
    expect(statutAttendu(fiche(), null, MAINTENANT)).toEqual({
      statut: "actif",
      dateSortie: null,
      motifSortie: null,
    });
  });
  it("fiche désactivée : suspendu, sans date de sortie", () => {
    expect(statutAttendu(fiche({ actif: false }), null, MAINTENANT).statut).toBe("suspendu");
  });
  it("fin de collaboration : sorti, à la date d'effet, avec le motif en clair", () => {
    const s = statutAttendu(
      fiche({
        actif: false,
        finCollaborationAt: new Date("2026-10-10T00:00:00Z"),
        finCollaborationEffetAt: new Date("2026-10-09T00:00:00Z"),
        finCollaborationMotif: "initiative_formateur",
      }),
      null,
      MAINTENANT,
    );
    expect(s.statut).toBe("sorti");
    expect(s.dateSortie).toEqual(new Date("2026-10-09T00:00:00Z"));
    expect(s.motifSortie).toMatch(/formateur/i);
  });
  it("n'est plus indépendant (changement de nature) : sorti, motif écrit", () => {
    const s = statutAttendu(fiche({ statut: "salarie" }), null, MAINTENANT);
    expect(s.statut).toBe("sorti");
    expect(s.dateSortie).toEqual(MAINTENANT);
    expect(s.motifSortie).toBeTruthy();
  });
  it("🔴 une sortie est définitive : la fiche réactivée ne fait pas revenir la ligne", () => {
    const sortie = {
      statut: "sorti" as const,
      dateSortie: new Date("2026-10-01T00:00:00Z"),
      motifSortie: "Fin de collaboration",
    };
    expect(statutAttendu(fiche(), sortie, MAINTENANT)).toEqual(sortie);
  });
});

describe("plan de synchronisation", () => {
  it("crée la ligne d'un nouvel entrant : identité légale, NDA, formations, date d'entrée", () => {
    const [p] = planifierSynchronisation([fiche()], [], MAINTENANT);
    expect(p?.sorte).toBe("creer");
    if (p?.sorte !== "creer") return;
    expect(p.generique.nom).toBe("Anne Martin");
    expect(p.generique.siret).toBe("12345678900011");
    expect(p.generique.nda).toBe("84691234569");
    expect(p.generique.objetPrestation).toContain("Prompt engineering");
    expect(p.generique.objetPrestation).toContain("IA pour les RH");
    expect(p.generique.contratSigneAt).toEqual(new Date("2026-09-01T00:00:00Z"));
    expect(p.generique.actif).toBe(true);
    // La première des deux dates : contrat-cadre signé (01/09) avant l'activation (03/09).
    expect(p.dateEntree).toEqual(new Date("2026-09-01T00:00:00Z"));
    expect(p.verifieDataGouvAt).toEqual(new Date("2026-09-02T00:00:00Z"));
  });

  it("sans date de contrat ni d'activation, l'entrée est datée du constat", () => {
    const [p] = planifierSynchronisation(
      [fiche({ contratSigneAt: null, activationValideeAt: null })],
      [],
      MAINTENANT,
    );
    expect(p?.sorte === "creer" && p.dateEntree).toEqual(MAINTENANT);
  });

  it("🔑 IDEMPOTENT : rejoué sur son propre résultat, rien n'est créé ni modifié", () => {
    const f = fiche();
    const plan = planifierSynchronisation([f], [existanteDepuis(f)], MAINTENANT);
    expect(plan).toEqual([{ sorte: "inchange", trainerId: T1, libelle: "Anne Martin" }]);
  });

  it("met à jour ce qui a changé, jamais la raison sociale (corrigeable à la main)", () => {
    const f = fiche();
    const e = existanteDepuis(f);
    const g = { ...e, generique: { ...e.generique, nom: "SASU Martin Conseil" } };
    const [p] = planifierSynchronisation(
      [fiche({ nom: "Martin-Durand", siret: "98765432100019" })],
      [g],
      MAINTENANT,
    );
    expect(p?.sorte).toBe("mettre_a_jour");
    if (p?.sorte !== "mettre_a_jour") return;
    expect(p.generique).toEqual({ siret: "98765432100019" });
    expect(p.statut).toBeNull();
  });

  it("une fin de collaboration fait SORTIR la ligne (statut + date + motif), sans la retirer", () => {
    const f = fiche();
    const [p] = planifierSynchronisation(
      [
        fiche({
          actif: false,
          finCollaborationAt: new Date("2026-10-10T00:00:00Z"),
          finCollaborationMotif: "initiative_axion",
        }),
      ],
      [existanteDepuis(f)],
      MAINTENANT,
    );
    expect(p?.sorte).toBe("mettre_a_jour");
    if (p?.sorte !== "mettre_a_jour") return;
    expect(p.statut?.statut).toBe("sorti");
    expect(p.generique.actif).toBe(false);
  });

  it("une fiche qui n'est plus éligible mais déjà au registre y reste, sortie", () => {
    const f = fiche();
    const [p] = planifierSynchronisation(
      [fiche({ statut: "salarie" })],
      [existanteDepuis(f)],
      MAINTENANT,
    );
    expect(p?.sorte === "mettre_a_jour" && p.statut?.statut).toBe("sorti");
  });

  it("une fiche non éligible et absente du registre n'apparaît pas au plan", () => {
    expect(
      planifierSynchronisation([fiche({ contratSigneAt: null, actif: false })], [], MAINTENANT),
    ).toEqual([]);
  });
});

describe("configuration des contrôles (un seul fichier)", () => {
  it("chaque contrôle dit quoi, quand et qui", () => {
    for (const c of CONTROLES_SOUS_TRAITANCE) {
      expect(c.quoi.length).toBeGreaterThan(10);
      expect(c.qui.length).toBeGreaterThan(3);
      expect(c.quand.sorte).toBeTruthy();
    }
  });
  it("les contrôles provisoires demandés sont là", () => {
    expect(CONTROLES_SOUS_TRAITANCE.map((c) => c.code)).toEqual([
      "pieces_entree",
      "pieces_validite",
      "registre_public",
      "revue_annuelle",
    ]);
  });
  it("les pièces suivies : URSSAF au seuil, RC pro non exigée, KBIS/avis SIRENE, NDA", () => {
    const parCode = Object.fromEntries(PIECES_REGISTRE.map((p) => [p.code, p.exigence]));
    expect(parCode).toEqual({
      urssaf: "au_seuil",
      rc_pro: "non_exigee",
      kbis_sirene: "toujours",
      nda: "toujours",
    });
  });
});

type Doc = Parameters<typeof etatPieces>[0][number];
const doc = (p: Partial<Doc>): Doc => ({
  type: "kbis_avis_sirene",
  statutValidation: "valide",
  fichierUrl: null,
  dateEmission: new Date("2026-09-01T00:00:00Z"),
  dateExpiration: null,
  ...p,
});
const piece = (pieces: ReturnType<typeof etatPieces>, code: string) =>
  pieces.find((p) => p.code === code);

describe("état des pièces", () => {
  it("URSSAF sous le seuil : non exigée", () => {
    expect(piece(etatPieces([], 0, MAINTENANT), "urssaf")?.etat).toBe("non_exigee");
  });
  it("URSSAF au seuil, absente : absente et exigée", () => {
    const p = piece(etatPieces([], SEUIL_VIGILANCE_CENTS, MAINTENANT), "urssaf");
    expect(p).toMatchObject({ exigee: true, etat: "absente" });
  });
  it("URSSAF au seuil : échéance à la validité légale après émission", () => {
    const p = piece(
      etatPieces(
        [
          doc({
            type: "attestation_vigilance_urssaf",
            dateEmission: new Date("2026-05-01T00:00:00Z"),
          }),
        ],
        SEUIL_VIGILANCE_CENTS,
        MAINTENANT,
      ),
      "urssaf",
    );
    expect(p?.echeance).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect(p?.etat).toBe("a_echeance");
  });
  it("cumul illisible : le seuil est réputé atteint", () => {
    expect(piece(etatPieces([], null, MAINTENANT), "urssaf")?.exigee).toBe(true);
  });
  it("RC pro absente : non exigée (décision du 03/08)", () => {
    expect(piece(etatPieces([], 0, MAINTENANT), "rc_pro")?.etat).toBe("non_exigee");
  });
  it("KBIS expiré : expirée ; à moins de J-30 : à échéance ; sans date : valide", () => {
    const d = (exp: Date | null) =>
      piece(etatPieces([doc({ dateExpiration: exp })], 0, MAINTENANT), "kbis_sirene")?.etat;
    expect(d(new Date(MAINTENANT.getTime() - JOUR))).toBe("expiree");
    expect(d(new Date(MAINTENANT.getTime() + (ALERTE_AVANT_ECHEANCE_JOURS - 1) * JOUR))).toBe(
      "a_echeance",
    );
    expect(d(new Date(MAINTENANT.getTime() + (ALERTE_AVANT_ECHEANCE_JOURS + 5) * JOUR))).toBe(
      "valide",
    );
    expect(d(null)).toBe("valide");
  });
  it("une pièce rejetée ou en attente ne compte pas", () => {
    const p = piece(
      etatPieces([doc({ statutValidation: "rejete" })], 0, MAINTENANT),
      "kbis_sirene",
    );
    expect(p?.etat).toBe("absente");
  });
  it("le NDA se prouve par la pièce NDA ou par le récépissé de déclaration", () => {
    const p = piece(
      etatPieces([doc({ type: "recepisse_declaration_activite" })], 0, MAINTENANT),
      "nda",
    );
    expect(p?.etat).toBe("valide");
  });
});

describe("échéances des contrôles", () => {
  const ENTREE = new Date("2026-09-01T00:00:00Z");
  const base = {
    dateEntree: ENTREE,
    traces: [] as {
      code: string;
      faitAt: Date;
      resultat: "conforme" | "non_conforme" | "a_revoir";
    }[],
    dernierControleRegistreAt: null as Date | null,
    pieces: etatPieces([], 0, MAINTENANT),
  };
  const c = (r: ReturnType<typeof etatControles>, code: string) => r.find((x) => x.code === code);

  it("pièces à l'entrée : en retard tant qu'aucun contrôle conforme n'est tracé", () => {
    expect(c(etatControles(base, MAINTENANT), "pieces_entree")?.enRetard).toBe(true);
    const fait = etatControles(
      {
        ...base,
        traces: [{ code: "pieces_entree", faitAt: ENTREE, resultat: "non_conforme" }],
      },
      MAINTENANT,
    );
    expect(c(fait, "pieces_entree")?.enRetard).toBe(true);
    const conforme = etatControles(
      { ...base, traces: [{ code: "pieces_entree", faitAt: ENTREE, resultat: "conforme" }] },
      MAINTENANT,
    );
    expect(c(conforme, "pieces_entree")).toMatchObject({ enRetard: false, dernierAt: ENTREE });
  });

  it("registre public : relu par la tâche de fond ou tracé à la main, sinon en retard", () => {
    expect(c(etatControles(base, MAINTENANT), "registre_public")?.enRetard).toBe(true);
    const recent = etatControles(
      { ...base, dernierControleRegistreAt: new Date(MAINTENANT.getTime() - 3 * JOUR) },
      MAINTENANT,
    );
    expect(c(recent, "registre_public")?.enRetard).toBe(false);
    expect(c(recent, "registre_public")?.echeance?.getTime()).toBeGreaterThan(MAINTENANT.getTime());
  });

  it("revue annuelle : un an après l'entrée, puis un an après la dernière revue", () => {
    const r = c(etatControles(base, MAINTENANT), "revue_annuelle");
    expect(r).toMatchObject({ enRetard: false, echeance: new Date("2027-09-01T00:00:00Z") });
    const tard = c(etatControles(base, new Date("2027-09-02T00:00:00Z")), "revue_annuelle");
    expect(tard?.enRetard).toBe(true);
  });

  it("dernier contrôle et prochaine échéance de la ligne", () => {
    const e = etatLigneRegistre(
      {
        ...base,
        traces: [{ code: "pieces_entree", faitAt: ENTREE, resultat: "conforme" }],
        dernierControleRegistreAt: new Date("2026-10-10T00:00:00Z"),
      },
      MAINTENANT,
    );
    expect(e.dernierControleAt).toEqual(new Date("2026-10-10T00:00:00Z"));
    expect(e.prochaineEcheance).toEqual(new Date("2026-11-09T00:00:00Z"));
  });
});

describe("alertes d'échéance", () => {
  const ligne = (p: Partial<Parameters<typeof candidatsAlertesRegistre>[0][number]> = {}) => ({
    trainerId: T1,
    libelle: "Anne Martin",
    statut: "actif" as const,
    pieces: etatPieces(
      [doc({ dateExpiration: new Date(MAINTENANT.getTime() - JOUR) })],
      0,
      MAINTENANT,
    ),
    controles: [] as ReturnType<typeof etatControles>,
    ...p,
  });

  it("pièce expirée : critique, une par formateur", () => {
    const a = candidatsAlertesRegistre([ligne()]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      sorte: "piece_expiree",
      niveau: "critique",
      cibleType: "Trainer",
      cibleId: T1,
    });
  });

  it("pièce à échéance sous J-30 : important", () => {
    const a = candidatsAlertesRegistre([
      ligne({
        pieces: etatPieces(
          [doc({ dateExpiration: new Date(MAINTENANT.getTime() + 10 * JOUR) })],
          0,
          MAINTENANT,
        ),
      }),
    ]);
    expect(a.map((x) => x.sorte)).toEqual(["piece_a_echeance"]);
  });

  it("contrôle en retard : important, les contrôles nommés", () => {
    const a = candidatsAlertesRegistre([
      ligne({
        pieces: etatPieces([], 0, MAINTENANT),
        controles: [
          {
            code: "revue_annuelle",
            libelle: "Revue annuelle",
            dernierAt: null,
            echeance: new Date("2026-01-01T00:00:00Z"),
            enRetard: true,
          },
        ],
      }),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]?.sorte).toBe("controle_en_retard");
    expect(a[0]?.message).toContain("Revue annuelle");
  });

  it("🔑 l'URSSAF a déjà ses propres alertes (vigilance_urssaf_*) : le registre ne les double pas", () => {
    const a = candidatsAlertesRegistre([
      ligne({
        pieces: etatPieces(
          [
            doc({
              type: "attestation_vigilance_urssaf",
              dateEmission: new Date("2026-01-01T00:00:00Z"),
            }),
          ],
          SEUIL_VIGILANCE_CENTS,
          MAINTENANT,
        ),
      }),
    ]);
    expect(a).toEqual([]);
  });

  it("rien pour une ligne suspendue ou sortie", () => {
    expect(candidatsAlertesRegistre([ligne({ statut: "suspendu" })])).toEqual([]);
    expect(candidatsAlertesRegistre([ligne({ statut: "sorti" })])).toEqual([]);
  });
});
