/**
 * Quelles demi-journées attendent la CONTRESIGNATURE du formateur ? Module PUR.
 *
 * ## Le défaut
 *
 * Sur la seule session réelle (AXI-SESS-2026-001), la stagiaire a signé et
 * `emargement_contresignatures` est resté vide. Rien ne l'a demandé au
 * formateur, rien ne l'a signalé à la console : la feuille tirée portait
 * « contresignature manquante », et c'est tout.
 *
 * La contresignature reste NON BLOQUANTE pour l'attestation — décision de Will,
 * conservée. Mais les OPCO la demandent, et une signature ne s'appose jamais à
 * la place de quelqu'un. « Automatique » veut donc dire : la DEMANDE part seule,
 * au bon moment, et le manque se voit tant qu'il dure.
 *
 * ## La règle
 *
 * Une demi-journée est à contresigner quand :
 *  · au moins un stagiaire l'a signée (signature non révoquée) ;
 *  · aucune contresignature non révoquée ne la couvre — par N'IMPORTE QUEL
 *    formateur, comme sur la feuille tirée (`emargement-tirage.ts`) ;
 *  · sa JOURNÉE est terminée (heure de fin déclarée, heure de Paris). On ne
 *    réclame rien au formateur au milieu de sa séance : il a le bouton sous les
 *    yeux, et la demande serait du bruit ;
 *  · son grain n'est pas `journee` (créneau hérité d'un import) : la feuille ne
 *    le réclame pas, le formateur non plus.
 *
 * Le formateur DÉSIGNÉ est celui de la journée, sinon le principal — la même
 * résolution que l'écran de groupe (`feuille-groupe.ts`).
 *
 * ## Une seule mesure, trois surfaces
 *
 * L'e-mail au formateur, son espace et la fiche session de la console lisent ce
 * bilan. Recompter ailleurs fabriquerait trois vérités.
 */

import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";

export type DemiJourneeContresignable = "matin" | "apres_midi";

export interface EntreeBilanContresignature {
  /** Journées déclarées (`session_jours`). `date` = colonne `@db.Date`. */
  readonly jours: ReadonlyArray<{
    readonly date: Date;
    readonly heureDebut: string;
    readonly heureFin: string;
    readonly trainerId: string | null;
  }>;
  readonly formateurPrincipalId: string | null;
  /** Créneaux portant au moins une signature de stagiaire non révoquée. */
  readonly creneauxSignes: ReadonlyArray<{ readonly date: Date; readonly demiJournee: string }>;
  /** Contresignatures non révoquées de la session, tous formateurs confondus. */
  readonly contresignatures: ReadonlyArray<{ readonly date: Date; readonly demiJournee: string }>;
  readonly maintenant: Date;
}

export interface DemiJourneeAContresigner {
  /** Jour civil `YYYY-MM-DD` (heure de Paris). */
  readonly date: string;
  readonly demiJournee: DemiJourneeContresignable;
  /** Formateur à qui la demande s'adresse — `null` si la session n'en a aucun. */
  readonly formateurId: string | null;
}

export interface BilanContresignature {
  /** Demi-journées TERMINÉES portant au moins une signature de stagiaire. */
  readonly signees: number;
  /** Parmi elles, celles qu'aucun formateur n'a contresignées. Triées. */
  readonly aContresigner: ReadonlyArray<DemiJourneeAContresigner>;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

/** La journée `iso`, finissant à `heureFin` (Paris), est-elle terminée ? */
export function journeeTerminee(iso: string, heureFin: string | null, maintenant: Date): boolean {
  const aujourdhui = parisDateISO(maintenant);
  if (aujourdhui > iso) return true;
  if (aujourdhui < iso || heureFin === null) return false;
  return parisMinutesDuJour(maintenant) >= minutes(heureFin);
}

const ORDRE: Record<DemiJourneeContresignable, number> = { matin: 0, apres_midi: 1 };

export function bilanContresignature(e: EntreeBilanContresignature): BilanContresignature {
  const jours = new Map(e.jours.map((j) => [parisDateISO(j.date), j] as const));
  const contresignees = new Set(
    e.contresignatures.map((c) => `${parisDateISO(c.date)}|${c.demiJournee}`),
  );

  const vues = new Set<string>();
  const signees: DemiJourneeAContresigner[] = [];
  for (const c of e.creneauxSignes) {
    if (c.demiJournee !== "matin" && c.demiJournee !== "apres_midi") continue;
    const date = parisDateISO(c.date);
    const cle = `${date}|${c.demiJournee}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    const jour = jours.get(date);
    if (!journeeTerminee(date, jour?.heureFin ?? null, e.maintenant)) continue;
    signees.push({
      date,
      demiJournee: c.demiJournee,
      formateurId: jour?.trainerId ?? e.formateurPrincipalId,
    });
  }

  const aContresigner = signees
    .filter((d) => !contresignees.has(`${d.date}|${d.demiJournee}`))
    .sort((a, b) => a.date.localeCompare(b.date) || ORDRE[a.demiJournee] - ORDRE[b.demiJournee]);

  return { signees: signees.length, aContresigner };
}

const LIBELLE_DEMI: Record<DemiJourneeContresignable, string> = {
  matin: "matin",
  apres_midi: "après-midi",
};

/** « mercredi 16 septembre 2026 — après-midi ». */
export function libelleDemiJourneeAContresigner(d: DemiJourneeAContresigner): string {
  const jour = new Date(`${d.date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${jour} — ${LIBELLE_DEMI[d.demiJournee]}`;
}
