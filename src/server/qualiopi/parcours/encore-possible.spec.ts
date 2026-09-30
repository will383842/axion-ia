/**
 * « Encore possible » sur un dossier clos — UNE liste, complète, dont chaque
 * lien arrive sur une section déployée (relecture L3, 30/09/2026).
 */

import { describe, expect, it } from "vitest";

import { gestesEncorePossibles, type EntreeEncorePossible } from "./encore-possible";
import type { EtapeParcours } from "./session-parcours";

const P = "/fr/admin/qualiopi/sessions";

function etape(patch: Partial<EtapeParcours> & Pick<EtapeParcours, "cle">): EtapeParcours {
  return {
    libelle: `Libellé ${patch.cle}`,
    etat: "rattrapable",
    mention: "rattrapable",
    geste: "geste",
    phase: "apres",
    cible: { fragment: "questionnaires", libelle: "bloc Questionnaires" },
    ...patch,
  };
}

const EVALUATION = etape({
  cle: "evaluation_finale",
  cible: { sousPage: "evaluations", fragment: "insc-e1", libelle: "Évaluations" },
});
const FROID = etape({ cle: "satisfaction_froid", avancement: { fait: 1, total: 3 } });
const SIGNATURE = etape({
  cle: "convention_signee",
  phase: "preparer",
  cible: { fragment: "signature-pieces", libelle: "bloc Signature des pièces contractuelles" },
});
const FAITE = etape({ cle: "satisfaction_chaud", etat: "fait" });

function entree(patch: Partial<EntreeEncorePossible> = {}): EntreeEncorePossible {
  return {
    sessionId: "S1",
    prefixeSessions: P,
    etapes: [EVALUATION, FROID, FAITE],
    piecesASigner: [],
    exemplairesARemettre: 0,
    froidSansReponse: 0,
    factures: 1,
    ...patch,
  };
}

describe("gestesEncorePossibles", () => {
  it("liste les étapes dues ENCORE permises, jamais une étape verrouillée ni faite", () => {
    const liste = gestesEncorePossibles(entree());
    expect(liste.map((g) => g.libelle)).toEqual(["Libellé satisfaction_froid (1/3) — rattrapable"]);
  });

  it("🔴 chaque lien vers la fiche porte sa phase : la section est déployée à l'arrivée", () => {
    const liste = gestesEncorePossibles(
      entree({
        etapes: [FROID, SIGNATURE],
        piecesASigner: [{ type: "lettre_mission" }],
        exemplairesARemettre: 2,
        factures: 0,
      }),
    );
    expect(liste.map((g) => g.href)).toEqual([
      `${P}/S1?phase=apres#questionnaires`,
      `${P}/S1?phase=preparer#signature-pieces`,
      `${P}/S1?phase=cloturee#documents`,
      `${P}/S1?phase=cloturee#documents`,
      `${P}/S1/financement#facturation`,
    ]);
    for (const g of liste) {
      if (!g.href.includes("/financement")) expect(g.href, g.libelle).toMatch(/\?phase=[a-z_]+#/);
    }
  });

  it("une convention déjà listée par son étape n'est pas recomptée parmi les pièces", () => {
    const pieces = [{ type: "convention" }, { type: "lettre_mission" }];
    const avecEtape = gestesEncorePossibles(entree({ etapes: [SIGNATURE], piecesASigner: pieces }));
    expect(avecEtape.map((g) => g.libelle)).toContain(
      "1 pièce attend encore une signature ou un contreseing",
    );
    // TÉMOIN — sans étape de signature due, la convention compte.
    const sansEtape = gestesEncorePossibles(entree({ etapes: [], piecesASigner: pieces }));
    expect(sansEtape.map((g) => g.libelle)).toContain(
      "2 pièces attendent encore une signature ou un contreseing",
    );
  });

  it("le comptage des questionnaires à froid ne double PAS l'étape du parcours", () => {
    const liste = gestesEncorePossibles(entree({ froidSansReponse: 2 }));
    expect(liste.filter((g) => /froid/i.test(g.libelle))).toHaveLength(1);
  });

  it("parcours illisible : le comptage à froid prend le relais, rien n'est tu", () => {
    const liste = gestesEncorePossibles(entree({ etapes: null, froidSansReponse: 2 }));
    expect(liste).toEqual([
      {
        libelle: "2 questionnaires à froid en attente de réponse du stagiaire",
        href: `${P}/S1?phase=apres#questionnaires`,
      },
    ]);
  });

  it("« Aucune facture émise » seulement quand il n'y en a aucune", () => {
    expect(gestesEncorePossibles(entree({ factures: 0 })).map((g) => g.libelle)).toContain(
      "Aucune facture émise",
    );
    expect(gestesEncorePossibles(entree({ factures: 1 })).map((g) => g.libelle)).not.toContain(
      "Aucune facture émise",
    );
  });
});
