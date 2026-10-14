/**
 * Formateurs indépendants — la RELANCE du bilan de fin de formation (F61) et l'ALERTE
 * interne à J+10 (lot G2).
 *
 * Une déclaration du registre des campagnes (CAMP-3) : aucune règle de relance propre,
 * le moteur commun décide (`lib/relances/campagne.ts`), le passage horaire envoie
 * (8 h - 19 h, une par personne et par jour).
 *   - origine : la dernière journée de la session ;
 *   - J+2 puis J+7, deux au plus, rien après 14 jours ;
 *   - arrêt : bilan terminé, « payer quand même », collaboration finie, adresse morte,
 *     opposition ;
 *   - interrupteurs : `textes_valides` (clé mère du registre) ET
 *     `formateurs.bilan_fin_formation`, lu ici : éteint, rien n'est lu au-delà de lui.
 *
 * L'alerte interne (Telegram) ne porte aucun nom : le numéro de session et un compteur.
 * Elle part une fois par bilan, tracée au journal (cible : la ligne du bilan, un UUID).
 *
 * Module neutre (ni `server-only`, ni Next) : le passage tourne dans le worker.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { sendTelegram } from "@/lib/telegram";
import { normaliserAdresse } from "@/server/email/opposition-jeton";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { journaliser } from "@/server/journal/journaliser";
import { formateursDeLaSession } from "@/server/qualiopi/appreciations/formateurs-de-la-session";
import type { DeclarationCampagne, FaitsCampagne } from "@/server/relances/registre-campagnes";

import { ajouterJours, jourParis } from "../argent/dates";
import { interrupteurAllume } from "../interrupteur-allume";
import { lireAllumageBilan } from "./allumage";
import {
  ALERTE_BILAN_JOURS,
  ANCRE_BILAN,
  bilanAAlerter,
  bilanExige,
  remetLeBilan,
  derniereJourneeDe,
  derniereJourneePassee,
  faitsRelanceBilan,
  GABARIT_RELANCE_BILAN,
  ID_CAMPAGNE_BILAN,
  REGLE_RELANCE_BILAN,
  type LigneRelanceBilan,
} from "./regles";

/** Fenêtre de lecture : au-delà, la relance est muette (14 jours) et l'alerte déjà partie. */
const FENETRE_JOURS = 30;
const PLAFOND = 500;

export const ACTION_ALERTE_BILAN = "qualiopi.formateur.bilan_alerte_j10";

function lienBilan(sessionId: string): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return site ? `${site}${FORMATEUR_BASE_PATH}/sessions/${sessionId}#${ANCRE_BILAN}` : null;
}

export interface LigneBilanLue extends LigneRelanceBilan {
  readonly numero: string;
}

/** Lecture EN LOT des couples (formateur indépendant, session finie) dont le bilan est exigé. */
export async function lireLignesBilan(maintenant: Date): Promise<LigneBilanLue[]> {
  if (!(await interrupteurAllume("bilan_fin_formation"))) return [];
  const allumeLe = await lireAllumageBilan(prisma);
  if (allumeLe === null) return [];
  const aujourdhui = jourParis(maintenant);
  const depuis = new Date(`${ajouterJours(aujourdhui, -FENETRE_JOURS)}T00:00:00Z`);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { notIn: ["annulee", "reportee"] },
      jours: { some: { date: { gte: depuis } } },
    },
    orderBy: { id: "asc" },
    take: PLAFOND,
    select: {
      id: true,
      numero: true,
      titreSession: true,
      formateurPrincipalId: true,
      sessionFormateurs: { select: { trainerId: true } },
      jours: { select: { date: true, heureFin: true, trainerId: true } },
    },
  });
  const finies = sessions.flatMap((s) => {
    const d = derniereJourneeDe(s.jours);
    if (d === null || !derniereJourneePassee(s.jours, maintenant)) return [];
    return [{ s, derniere: d.jour, formateurs: formateursDeLaSession(s) }];
  });
  if (finies.length === 0) return [];
  const ids = [...new Set(finies.flatMap((f) => f.formateurs))];
  const formateurs = await prisma.trainer.findMany({
    where: { id: { in: ids }, statut: "sous_traitant", organismeSousTraitantId: null },
    select: {
      id: true,
      email: true,
      prenom: true,
      statut: true,
      organismeSousTraitantId: true,
      finCollaborationAt: true,
    },
  });
  const parId = new Map(formateurs.map((f) => [f.id, f]));
  const couples = finies.flatMap(({ s, derniere, formateurs: fs }) =>
    fs.flatMap((trainerId) => {
      const t = parId.get(trainerId);
      if (t === undefined) return [];
      const remet = remetLeBilan(trainerId, s);
      if (!bilanExige({ ...t, remetLeBilan: remet, allumeLe, derniereJournee: derniere })) {
        return [];
      }
      return [{ s, derniere, t }];
    }),
  );
  if (couples.length === 0) return [];
  const trainerIds = [...new Set(couples.map((c) => c.t.id))];
  const [bilans, journal, oppositions] = await Promise.all([
    prisma.bilanFinFormation.findMany({
      where: { sessionId: { in: [...new Set(couples.map((c) => c.s.id))] } },
      select: { sessionId: true, trainerId: true, termineAt: true, payerQuandMemeAt: true },
    }),
    prisma.emailLog.findMany({
      where: {
        entityType: "Trainer",
        entityId: { in: trainerIds },
        template: GABARIT_RELANCE_BILAN,
        status: { not: "failed" },
        createdAt: { gte: depuis },
      },
      select: { entityId: true, jobId: true, createdAt: true, bounceType: true },
    }),
    prisma.emailOpposition.findMany({
      where: {
        emailHash: {
          in: formateurs
            .map((f) => hashEmailForLookup(normaliserAdresse(f.email)))
            .filter((h): h is string => h !== null),
        },
      },
      select: { emailHash: true },
    }),
  ]);
  const opposes = new Set(oppositions.map((o) => o.emailHash));
  return couples.map(({ s, derniere, t }) => {
    const b = bilans.find((x) => x.sessionId === s.id && x.trainerId === t.id);
    const lignes = journal.filter((j) => j.entityId === t.id);
    const prefixe = `fi-${ID_CAMPAGNE_BILAN}-${t.id}-${s.id}-`;
    const empreinte = hashEmailForLookup(normaliserAdresse(t.email));
    return {
      trainerId: t.id,
      sessionId: s.id,
      numero: s.numero,
      email: t.email,
      prenom: t.prenom,
      intitule: s.titreSession,
      derniereJournee: derniere,
      termine: b?.termineAt != null,
      payerQuandMeme: b?.payerQuandMemeAt != null,
      fermee: t.finCollaborationAt !== null,
      relances: lignes.filter((j) => (j.jobId ?? "").startsWith(prefixe)).map((j) => j.createdAt),
      adresseMorte: lignes.some((j) => j.bounceType === "hard"),
      opposition: empreinte !== null && opposes.has(empreinte),
    };
  });
}

export const CAMPAGNE_BILAN: DeclarationCampagne<"j2" | "j7"> = {
  id: ID_CAMPAGNE_BILAN,
  gabarit: GABARIT_RELANCE_BILAN,
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_RELANCE_BILAN,
  // Variante 1 à J+2, variante 2 à J+7 (le rang de l'étape).
  interrupteurs: ["textes_valides"],
  lireFaits: async (maintenant) =>
    (await lireLignesBilan(maintenant)).flatMap((l): FaitsCampagne[] => {
      const f = faitsRelanceBilan(l, lienBilan(l.sessionId));
      return f === null ? [] : [f];
    }),
};

/**
 * L'alerte interne à J+10 : une fois par bilan, tracée au journal AVANT d'alerter (sans
 * trace, pas d'alerte : elle se répéterait). De 8 h à 19 h (Paris). Ne lève jamais.
 */
export async function passerAlerteBilanFinFormation(maintenant: Date): Promise<number> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return 0;
  const heure = Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" })
      .formatToParts(maintenant)
      .find((p) => p.type === "hour")?.value ?? "0",
  );
  if (heure < 8 || heure >= 19) return 0;
  try {
    const dues = (await lireLignesBilan(maintenant)).filter((l) => bilanAAlerter(l, maintenant));
    let n = 0;
    for (const l of dues) {
      // La ligne du bilan sert de cible (UUID) ; créée vide si le formateur n'a rien fait.
      const { id } = await prisma.bilanFinFormation.upsert({
        where: { sessionId_trainerId: { sessionId: l.sessionId, trainerId: l.trainerId } },
        create: { sessionId: l.sessionId, trainerId: l.trainerId },
        update: {},
        select: { id: true },
      });
      const deja = await prisma.activityLog.count({
        where: { action: ACTION_ALERTE_BILAN, targetId: id },
      });
      if (deja > 0) continue;
      const ecrit = await journaliser(prisma, {
        action: ACTION_ALERTE_BILAN,
        targetType: "BilanFinFormation",
        targetId: id,
        changes: { sessionId: l.sessionId, trainerId: l.trainerId, jours: ALERTE_BILAN_JOURS },
        session: null,
      });
      if (!ecrit) continue;
      await sendTelegram({
        tag: "AUTO",
        body: `📌 Bilan de fin de formation toujours manquant ${ALERTE_BILAN_JOURS} jours après la dernière journée (${l.numero}). Le formateur a été relancé ; son paiement attend. « Payer quand même » est sur la page « Évaluations » de la session.`,
      }).catch(() => false);
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
