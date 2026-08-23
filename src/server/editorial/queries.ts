/**
 * Console éditoriale — lectures du lot 0.
 *
 * Server-only. Aucune mutation ici : le lot 0 ne fait que MONTRER les quatre
 * mois. Les Server Actions de rédaction arrivent au lot 1.
 *
 * 🔴 Le piège de fuseau, qui décide du critère « septembre aux bonnes dates ».
 *
 * `EdPublication.datePrevue` est une colonne `@db.Date` : elle ne porte PAS
 * d'heure, et Prisma la rend comme une `Date` à minuit **UTC**. La clé de
 * regroupement doit donc être calculée sur les composants UTC
 * (`dayKeyOfGridDate`) et jamais avec `dayKeyInParis`, qui est juste pour un
 * instant horodaté mais applique une conversion à une valeur qui n'en demande
 * pas. Le même raisonnement vaut à l'écriture, côté import : `Date.UTC`, pas
 * `new Date(a, m, j)`.
 */

import "server-only";
import { prisma } from "@/lib/prisma";
import { dayKeyOfGridDate } from "@/lib/calendar-grid";
import { CLE_MARQUEUR_IMPORT } from "@/server/editorial/import/linkedin-q4";
import { bornesDuMois, type FiltreIdentite } from "@/server/editorial/calendrier-pur";

// Les écrans n'ont pas à savoir que la logique pure vit à côté : un seul
// point d'entrée, et la frontière testable reste interne.
export {
  estFiltreIdentite,
  bornesDuMois,
  moisVoisin,
  lireMois,
  lireAnnee,
  estCleJour,
  compterParJour,
} from "@/server/editorial/calendrier-pur";
export type { FiltreIdentite } from "@/server/editorial/calendrier-pur";

/** Traduit le filtre en clause Prisma. `toutes` n'ajoute aucune contrainte. */
function clauseIdentite(identite: FiltreIdentite) {
  return identite === "toutes" ? {} : { compte: { identite } };
}

export interface PublicationDuCalendrier {
  id: string;
  dayKey: string;
  heurePrevue: string;
  titreInterne: string;
  compteLibelle: string;
  identite: "perso" | "pro";
  statutRedaction: string;
  statutAsset: string;
  statutDiffusion: string;
  /** Vrai quand la publication est une reprise (écho de page, relais). */
  estReprise: boolean;
}

/**
 * Les publications d'un mois, filtrées par identité.
 *
 * Une seule requête : le calendrier ET la liste du jour se servent du même
 * jeu. Un mois compte quelques dizaines de lignes — un aller-retour par jour
 * coûterait trente requêtes pour rien.
 */
export async function listerPublicationsDuMois(
  annee: number,
  mois: number,
  identite: FiltreIdentite,
): Promise<PublicationDuCalendrier[]> {
  const { debut, fin } = bornesDuMois(annee, mois);

  const lignes = await prisma.edPublication.findMany({
    where: {
      datePrevue: { gte: debut, lt: fin },
      // Une publication archivée reste consultable et mesurable, mais
      // n'encombre plus le calendrier actif.
      archiveeA: null,
      ...clauseIdentite(identite),
    },
    select: {
      id: true,
      datePrevue: true,
      heurePrevue: true,
      titreInterne: true,
      statutRedaction: true,
      statutAsset: true,
      statutDiffusion: true,
      sourceId: true,
      compte: { select: { libelle: true, identite: true } },
    },
    orderBy: [{ datePrevue: "asc" }, { heurePrevue: "asc" }],
  });

  return lignes.map((l) => ({
    id: l.id,
    dayKey: dayKeyOfGridDate(l.datePrevue),
    heurePrevue: l.heurePrevue,
    titreInterne: l.titreInterne,
    compteLibelle: l.compte.libelle,
    identite: l.compte.identite,
    statutRedaction: l.statutRedaction,
    statutAsset: l.statutAsset,
    statutDiffusion: l.statutDiffusion,
    estReprise: l.sourceId !== null,
  }));
}

export interface ResumeConsole {
  publicationsTotal: number;
  publicationsAVenir: number;
  comptesActifs: number;
  comptesTotal: number;
  reglesConformite: number;
  reglesAlerte: number;
  /** Mois porteurs de publications, du plus ancien au plus récent. */
  moisCouverts: { annee: number; mois: number; combien: number }[];
  importFait: boolean;
}

/**
 * Le résumé du tableau de bord.
 *
 * Volontairement maigre au lot 0 : « ce qui presse » suppose des alertes
 * évaluées, et l'évaluateur arrive au lot 1. Montrer des compteurs vrais vaut
 * mieux qu'un écran de widgets qui affichent tous zéro.
 */
export async function chargerResumeConsole(aujourdhui: Date): Promise<ResumeConsole> {
  const debutDuJour = new Date(
    Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()),
  );

  const [
    publicationsTotal,
    publicationsAVenir,
    comptesActifs,
    comptesTotal,
    reglesConformite,
    reglesAlerte,
    marqueur,
    groupes,
  ] = await Promise.all([
    prisma.edPublication.count({ where: { archiveeA: null } }),
    prisma.edPublication.count({ where: { archiveeA: null, datePrevue: { gte: debutDuJour } } }),
    prisma.edCompte.count({ where: { actif: true } }),
    prisma.edCompte.count(),
    prisma.edRegleConformite.count({ where: { actif: true } }),
    prisma.edRegleAlerte.count({ where: { actif: true } }),
    prisma.siteSetting.findUnique({ where: { key: CLE_MARQUEUR_IMPORT } }),
    prisma.edPublication.groupBy({
      by: ["datePrevue"],
      where: { archiveeA: null },
      _count: { _all: true },
    }),
  ]);

  // Regroupement par mois côté application : `groupBy` de Prisma ne sait pas
  // tronquer une date, et un `$queryRaw` pour six lignes ne se justifie pas.
  const parMois = new Map<string, { annee: number; mois: number; combien: number }>();
  for (const g of groupes) {
    const annee = g.datePrevue.getUTCFullYear();
    const mois = g.datePrevue.getUTCMonth() + 1;
    const cle = `${annee}-${mois}`;
    const courant = parMois.get(cle);
    if (courant) courant.combien += g._count._all;
    else parMois.set(cle, { annee, mois, combien: g._count._all });
  }

  return {
    publicationsTotal,
    publicationsAVenir,
    comptesActifs,
    comptesTotal,
    reglesConformite,
    reglesAlerte,
    moisCouverts: [...parMois.values()].sort((a, b) =>
      a.annee === b.annee ? a.mois - b.mois : a.annee - b.annee,
    ),
    importFait: marqueur !== null,
  };
}
