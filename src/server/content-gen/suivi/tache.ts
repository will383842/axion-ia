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
import { TENTATIVES_MAX } from "@/server/seo-pilotage/ingestion/jour";
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
  const debut = jourUtc(maintenant);
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
  const joursCollectes = await prisma.gscImportRun.count({
    // Un jour est « réglé » s'il a réussi OU s'il est abandonné (plafond de tentatives, jamais
    // repris) : sinon une échéance resterait bloquée pour toujours.
    where: {
      typeRecherche: "web",
      jour: { gte: debut, lt: finExclue },
      OR: [{ statut: "reussi" }, { tentatives: { gte: TENTATIVES_MAX } }],
    },
  });
  if (joursCollectes < joursFenetre) return null;
  const [agregat, inspection, rdv] = await Promise.all([
    prisma.gscPageJour.aggregate({
      where: { chemin, typeRecherche: "web", date: { gte: debut, lt: finExclue } },
      _sum: { clics: true, impressions: true, positionSum: true },
    }),
    prisma.gscInspection.findFirst({
      // L'état EN VIGUEUR à l'échéance : la rotation n'écrit une ligne que quand un champ change.
      where: { chemin, inspecteLe: { lte: ajouterJours(finInspection, 1) } },
      orderBy: { inspecteLe: "desc" },
      select: { verdict: true, inspecteLe: true },
    }),
    // Compté seulement si la capture tournait déjà au début de la fenêtre ; sinon null, jamais 0.
    debutCapture !== null && debutCapture.getTime() <= debut.getTime()
      ? prisma.contenuRendezVousOrigine.count({
          where: { pageOrigine: chemin, createdAt: { gte: debut, lt: finExclue } },
        })
      : Promise.resolve(null),
  ]);
  const gsc: MesureGsc = {
    impressions: agregat._sum.impressions ?? 0,
    clics: agregat._sum.clics ?? 0,
    positionSum: agregat._sum.positionSum ?? 0,
    joursAvecDonnees: joursCollectes,
  };
  return construireResultat({
    code,
    publieLe,
    gsc,
    inspection,
    rendezVous: rdv,
  });
}
