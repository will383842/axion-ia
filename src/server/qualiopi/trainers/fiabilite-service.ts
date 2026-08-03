/**
 * Fiabilité d'un intervenant externe — art. 7 et 8 de la procédure de
 * sous-traitance (2026-08-03).
 *
 * ## Ce que ce service calcule, et ce qu'il refuse de calculer
 *
 * Il **dérive** un état à partir de faits consignés : missions réalisées,
 * incidents constatés. Il ne stocke aucune note attribuée à la main — une note
 * saisie serait une opinion, pas une preuve, et l'article 8 exige de motiver une
 * non-reconduction sur des faits.
 *
 * ## Pourquoi ce n'est PAS bloquant
 *
 * Décision Will du 2026-08-03, cohérente avec son arbitrage sur la RC pro : le
 * système **informe**, il ne décide pas. Un formateur qui a annulé deux fois peut
 * rester le meilleur choix pour une mission donnée — un blocage dur retirerait à
 * Will un arbitrage qui lui revient, et le pousserait à contourner l'outil.
 *
 * `niveauVigilance` est donc un signal d'affichage, jamais une interdiction.
 */

import { prisma } from "@/lib/prisma";

/** Fenêtre d'observation. Au-delà, un incident ancien ne dit plus rien d'utile. */
const FENETRE_MOIS = 24;

/**
 * Faits qui pèsent LOURD : ils font tomber une session déjà vendue au client.
 * Les autres (retard, preuve manquante) se rattrapent.
 */
const FAITS_BLOQUANTS = ["annulation_tardive", "desistement"] as const;

export type NiveauVigilance = "aucune" | "surveiller" | "vigilance_forte";

export interface FiabiliteIntervenant {
  /** Missions réalisées sur la fenêtre — le dénominateur. */
  missionsRealisees: number;
  incidentsTotal: number;
  /** Annulations tardives et désistements : ceux qui font tomber une session. */
  incidentsBloquants: number;
  /** Part d'incidents bloquants sur les missions, en %. `null` si aucune mission. */
  tauxIncidentsBloquants: number | null;
  niveauVigilance: NiveauVigilance;
  /** Phrase prête à afficher, qui DIT les faits plutôt que de noter la personne. */
  resume: string;
}

/**
 * Seuils de vigilance.
 *
 * 🔴 Ils s'appliquent sur un NOMBRE d'incidents bloquants, pas sur un taux, tant
 * que les missions sont peu nombreuses. Sur 2 missions, un désistement donne
 * 50 % — un taux affolant qui ne dit rien. Le nombre absolu est plus honnête
 * quand l'échantillon est petit, et c'est exactement la situation d'un OF qui
 * démarre.
 */
function calculerNiveau(incidentsBloquants: number): NiveauVigilance {
  if (incidentsBloquants >= 2) return "vigilance_forte";
  if (incidentsBloquants >= 1) return "surveiller";
  return "aucune";
}

function formulerResume(f: Omit<FiabiliteIntervenant, "resume">): string {
  if (f.missionsRealisees === 0 && f.incidentsTotal === 0) {
    return "Aucune mission réalisée à ce jour — pas d'historique.";
  }
  if (f.incidentsTotal === 0) {
    return `${f.missionsRealisees} mission(s) réalisée(s), aucun incident consigné.`;
  }
  const bloquants =
    f.incidentsBloquants > 0
      ? ` dont ${f.incidentsBloquants} ayant fait tomber une session (annulation tardive ou désistement)`
      : "";
  return `${f.missionsRealisees} mission(s) réalisée(s), ${f.incidentsTotal} incident(s) consigné(s)${bloquants}.`;
}

/**
 * Fiabilité d'un formateur (personne physique) sur les {@link FENETRE_MOIS} mois.
 *
 * Stub-aware : au build SSG, le proxy Prisma court-circuite les lectures et
 * rendrait un état vide trompeur. On sort avec un état neutre explicite.
 */
export async function fiabiliteFormateur(trainerId: string): Promise<FiabiliteIntervenant> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      missionsRealisees: 0,
      incidentsTotal: 0,
      incidentsBloquants: 0,
      tauxIncidentsBloquants: null,
      niveauVigilance: "aucune",
      resume: "Aucune mission réalisée à ce jour — pas d'historique.",
    };
  }

  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - FENETRE_MOIS);

  const [missionsRealisees, incidentsTotal, incidentsBloquants] = await Promise.all([
    // Le dénominateur, ce sont les sessions RÉALISÉES : une session annulée ne
    // compte pas comme mission, sinon un désistement gonflerait le dénominateur
    // qu'il est censé dégrader.
    //
    // 🔴 On compte par la JOINTURE `SessionFormateur`, pas par
    // `TrainingSession.formateurPrincipalId` : ce dernier est un cache
    // dénormalisé qui ne porte QUE le formateur principal. S'appuyer dessus
    // aurait rendu invisible toute mission animée en co-animation, et donc
    // gonflé le taux d'incidents d'un formateur souvent co-animateur.
    prisma.sessionFormateur.count({
      where: { trainerId, session: { statut: "realisee", dateFin: { gte: depuis } } },
    }),
    prisma.incident.count({
      where: { trainerId, dateIncident: { gte: depuis } },
    }),
    prisma.incident.count({
      where: {
        trainerId,
        dateIncident: { gte: depuis },
        faitIntervenant: { in: [...FAITS_BLOQUANTS] },
      },
    }),
  ]);

  const base = {
    missionsRealisees,
    incidentsTotal,
    incidentsBloquants,
    tauxIncidentsBloquants:
      missionsRealisees > 0 ? Math.round((incidentsBloquants / missionsRealisees) * 100) : null,
    niveauVigilance: calculerNiveau(incidentsBloquants),
  };

  return { ...base, resume: formulerResume(base) };
}

/**
 * Fiabilité d'un organisme sous-traitant.
 *
 * Le dénominateur manque : aucune relation ne rattache une session à un
 * `SousTraitant`. On expose donc les incidents SANS taux plutôt que d'inventer
 * un ratio — `tauxIncidentsBloquants` reste `null`, ce qui est l'information
 * exacte. Le jour où la relation existera, seul le dénominateur sera à brancher.
 */
export async function fiabiliteSousTraitant(sousTraitantId: string): Promise<FiabiliteIntervenant> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      missionsRealisees: 0,
      incidentsTotal: 0,
      incidentsBloquants: 0,
      tauxIncidentsBloquants: null,
      niveauVigilance: "aucune",
      resume: "Aucune mission réalisée à ce jour — pas d'historique.",
    };
  }

  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - FENETRE_MOIS);

  const [incidentsTotal, incidentsBloquants] = await Promise.all([
    prisma.incident.count({ where: { sousTraitantId, dateIncident: { gte: depuis } } }),
    prisma.incident.count({
      where: {
        sousTraitantId,
        dateIncident: { gte: depuis },
        faitIntervenant: { in: [...FAITS_BLOQUANTS] },
      },
    }),
  ]);

  const base = {
    missionsRealisees: 0,
    incidentsTotal,
    incidentsBloquants,
    tauxIncidentsBloquants: null,
    niveauVigilance: calculerNiveau(incidentsBloquants),
  };

  return { ...base, resume: formulerResume(base) };
}
