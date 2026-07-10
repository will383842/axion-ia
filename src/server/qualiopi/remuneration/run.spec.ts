/**
 * Tests — run.ts (run mensuel de rémunération des formateurs).
 *
 * `calcul.spec.ts` couvre la valeur d'une ligne. Ici on teste ce que le run
 * décide : à quelle PÉRIODE une prestation se rattache (heure de Paris, pas
 * UTC), quelles lignes existent, ce qu'on refuse de deviner (barème, régime de
 * TVA), et quelles TRANSITIONS de relevé sont légales — notamment le gate dur
 * « on ne paie que sur facture reçue ».
 */

import { describe, it, expect } from "vitest";
import {
  appartientALaPeriode,
  construireLignesPrestation,
  construireReleve,
  estStatutTerminal,
  mapStatutCoaching,
  mapStatutSession,
  periodeDeRattachement,
  periodeRecalculable,
  referenceUnique,
  statutLigne,
  totauxReleve,
  transitionAutorisee,
  transitionsPossibles,
  type FormateurContexte,
  type LigneAPersister,
  type PrestationACalculer,
  type RegleIdentifiee,
  type StatementStatut,
} from "./run";

/* ──────────────────────────────────────────────────────────────────────────────
 * Fabriques
 * ────────────────────────────────────────────────────────────────────────────── */

function regle(over: Partial<RegleIdentifiee> = {}): RegleIdentifiee {
  return {
    id: "r1",
    trainerId: "t1",
    prestationType: null,
    interventionSlug: null,
    model: "taux_journalier",
    tauxJourneeHtCents: 90_000, // 900 €/j
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
    ...over,
  };
}

function formateur(over: Partial<FormateurContexte> = {}): FormateurContexte {
  return {
    trainerId: "t1",
    statut: "sous_traitant",
    tarifJourneeHtCentsFallback: null,
    regimeTva: "assujetti_20",
    ...over,
  };
}

function contexte(...fs: FormateurContexte[]): ReadonlyMap<string, FormateurContexte> {
  return new Map(fs.map((f) => [f.trainerId, f]));
}

function prestation(over: Partial<PrestationACalculer> = {}): PrestationACalculer {
  return {
    type: "formation_collective",
    sessionId: "s1",
    coachingSessionId: null,
    bookingId: null,
    auditMissionId: null,
    date: new Date("2026-06-15T09:00:00Z"),
    statut: "realisee",
    interventionSlug: null,
    dureeHeures: 7,
    caTotalCents: 0,
    affectations: [{ trainerId: "t1" }],
    ...over,
  };
}

function ligne(over: Partial<LigneAPersister> = {}): LigneAPersister {
  return {
    trainerId: "t1",
    prestationType: "formation_collective",
    sessionId: "s1",
    coachingSessionId: null,
    bookingId: null,
    auditMissionId: null,
    ruleId: "r1",
    model: "taux_journalier",
    nature: "honoraire_du",
    tauxSnapshotCents: 90_000,
    commissionPctSnapshot: null,
    heures: 7,
    nbJours: 1,
    caBaseCents: 0,
    montantHtCents: 90_000,
    statut: "calcule",
    periodeYear: 2026,
    periodeMonth: 6,
    ...over,
  };
}

const TOUS_STATUTS: readonly StatementStatut[] = [
  "brouillon",
  "a_valider",
  "valide",
  "facture_recue",
  "paye",
  "annule",
];

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. Période de rattachement — heure de Paris
 * ────────────────────────────────────────────────────────────────────────────── */

describe("periodeDeRattachement", () => {
  it("rattache une date en milieu de mois au mois évident", () => {
    expect(periodeDeRattachement(new Date("2026-06-15T09:00:00Z"))).toEqual({
      year: 2026,
      month: 6,
    });
  });

  it("INVARIANT : le 1er août 00h30 à Paris se rattache à AOÛT, pas à juillet", () => {
    // Stocké 2026-07-31T22:30:00Z (Paris = UTC+2 en été). Un calcul en UTC le
    // ferait tomber sur le relevé de juillet — donc sur la mauvaise facture.
    const minuitTrenteParis = new Date("2026-07-31T22:30:00Z");
    expect(periodeDeRattachement(minuitTrenteParis)).toEqual({ year: 2026, month: 8 });
  });

  it("INVARIANT : le 31 juillet 23h30 UTC reste en août à Paris", () => {
    expect(periodeDeRattachement(new Date("2026-07-31T23:30:00Z"))).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("le 1er juillet 00h30 UTC (= 02h30 Paris) reste en juillet", () => {
    expect(periodeDeRattachement(new Date("2026-07-01T00:30:00Z"))).toEqual({
      year: 2026,
      month: 7,
    });
  });

  it("gère le passage d'année : 31 déc 23h30 UTC = 1er janv à Paris", () => {
    expect(periodeDeRattachement(new Date("2026-12-31T23:30:00Z"))).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("gère l'hiver (Paris = UTC+1) : 31 janv 23h30 UTC = 1er févr à Paris", () => {
    expect(periodeDeRattachement(new Date("2026-01-31T23:30:00Z"))).toEqual({
      year: 2026,
      month: 2,
    });
  });

  it("mois toujours en 1..12 (contrainte SQL ck_fee_line_periode_month)", () => {
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(2026, m, 15, 12));
      const p = periodeDeRattachement(d);
      expect(p.month).toBeGreaterThanOrEqual(1);
      expect(p.month).toBeLessThanOrEqual(12);
    }
  });
});

describe("appartientALaPeriode", () => {
  it("accepte une date du mois, à l'heure de Paris", () => {
    expect(appartientALaPeriode(new Date("2026-06-15T09:00:00Z"), { year: 2026, month: 6 })).toBe(
      true,
    );
  });

  it("rejette le même mois d'une autre année", () => {
    expect(appartientALaPeriode(new Date("2025-06-15T09:00:00Z"), { year: 2026, month: 6 })).toBe(
      false,
    );
  });

  it("le filet UTC élargi est bien affiné : 31 juil 22h30 Z n'est PAS de juillet", () => {
    const d = new Date("2026-07-31T22:30:00Z"); // 1er août 00h30 à Paris
    expect(appartientALaPeriode(d, { year: 2026, month: 7 })).toBe(false);
    expect(appartientALaPeriode(d, { year: 2026, month: 8 })).toBe(true);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Statuts
 * ────────────────────────────────────────────────────────────────────────────── */

describe("mapStatutSession", () => {
  it("en_cours devient planifiee : rien n'est dû tant que ce n'est pas fini", () => {
    expect(mapStatutSession("en_cours")).toBe("planifiee");
  });

  it("laisse les autres statuts intacts", () => {
    expect(mapStatutSession("planifiee")).toBe("planifiee");
    expect(mapStatutSession("realisee")).toBe("realisee");
    expect(mapStatutSession("annulee")).toBe("annulee");
    expect(mapStatutSession("reportee")).toBe("reportee");
  });
});

describe("mapStatutCoaching", () => {
  it("un coaching n'a pas d'`en_cours` : les 4 états passent tels quels", () => {
    expect(mapStatutCoaching("planifiee")).toBe("planifiee");
    expect(mapStatutCoaching("realisee")).toBe("realisee");
    expect(mapStatutCoaching("annulee")).toBe("annulee");
    expect(mapStatutCoaching("reportee")).toBe("reportee");
  });
});

describe("statutLigne", () => {
  it("realisee → calcule", () => expect(statutLigne("realisee")).toBe("calcule"));
  it("planifiee → previsionnel", () => expect(statutLigne("planifiee")).toBe("previsionnel"));
  it("annulee → annule", () => expect(statutLigne("annulee")).toBe("annule"));
  it("reportee → annule", () => expect(statutLigne("reportee")).toBe("annule"));

  it("ne produit JAMAIS `valide` : figer une ligne est une transition de relevé", () => {
    const statuts = (["realisee", "planifiee", "annulee", "reportee"] as const).map(statutLigne);
    expect(statuts).not.toContain("valide");
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. Transitions du relevé
 * ────────────────────────────────────────────────────────────────────────────── */

describe("transitionAutorisee", () => {
  it("INVARIANT : `paye` n'est atteignable QUE depuis `facture_recue`", () => {
    const sources = TOUS_STATUTS.filter((s) => transitionAutorisee(s, "paye"));
    expect(sources).toEqual(["facture_recue"]);
  });

  it("on ne saute JAMAIS la facture : valide → paye est refusé", () => {
    expect(transitionAutorisee("valide", "paye")).toBe(false);
  });

  it("un brouillon ne peut pas être payé ni validé directement", () => {
    expect(transitionAutorisee("brouillon", "paye")).toBe(false);
    expect(transitionAutorisee("brouillon", "valide")).toBe(false);
  });

  it("le chemin nominal complet est ouvert", () => {
    expect(transitionAutorisee("brouillon", "a_valider")).toBe(true);
    expect(transitionAutorisee("a_valider", "valide")).toBe(true);
    expect(transitionAutorisee("valide", "facture_recue")).toBe(true);
    expect(transitionAutorisee("facture_recue", "paye")).toBe(true);
  });

  it("une facture non conforme se rejette : facture_recue → valide", () => {
    expect(transitionAutorisee("facture_recue", "valide")).toBe(true);
  });

  it("un relevé à valider peut redescendre en brouillon", () => {
    expect(transitionAutorisee("a_valider", "brouillon")).toBe(true);
  });

  it("`paye` et `annule` sont terminaux : aucune sortie", () => {
    for (const cible of TOUS_STATUTS) {
      expect(transitionAutorisee("paye", cible)).toBe(false);
      expect(transitionAutorisee("annule", cible)).toBe(false);
    }
  });

  it("un paiement ne se dé-fait pas : paye → annule est refusé", () => {
    expect(transitionAutorisee("paye", "annule")).toBe(false);
  });

  it("aucun statut ne transite vers lui-même", () => {
    for (const s of TOUS_STATUTS) expect(transitionAutorisee(s, s)).toBe(false);
  });

  it("tout statut non terminal peut être annulé", () => {
    for (const s of TOUS_STATUTS) {
      if (estStatutTerminal(s)) continue;
      expect(transitionAutorisee(s, "annule")).toBe(true);
    }
  });
});

describe("transitionsPossibles / estStatutTerminal", () => {
  it("expose exactement les cibles légales", () => {
    expect(transitionsPossibles("facture_recue")).toEqual(["paye", "valide", "annule"]);
  });

  it("cohérent avec transitionAutorisee sur toute la matrice", () => {
    for (const from of TOUS_STATUTS) {
      for (const to of TOUS_STATUTS) {
        expect(transitionAutorisee(from, to)).toBe(transitionsPossibles(from).includes(to));
      }
    }
  });

  it("seuls `paye` et `annule` sont terminaux", () => {
    expect(TOUS_STATUTS.filter(estStatutTerminal)).toEqual(["paye", "annule"]);
  });
});

describe("periodeRecalculable", () => {
  it("aucun relevé (null) → recalcul libre", () => {
    expect(periodeRecalculable(null)).toBe(true);
  });

  it("brouillon et a_valider restent recalculables", () => {
    expect(periodeRecalculable("brouillon")).toBe(true);
    expect(periodeRecalculable("a_valider")).toBe(true);
  });

  it("INVARIANT : au-delà de a_valider, le run ne touche plus rien", () => {
    for (const s of ["valide", "facture_recue", "paye", "annule"] as const) {
      expect(periodeRecalculable(s)).toBe(false);
    }
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. Référence de prestation (miroir du CHECK SQL)
 * ────────────────────────────────────────────────────────────────────────────── */

describe("referenceUnique", () => {
  const base = { type: "formation_collective", auditMissionId: null } as const;

  it("accepte exactement une référence", () => {
    expect(
      referenceUnique({ ...base, sessionId: "s", coachingSessionId: null, bookingId: null }),
    ).toBe(true);
    expect(
      referenceUnique({ ...base, sessionId: null, coachingSessionId: "c", bookingId: null }),
    ).toBe(true);
    expect(
      referenceUnique({ ...base, sessionId: null, coachingSessionId: null, bookingId: "b" }),
    ).toBe(true);
  });

  it("refuse zéro référence", () => {
    expect(
      referenceUnique({ ...base, sessionId: null, coachingSessionId: null, bookingId: null }),
    ).toBe(false);
  });

  it("refuse deux références", () => {
    expect(
      referenceUnique({ ...base, sessionId: "s", coachingSessionId: "c", bookingId: null }),
    ).toBe(false);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 5. Construction des lignes
 * ────────────────────────────────────────────────────────────────────────────── */

describe("construireLignesPrestation — cas nominal", () => {
  it("produit une ligne d'honoraires avec le barème résolu snapshoté", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation(),
      [regle()],
      contexte(formateur()),
    );

    expect(anomalies).toEqual([]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      trainerId: "t1",
      ruleId: "r1",
      model: "taux_journalier",
      nature: "honoraire_du",
      tauxSnapshotCents: 90_000,
      commissionPctSnapshot: null,
      heures: 7,
      nbJours: 1,
      montantHtCents: 90_000,
      statut: "calcule",
      periodeYear: 2026,
      periodeMonth: 6,
    });
  });

  it("les heures animées défaillent sur la durée de la prestation", () => {
    // Aucune heure déclarée : un formateur seul sur 7 h a animé 7 h.
    const { lignes } = construireLignesPrestation(
      prestation({ dureeHeures: 14, affectations: [{ trainerId: "t1" }] }),
      [regle()],
      contexte(formateur()),
    );
    expect(lignes[0]?.heures).toBe(14);
    expect(lignes[0]?.nbJours).toBe(2);
    expect(lignes[0]?.montantHtCents).toBe(180_000); // 2 j × 900 €
  });

  it("un salarié produit une ligne analytique (coût), pas un dû", () => {
    const { lignes } = construireLignesPrestation(
      prestation(),
      [regle()],
      contexte(formateur({ statut: "salarie", regimeTva: null })),
    );
    expect(lignes[0]?.nature).toBe("analytique");
    expect(lignes[0]?.montantHtCents).toBe(90_000);
  });

  it("nbJours est arrondi au centième, comme Decimal(6,2)", () => {
    const { lignes } = construireLignesPrestation(
      prestation({ dureeHeures: 3 }), // 3 / 7 = 0.428571...
      [regle()],
      contexte(formateur()),
    );
    expect(lignes[0]?.nbJours).toBe(0.43);
  });

  it("nbJours n'est renseigné que pour un modèle journalier", () => {
    const { lignes } = construireLignesPrestation(
      prestation(),
      [regle({ model: "taux_horaire", tauxHoraireHtCents: 12_000 })],
      contexte(formateur()),
    );
    expect(lignes[0]?.nbJours).toBeNull();
    expect(lignes[0]?.tauxSnapshotCents).toBe(12_000);
    expect(lignes[0]?.montantHtCents).toBe(84_000); // 7 h × 120 €
  });

  it("une commission snapshote le pourcentage, pas un taux monétaire", () => {
    const { lignes } = construireLignesPrestation(
      prestation({ caTotalCents: 500_000 }),
      [regle({ model: "commission_ca_pct", commissionPct: 30 })],
      contexte(formateur()),
    );
    expect(lignes[0]?.tauxSnapshotCents).toBeNull();
    expect(lignes[0]?.commissionPctSnapshot).toBe(30);
    expect(lignes[0]?.caBaseCents).toBe(500_000);
    expect(lignes[0]?.montantHtCents).toBe(150_000);
  });

  it("une prestation sans affectation est un silence, pas une anomalie", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ affectations: [] }),
      [regle()],
      contexte(formateur()),
    );
    expect(lignes).toEqual([]);
    expect(anomalies).toEqual([]);
  });
});

describe("construireLignesPrestation — annulation / report", () => {
  it("une prestation annulée produit une ligne `annule` à 0 €, snapshot conservé", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ statut: "annulee" }),
      [regle()],
      contexte(formateur()),
    );
    expect(lignes[0]?.statut).toBe("annule");
    expect(lignes[0]?.montantHtCents).toBe(0);
    // La trace du barème qui se serait appliqué survit à l'annulation.
    expect(lignes[0]?.tauxSnapshotCents).toBe(90_000);
    expect(anomalies).toEqual([]);
  });

  it("une prestation reportée ne signale pas `heures_absentes` (rien n'a été animé)", () => {
    const { anomalies } = construireLignesPrestation(
      prestation({ statut: "reportee", dureeHeures: 0 }),
      [regle()],
      contexte(formateur()),
    );
    expect(anomalies).toEqual([]);
  });

  it("une prestation planifiée produit une ligne prévisionnelle", () => {
    const { lignes } = construireLignesPrestation(
      prestation({ statut: "planifiee" }),
      [regle()],
      contexte(formateur()),
    );
    expect(lignes[0]?.statut).toBe("previsionnel");
    expect(lignes[0]?.montantHtCents).toBe(90_000); // estimé, non engageant
  });
});

describe("construireLignesPrestation — le fallback legacy est snapshoté", () => {
  it("RÉGRESSION : sans règle, le tarif journée de repli est écrit dans le snapshot", () => {
    // Le montant vient du tarif de repli ; persister ce montant SANS le taux qui
    // l'explique viderait le snapshot de son sens (« le passé est figé par la copie »).
    const { lignes, anomalies } = construireLignesPrestation(
      prestation(),
      [], // aucune règle
      contexte(formateur({ tarifJourneeHtCentsFallback: 70_000 })),
    );

    expect(anomalies).toEqual([]);
    expect(lignes[0]?.montantHtCents).toBe(70_000);
    expect(lignes[0]?.model).toBe("taux_journalier");
    expect(lignes[0]?.tauxSnapshotCents).toBe(70_000);
    expect(lignes[0]?.ruleId).toBeNull(); // aucune règle versionnée derrière
  });

  it("une règle qui ne couvre pas la date bascule sur le repli", () => {
    const { lignes } = construireLignesPrestation(
      prestation({ date: new Date("2026-06-15T09:00:00Z") }),
      [regle({ effectiveFrom: new Date("2026-09-01T00:00:00Z") })], // future
      contexte(formateur({ tarifJourneeHtCentsFallback: 70_000 })),
    );
    expect(lignes[0]?.tauxSnapshotCents).toBe(70_000);
    expect(lignes[0]?.ruleId).toBeNull();
  });

  it("la règle résolue prime sur le repli et son id est conservé", () => {
    const { lignes } = construireLignesPrestation(
      prestation(),
      [regle({ id: "r-specifique", prestationType: "formation_collective" })],
      contexte(formateur({ tarifJourneeHtCentsFallback: 70_000 })),
    );
    expect(lignes[0]?.ruleId).toBe("r-specifique");
    expect(lignes[0]?.tauxSnapshotCents).toBe(90_000);
  });
});

describe("construireLignesPrestation — anomalies", () => {
  it("INVARIANT 4 : ni règle ni repli → aucune ligne, anomalie `bareme_absent`", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation(),
      [],
      contexte(formateur({ tarifJourneeHtCentsFallback: null })),
    );
    expect(lignes).toEqual([]);
    expect(anomalies).toEqual([
      {
        motif: "bareme_absent",
        trainerId: "t1",
        prestation: {
          type: "formation_collective",
          sessionId: "s1",
          coachingSessionId: null,
          bookingId: null,
          auditMissionId: null,
        },
      },
    ]);
  });

  it("un formateur inconnu du contexte est signalé, pas inventé", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ affectations: [{ trainerId: "fantome" }] }),
      [regle()],
      contexte(formateur()),
    );
    expect(lignes).toEqual([]);
    expect(anomalies[0]).toMatchObject({ motif: "formateur_inconnu", trainerId: "fantome" });
  });

  it("un modèle au temps sans heures signale `heures_absentes` (le 0 € devient visible)", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ dureeHeures: 0, affectations: [{ trainerId: "t1", heuresAnimees: 0 }] }),
      [regle()],
      contexte(formateur()),
    );
    // La ligne existe (trace de l'affectation) mais l'anomalie crie.
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.montantHtCents).toBe(0);
    expect(lignes[0]?.heures).toBeNull();
    expect(anomalies[0]).toMatchObject({ motif: "heures_absentes", trainerId: "t1" });
  });

  it("un forfait sans heures ne signale RIEN (son montant ne dépend pas du temps)", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ dureeHeures: 0 }),
      [regle({ model: "forfait_prestation", forfaitHtCents: 50_000 })],
      contexte(formateur()),
    );
    expect(anomalies).toEqual([]);
    expect(lignes[0]?.montantHtCents).toBe(50_000);
    expect(lignes[0]?.tauxSnapshotCents).toBe(50_000);
  });

  it("une commission sans heures ne signale rien non plus", () => {
    const { anomalies } = construireLignesPrestation(
      prestation({ dureeHeures: 0, caTotalCents: 100_000 }),
      [regle({ model: "commission_ca_pct", commissionPct: 40 })],
      contexte(formateur()),
    );
    expect(anomalies).toEqual([]);
  });

  it("une commission sur un CA nul signale `assiette_ca_absente` (cas coaching)", () => {
    // Le montant d'un coaching vit sur le CONTRAT (N séances) : la séance elle-même
    // n'a pas de CA. Une commission y vaudrait 0 € sans un mot.
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ caTotalCents: 0 }),
      [regle({ model: "commission_ca_pct", commissionPct: 40 })],
      contexte(formateur()),
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.montantHtCents).toBe(0);
    expect(anomalies[0]).toMatchObject({ motif: "assiette_ca_absente", trainerId: "t1" });
  });

  it("un modèle au temps sur un CA nul ne signale RIEN (le CA ne le concerne pas)", () => {
    const { anomalies } = construireLignesPrestation(
      prestation({ caTotalCents: 0 }),
      [regle()], // taux_journalier
      contexte(formateur()),
    );
    expect(anomalies).toEqual([]);
  });

  it("une commission sur un CA nul mais prestation ANNULÉE ne signale rien", () => {
    const { anomalies } = construireLignesPrestation(
      prestation({ caTotalCents: 0, statut: "annulee" }),
      [regle({ model: "commission_ca_pct", commissionPct: 40 })],
      contexte(formateur()),
    );
    expect(anomalies).toEqual([]);
  });

  it("miroir du CHECK SQL : zéro référence → aucune ligne, anomalie", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ sessionId: null }),
      [regle()],
      contexte(formateur()),
    );
    expect(lignes).toEqual([]);
    expect(anomalies[0]).toMatchObject({
      motif: "reference_prestation_invalide",
      trainerId: null,
    });
  });

  it("miroir du CHECK SQL : deux références → aucune ligne, anomalie", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({ sessionId: "s1", bookingId: "b1" }),
      [regle()],
      contexte(formateur()),
    );
    expect(lignes).toEqual([]);
    expect(anomalies[0]?.motif).toBe("reference_prestation_invalide");
  });

  it("une anomalie n'interrompt pas le run : les autres formateurs sont payés", () => {
    const { lignes, anomalies } = construireLignesPrestation(
      prestation({
        affectations: [{ trainerId: "fantome" }, { trainerId: "t1" }],
        dureeHeures: 7,
      }),
      [regle()],
      contexte(formateur()),
    );
    expect(anomalies).toHaveLength(1);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.trainerId).toBe("t1");
  });
});

describe("construireLignesPrestation — co-animation", () => {
  it("la commission porte sur la PART du co-animateur, pas sur le CA entier", () => {
    const { lignes } = construireLignesPrestation(
      prestation({
        caTotalCents: 1_000_000, // 10 000 €
        dureeHeures: 14,
        affectations: [
          { trainerId: "t1", heuresAnimees: 7 },
          { trainerId: "t2", heuresAnimees: 7 },
        ],
      }),
      [
        regle({ id: "r1", trainerId: "t1", model: "commission_ca_pct", commissionPct: 30 }),
        regle({ id: "r2", trainerId: "t2", model: "commission_ca_pct", commissionPct: 30 }),
      ],
      contexte(formateur({ trainerId: "t1" }), formateur({ trainerId: "t2" })),
    );

    // 50 % du CA chacun → 30 % de 5 000 € = 1 500 €. Surtout PAS 30 % de 10 000 €.
    expect(lignes[0]?.caBaseCents).toBe(500_000);
    expect(lignes[0]?.montantHtCents).toBe(150_000);
    expect(lignes[1]?.montantHtCents).toBe(150_000);
  });

  it("aucun centime perdu : les parts de CA somment au total exact", () => {
    const { lignes } = construireLignesPrestation(
      prestation({
        caTotalCents: 100_001, // impair : force un reliquat d'arrondi
        dureeHeures: 3,
        affectations: [
          { trainerId: "t1", heuresAnimees: 1 },
          { trainerId: "t2", heuresAnimees: 1 },
          { trainerId: "t3", heuresAnimees: 1 },
        ],
      }),
      [
        regle({ id: "r1", trainerId: "t1" }),
        regle({ id: "r2", trainerId: "t2" }),
        regle({ id: "r3", trainerId: "t3" }),
      ],
      contexte(
        formateur({ trainerId: "t1" }),
        formateur({ trainerId: "t2" }),
        formateur({ trainerId: "t3" }),
      ),
    );
    const somme = lignes.reduce((t, l) => t + l.caBaseCents, 0);
    expect(somme).toBe(100_001);
  });

  it("le prorata voit les heures PAR DÉFAUT, pas des zéros", () => {
    // t1 déclare ses heures, t2 non → t2 hérite de la durée de la prestation.
    // Sans ce défaut, t2 pèserait 0 et t1 raflerait tout le CA.
    const { lignes } = construireLignesPrestation(
      prestation({
        caTotalCents: 100_000,
        dureeHeures: 7,
        affectations: [{ trainerId: "t1", heuresAnimees: 7 }, { trainerId: "t2" }],
      }),
      [regle({ id: "r1", trainerId: "t1" }), regle({ id: "r2", trainerId: "t2" })],
      contexte(formateur({ trainerId: "t1" }), formateur({ trainerId: "t2" })),
    );
    expect(lignes[0]?.caBaseCents).toBe(50_000);
    expect(lignes[1]?.caBaseCents).toBe(50_000);
  });

  it("des quotes-parts explicites priment sur le prorata d'heures", () => {
    const { lignes } = construireLignesPrestation(
      prestation({
        caTotalCents: 100_000,
        dureeHeures: 7,
        affectations: [
          { trainerId: "t1", heuresAnimees: 7, quotePartPct: 70 },
          { trainerId: "t2", heuresAnimees: 7, quotePartPct: 30 },
        ],
      }),
      [
        regle({ id: "r1", trainerId: "t1", model: "commission_ca_pct", commissionPct: 100 }),
        regle({ id: "r2", trainerId: "t2", model: "commission_ca_pct", commissionPct: 100 }),
      ],
      contexte(formateur({ trainerId: "t1" }), formateur({ trainerId: "t2" })),
    );
    expect(lignes[0]?.caBaseCents).toBe(70_000);
    expect(lignes[1]?.caBaseCents).toBe(30_000);
  });

  it("chaque co-animateur garde SON modèle et SON id de règle", () => {
    const { lignes } = construireLignesPrestation(
      prestation({
        caTotalCents: 200_000,
        dureeHeures: 7,
        affectations: [
          { trainerId: "t1", heuresAnimees: 7 },
          { trainerId: "t2", heuresAnimees: 7 },
        ],
      }),
      [
        regle({ id: "r-jour", trainerId: "t1" }),
        regle({ id: "r-com", trainerId: "t2", model: "commission_ca_pct", commissionPct: 25 }),
      ],
      contexte(
        formateur({ trainerId: "t1" }),
        formateur({ trainerId: "t2", statut: "salarie", regimeTva: null }),
      ),
    );
    expect(lignes[0]).toMatchObject({
      ruleId: "r-jour",
      model: "taux_journalier",
      nature: "honoraire_du",
    });
    expect(lignes[1]).toMatchObject({
      ruleId: "r-com",
      model: "commission_ca_pct",
      nature: "analytique",
    });
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 6. Totaux et relevé
 * ────────────────────────────────────────────────────────────────────────────── */

describe("totauxReleve", () => {
  it("exclut les lignes analytiques : on ne facture pas un salaire", () => {
    const t = totauxReleve(
      [
        ligne({ nature: "honoraire_du", montantHtCents: 100_000 }),
        ligne({ nature: "analytique", montantHtCents: 900_000 }),
      ],
      "franchise_293b",
    );
    expect(t.totalHtCents).toBe(100_000);
  });

  it("exclut les lignes annulées", () => {
    const t = totauxReleve(
      [ligne({ montantHtCents: 100_000 }), ligne({ statut: "annule", montantHtCents: 999_999 })],
      "franchise_293b",
    );
    expect(t.totalHtCents).toBe(100_000);
  });

  it("exclut le prévisionnel : une prestation non réalisée n'est pas due", () => {
    const t = totauxReleve(
      [
        ligne({ statut: "calcule", montantHtCents: 100_000 }),
        ligne({ statut: "previsionnel", montantHtCents: 500_000 }),
      ],
      "franchise_293b",
    );
    expect(t.totalHtCents).toBe(100_000);
  });

  it("inclut les lignes déjà figées (`valide`)", () => {
    const t = totauxReleve([ligne({ statut: "valide", montantHtCents: 42_000 })], "franchise_293b");
    expect(t.totalHtCents).toBe(42_000);
  });

  it("la TVA s'applique au TOTAL, pas ligne à ligne", () => {
    // 3 × 333,33 € HT. Ligne à ligne : 3 × round(6666,6) = 3 × 6667 = 20 001 c.
    // Sur le total : round(20 % × 99 999) = 20 000 c. C'est ce dernier qui figure
    // sur la facture du formateur.
    const l = ligne({ montantHtCents: 33_333 });
    const t = totauxReleve([l, l, l], "assujetti_20");
    expect(t.totalHtCents).toBe(99_999);
    expect(t.tvaCents).toBe(20_000);
    expect(t.totalTtcCents).toBe(119_999);
  });

  it("franchise et exonération donnent 0 % mais des mentions DIFFÉRENTES", () => {
    const franchise = totauxReleve([ligne()], "franchise_293b");
    const exonere = totauxReleve([ligne()], "exonere_formation");
    expect(franchise.tvaCents).toBe(0);
    expect(exonere.tvaCents).toBe(0);
    expect(franchise.mentionTva).toContain("293 B");
    expect(exonere.mentionTva).toContain("261-4-4");
    expect(franchise.mentionTva).not.toBe(exonere.mentionTva);
  });
});

describe("construireReleve", () => {
  const JUIN = { year: 2026, month: 6 };

  it("émet un relevé brouillon pour un indépendant", () => {
    const { releve, anomalies } = construireReleve(formateur(), JUIN, [
      ligne({ montantHtCents: 90_000 }),
    ]);
    expect(anomalies).toEqual([]);
    expect(releve).toEqual({
      trainerId: "t1",
      periodeYear: 2026,
      periodeMonth: 6,
      statut: "brouillon",
      tvaRegime: "assujetti_20",
      totalHtCents: 90_000,
      tvaCents: 18_000,
      totalTtcCents: 108_000,
    });
  });

  it("un salarié n'a JAMAIS de relevé — et ce n'est pas une anomalie", () => {
    const { releve, anomalies } = construireReleve(
      formateur({ statut: "salarie", regimeTva: null }),
      JUIN,
      [ligne({ nature: "analytique", montantHtCents: 90_000 })],
    );
    expect(releve).toBeNull();
    expect(anomalies).toEqual([]);
  });

  it("INVARIANT 3 : indépendant sans régime de TVA → pas de relevé, anomalie", () => {
    const { releve, anomalies } = construireReleve(formateur({ regimeTva: null }), JUIN, [ligne()]);
    expect(releve).toBeNull();
    expect(anomalies).toEqual([{ motif: "regime_tva_absent", trainerId: "t1", prestation: null }]);
  });

  it("aucune ligne due → pas de relevé à 0 € (bruit + collision d'unicité)", () => {
    const { releve, anomalies } = construireReleve(formateur(), JUIN, [
      ligne({ statut: "previsionnel" }),
      ligne({ statut: "annule" }),
    ]);
    expect(releve).toBeNull();
    expect(anomalies).toEqual([]);
  });

  it("un mois sans aucune ligne ne produit rien", () => {
    expect(construireReleve(formateur(), JUIN, []).releve).toBeNull();
  });

  it("le régime est SNAPSHOTÉ sur le relevé", () => {
    const { releve } = construireReleve(formateur({ regimeTva: "exonere_formation" }), JUIN, [
      ligne({ montantHtCents: 50_000 }),
    ]);
    expect(releve?.tvaRegime).toBe("exonere_formation");
    expect(releve?.tvaCents).toBe(0);
    expect(releve?.totalTtcCents).toBe(50_000);
  });

  it("un relevé naît en brouillon : il ne peut pas être payé directement", () => {
    const { releve } = construireReleve(formateur(), JUIN, [ligne()]);
    expect(releve?.statut).toBe("brouillon");
    expect(transitionAutorisee(releve!.statut, "paye")).toBe(false);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 7. Scénario intégré
 * ────────────────────────────────────────────────────────────────────────────── */

describe("scénario intégré — un mois complet, deux formateurs, un relevé", () => {
  it("le salarié est valorisé sans relevé, l'indépendant est facturable", () => {
    const salarie = formateur({ trainerId: "sal", statut: "salarie", regimeTva: null });
    const indep = formateur({ trainerId: "ind", regimeTva: "franchise_293b" });
    const regles = [
      regle({ id: "r-sal", trainerId: "sal", tauxJourneeHtCents: 40_000 }),
      regle({ id: "r-ind", trainerId: "ind", tauxJourneeHtCents: 90_000 }),
    ];
    const ctx = contexte(salarie, indep);

    // Deux sessions réalisées en juin + une annulée.
    const juin1 = construireLignesPrestation(
      prestation({
        sessionId: "s1",
        date: new Date("2026-06-03T08:00:00Z"),
        affectations: [{ trainerId: "sal" }, { trainerId: "ind" }],
        dureeHeures: 7,
      }),
      regles,
      ctx,
    );
    const juin2 = construireLignesPrestation(
      prestation({
        sessionId: "s2",
        date: new Date("2026-06-20T08:00:00Z"),
        affectations: [{ trainerId: "ind" }],
        dureeHeures: 14,
      }),
      regles,
      ctx,
    );
    const annulee = construireLignesPrestation(
      prestation({
        sessionId: "s3",
        statut: "annulee",
        date: new Date("2026-06-25T08:00:00Z"),
        affectations: [{ trainerId: "ind" }],
      }),
      regles,
      ctx,
    );

    const toutes = [...juin1.lignes, ...juin2.lignes, ...annulee.lignes];
    expect([...juin1.anomalies, ...juin2.anomalies, ...annulee.anomalies]).toEqual([]);
    expect(toutes.every((l) => l.periodeMonth === 6 && l.periodeYear === 2026)).toBe(true);

    const lignesInd = toutes.filter((l) => l.trainerId === "ind");
    const lignesSal = toutes.filter((l) => l.trainerId === "sal");

    // Le salarié : une ligne analytique, aucun relevé.
    expect(lignesSal).toHaveLength(1);
    expect(lignesSal[0]?.nature).toBe("analytique");
    expect(construireReleve(salarie, { year: 2026, month: 6 }, lignesSal).releve).toBeNull();

    // L'indépendant : 1 j + 2 j dus, l'annulée ne compte pas.
    const { releve, anomalies } = construireReleve(indep, { year: 2026, month: 6 }, lignesInd);
    expect(anomalies).toEqual([]);
    expect(releve?.totalHtCents).toBe(270_000); // 3 j × 900 €
    expect(releve?.tvaCents).toBe(0); // franchise 293 B
    expect(releve?.totalTtcCents).toBe(270_000);
  });

  it("un changement de barème en septembre ne recalcule pas juin", () => {
    const regles = [
      regle({
        id: "v1",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: new Date("2026-09-01T00:00:00Z"),
        tauxJourneeHtCents: 90_000,
      }),
      regle({
        id: "v2",
        effectiveFrom: new Date("2026-09-01T00:00:00Z"),
        tauxJourneeHtCents: 110_000,
      }),
    ];
    const ctx = contexte(formateur());

    const juin = construireLignesPrestation(
      prestation({ date: new Date("2026-06-15T09:00:00Z") }),
      regles,
      ctx,
    );
    const septembre = construireLignesPrestation(
      prestation({ date: new Date("2026-09-15T09:00:00Z") }),
      regles,
      ctx,
    );

    expect(juin.lignes[0]).toMatchObject({
      ruleId: "v1",
      tauxSnapshotCents: 90_000,
      periodeMonth: 6,
    });
    expect(septembre.lignes[0]).toMatchObject({
      ruleId: "v2",
      tauxSnapshotCents: 110_000,
      periodeMonth: 9,
    });
  });
});
