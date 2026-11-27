/**
 * « Le client demande un délai » : pas de rappel de relance avant une date choisie.
 *
 * Module pur + lecteurs (PAS de `"use server"`). L'état du délai est rangé dans le journal
 * (`activity_logs`), sans migration : une entrée « demande » (`changes.finDelai`, instant ISO) et une
 * entrée « levée ». Pour un devis, c'est la DERNIÈRE entrée de ces deux actions qui compte.
 *
 * Trois signaux se taisent pendant un délai : la pastille « À relancer » de la liste, les rappels
 * de relance proposés (Facturation, « À traiter »), les alertes `devis_sans_reponse` et
 * `devis_expire_j7`. « Préparer une relance » (geste manuel) reste permis.
 */

import { finDeJourneeParis, JOUR_MS, minuitParisUtc } from "@/server/qualiopi/devis/date-validite";

export const ACTION_DELAI_CLIENT_DEMANDE = "qualiopi.devis.delai_client.demande";
export const ACTION_DELAI_CLIENT_LEVE = "qualiopi.devis.delai_client.leve";
export const DELAI_CLIENT_JOURS_DEFAUT = 7;
export const DELAI_CLIENT_MAX_JOURS = 90;
export const CODES_ALERTES_SUSPENDUES_PAR_DELAI = [
  "devis_sans_reponse",
  "devis_expire_j7",
] as const;

/** Instant UTC de 0 h, heure de Paris, du jour civil `y-mo-d`. */
export function debutDeJourneeParis(y: number, mo: number, d: number): Date {
  return new Date(finDeJourneeParis(y, mo, d - 1).getTime() + 1000);
}

/** Lit `changes.finDelai` (chaîne ISO) ; absent, pas une chaîne ou date invalide → `null`. */
export function finDelaiDepuisChanges(changes: unknown): Date | null {
  if (changes === null || typeof changes !== "object") return null;
  const v = (changes as { finDelai?: unknown }).finDelai;
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface LecteurDelais {
  activityLog: {
    findMany: (args: {
      where: {
        action: { in: string[] };
        targetType: string;
        createdAt: { gte: Date };
        targetId?: { in: string[] };
      };
      select: { targetId: true; action: true; changes: true; createdAt: true; id: true };
      orderBy: Array<{ createdAt: "desc" } | { id: "desc" }>;
    }) => Promise<
      Array<{
        targetId: string | null;
        action: string;
        changes: unknown;
        createdAt: Date;
        id: string;
      }>
    >;
  };
}

/**
 * Délais en cours : devisId → fin du délai. UNE requête groupée.
 *
 * La borne de 90 jours est exacte, pas une approximation : un délai ne dépasse jamais 90 jours
 * après sa demande (garde de l'action), donc une entrée plus ancienne est forcément échue.
 */
export async function delaisClientActifs(
  lecteur: LecteurDelais,
  maintenant: Date,
  devisIds?: readonly string[],
): Promise<Map<string, Date>> {
  const actifs = new Map<string, Date>();
  if (devisIds && devisIds.length === 0) return actifs;
  const lignes = await lecteur.activityLog.findMany({
    where: {
      action: { in: [ACTION_DELAI_CLIENT_DEMANDE, ACTION_DELAI_CLIENT_LEVE] },
      targetType: "Devis",
      createdAt: { gte: new Date(maintenant.getTime() - DELAI_CLIENT_MAX_JOURS * JOUR_MS) },
      ...(devisIds ? { targetId: { in: [...devisIds] } } : {}),
    },
    select: { targetId: true, action: true, changes: true, createdAt: true, id: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const vus = new Set<string>();
  for (const l of lignes) {
    if (l.targetId === null || vus.has(l.targetId)) continue;
    vus.add(l.targetId); // la première ligne vue est la plus récente
    if (l.action !== ACTION_DELAI_CLIENT_DEMANDE) continue;
    const fin = finDelaiDepuisChanges(l.changes);
    if (fin && fin.getTime() > maintenant.getTime()) actifs.set(l.targetId, fin);
  }
  return actifs;
}

/** Identifiants des devis en délai (lecture globale, pour les rappels proposés). */
export async function idsDevisEnDelaiClient(
  lecteur: LecteurDelais,
  maintenant: Date,
): Promise<string[]> {
  return [...(await delaisClientActifs(lecteur, maintenant)).keys()];
}

const jourIso = (msMinuitUtc: number): string => new Date(msMinuitUtc).toISOString().slice(0, 10);

/** Bornes du choix de date (jours `AAAA-MM-JJ`, heure de Paris), ou `null` si aucun jour n'est possible. */
export function bornesDelaiClient(
  maintenant: Date,
  dateValidite: Date,
): { min: string; max: string; defaut: string } | null {
  const aujourdhui = minuitParisUtc(maintenant);
  const min = jourIso(aujourdhui + JOUR_MS);
  const jourValidite = jourIso(minuitParisUtc(dateValidite));
  const plafond = jourIso(aujourdhui + DELAI_CLIENT_MAX_JOURS * JOUR_MS);
  const max = jourValidite < plafond ? jourValidite : plafond;
  if (max < min) return null;
  const sept = jourIso(aujourdhui + DELAI_CLIENT_JOURS_DEFAUT * JOUR_MS);
  return { min, max, defaut: sept < max ? sept : max };
}

export function peutDemanderDelai(e: {
  statut: string;
  clientASigne: boolean;
  signeParClient: boolean;
  signeDesDeuxParties: boolean;
  repriseParRelance: boolean;
  peutEcrire: boolean;
  dateValidite: Date;
  maintenant: Date;
}): boolean {
  return (
    e.peutEcrire &&
    e.statut === "envoye" &&
    !e.clientASigne &&
    !e.signeParClient &&
    !e.signeDesDeuxParties &&
    !e.repriseParRelance &&
    e.dateValidite.getTime() >= e.maintenant.getTime()
  );
}
