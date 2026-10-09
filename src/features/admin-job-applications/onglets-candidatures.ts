/**
 * LES ONGLETS DE LA LISTE « CANDIDATURES » (Candidatures unifiées L8b,
 * maquette v2 validée le 2026-10-07) — module PUR.
 *
 *   Monteurs & vidéastes · Formateurs · Autres offres · Spontanées ·
 *   Par le formulaire de contact
 *
 * Un onglet est DÉRIVÉ de l'offre (son `slug`), jamais stocké : une offre
 * vidéo freelance va dans « Monteurs & vidéastes » (le panneau des prix de L1),
 * une offre dont l'adresse dit « formateur » dans « Formateurs », une
 * candidature sans offre dans « Spontanées », le reste dans « Autres offres ».
 * « Par le formulaire de contact » n'est pas une candidature à une offre :
 * c'est le formulaire /contact, catégorie « recrutement » — l'onglet y mène.
 *
 * ⚠️ Côté emploi uniquement : les futurs apporteurs ont leur propre liste.
 */

import { isVideoFreelanceOffer } from "@/lib/careers/video-editor-offer";

export type OngletCandidatures = "monteurs" | "formateurs" | "autres" | "spontanees" | "formulaire";

export const ONGLETS_CANDIDATURES: ReadonlyArray<{
  readonly id: OngletCandidatures;
  readonly libelle: string;
  /** Phrase d'un onglet vide (la maquette : « phrase + geste »). */
  readonly vide: string;
}> = [
  {
    id: "monteurs",
    libelle: "Monteurs & vidéastes",
    vide: "Aucune candidature de monteur ou de vidéaste pour l'instant.",
  },
  {
    id: "formateurs",
    libelle: "Formateurs",
    vide: "Aucune candidature de formateur pour l'instant.",
  },
  {
    id: "autres",
    libelle: "Autres offres",
    vide: "Aucune candidature sur les autres offres pour l'instant.",
  },
  { id: "spontanees", libelle: "Spontanées", vide: "Aucune candidature spontanée pour l'instant." },
  {
    id: "formulaire",
    libelle: "Par le formulaire de contact",
    vide: "Aucun message « recrutement » reçu par le formulaire de contact.",
  },
];

const IDS = new Set<string>(ONGLETS_CANDIDATURES.map((o) => o.id));

/** L'onglet d'une offre, d'après son adresse (`null` : sans offre). */
export function ongletDeLOffre(slug: string | null): Exclude<OngletCandidatures, "formulaire"> {
  if (slug === null) return "spontanees";
  if (isVideoFreelanceOffer(slug)) return "monteurs";
  if (/formateur|formatrice/i.test(slug)) return "formateurs";
  return "autres";
}

/**
 * L'onglet demandé. Sans paramètre, celui de l'offre filtrée (un lien
 * `?offerId=X&status=new` garde ainsi ses filtres, dans le bon onglet), sinon
 * le premier, comme la maquette.
 */
export function lireOnglet(
  brut: string | undefined,
  ongletDeLOffreFiltree?: OngletCandidatures,
): OngletCandidatures {
  if (brut && IDS.has(brut)) return brut as OngletCandidatures;
  return ongletDeLOffreFiltree ?? "monteurs";
}

/** Les offres (et leurs volumes) rangées par onglet. */
export function repartirOffres(
  offres: ReadonlyArray<{
    readonly id: string;
    readonly count: number;
    readonly slug: string | null;
  }>,
): {
  ids: Record<Exclude<OngletCandidatures, "formulaire">, string[]>;
  compte: Record<Exclude<OngletCandidatures, "formulaire">, number>;
} {
  const ids = {
    monteurs: [] as string[],
    formateurs: [] as string[],
    autres: [] as string[],
    spontanees: [] as string[],
  };
  const compte = { monteurs: 0, formateurs: 0, autres: 0, spontanees: 0 };
  for (const o of offres) {
    const onglet = ongletDeLOffre(o.slug);
    ids[onglet].push(o.id);
    compte[onglet] += o.count;
  }
  return { ids, compte };
}
