/**
 * Chantier QNC, NC6 — la réponse du stagiaire à la demande de confirmation de présence (B3).
 *
 * ⚠️ SURFACE NON AUTHENTIFIÉE : le jeton est la seule barrière. `lireEtatPresence` (le GET de
 * la page) ne fait JAMAIS d'écriture — un antivirus de messagerie ouvre les liens ; seule
 * `enregistrerReponsePresence` écrit, et seul le POST d'un bouton l'appelle.
 *
 * Une réponse est une ligne `RemiseRetour` (nature `reponse`, `remiseId` = la demande, objet
 * `presence_confirmation:oui|non`). Table à ajout seul : la dernière ligne compte, une réponse
 * identique à la dernière n'ajoute rien, les précédentes restent (la preuve d'un revirement).
 * Aucun champ libre : le stagiaire ne peut pas déposer de motif ici.
 *
 * Refus SANS écriture : jeton forgé, d'un autre scope ou expiré ; inscription sortie ou
 * stagiaire effacé ; session non planifiée ou commencée ; lot qui n'agit pas sur la session ;
 * aucune demande envoyée.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { debutPremiereDemiJournee } from "./debut";
import { presencePour } from "./activation";
import { verifierJetonPresence } from "./jeton";
import { jourJ, libelleJour } from "./calendrier";
import {
  OBJET_PRESENCE_DEMANDE,
  OBJET_PRESENCE_NON,
  OBJET_PRESENCE_OUI,
  type ReponsePresence,
} from "./objets";

export type RefusPresence =
  | "lien_invalide"
  | "inscription_sortie"
  | "session_close"
  | "session_commencee"
  | "lot_inactif"
  | "aucune_demande";

export type ResultatReponse =
  | { readonly ok: true; readonly enregistre: boolean; readonly reponse: ReponsePresence }
  | { readonly ok: false; readonly raison: RefusPresence };

export type EtatPresence =
  | {
      readonly ok: true;
      readonly titreFormation: string;
      /** « lundi 26 octobre 2026 ». */
      readonly dateDebutFormation: string;
      readonly derniereReponse: ReponsePresence | null;
    }
  | { readonly ok: false; readonly raison: RefusPresence };

const LIBELLES: Record<ReponsePresence, string> = {
  oui: "Le stagiaire a répondu qu'il sera présent(e) à la formation.",
  non: "Le stagiaire a répondu qu'il ne pourra pas venir à la formation.",
};

const OBJET_DE: Record<ReponsePresence, string> = {
  oui: OBJET_PRESENCE_OUI,
  non: OBJET_PRESENCE_NON,
};

function reponseDepuisObjet(objet: string): ReponsePresence | null {
  if (objet === OBJET_PRESENCE_OUI) return "oui";
  if (objet === OBJET_PRESENCE_NON) return "non";
  return null;
}

type Charge =
  | {
      readonly ok: true;
      readonly enrollmentId: string;
      readonly sessionId: string;
      readonly titreFormation: string;
      readonly jour: string;
      readonly demandeId: string | null;
      readonly derniereReponse: ReponsePresence | null;
    }
  | { readonly ok: false; readonly raison: RefusPresence };

/** Toutes les vérifications, en lecture seule, communes au GET et au POST. */
async function charger(token: string, maintenant: Date): Promise<Charge> {
  const jeton = await verifierJetonPresence(token);
  if (!jeton.ok) return { ok: false, raison: "lien_invalide" };

  const inscription = await prisma.enrollment.findFirst({
    where: { id: jeton.enrollmentId, ...inscriptionsActives(), trainee: { deletedAt: null } },
    select: {
      id: true,
      sessionId: true,
      session: {
        select: {
          statut: true,
          estTestInterne: true,
          titreSession: true,
          dateDebut: true,
          jours: { select: { date: true, heureDebut: true, heureFin: true } },
        },
      },
      remisesRetours: {
        where: { objet: { startsWith: OBJET_PRESENCE_DEMANDE } },
        select: { id: true, nature: true, objet: true, survenuLe: true },
        orderBy: { survenuLe: "asc" },
      },
    },
  });
  if (inscription === null) return { ok: false, raison: "inscription_sortie" };

  const s = inscription.session;
  if (s.statut !== "planifiee") return { ok: false, raison: "session_close" };
  if (maintenant.getTime() >= debutPremiereDemiJournee(s).getTime()) {
    return { ok: false, raison: "session_commencee" };
  }
  if (!(await presencePour(s))) return { ok: false, raison: "lot_inactif" };

  const lignes = inscription.remisesRetours;
  const demande = [...lignes]
    .reverse()
    .find((l) => l.nature === "remise" && l.objet === OBJET_PRESENCE_DEMANDE);
  const derniere = [...lignes].reverse().find((l) => l.nature === "reponse");
  return {
    ok: true,
    enrollmentId: inscription.id,
    sessionId: inscription.sessionId,
    titreFormation: s.titreSession,
    jour: jourJ(s),
    demandeId: demande?.id ?? null,
    derniereReponse: derniere === undefined ? null : reponseDepuisObjet(derniere.objet),
  };
}

/** Ce que la page affiche. N'écrit rien. */
export async function lireEtatPresence(token: string): Promise<EtatPresence> {
  const c = await charger(token, new Date());
  if (!c.ok) return c;
  return {
    ok: true,
    titreFormation: c.titreFormation,
    dateDebutFormation: libelleJour(c.jour),
    derniereReponse: c.derniereReponse,
  };
}

/** Enregistre la réponse. Appelée par le POST d'un bouton, jamais par un GET. */
export async function enregistrerReponsePresence(
  token: string,
  choix: ReponsePresence,
): Promise<ResultatReponse> {
  const c = await charger(token, new Date());
  if (!c.ok) return c;
  if (c.demandeId === null) return { ok: false, raison: "aucune_demande" };
  if (c.derniereReponse === choix) return { ok: true, enregistre: false, reponse: choix };

  await prisma.remiseRetour.create({
    data: {
      sessionId: c.sessionId,
      enrollmentId: c.enrollmentId,
      nature: "reponse",
      remiseId: c.demandeId,
      destinataire: "stagiaire",
      canal: "espace",
      objet: OBJET_DE[choix],
      libelle: LIBELLES[choix],
    },
  });
  return { ok: true, enregistre: true, reponse: choix };
}
