/**
 * Données de l'onglet « Aperçus de partage ».
 *
 * 🔴 POURQUOI — recensement OG du 2026-08-17. Aucun écran de la console ne
 * montrait ce que le site sert quand on partage un lien : on découvrait un
 * aperçu cassé en partageant le lien.
 *
 * 🔑 ON REGROUPE PAR MODÈLE, PAS PAR URL, ET C'EST STRUCTURANT.
 *
 * Le site pré-rend 17 629 routes. 10 162 d'entre elles sont des pages
 * ville×service qui ne diffèrent que d'un nom de ville — et qui ne sont même
 * pas au catalogue `SiteRoute` (l'énumérateur ne catalogue une page ville×
 * service que si elle a une copy éditoriale : 623 catalogées, 10 162 non).
 *
 * Afficher 10 162 vignettes identiques à un mot près n'apprendrait rien et
 * coûterait une page illisible. On affiche donc UNE ligne par `pathPattern`,
 * avec un exemple rendu et le nombre de routes qu'il représente. C'est aussi
 * l'unité à laquelle une surcharge éditoriale a du sens.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import { OG_LARGEUR_MINIMALE_GRANDE_CARTE } from "@/lib/og-format";
import { requireAdminRead } from "./_guards";

/** Nature de l'image de partage, telle qu'on la présente à l'écran. */
export type NatureApercu =
  | "carte_generee" // notre carte /api/og — le cas de l'immense majorité
  | "image_propre" // un vrai fichier sur notre domaine
  | "image_tierce" // hébergée ailleurs : casse si le tiers la retire
  | "aucune"; // le lien se partage nu

export interface ApercuModele {
  /** Identifiant de la route représentative (pour ouvrir sa fiche). */
  readonly id: string;
  /** Le modèle d'URL, ex. `/fr/audit/par-ville/[ville]`. */
  readonly pathPattern: string;
  /** L'URL réellement rendue de l'exemple montré. */
  readonly exemple: string;
  readonly category: string | null;
  readonly section: string | null;
  /** Combien de routes partagent ce modèle (relevées ou non). */
  readonly routes: number;
  /** Combien ont été relevées par l'inspecteur. */
  readonly relevees: number;
  readonly ogImage: string | null;
  readonly ogTitle: string | null;
  readonly ogDescription: string | null;
  readonly ogImageWidth: number | null;
  readonly ogImageHeight: number | null;
  readonly ogDeclaredWidth: number | null;
  readonly ogDeclaredHeight: number | null;
  readonly ogImageStatus: number | null;
  readonly ogInspectedAt: Date | null;
  readonly nature: NatureApercu;
  /** Défauts constatés sur l'exemple, en français, prêts à afficher. */
  readonly defauts: readonly string[];
}

export interface StatistiquesApercus {
  readonly routesPubliques: number;
  readonly relevees: number;
  readonly modeles: number;
  readonly carteGeneree: number;
  readonly imagePropre: number;
  readonly imageTierce: number;
  readonly aucune: number;
  readonly dimensionsFausses: number;
  readonly tropPetites: number;
  readonly injoignables: number;
}

function natureDe(ogImage: string | null): NatureApercu {
  if (!ogImage) return "aucune";
  try {
    const u = new URL(ogImage, SITE_URL);
    if (u.hostname !== new URL(SITE_URL).hostname) return "image_tierce";
    return u.pathname === "/api/og" || u.pathname === "/opengraph-image"
      ? "carte_generee"
      : "image_propre";
  } catch {
    return "aucune";
  }
}

/**
 * Défauts d'un aperçu, formulés pour être lus par un humain.
 *
 * Volontairement SANS jargon : « LinkedIn n'affichera qu'une vignette » dit ce
 * qui va se passer ; « width < 1200 » demande de savoir pourquoi ça compte.
 */
function defautsDe(r: {
  ogImage: string | null;
  ogImageStatus: number | null;
  ogImageWidth: number | null;
  ogImageHeight: number | null;
  ogDeclaredWidth: number | null;
  ogDeclaredHeight: number | null;
  ogInspectedAt: Date | null;
}): string[] {
  const out: string[] = [];
  if (!r.ogInspectedAt) return out; // jamais relevée : elle n'a rien dit
  if (!r.ogImage) {
    out.push("Aucune image : le lien se partage nu");
    return out;
  }
  if (r.ogImageStatus !== null && r.ogImageStatus !== 200) {
    out.push(`L'image répond ${r.ogImageStatus} : l'aperçu est vide`);
  }
  if (r.ogImageWidth !== null && r.ogImageWidth < OG_LARGEUR_MINIMALE_GRANDE_CARTE) {
    out.push(`Image ${r.ogImageWidth}×${r.ogImageHeight} : LinkedIn n'affichera qu'une vignette`);
  }
  if (
    r.ogImageWidth !== null &&
    r.ogDeclaredWidth !== null &&
    (r.ogImageWidth !== r.ogDeclaredWidth || r.ogImageHeight !== r.ogDeclaredHeight)
  ) {
    out.push(
      `Annonce ${r.ogDeclaredWidth}×${r.ogDeclaredHeight}, le fichier fait ` +
        `${r.ogImageWidth}×${r.ogImageHeight}`,
    );
  }
  return out;
}

export interface FiltresApercus {
  readonly category?: string;
  readonly nature?: NatureApercu;
  /** Ne garder que les modèles porteurs d'au moins un défaut. */
  readonly defautsSeuls?: boolean;
  readonly recherche?: string;
}

/**
 * Un modèle par `pathPattern`, avec l'exemple le plus récemment relevé.
 *
 * ⚠️ Le regroupement se fait en mémoire APRÈS lecture, et non par un
 * `groupBy` SQL : on a besoin, pour chaque groupe, de la LIGNE COMPLÈTE de
 * l'exemple (son image, ses dimensions), ce qu'un `groupBy` ne rend pas. La
 * lecture est bornée par `PLAFOND_LECTURE` et la troncature est ANNONCÉE à
 * l'appelant plutôt que silencieuse.
 */
const PLAFOND_LECTURE = 4000;

export async function listerApercusParModele(filtres: FiltresApercus = {}): Promise<{
  readonly modeles: ApercuModele[];
  readonly tronque: boolean;
  readonly luesr: number;
}> {
  await requireAdminRead();

  const lignes = await prisma.siteRoute.findMany({
    where: {
      visibility: "public",
      removedAt: null,
      ...(filtres.category ? { category: filtres.category } : {}),
      ...(filtres.recherche
        ? { pathPattern: { contains: filtres.recherche, mode: "insensitive" as const } }
        : {}),
    },
    select: {
      id: true,
      pathPattern: true,
      pathRendered: true,
      category: true,
      section: true,
      ogImage: true,
      ogTitle: true,
      ogDescription: true,
      ogImageWidth: true,
      ogImageHeight: true,
      ogDeclaredWidth: true,
      ogDeclaredHeight: true,
      ogImageStatus: true,
      ogInspectedAt: true,
    },
    orderBy: [{ pathPattern: "asc" }, { ogInspectedAt: "desc" }],
    take: PLAFOND_LECTURE + 1,
  });

  const tronque = lignes.length > PLAFOND_LECTURE;
  const utiles = tronque ? lignes.slice(0, PLAFOND_LECTURE) : lignes;

  const parModele = new Map<string, ApercuModele>();
  for (const l of utiles) {
    const existant = parModele.get(l.pathPattern);
    if (existant) {
      // Le premier de chaque groupe est le plus récemment relevé (tri SQL) :
      // on ne remplace pas l'exemple, on compte seulement.
      parModele.set(l.pathPattern, {
        ...existant,
        routes: existant.routes + 1,
        relevees: existant.relevees + (l.ogInspectedAt ? 1 : 0),
      });
      continue;
    }
    parModele.set(l.pathPattern, {
      id: l.id,
      pathPattern: l.pathPattern,
      exemple: l.pathRendered ?? l.pathPattern,
      category: l.category,
      section: l.section,
      routes: 1,
      relevees: l.ogInspectedAt ? 1 : 0,
      ogImage: l.ogImage,
      ogTitle: l.ogTitle,
      ogDescription: l.ogDescription,
      ogImageWidth: l.ogImageWidth,
      ogImageHeight: l.ogImageHeight,
      ogDeclaredWidth: l.ogDeclaredWidth,
      ogDeclaredHeight: l.ogDeclaredHeight,
      ogImageStatus: l.ogImageStatus,
      ogInspectedAt: l.ogInspectedAt,
      nature: natureDe(l.ogImage),
      defauts: defautsDe(l),
    });
  }

  let modeles = [...parModele.values()];
  if (filtres.nature) modeles = modeles.filter((m) => m.nature === filtres.nature);
  if (filtres.defautsSeuls) modeles = modeles.filter((m) => m.defauts.length > 0);

  // Les modèles en défaut d'abord, puis les plus gros : ce qui casse le plus
  // de pages se lit en premier.
  modeles.sort((a, b) => {
    if (a.defauts.length !== b.defauts.length) return b.defauts.length - a.defauts.length;
    return b.routes - a.routes;
  });

  return { modeles, tronque, luesr: utiles.length };
}

export async function statistiquesApercus(): Promise<StatistiquesApercus> {
  await requireAdminRead();

  const lignes = await prisma.siteRoute.findMany({
    where: { visibility: "public", removedAt: null },
    select: {
      pathPattern: true,
      ogImage: true,
      ogImageWidth: true,
      ogImageHeight: true,
      ogDeclaredWidth: true,
      ogDeclaredHeight: true,
      ogImageStatus: true,
      ogInspectedAt: true,
    },
    take: PLAFOND_LECTURE,
  });

  const modeles = new Set<string>();
  let relevees = 0;
  let carteGeneree = 0;
  let imagePropre = 0;
  let imageTierce = 0;
  let aucune = 0;
  let dimensionsFausses = 0;
  let tropPetites = 0;
  let injoignables = 0;

  for (const l of lignes) {
    modeles.add(l.pathPattern);
    if (!l.ogInspectedAt) continue;
    relevees++;
    switch (natureDe(l.ogImage)) {
      case "carte_generee":
        carteGeneree++;
        break;
      case "image_propre":
        imagePropre++;
        break;
      case "image_tierce":
        imageTierce++;
        break;
      default:
        aucune++;
    }
    if (l.ogImageStatus !== null && l.ogImageStatus !== 200) injoignables++;
    if (l.ogImageWidth !== null && l.ogImageWidth < OG_LARGEUR_MINIMALE_GRANDE_CARTE) tropPetites++;
    if (
      l.ogImageWidth !== null &&
      l.ogDeclaredWidth !== null &&
      (l.ogImageWidth !== l.ogDeclaredWidth || l.ogImageHeight !== l.ogDeclaredHeight)
    ) {
      dimensionsFausses++;
    }
  }

  return {
    routesPubliques: lignes.length,
    relevees,
    modeles: modeles.size,
    carteGeneree,
    imagePropre,
    imageTierce,
    aucune,
    dimensionsFausses,
    tropPetites,
    injoignables,
  };
}
