// @formateurs — NON-RÉGRESSION 3 : le relevé mensuel d'un formateur SALARIÉ
// est inchangé, au centime.
//
// Le chantier « formateurs freelance » ajoute un statut et ses règles ; il ne
// doit RIEN changer à ce qu'un salarié touche. Ce spec fige, sur le scénario
// de `./remuneration-salarie.ts`, les montants que le calcul
// de `main` produisait le jour où le banc a été posé (2026-10-09) :
//
//   · les lignes du mois (`construireLignesPrestation`, l'appel même du run
//     mensuel) — modèle, nature, statut, assiette et montant de chacune ;
//   · le relevé (`construireReleve`) — qui pour un salarié est ABSENT, et
//     doit le rester : il est payé par la paie, jamais sur facture ;
//   · le fixe récupérable (`deroulerAvanceRecuperable`), sommé comme le fait
//     la fiche formateur (`lireSituationFixe` : lignes `analytique` à l'état
//     `calcule` ou `valide`).
//
// 🔑 Un montant qui bouge ici n'est pas forcément faux — mais il doit être
// DÉCIDÉ, et ce test le fait voir. Le changer demande de dire pourquoi dans la
// PR qui le change.
//
// 📁 Rangé sous `tests/e2e/qualiopi/` et non `tests/e2e/formateurs/` : il
// importe le domaine Qualiopi, que `pnpm qualiopi:isolation-check` cantonne à
// ses zones dédiées. Le tag `@formateurs` le garde dans le banc.
//
// Calcul PUR : aucune base, aucun serveur. Le banc l'exécute quand même sous
// Gate B, avec les autres specs `@formateurs`.

import { expect, test } from "@playwright/test";

import {
  construireLignesPrestation,
  construireReleve,
  type Anomalie,
  type LigneAPersister,
} from "@/server/qualiopi/remuneration/run";
import {
  deroulerAvanceRecuperable,
  synthetiser,
} from "@/server/qualiopi/remuneration/avance-recuperable";

import {
  FORMATEURS_BANC,
  PERIODE_BANC,
  PRESTATIONS_BANC,
  REGLES_BANC,
  SALARIE_BANC,
  trimestreDuSalarie,
} from "./remuneration-salarie";

function calculerLeMois(): { lignes: LigneAPersister[]; anomalies: Anomalie[] } {
  const lignes: LigneAPersister[] = [];
  const anomalies: Anomalie[] = [];
  for (const prestation of PRESTATIONS_BANC) {
    const r = construireLignesPrestation(prestation, REGLES_BANC, FORMATEURS_BANC);
    lignes.push(...r.lignes);
    anomalies.push(...r.anomalies);
  }
  return { lignes, anomalies };
}

test.describe("@formateurs non-régression — relevé mensuel d'un salarié", () => {
  test("les lignes de mars 2026 sont inchangées, au centime", () => {
    const { lignes, anomalies } = calculerLeMois();
    expect(anomalies, "aucune anomalie sur un scénario complet").toEqual([]);

    const duSalarie = lignes
      .filter((l) => l.trainerId === SALARIE_BANC)
      .map((l) => ({
        session: l.sessionId,
        model: l.model,
        nature: l.nature,
        statut: l.statut,
        caBaseCents: l.caBaseCents,
        heures: l.heures,
        nbJours: l.nbJours,
        tauxSnapshotCents: l.tauxSnapshotCents,
        commissionPctSnapshot: l.commissionPctSnapshot,
        montantHtCents: l.montantHtCents,
        periode: `${l.periodeYear}-${l.periodeMonth}`,
      }));

    expect(duSalarie).toEqual([
      {
        session: "b4c00000-0000-4000-8000-000000000001",
        model: "commission_ca_pct",
        nature: "analytique",
        statut: "calcule",
        caBaseCents: 419_999,
        heures: 7,
        nbJours: null,
        tauxSnapshotCents: null,
        commissionPctSnapshot: 30,
        montantHtCents: 126_000,
        periode: "2026-3",
      },
      {
        session: "b4c00000-0000-4000-8000-000000000002",
        model: "commission_ca_pct",
        nature: "analytique",
        statut: "calcule",
        caBaseCents: 200_000,
        heures: 8.5,
        nbJours: null,
        tauxSnapshotCents: null,
        commissionPctSnapshot: 30,
        montantHtCents: 60_000,
        periode: "2026-3",
      },
      {
        session: "b4c00000-0000-4000-8000-000000000003",
        model: "taux_journalier",
        nature: "analytique",
        statut: "calcule",
        caBaseCents: 280_000,
        heures: 10.5,
        nbJours: 1.5,
        tauxSnapshotCents: 52_500,
        commissionPctSnapshot: null,
        montantHtCents: 78_750,
        periode: "2026-3",
      },
      {
        session: "b4c00000-0000-4000-8000-000000000004",
        model: "commission_ca_pct",
        nature: "analytique",
        statut: "annule",
        caBaseCents: 150_000,
        heures: 7,
        nbJours: null,
        tauxSnapshotCents: null,
        commissionPctSnapshot: 30,
        montantHtCents: 0,
        periode: "2026-3",
      },
      {
        session: "b4c00000-0000-4000-8000-000000000005",
        model: "commission_ca_pct",
        nature: "analytique",
        statut: "calcule",
        caBaseCents: 99_999,
        heures: 3.5,
        nbJours: null,
        tauxSnapshotCents: null,
        commissionPctSnapshot: 30,
        montantHtCents: 30_000,
        periode: "2026-3",
      },
    ]);

    // La co-animation n'a perdu aucun centime : 200 000 + 133 333 = 333 333.
    const coAnimateur = lignes.filter((l) => l.trainerId !== SALARIE_BANC);
    expect(coAnimateur.map((l) => [l.nature, l.caBaseCents, l.montantHtCents])).toEqual([
      ["honoraire_du", 133_333, 35_750],
    ]);
  });

  test("un salarié n'a toujours AUCUN relevé facturable", () => {
    const { lignes } = calculerLeMois();
    const formateur = FORMATEURS_BANC.get(SALARIE_BANC);
    if (formateur === undefined) throw new Error("salarié du banc absent du scénario");
    const duSalarie = lignes.filter((l) => l.trainerId === SALARIE_BANC);
    expect(construireReleve(formateur, PERIODE_BANC, duSalarie)).toEqual({
      releve: null,
      anomalies: [],
    });
  });

  test("le fixe récupérable du trimestre est inchangé, au centime", () => {
    const { lignes } = calculerLeMois();
    // La somme de `lireSituationFixe` : lignes analytiques calculées ou validées.
    const commissionsMars = lignes
      .filter(
        (l) =>
          l.trainerId === SALARIE_BANC &&
          l.nature === "analytique" &&
          (l.statut === "calcule" || l.statut === "valide"),
      )
      .reduce((total, l) => total + l.montantHtCents, 0);
    expect(commissionsMars).toBe(294_750);

    const deroule = deroulerAvanceRecuperable(trimestreDuSalarie(commissionsMars));
    expect(
      deroule.map((m) => [
        m.month,
        m.detteEntranteCents,
        m.remboursementCents,
        m.complementCents,
        m.detteSortanteCents,
      ]),
    ).toEqual([
      // mois, dette entrante, remboursement, complément, dette sortante
      [1, 0, 0, 0, 111_667],
      [2, 111_667, 86_234, 0, 25_433],
      [3, 25_433, 25_433, 24_317, 0],
    ]);

    const synthese = synthetiser(deroule);
    expect(synthese.complementDuMoisCents).toBe(24_317);
    expect(synthese.detteCents).toBe(0);
  });
});
