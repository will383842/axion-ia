// @formateurs E-C3 — INDEMNITÉ D'ANNULATION à moins de 72 h, des demi-journées étant
// déjà signées : elles ne sont PAS comptées dans l'indemnité (décision du dirigeant).
//
// Contrat, art. 11.1 : 50 % des honoraires des demi-journées annulées, hors forfait, si
// l'organisme annule moins de 72 heures avant la première demi-journée annulée.
//
// Exemple : lundi et mardi, 9 h – 17 h, 350 €/jour. Le lundi matin est signé (12 h 05) ;
// la session est annulée le lundi à 12 h 30. Annulées : lundi après-midi, mardi matin,
// mardi après-midi (3) → 50 % × 3 × 175 € = 262,50 € HT. Le matin signé n'y est pas.
//
// DÉFAUT V1-C-5 (test.fixme) : le matin SIGNÉ n'est payé par personne. La session
// annulée garde ses journées (`SessionJour`) ; le passage les lit comme prévues
// (`lireCandidats`, paiement/passage-mission-base.ts ~l. 59, statut de session non lu) :
// le mois reste « feuilles incomplètes » pour toujours. L'indemnité, elle, l'exclut à bon
// droit. Montant en jeu : 175 € HT ici, une demi-journée par demi-journée signée.
//
// ÉCARTS : la décision d'indemnité est écrite par la console seulement (aucun calcul
// automatique) — le banc appelle son service, `ecrireIndemniteDecidee`. M-D n'étant pas
// en base, l'écriture est REFUSÉE (`contract_non_fait`) ; le montant rendu est celui de
// l'aperçu, contre-calculé ici. Le passage de la session à « annulée » (action de la
// console, auth requise) est écrit en base par le banc.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { BASCULE_2037, HORS_BANC, bascule } from "../fixtures/formateurs/argent-commun";
import {
  aParis,
  honorairesAnimationCents,
  indemniteAnnulationCents,
} from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import {
  lignesVivantes,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { semerInterrupteurs } from "../fixtures/formateurs/interrupteurs";

const TARIF = 35_000;
/** `moteur-mission.ts` : la mission fermée alors que sa lettre est signée. */
const MOTIF_FERMEE_LETTRE_SIGNEE =
  "Mission fermée alors que la lettre est signée : Will décide (annuler avec motif, ou constater).";
const LUNDI = "2038-03-15";
const MARDI = "2038-03-16";

/**
 * Ménage : ces sessions annulées gardent des demi-journées « prévues » non signées (cf.
 * V1-C-5) ; le suivi quotidien d'un autre scénario leur écrirait F35. La fiche est donc
 * close en fin de test (fin de collaboration) : plus aucun envoi ne la vise.
 */
const fichesAClore: string[] = [];
async function clore(): Promise<void> {
  await prisma.trainer.updateMany({
    where: { id: { in: fichesAClore.splice(0) } },
    data: { finCollaborationAt: new Date(), finCollaborationMotif: "initiative_axion" },
  });
}

async function missionAnnulee(prenom: string, signerLeMatin: boolean) {
  const f = await semerFormateur({ prenom });
  fichesAClore.push(f.id);
  const s = await semerSession({
    jours: [LUNDI, MARDI].map((date) => ({ date, trainerId: f.id })),
    formateurs: [f.id],
    statut: "en_cours",
  });
  const missionId = await semerMissionAcceptee({
    sessionId: s.id,
    trainerId: f.id,
    tarifHtCents: TARIF,
    lettreBlocageMotif: MOTIF_FERMEE_LETTRE_SIGNEE,
  });
  if (signerLeMatin) {
    const [sig] = await jouer([
      {
        etape: "contresigner",
        sessionId: s.id,
        trainerId: f.id,
        date: LUNDI,
        demiJournee: "matin",
        nomConfirme: f.nomComplet,
        maintenant: aParis(LUNDI, "12:05").toISOString(),
      },
    ]);
    expect(sig).toMatchObject({ ok: true });
  }
  // L'annulation de la session (geste de la console).
  await prisma.trainingSession.update({ where: { id: s.id }, data: { statut: "annulee" } });
  return { f, s, missionId };
}

test.describe("@formateurs E-C3 — indemnité d'annulation sans les demi-journées signées", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  const interrupteurs = {
    ...bascule(BASCULE_2037),
    "formateurs.bilan_fin_formation": { actif: false },
  };

  test("à moins de 72 h : 50 % des seules demi-journées annulées non signées", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerInterrupteurs(interrupteurs);
      try {
        const { missionId } = await missionAnnulee("Iris", true);
        const tard = await missionAnnulee("Hugo", false);

        const [decision, avant72h, anterieure] = await jouer([
          {
            etape: "indemnite",
            missionId,
            annuleeA: aParis(LUNDI, "12:30").toISOString(),
            parAxion: true,
          },
          // Annulée cinq jours avant : rien n'est dû.
          {
            etape: "indemnite",
            missionId: tard.missionId,
            annuleeA: aParis("2038-03-10", "12:30").toISOString(),
            parAxion: true,
          },
          // Un instant ANTÉRIEUR à une demi-journée signée est refusé : la signature
          // prouve que la session se tenait.
          {
            etape: "indemnite",
            missionId,
            annuleeA: aParis(LUNDI, "08:00").toISOString(),
            parAxion: true,
          },
        ]);

        // Contre-calcul : 3 demi-journées annulées non signées, le matin signé exclu.
        const attendu = indemniteAnnulationCents(3, TARIF);
        expect(attendu).toBe(26_250);
        // Ce qu'aurait donné le matin compté à tort : 4 demi-journées.
        expect(indemniteAnnulationCents(4, TARIF)).toBe(35_000);
        expect(decision).toMatchObject({ montantHtCents: attendu, totalTtcCents: attendu });
        // M-D non fait : la pièce n'est pas écrite (ÉCART), rien n'est payé deux fois.
        expect((decision as { issue: string }).issue).toBe("contract_non_fait");
        expect(avant72h).toEqual({ issue: "non_due" });
        expect(anterieure).toEqual({ issue: "instant_anterieur_signature" });
      } finally {
        await restaurer();
        await clore();
      }
    });
  });

  // DÉFAUT V1-C-5 — la demi-journée signée d'une session annulée n'est jamais payée.
  test.fixme("V1-C-5 : le matin signé d'une session annulée est payé par le passage", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerInterrupteurs(interrupteurs);
      try {
        const { f, s } = await missionAnnulee("Jade", true);
        const [p] = await jouer([
          {
            etape: "passage",
            maintenant: "2038-03-20T07:15:00Z",
            dateBascule: BASCULE_2037,
            sessionIds: [s.id],
            retraitMd: "declare",
          },
        ]);
        expect(p).toMatchObject({ etat: "fait", ecrits: 1 });
        const vivantes = await lignesVivantes(f.id, s.id);
        expect(vivantes.reduce((t, l) => t + l.montantHtCents, 0)).toBe(
          honorairesAnimationCents(1, TARIF),
        );
      } finally {
        await restaurer();
        await clore();
      }
    });
  });
});
