// @formateurs V2-A8 — un VIREMENT de mission qui dépasse son échéance (facture + 30 jours).
//
// Une autofacture de mission émise, puis personne ne paie. Attendu : la vue « Virements
// à faire » la montre en rouge, au montant dû, et le moteur d'alertes la signale
// (`releve_formateur_echu`) — sans attendre que le formateur relance.
//
// ÉCART : le moteur d'alertes lit l'horloge RÉELLE (il ne reçoit pas d'instant), et
// l'autofacture est datée à l'heure réelle : le banc recule donc l'échéance de la pièce
// de 31 jours (la seule colonne touchée), plutôt que d'avancer une horloge.
//
// DÉFAUT V2-A-6 (corrigé, ex-test.fixme, mineur) : quand le virement est SUSPENDU faute d'attestation
// URSSAF au seuil (délai suspendu, art. 16.7 : aucune pénalité ne court,
// `gardeVirementMission` rend un retard nul), l'alerte dit pourtant que « des pénalités
// au taux BCE majoré de 10 points et une indemnité de 40 € » courent de plein droit
// (`regleReleveFormateurEchu`, qualiopi/alertes/evaluateur.ts ~l. 4684-4726, qui ne lit
// que l'échéance). Le geste qu'elle demande (« Payez le relevé ») est celui que la garde
// refuse.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { jouerUne } from "../fixtures/formateurs/argent-execution";
import { factureDeMissionEmise } from "../fixtures/formateurs/argent-parcours";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { jouerV2aUne } from "../fixtures/formateurs/v2a-execution";
import { attestationValidee, honorairesDejaPayes } from "../fixtures/formateurs/v2a-semis";

const JOUR_MS = 86_400_000;

interface Alertes {
  reglesEnEchec: string[];
  candidates: Array<{ code: string; cibleId: string; message: string }>;
}

/** Une autofacture de mission émise, dont l'échéance est passée de 31 jours. */
async function factureEchue(prenom: string, jours: readonly [string, string]) {
  const f = await factureDeMissionEmise({ prenom, jours });
  const echeance = new Date(Date.now() - 31 * JOUR_MS);
  await prisma.trainerStatement.update({
    where: { id: f.statementId },
    data: { echeanceAt: echeance },
  });
  return f;
}

test.describe("@formateurs V2-A8 — virement de mission en retard", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("en rouge dans « Virements à faire », au montant dû, et une alerte « honoraires échus »", async () => {
    await avecVerrouArgent(async () => {
      const f = await factureEchue("Valere", ["2041-03-05", "2041-03-06"]);
      const vue = await jouerUne<Array<{ pieceId: string; couleur: string; montantCents: number }>>(
        {
          etape: "virements",
          maintenant: new Date().toISOString(),
          ids: [f.statementId],
        },
      );
      expect(vue).toEqual([
        expect.objectContaining({
          pieceId: f.statementId,
          couleur: "rouge",
          montantCents: f.totalTtcCents,
        }),
      ]);
      const a = await jouerV2aUne<Alertes>({ etape: "alertes", cibles: [f.statementId] });
      expect(a.reglesEnEchec).not.toContain("releve_formateur_echu");
      const echu = a.candidates.filter((c) => c.code === "releve_formateur_echu");
      expect(echu).toHaveLength(1);
      expect(echu[0]!.message).toMatch(/dépassée de 3[01] jours/);
    });
  });

  // DÉFAUT V2-A-6 (mineur) — l'alerte annonce des pénalités pendant une suspension légale.
  test("V2-A-6 : virement suspendu (attestation URSSAF au seuil) : l'alerte ne dit pas que des pénalités courent", async () => {
    await avecVerrouArgent(async () => {
      const f = await factureEchue("Wanda", ["2041-03-12", "2041-03-13"]);
      // Au seuil (4 950 € déjà payés + la mission), attestation échue avant la mission.
      await honorairesDejaPayes(f.formateur.id, 495_000, { year: 2040, month: 2 });
      await attestationValidee(f.formateur.id, {
        emission: "2040-03-01",
        fin: "2040-09-01",
        valideLe: "2040-03-02",
      });
      const garde = await jouerUne<{
        verdict: { autorise: boolean; motifs: string[]; retard: { joursDeRetard: number } };
      }>({
        etape: "garde-virement",
        statementId: f.statementId,
        empreinteAffichee: f.empreinte,
        maintenant: new Date().toISOString(),
      });
      expect(garde.verdict.motifs).toEqual(["attestation_urssaf_echue_a_la_mission"]);
      expect(garde.verdict.retard.joursDeRetard).toBe(0);
      const a = await jouerV2aUne<Alertes>({ etape: "alertes", cibles: [f.statementId] });
      for (const c of a.candidates) expect(c.message).not.toMatch(/pénalités/);
    });
  });
});
