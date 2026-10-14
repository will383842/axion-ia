// E39 — Coupure en cascade : `dossier_en_ligne` coupé avec des F9 en file,
// `echange_ouvert` coupé avec des F2 dus — aucun F9 ni F2 ne part.
//
// Tout est allumé par la console, puis COUPÉ par la console (c'est le geste
// d'un humain qui suspend). Témoins : avant la coupure, un F9 et un F2 partent
// réellement par la file. Après : les e-mails déjà en file sont retenus au
// départ, et le passage des campagnes n'enfile plus rien — le passage est
// appelé avec SES campagnes réelles, restreintes aux fiches du banc pour ne
// rien envoyer aux fixtures des autres specs.

import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";
import { CAMPAGNE_S1 } from "@/server/qualiopi/formateurs-independants/invitation-formateurs";
import { CAMPAGNE_RELANCE_DOSSIER } from "@/server/qualiopi/formateurs-independants/relance-dossier";

import {
  adresse,
  allumerParLaConsole,
  attendre,
  avecVerrouInterrupteurs,
  basculerParLaConsole,
  creerAdmin,
  creerCandidatureFreelance,
  creerIndependant,
  menage,
  noterReglage,
  prisma,
  seConnecter,
  validerTextesParLaConsole,
  valeursDuBanc,
} from "../donnees";

const FILLES = [
  "formateurs.relances_auto",
  "formateurs.pieces_cron",
  "formateurs.mise_a_niveau",
  "formateurs.invitation_auto",
  "formateurs.suivi_echange",
];

/** Un instant dans la fenêtre d'envoi (10 h à Paris), aujourd'hui. */
function dansLaFenetre(): Date {
  const d = new Date();
  d.setUTCHours(8, 30, 0, 0);
  return d;
}

export default async function e39(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      for (const k of FILLES) await noterReglage(k);
      await allumerParLaConsole(direction, [
        "textes_valides",
        "dossier_en_ligne",
        "relances_auto",
        "echange_ouvert",
        "invitation_auto",
        "suivi_echange",
      ]);
      await validerTextesParLaConsole(direction, [
        { gabarit: "formateur-dossier-relance" },
        { gabarit: "formateur-invitation-relance" },
      ]);

      const t = await creerIndependant({ actif: false, dossierStatut: "a_completer" } as never);
      const emailCandidat = adresse("candidat");
      const candidature = await creerCandidatureFreelance(emailCandidat);
      const f9 = async (delayMs: number) =>
        enqueueEmail(
          "formateur-dossier-relance" as EmailJobName,
          t.email,
          "fr",
          {
            prenom: t.prenom,
            valeurs: await valeursDuBanc("formateur-dossier-relance"),
          },
          { entityType: "Trainer", entityId: t.id, ...(delayMs ? { delayMs } : {}) },
        );
      const f2 = async (delayMs: number) =>
        enqueueEmail(
          "formateur-invitation-relance" as EmailJobName,
          emailCandidat,
          "fr",
          {
            prenom: "Hortense",
            valeurs: await valeursDuBanc("formateur-invitation-relance"),
          },
          { entityType: "JobApplication", entityId: candidature, ...(delayMs ? { delayMs } : {}) },
        );
      const lignes = (to: string) =>
        prisma.emailLog.findMany({
          where: { recipient: to },
          orderBy: { createdAt: "asc" },
          select: { template: true, status: true, error: true },
        });
      const finies = (to: string, n: number) =>
        attendre(
          () => lignes(to),
          (l) => l.length >= n && l.every((x) => x.status !== "pending"),
          60_000,
        );

      // Campagnes réelles, restreintes aux fiches du banc.
      const miennes = new Set([t.id, candidature]);
      const registre = [CAMPAGNE_RELANCE_DOSSIER, CAMPAGNE_S1].map((c) => ({
        ...c,
        lireFaits: async (m: Date) => (await c.lireFaits(m)).filter((f) => miennes.has(f.entityId)),
      }));
      const passage = () => passerCampagnes(dansLaFenetre(), { registre } as never);

      // ── Témoins : tout allumé ───────────────────────────────────────────
      const passageAvant = await passage();
      await f9(0);
      await f2(0);
      const temoinF9 = await finies(t.email, 1);
      const temoinF2 = await finies(emailCandidat, 1);

      // ── En file au moment de la coupure ─────────────────────────────────
      const enFile = { f9: await f9(15_000), f2: await f2(15_000) };

      seConnecter(direction);
      const coupures = {
        dossier_en_ligne: await basculerParLaConsole("dossier_en_ligne", false),
        echange_ouvert: await basculerParLaConsole("echange_ouvert", false),
      };
      const filles = await prisma.setting.findMany({
        where: { key: { in: FILLES } },
        select: { key: true, value: true },
      });
      const journalCascade = await prisma.activityLog.findMany({
        where: { adminUserId: direction.id, action: "formateurs.interrupteur_coupe" },
        select: { changes: true },
      });

      const passageApres = await passage();
      const apresF9 = await finies(t.email, 2);
      const apresF2 = await finies(emailCandidat, 2);

      await prisma.emailLog.deleteMany({ where: { recipient: { in: [t.email, emailCandidat] } } });
      return {
        adresses: [t.email, emailCandidat],
        passageAvant,
        temoinF9,
        temoinF2,
        enFile,
        coupures,
        filles: Object.fromEntries(filles.map((f) => [f.key, f.value])),
        journalCascade: journalCascade.map((j) => j.changes),
        passageApres,
        apresF9,
        apresF2,
      };
    });
  } finally {
    await menage();
  }
}
