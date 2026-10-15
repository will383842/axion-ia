// @formateurs E21 — ÉMARGEMENT MANQUANT du formateur :
//   · F34 (demande de contresignature) le soir, puis +23 h, puis +46 h — trois au plus ;
//   · F35 (feuilles manquantes) à J+3 ; alerte interne à J+10 ;
//   · « payer sur constat » REPORTÉ (hors version) : rien ne le propose, rien n'est payé ;
//   · visio prouvée seulement par un relevé de connexion importé : F35 part quand même,
//     et c'est la seule campagne (aucun F34).
//
// DÉFAUT V1-C-10 (test.fixme) : la « feuille papier » est REPORTÉE (décision du
// dirigeant), mais F35 la propose encore : « Signez-les depuis votre espace, ou déposez la
// feuille papier signée » (lib/email/templates/formateur-independant-textes.ts ~l. 868).
// Aucun type de pièce ne permet ce dépôt (`TYPES_DEPOSABLES`, depot.ts ~l. 40) : le
// formateur est envoyé vers un geste qui n'existe pas. (La contresignature accepte aussi
// `papier_scanne`, photo d'une feuille papier, depuis l'espace : à trancher avec le même
// report.)
//
// DÉFAUT V1-C-11 (test.fixme) : un même envoi peut laisser DEUX lignes au journal des
// envois. `enqueueEmail` pose le job en file AVANT d'écrire la ligne « pending »
// (server/queue/queues.ts ~l. 1048 puis ~l. 1087) ; la garde de `journaliserEnAttente`
// (server/email/email-log.ts ~l. 69, lire puis créer) n'est pas atomique. Un worker qui
// termine l'envoi entre les deux CRÉE sa ligne « sent » (`cloturerJournal`, ~l. 194-200),
// puis l'enfilage crée la sienne, restée « pending » pour toujours. F34 compte ces lignes
// (rang et plafond de 3, emargement/demande-contresignature.ts ~l. 214) et les campagnes
// F40/F41 aussi (pieces-relances.ts ~l. 542) : un rappel peut être sauté au hasard.
// Constaté sur le banc CI (run 38638829976, tentative 2 : « 2 ligne(s) » pour un F34).
// Les scénarios d'argent écartent cette course pour éprouver la cadence (envois retenus le
// temps d'un passage, `retenirLeWorker`) et comptent les envois par `jobId` distinct.
//
// ÉCARTS : `enqueueEmail` date sa ligne de journal à l'heure RÉELLE ; la garde des 23 h
// la relit. Le banc rejoue des journées de 2038 : il RECALE la date de chaque ligne F34
// sur l'instant piloté du passage qui l'a écrite (`recalerJournal`), seule colonne
// touchée. Les alertes internes partent par Telegram (coupé dans le banc) : elles se
// constatent par leur trace au journal d'activité, posée AVANT l'alerte. Les e-mails se
// constatent à l'enfilage — journal des envois, valeurs du job, texte rendu — et non à
// leur remise au puits : le worker est bridé à 40 envois par heure pour tout le banc
// (voir `jobEnFile`).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  BASCULE_2037,
  HORS_BANC,
  attendreEnvois,
  bascule,
  dernierEnvoiRendu,
  envoisDistincts,
  recalerJournal,
  semerTextesValides,
} from "../fixtures/formateurs/argent-commun";
import { aParis, plusJours } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import {
  relevesDe,
  semerFormateur,
  semerInscrit,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

const TARIF = 35_000;
const interrupteurs = {
  ...bascule(BASCULE_2037),
  "formateurs.bilan_fin_formation": { actif: false },
};

interface BilanF34 {
  horsPlage: boolean;
}
interface BilanSuivi {
  etat: string;
  f35: number;
  alertesFeuilles: number;
}

/**
 * Un passage F34 à `instant` ; recale la ligne qu'il a écrite sur cet instant. Rend le
 * nombre de F34 écrits pour CETTE session (le bilan du passage compte toute la base).
 */
async function passageF34(sessionId: string, instant: Date): Promise<number> {
  const avant = new Set(
    (
      await prisma.emailLog.findMany({
        where: { template: "formateur-contresignature", entityId: sessionId },
        select: { id: true },
      })
    ).map((l) => l.id),
  );
  const [b] = (await jouer([
    { etape: "demandes-contresignature", maintenant: instant.toISOString(), retenirLeWorker: true },
  ])) as [BilanF34];
  expect(b.horsPlage).toBe(false);
  const nouvelles = await prisma.emailLog.findMany({
    where: { template: "formateur-contresignature", entityId: sessionId },
    select: { id: true, jobId: true },
  });
  // Un envoi = un `jobId` (V1-C-11 : il peut laisser deux lignes).
  const jobIds = [...new Set(nouvelles.filter((x) => !avant.has(x.id)).map((x) => x.jobId!))];
  for (const jobId of jobIds) await recalerJournal(jobId, instant);
  return jobIds.length;
}

/**
 * Un passage du suivi quotidien ; rend ce qu'il a fait POUR CE FORMATEUR. Le bilan du
 * passage compte toute la base (d'autres scénarios y ont laissé des feuilles
 * incomplètes) : on compte donc ses F35 au journal des envois et ses alertes à leur
 * trace au journal d'activité.
 */
async function suivi(jour: string, f: { id: string; email: string }) {
  const [b] = (await jouer([
    { etape: "suivi", maintenant: aParis(jour, "08:15").toISOString() },
  ])) as [BilanSuivi];
  expect(b.etat).toBe("fait");
  const [f35, alertes] = await Promise.all([
    envoisDistincts({ destinataire: f.email, gabarit: "formateur-feuilles-manquantes" }).then(
      (l) => l.length,
    ),
    prisma.activityLog.count({
      where: {
        action: {
          in: ["qualiopi.formateur.feuilles_alerte_j10", "qualiopi.formateur.feuilles_alerte_j20"],
        },
        targetId: f.id,
      },
    }),
  ]);
  return { f35, alertes };
}

test.describe("@formateurs E21 — émargement manquant, F34, F35, alerte", () => {
  test.setTimeout(2_400_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("présentiel : F34 le soir, +23 h, +46 h ; F35 à J+3 ; alerte à J+10 ; rien sur constat", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides(["formateur-feuilles-manquantes"], interrupteurs);
      const f = await semerFormateur({ prenom: "Gaspard" });
      try {
        const JOUR = "2038-04-12";
        const s = await semerSession({
          jours: [{ date: JOUR, trainerId: f.id }],
          formateurs: [f.id],
          statut: "en_cours",
        });
        await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
        // Les stagiaires ont signé ; le formateur, rien.
        const inscrit = await semerInscrit({
          sessionId: s.id,
          creneaux: [
            { date: JOUR, demiJournee: "matin" },
            { date: JOUR, demiJournee: "apres_midi" },
          ],
        });
        const signes = await jouer(
          inscrit.creneaux.map((c) => ({
            etape: "signer-stagiaire" as const,
            creneauId: c.id,
            enrollmentId: inscrit.enrollmentId,
            nomConfirme: inscrit.nomComplet,
            maintenant: aParis(JOUR, c.demiJournee === "matin" ? "09:15" : "14:15").toISOString(),
          })),
        );
        expect(signes).toMatchObject([{ ok: true }, { ok: true }]);

        // F34 : pas avant la fin de la journée ; le soir ; pas à +22 h ; +23 h ; +46 h ; plafond.
        const soir = aParis(JOUR, "17:25");
        const h = (n: number) => new Date(soir.getTime() + n * 3_600_000);
        expect(await passageF34(s.id, aParis(JOUR, "16:25"))).toBe(0);
        expect(await passageF34(s.id, soir)).toBe(1);
        expect(await passageF34(s.id, h(22))).toBe(0);
        expect(await passageF34(s.id, h(23))).toBe(1);
        expect(await passageF34(s.id, h(46))).toBe(1);
        expect(await passageF34(s.id, h(69))).toBe(0);
        const f34 = await envoisDistincts({
          destinataire: f.email,
          gabarit: "formateur-contresignature",
        });
        expect(f34.map((l) => l.createdAt.toISOString())).toEqual(
          [soir, h(23), h(46)].map((d) => d.toISOString()),
        );

        // F35 : pas à J+2, à J+3, une seule fois (cumuls pour ce formateur).
        expect(await suivi(plusJours(JOUR, 2), f)).toEqual({ f35: 0, alertes: 0 });
        expect(await suivi(plusJours(JOUR, 3), f)).toEqual({ f35: 1, alertes: 0 });
        expect(await suivi(plusJours(JOUR, 4), f)).toEqual({ f35: 1, alertes: 0 });
        await attendreEnvois(f.email, "formateur-feuilles-manquantes", 1);

        // Alerte interne à J+10, une fois (trace au journal d'activité).
        expect(await suivi(plusJours(JOUR, 9), f)).toEqual({ f35: 1, alertes: 0 });
        expect(await suivi(plusJours(JOUR, 10), f)).toEqual({ f35: 1, alertes: 1 });
        expect(await suivi(plusJours(JOUR, 11), f)).toEqual({ f35: 1, alertes: 1 });

        // « Payer sur constat » est reporté : à J+20, une alerte de plus, et RIEN de payé.
        expect(await suivi(plusJours(JOUR, 20), f)).toEqual({ f35: 1, alertes: 2 });
        const [p] = await jouer([
          {
            etape: "passage",
            maintenant: aParis(plusJours(JOUR, 21), "08:15").toISOString(),
            dateBascule: BASCULE_2037,
            sessionIds: [s.id],
            retraitMd: "declare",
          },
        ]);
        expect(p).toMatchObject({ etat: "fait", ecrits: 0 });
        expect(await relevesDe(f.id)).toEqual([]);
        const surConstat = await prisma.trainerStatement.count({
          where: { trainerId: f.id, surConstatAt: { not: null } } as never,
        });
        expect(surConstat).toBe(0);

        // Le journal : trois F34 et un F35, rien d'autre ; F35 dit le jour et le nombre.
        expect(
          (await envoisDistincts({ destinataire: f.email })).map((l) => l.template).sort(),
        ).toEqual([
          "formateur-contresignature",
          "formateur-contresignature",
          "formateur-contresignature",
          "formateur-feuilles-manquantes",
        ]);
        const f35 = await dernierEnvoiRendu(f.email, "formateur-feuilles-manquantes");
        expect(f35.texte).toContain("lundi 12 avril (2 demi-journée(s))");
      } finally {
        await restaurer();
      }
    });
  });

  test("visio prouvée par un relevé importé : aucun F34, F35 à J+3, une seule campagne", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides(["formateur-feuilles-manquantes"], interrupteurs);
      const f = await semerFormateur({ prenom: "Hortense" });
      try {
        const JOUR = "2038-04-19";
        const s = await semerSession({
          jours: [{ date: JOUR, trainerId: f.id }],
          formateurs: [f.id],
          modalite: "distanciel",
          statut: "en_cours",
        });
        await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
        // La présence vient d'un relevé de connexion importé (Zoom), grain « journée ».
        const releve = await prisma.releveConnexionImport.create({
          data: {
            sessionId: s.id,
            plateforme: "zoom",
            fichierOriginalNom: "banc-releve-zoom.csv",
            hashSha256: "b".repeat(64),
          } as never,
          select: { id: true },
        });
        const inscrit = await semerInscrit({ sessionId: s.id, creneaux: [] });
        await prisma.presenceCreneau.create({
          data: {
            enrollmentId: inscrit.enrollmentId,
            date: new Date(`${JOUR}T00:00:00Z`),
            demiJournee: "journee",
            libelle: "Journée (relevé Zoom)",
            dureePrevueMinutes: 420,
            source: "import_zoom",
            importId: releve.id,
          } as never,
        });

        const soir = aParis(JOUR, "17:25");
        expect(await passageF34(s.id, soir)).toBe(0);
        expect(await passageF34(s.id, new Date(soir.getTime() + 23 * 3_600_000))).toBe(0);
        expect(await suivi(plusJours(JOUR, 3), f)).toMatchObject({ f35: 1 });
        expect(await suivi(plusJours(JOUR, 4), f)).toMatchObject({ f35: 1 });

        const journal = await envoisDistincts({ destinataire: f.email });
        expect(journal.map((l) => l.template)).toEqual(["formateur-feuilles-manquantes"]);
      } finally {
        await restaurer();
      }
    });
  });

  // DÉFAUT V1-C-10 — F35 propose la feuille papier, reportée.
  test.fixme("V1-C-10 : F35 ne propose pas la feuille papier (reportée)", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides(["formateur-feuilles-manquantes"], interrupteurs);
      const f = await semerFormateur({ prenom: "Isidore" });
      try {
        const JOUR = "2038-04-26";
        const s = await semerSession({
          jours: [{ date: JOUR, trainerId: f.id }],
          formateurs: [f.id],
          statut: "realisee",
        });
        await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
        expect(await suivi(plusJours(JOUR, 3), f)).toMatchObject({ f35: 1 });
        const f35 = await dernierEnvoiRendu(f.email, "formateur-feuilles-manquantes");
        expect(f35.texte).not.toMatch(/papier/i);
      } finally {
        await restaurer();
      }
    });
  });

  // DÉFAUT V1-C-11 — un envoi, deux lignes au journal, quand le worker devance l'enfilage.
  // Course : le test peut passer par chance ; il échoue dès que le worker est plus rapide.
  test.fixme("V1-C-11 : chaque F34 parti laisse UNE ligne au journal des envois", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides([], interrupteurs);
      const f = await semerFormateur({ prenom: "Jules" });
      try {
        const JOUR = "2038-05-03";
        const s = await semerSession({
          jours: [{ date: JOUR, trainerId: f.id }],
          formateurs: [f.id],
          statut: "en_cours",
        });
        const inscrit = await semerInscrit({
          sessionId: s.id,
          creneaux: [{ date: JOUR, demiJournee: "matin" }],
        });
        await jouer([
          {
            etape: "signer-stagiaire",
            creneauId: inscrit.creneaux[0]!.id,
            enrollmentId: inscrit.enrollmentId,
            nomConfirme: inscrit.nomComplet,
            maintenant: aParis(JOUR, "09:15").toISOString(),
          },
          // SANS retenir le worker : la course est libre.
          { etape: "demandes-contresignature", maintenant: aParis(JOUR, "17:25").toISOString() },
        ]);
        await attendreEnvois(f.email, "formateur-contresignature", 1);
        await expect
          .poll(
            async () =>
              (
                await prisma.emailLog.findMany({
                  where: { recipient: f.email, template: "formateur-contresignature" },
                  select: { status: true },
                })
              ).map((l) => l.status),
            { timeout: 60_000 },
          )
          .toEqual(["sent"]);
      } finally {
        await restaurer();
      }
    });
  });
});
