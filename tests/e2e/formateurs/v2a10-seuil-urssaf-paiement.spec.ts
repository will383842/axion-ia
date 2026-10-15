// @formateurs V2-A10 — SEUIL URSSAF de 5 000 € HT au moment de PAYER une mission.
//
// Règle (lot G1, décision du 12/10, « comme les apporteurs », `lib/vigilance.ts`) : le
// cumul des honoraires HT facturés compte la mission EN COURS de paiement ; au seuil, le
// virement attend tant qu'aucune attestation vérifiée n'est valable à la date de la
// mission ; une attestation vaut 6 mois depuis son émission.
//
// Chaque formateur a déjà 4 400 € HT payés (un relevé mensuel de 2040) ; sa mission de
// mai 2041 (700 € HT) porte le cumul à 5 100 €.
//
// ÉCART : la facture de mission n'est pas émise (chaque F36 coûte une place du bridage des
// e-mails du banc) ; son relevé est passé « facture reçue » par le banc — le seul statut
// que lisent le cumul et la garde.
//
// DÉFAUT V2-A-7 (corrigé, ex-test.fixme) : la garde du virement lit la fin de validité SAISIE de
// l'attestation (`dateExpiration`) telle quelle (paiement/virement-mission-base.ts
// ~l. 139-178 ; `attenteAttestationALaMission`, paiement/virement-mission.ts ~l. 110),
// alors que la règle des pièces gardées retient la PLUS PROCHE de la date saisie et de
// « émission + 6 mois » (`pieceGardeeProbante`, formateurs-independants/gardes.ts
// ~l. 75-89 : « une date libre ne prolonge jamais une attestation »). Une attestation du
// stock saisie « valable jusqu'en 2099 » (avant le lot S1, la console l'acceptait)
// débloque donc un virement des années après son émission.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { jouerUne } from "../fixtures/formateurs/argent-execution";
import { factureDeMissionEmise } from "../fixtures/formateurs/argent-parcours";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { jouerV2aUne } from "../fixtures/formateurs/v2a-execution";
import { attestationValidee, honorairesDejaPayes } from "../fixtures/formateurs/v2a-semis";

const DEJA_PAYES = 440_000;
const MISSION = 70_000;
const SEUIL = 500_000;

interface Garde {
  verdict: { autorise: boolean; motifs: string[] };
}

/** Une mission de mai 2041 « facture reçue », après 4 400 € déjà payés. */
async function missionAuSeuil(prenom: string, jours: readonly [string, string]) {
  const f = await factureDeMissionEmise({ prenom, jours, emettre: false });
  await honorairesDejaPayes(f.formateur.id, DEJA_PAYES, { year: 2040, month: 6 });
  return f;
}

async function factureRecue(statementId: string, totalTtcCents: number) {
  await prisma.trainerStatement.update({
    where: { id: statementId },
    data: {
      statut: "facture_recue",
      numeroFacture: `BANC-V2A-${statementId.slice(0, 8)}`,
      dateFacture: new Date("2041-05-20T10:00:00Z"),
      montantFactureTtcCents: totalTtcCents,
    },
  });
}

const garde = (statementId: string, empreinte: string, maintenant: string) =>
  jouerUne<Garde>({
    etape: "garde-virement",
    statementId,
    empreinteAffichee: empreinte,
    maintenant,
  });

test.describe("@formateurs V2-A10 — seuil URSSAF au paiement d'une mission", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("le cumul compte la mission en cours : à « facture reçue », 5 100 € et le virement attend", async () => {
    await avecVerrouArgent(async () => {
      const f = await missionAuSeuil("Ursule", ["2041-05-14", "2041-05-15"]);
      // À valider : la mission n'est pas encore facturée, le cumul ne la compte pas.
      expect(await jouerV2aUne<number>({ etape: "cumul", trainerId: f.formateur.id })).toBe(
        DEJA_PAYES,
      );
      await factureRecue(f.statementId, f.totalTtcCents);
      const cumul = await jouerV2aUne<number>({ etape: "cumul", trainerId: f.formateur.id });
      expect(cumul).toBe(DEJA_PAYES + MISSION);
      expect(cumul).toBeGreaterThanOrEqual(SEUIL);
      const g = await garde(f.statementId, f.empreinte, "2041-05-25T08:00:00Z");
      expect(g.verdict.autorise).toBe(false);
      expect(g.verdict.motifs).toEqual(["attestation_urssaf_echue_a_la_mission"]);
    });
  });

  test("attestation émise 8 mois avant la mission (échue à 6 mois) : le virement attend", async () => {
    await avecVerrouArgent(async () => {
      const f = await missionAuSeuil("Ugolin", ["2041-05-21", "2041-05-22"]);
      await factureRecue(f.statementId, f.totalTtcCents);
      await attestationValidee(f.formateur.id, {
        emission: "2040-09-01",
        fin: "2041-03-01",
        valideLe: "2040-09-03",
      });
      const g = await garde(f.statementId, f.empreinte, "2041-05-25T08:00:00Z");
      expect(g.verdict.motifs).toEqual(["attestation_urssaf_echue_a_la_mission"]);
    });
  });

  test("attestation valable à la date de la mission, échue depuis : le virement part", async () => {
    await avecVerrouArgent(async () => {
      const f = await missionAuSeuil("Ulrich", ["2041-05-28", "2041-05-29"]);
      await factureRecue(f.statementId, f.totalTtcCents);
      await attestationValidee(f.formateur.id, {
        emission: "2041-01-10",
        fin: "2041-07-10",
        valideLe: "2041-01-12",
      });
      const g = await garde(f.statementId, f.empreinte, "2041-08-01T08:00:00Z");
      expect(g.verdict.motifs).not.toContain("attestation_urssaf_echue_a_la_mission");
      expect(g.verdict.autorise).toBe(true);
    });
  });

  // DÉFAUT V2-A-7 — une fin de validité saisie au-delà de 6 mois prolonge l'attestation.
  test("V2-A-7 : une attestation émise il y a 9 mois, saisie « jusqu'en 2099 », ne débloque pas le virement", async () => {
    await avecVerrouArgent(async () => {
      const f = await missionAuSeuil("Urbain", ["2041-06-04", "2041-06-05"]);
      await factureRecue(f.statementId, f.totalTtcCents);
      await attestationValidee(f.formateur.id, {
        emission: "2040-09-01",
        fin: "2099-12-31",
        valideLe: "2040-09-03",
      });
      const g = await garde(f.statementId, f.empreinte, "2041-06-10T08:00:00Z");
      expect(g.verdict.motifs).toEqual(["attestation_urssaf_echue_a_la_mission"]);
    });
  });
});
