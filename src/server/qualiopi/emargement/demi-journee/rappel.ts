/**
 * Chantier QNC, lot L06 — LE RAPPEL AU DÉBUT DE CHAQUE DEMI-JOURNÉE.
 *
 * Appelé par le passage horaire du cron `formation-crons.liens-emargement-j0`.
 * Pour chaque session du jour sur laquelle `qualiopi.emargement.actif` agit,
 * chaque inscrit actif reçoit, au début de chacune de ses demi-journées, un
 * lien NEUF qui ne sert que cette demi-journée (`creerTokenInscription` fixe
 * son expiration à la fin du créneau) — avec `envoye_at` posé après l'envoi
 * accepté, comme tout lien remis (`envoi-liens.ts`).
 *
 * Idempotence : chaque rappel parti s'inscrit au journal des relances
 * (`relances_journal`, ajout seul) sous l'objet
 * `emargement_demi_journee:<jour>:<demi-journée>`. Une demi-journée qui a son
 * rappel n'en reçoit pas un second ; un envoi qui échoue n'écrit rien et se
 * retente au passage suivant, tant que la demi-journée est ouverte.
 *
 * ⚠️ Atteint par le WORKER : aucun import Next ni Server Action. L'envoi passe
 * par un import DYNAMIQUE (`envoi-liens` tire `queues.ts`), même raison que
 * dans le cron.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { estActifPour, type EtatInterrupteur } from "@/server/qualiopi/socle/interrupteurs";
import { lireInterrupteurEmargement } from "./activation";
import { cleDemiJournee, demiJourneeDuRappel } from "./fenetre";
import { demiJourneesDepuis } from "./lecture";
import { objetRappel, PREFIXE_OBJET_RAPPEL } from "./rappel-objet";

export interface BilanRappels {
  readonly sessions: number;
  readonly envoyes: number;
  readonly echecs: ReadonlyArray<string>;
}

const BILAN_VIDE: BilanRappels = { sessions: 0, envoyes: 0, echecs: [] };

/** L'état de l'interrupteur, lu une fois par passage du cron. */
export function etatInterrupteurPourCron(): Promise<EtatInterrupteur> {
  return lireInterrupteurEmargement();
}

/**
 * Les sessions du jour sur lesquelles le lot agit. Lues aussi par le cron pour
 * écarter ces sessions de l'envoi historique (« un lien pour toute la
 * session ») : les deux régimes ne doivent jamais servir la même session.
 */
export async function sessionsParDemiJourneeDuJour(maintenant: Date): Promise<Set<string>> {
  const etat = await lireInterrupteurEmargement();
  if (etat === "eteint") return new Set();
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      jours: { some: { date: new Date(`${parisDateISO(maintenant)}T00:00:00.000Z`) } },
      ...(etat === "essai" ? { estTestInterne: true } : {}),
    },
    select: { id: true, estTestInterne: true },
    take: 200,
  });
  return new Set(sessions.filter((s) => estActifPour(etat, s)).map((s) => s.id));
}

export async function envoyerRappelsDemiJournee(maintenant: Date): Promise<BilanRappels> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return BILAN_VIDE;
  const ids = await sessionsParDemiJourneeDuJour(maintenant);
  if (ids.size === 0) return BILAN_VIDE;

  const { envoyerLiensPourSession } = await import("../envoi-liens");
  let envoyes = 0;
  const echecs: string[] = [];

  for (const sessionId of ids) {
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: {
        numero: true,
        jours: { select: { date: true, heureDebut: true, heureFin: true } },
        enrollments: {
          where: { ...inscriptionsActives(), trainee: { deletedAt: null } },
          select: {
            id: true,
            presences: { select: { id: true, date: true, demiJournee: true } },
            relancesJournal: {
              where: { objet: { startsWith: PREFIXE_OBJET_RAPPEL } },
              select: { objet: true },
            },
          },
        },
      },
    });
    if (session === null) continue;

    for (const e of session.enrollments) {
      const dj = demiJourneeDuRappel(demiJourneesDepuis(e.presences, session.jours), maintenant);
      if (dj === null) continue;
      const objet = objetRappel(cleDemiJournee(dj));
      if (e.relancesJournal.some((r) => r.objet === objet)) continue;
      try {
        const r = await envoyerLiensPourSession({
          sessionId,
          enrollmentId: e.id,
          origine: "cron-j0",
          cible: "tous",
        });
        if (!r.ok || r.envoyes === 0) {
          echecs.push(
            `${session.numero} — ${r.ok ? (r.echecs[0]?.motif ?? "non envoyé") : r.motif}`,
          );
          continue;
        }
        await prisma.relanceJournal.create({
          data: {
            sessionId,
            enrollmentId: e.id,
            objet,
            destinataire: "stagiaire",
            canal: "email",
            rang: 1,
            automatique: true,
          },
        });
        envoyes++;
      } catch (err) {
        echecs.push(`${session.numero} — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return { sessions: ids.size, envoyes, echecs };
}
