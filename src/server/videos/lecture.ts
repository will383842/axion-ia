/**
 * LECTURE DES VIDÉOS PUBLIÉES — la SEULE porte de lecture pour les pages, la
 * galerie, les plans du site, `llms.txt` et les encarts (plan PLAN-W1-W4 §5.1).
 *
 * Règle « 0 vidéo publiée = rien » (motif `reviews/presence.ts`) :
 *  - interrupteur éteint → `[]` / `null`, SANS appel à la base (c'est la première garde) ;
 *  - base factice du build (`stub.invalid`, ADR 0026) → `[]` sans appel : rien de ce
 *    vide n'est figé, les appelants sont rendus à la requête ou en ISR ;
 *  - seules les lignes `statut = publiee` sortent : un retrait disparaît de toutes les
 *    surfaces d'un coup.
 *
 * Cache mémoire 5 min par processus (une requête pour toute la liste, pas une par page) ;
 * `viderCacheVideos()` est appelé à chaque publication / retrait.
 */
import { prisma } from "@/lib/prisma";
import { videosSiteActives } from "./config";

export interface Chapitre {
  readonly titre: string;
  readonly debutSecondes: number;
}
export interface FichierMedia {
  readonly chemin: string;
  readonly type: string;
  readonly octets: number;
  readonly largeur?: number;
  readonly hauteur?: number;
}
export interface FichiersVideo {
  readonly video: FichierMedia;
  readonly affiche169: FichierMedia;
  readonly vignette43: FichierMedia;
  readonly vignette11: FichierMedia;
  readonly sousTitres: FichierMedia | null;
}

export interface VideoPubliee {
  readonly slug: string;
  readonly version: number;
  readonly theme: string;
  readonly titre: string;
  readonly description: string;
  readonly resume: string;
  readonly aRetenir: ReadonlyArray<string>;
  readonly questions: ReadonlyArray<{ question: string; reponse: string }>;
  readonly chapitres: ReadonlyArray<Chapitre>;
  readonly fichiers: FichiersVideo;
  readonly transcription: string | null;
  readonly dureeSecondes: number;
  readonly serie: { slug: string; titre: string; rang: number } | null;
  readonly lien: { type: "service" | "formation"; chemin: string };
  readonly iaVoixGeneree: boolean;
  readonly iaDoubleNumerique: boolean;
  readonly williamsALImage: boolean;
  readonly publieeLe: Date;
  readonly modifieeLe: Date;
}

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: VideoPubliee[] } | null = null;

function estBaseFactice(): boolean {
  return process.env.DATABASE_URL?.includes("stub.invalid") ?? false;
}

export function viderCacheVideos(): void {
  cache = null;
}

type Ligne = Awaited<ReturnType<typeof prisma.siteVideo.findMany>>[number];

function enVideo(l: Ligne): VideoPubliee {
  return {
    slug: l.slug,
    version: l.version,
    theme: l.theme,
    titre: l.titre,
    description: l.description,
    resume: l.resume,
    aRetenir: l.aRetenir as unknown as string[],
    questions: l.questions as unknown as VideoPubliee["questions"],
    chapitres: l.chapitres as unknown as Chapitre[],
    fichiers: l.fichiers as unknown as FichiersVideo,
    transcription: l.transcription,
    dureeSecondes: l.dureeSecondes,
    serie:
      l.serieSlug && l.serieTitre && l.serieRang !== null
        ? { slug: l.serieSlug, titre: l.serieTitre, rang: l.serieRang }
        : null,
    lien: { type: l.lienType as "service" | "formation", chemin: l.lienChemin },
    iaVoixGeneree: l.iaVoixGeneree,
    iaDoubleNumerique: l.iaDoubleNumerique,
    williamsALImage: l.williamsALImage,
    publieeLe: l.publieeLe,
    modifieeLe: l.modifieeLe,
  };
}

/** Toutes les vidéos publiées, de la plus récente à la plus ancienne. Jamais d'exception. */
export async function videosPubliees(): Promise<VideoPubliee[]> {
  if (!videosSiteActives() || estBaseFactice()) return [];
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const lignes = await prisma.siteVideo.findMany({
      where: { statut: "publiee" },
      orderBy: [{ publieeLe: "desc" }, { slug: "asc" }],
    });
    const data = lignes.map(enVideo);
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? [];
  }
}

export async function videoParSlug(slug: string): Promise<VideoPubliee | null> {
  return (await videosPubliees()).find((v) => v.slug === slug) ?? null;
}

export async function videosDuTheme(theme: string): Promise<VideoPubliee[]> {
  return (await videosPubliees()).filter((v) => v.theme === theme);
}

/**
 * Slugs des vidéos RETIRÉES (pour le 410 du proxy). Vide si l'interrupteur est éteint ou
 * sur la base factice du build. Jamais d'exception.
 */
export async function slugsRetires(): Promise<string[]> {
  if (!videosSiteActives() || estBaseFactice()) return [];
  try {
    const lignes = await prisma.siteVideo.findMany({
      where: { statut: "retiree" },
      select: { slug: true },
      orderBy: { slug: "asc" },
    });
    return lignes.map((l) => l.slug);
  } catch {
    return [];
  }
}
