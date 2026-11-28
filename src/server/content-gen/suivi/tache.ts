/**
 * Tâche de suivi des résultats (C12) : pour chaque contenu publié depuis moins de 100 jours, écrit
 * une ligne `ContenuResultat` à chaque échéance échue (J3, J7, J28, J90). Lecture seule sur les
 * tables du pilotage (Search Console, inspections) ; écrit uniquement `contenu_resultats`.
 *
 * Contenu « publié » = route publique et vivante de la rubrique blog (`SiteRoute`), daté par sa
 * création : une approximation de la date de publication, assumée et affichée dans les détails.
 */
import type { PrismaClient } from "../../../../prisma/generated/client";
import {
  ajouterJours,
  echeancesDues,
  fenetreGsc,
  joursDe,
  jourUtc,
  TOLERANCE_INDEXATION_JOURS,
  type CodeEcheance,
} from "./echeances";
import { DELAI_PASSAGE_MORT_MS, TENTATIVES_MAX } from "@/server/seo-pilotage/ingestion/jour";
import { construireResultat, type MesureGsc } from "./resultat";

export const HOTE_SITE = "https://axion-ia.com";
// 90 jours + 30 de marge : une collecte arrêtée quelques semaines ne fait pas perdre J90.
const FENETRE_SUIVI_JOURS = 120;
export const CLE_DEBUT_CAPTURE = "chaine_suivi_debut";
const MAX_LIGNES_PAR_PASSAGE = 200;

type PrismaSuivi = Pick<
  PrismaClient,
  | "siteRoute"
  | "contenuResultat"
  | "gscPageJour"
  | "gscInspection"
  | "gscImportRun"
  | "contentGenConfig"
  | "contenuRendezVousOrigine"
>;

export interface DepsSuivi {
  readonly prisma: PrismaSuivi;
  readonly maintenant?: () => Date;
}

export interface BilanSuivi {
  readonly contenus: number;
  readonly ecrites: number;
  readonly dejaEcrites: number;
}

export async function tacheSuiviResultats(deps: DepsSuivi): Promise<BilanSuivi> {
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const depuis = ajouterJours(jourUtc(maintenant), -FENETRE_SUIVI_JOURS);
  const routes = await deps.prisma.siteRoute.findMany({
    where: {
      visibility: "public",
      status: "live",
      removedAt: null,
      pathRendered: { startsWith: "/fr/blog/" },
      NOT: { pathRendered: { contains: "[" } },
      createdAt: { gte: depuis },
    },
    orderBy: { createdAt: "asc" },
    select: { pathRendered: true, createdAt: true },
  });

  // Un article = UN segment après `/fr/blog/`, hors pages d'index (catégorie, étiquette, auteur…).
  const contenus = routes.flatMap((r) =>
    r.pathRendered && estUnArticle(r.pathRendered)
      ? [{ chemin: r.pathRendered, publieLe: r.createdAt }]
      : [],
  );
  // Début de la capture de l'origine des réservations : la date d'allumage du suivi, posée au
  // premier passage. Sans elle, « 0 rendez-vous » ne veut rien dire (null, jamais 0). Le drapeau
  // doit être allumé sur le site ET sur le worker : sinon le site n'écrit rien et le compte reste 0.
  const debutCapture = await dateDebutCapture(deps.prisma, maintenant);
  const urls = contenus.map((c) => `${HOTE_SITE}${c.chemin}`);
  const existantes = await deps.prisma.contenuResultat.findMany({
    where: { url: { in: urls } },
    select: { url: true, echeance: true },
  });
  const faites = new Map<string, Set<string>>();
  for (const l of existantes) {
    const s = faites.get(l.url) ?? new Set<string>();
    s.add(l.echeance);
    faites.set(l.url, s);
  }

  let ecrites = 0;
  let dejaEcrites = 0;
  for (const c of contenus) {
    if (ecrites >= MAX_LIGNES_PAR_PASSAGE) break;
    const url = `${HOTE_SITE}${c.chemin}`;
    const dues = echeancesDues(c.publieLe, faites.get(url) ?? new Set(), maintenant);
    for (const code of dues) {
      const ligne = await mesurer(
        deps.prisma,
        c.chemin,
        c.publieLe,
        code,
        maintenant,
        debutCapture,
      );
      // Fenêtre Search Console pas encore entièrement collectée : on attend le passage suivant.
      if (ligne === null) continue;
      try {
        await deps.prisma.contenuResultat.create({
          data: {
            url,
            echeance: code,
            mesureLe: jourUtc(maintenant),
            indexe: ligne.indexe,
            affichages: ligne.affichages,
            clics: ligne.clics,
            position: ligne.position,
            affichagesIa: ligne.affichagesIa,
            citationsIa: ligne.citationsIa,
            visitesIa: ligne.visitesIa,
            rendezVous: ligne.rendezVous,
            details: ligne.details as object,
          },
        });
        ecrites += 1;
      } catch (err) {
        // Doublon (deux passages en même temps) : la ligne existe déjà, c'est le but.
        if ((err as { code?: unknown }).code === "P2002") dejaEcrites += 1;
        else throw err;
      }
    }
  }
  return { contenus: contenus.length, ecrites, dejaEcrites };
}

async function dateDebutCapture(prisma: PrismaSuivi, maintenant: Date): Promise<Date> {
  const ligne = await prisma.contentGenConfig.findUnique({ where: { key: CLE_DEBUT_CAPTURE } });
  const brut =
    typeof ligne?.value === "object" && ligne.value !== null && !Array.isArray(ligne.value)
      ? (ligne.value as Record<string, unknown>)["debut"]
      : undefined;
  const date = typeof brut === "string" ? new Date(brut) : null;
  if (date && !Number.isNaN(date.getTime())) return date;
  // Lendemain minuit : les réservations d'avant le premier passage n'ont pas pu être capturées.
  const debut = ajouterJours(jourUtc(maintenant), 1);
  try {
    await prisma.contentGenConfig.create({
      data: {
        key: CLE_DEBUT_CAPTURE,
        value: { debut: debut.toISOString() },
        description: "Allumage du suivi des résultats (début de la capture de l'origine)",
      },
    });
  } catch {
    // Posée entre-temps par un autre passage : la prochaine lecture la trouvera.
  }
  return debut;
}

const SEGMENTS_INDEX = new Set(["categorie", "tag", "auteur", "secteur", "taille", "service"]);

function estUnArticle(chemin: string): boolean {
  const m = /^\/fr\/blog\/([a-z0-9][a-z0-9-]*)$/.exec(chemin);
  return m !== null && !SEGMENTS_INDEX.has(m[1] ?? "");
}

async function mesurer(
  prisma: PrismaSuivi,
  chemin: string,
  publieLe: Date,
  code: CodeEcheance,
  maintenant: Date,
  debutCapture: Date | null,
) {
  const { debut, finExclue } = fenetreGsc(code, publieLe);
  const finInspection = ajouterJours(jourUtc(publieLe), joursDe(code) + TOLERANCE_INDEXATION_JOURS);
  const joursFenetre = Math.round((finExclue.getTime() - debut.getTime()) / 86_400_000);
  // La disponibilité se lit dans le journal de collecte (un jour `reussi` par jour), pas dans les
  // lignes de la page : une page sans impression n'a pas de ligne, et ce n'est pas « indisponible ».
  const jourPasseMort = new Date(maintenant.getTime() - DELAI_PASSAGE_MORT_MS);
  const [joursReussis, joursAbandonnes] = await Promise.all([
    prisma.gscImportRun.count({
      where: { typeRecherche: "web", jour: { gte: debut, lt: finExclue }, statut: "reussi" },
    }),
    // Abandonné = plafond de tentatives atteint, et plus repris : soit plus « en cours », soit un
    // « en cours » mort (un jour qui fait tomber le processus reste `en_cours` pour toujours).
    prisma.gscImportRun.count({
      where: {
        typeRecherche: "web",
        jour: { gte: debut, lt: finExclue },
        statut: { not: "reussi" },
        tentatives: { gte: TENTATIVES_MAX },
        OR: [{ statut: { not: "en_cours" } }, { debutLe: { lt: jourPasseMort } }],
      },
    }),
  ]);
  // Un jour réglé (réussi ou abandonné) ne bloque plus l'échéance ; sinon on attend.
  if (joursReussis + joursAbandonnes < joursFenetre) return null;
  // Un jour abandonné n'a écrit aucune donnée : la fenêtre est partielle, donc INDISPONIBLE (null),
  // jamais un total partiel présenté comme complet ni un zéro.
  const fenetreComplete = joursReussis >= joursFenetre;
  const finEcheance = ajouterJours(jourUtc(publieLe), joursDe(code) + 1);
  const inspectionOuverte = { chemin, inspecteLe: { gte: jourUtc(publieLe), lt: finEcheance } };
  const [agregat, avant, apres, rdv] = await Promise.all([
    fenetreComplete
      ? prisma.gscPageJour.aggregate({
          where: { chemin, typeRecherche: "web", date: { gte: debut, lt: finExclue } },
          _sum: { clics: true, impressions: true, positionSum: true },
        })
      : Promise.resolve(null),
    // L'état EN VIGUEUR à l'échéance : la rotation n'écrit une ligne que quand un champ change.
    prisma.gscInspection.findFirst({
      where: inspectionOuverte,
      orderBy: { inspecteLe: "desc" },
      select: { verdict: true, inspecteLe: true },
    }),
    // Une ligne postérieure à l'échéance (dans la tolérance) ne sert qu'à défaut, ou pour PASS.
    prisma.gscInspection.findFirst({
      where: { chemin, inspecteLe: { gte: finEcheance, lt: ajouterJours(finInspection, 1) } },
      orderBy: { inspecteLe: "desc" },
      select: { verdict: true, inspecteLe: true },
    }),
    compterRendezVous(prisma, chemin, debut, finExclue, debutCapture),
  ]);
  const estPass = (i: { verdict: string | null } | null) => i?.verdict?.toUpperCase() === "PASS";
  const inspection = estPass(avant) ? avant : estPass(apres) ? apres : (avant ?? apres);
  const gsc: MesureGsc | null = agregat
    ? {
        impressions: agregat._sum.impressions ?? 0,
        clics: agregat._sum.clics ?? 0,
        positionSum: agregat._sum.positionSum ?? 0,
        joursAvecDonnees: joursReussis,
      }
    : null;
  const ligne = construireResultat({ code, publieLe, gsc, inspection, rendezVous: rdv });
  return joursAbandonnes > 0 ? { ...ligne, details: { ...ligne.details, joursAbandonnes } } : ligne;
}

/**
 * Compté seulement si la capture écrivait déjà au début de la fenêtre ; sinon null, jamais 0.
 * Le début effectif est le plus tardif de l'allumage du worker et du lendemain de la PREMIÈRE
 * origine réellement écrite (le site et le worker s'allument séparément) : une origine prouve que
 * la capture écrit, et aucune ne prouve rien.
 */
async function compterRendezVous(
  prisma: PrismaSuivi,
  chemin: string,
  debut: Date,
  finExclue: Date,
  debutCapture: Date | null,
): Promise<number | null> {
  if (debutCapture === null) return null;
  const premiere = await prisma.contenuRendezVousOrigine.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (!premiere) return null;
  const debutEffectif = Math.max(
    debutCapture.getTime(),
    ajouterJours(jourUtc(premiere.createdAt), 1).getTime(),
  );
  if (debutEffectif > debut.getTime()) return null;
  return prisma.contenuRendezVousOrigine.count({
    where: { pageOrigine: chemin, createdAt: { gte: debut, lt: finExclue } },
  });
}
