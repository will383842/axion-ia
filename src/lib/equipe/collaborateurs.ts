/**
 * Lecteurs publics des collaborateurs (`TeamMember`) — SEUL point d'entrée des pages publiques.
 *
 * Contrat de build (AGENTS.md, stubs) : sur la base stub (`stub.invalid`) les lecteurs rendent
 * `null` / `[]` SANS appeler Prisma ; une table absente (P2021, migration pas encore passée) donne
 * aussi du vide. Aucun `$queryRaw`. Ne lit que les champs publics, statut « publie » seulement,
 * hors demande d'effacement. Aucun contact (e-mail chiffré, hash, jeton de retrait, note de preuve).
 */
import { prisma } from "@/lib/prisma";
import { SLUG_DIRIGEANT_PRINCIPAL } from "./regles";
import type { MembrePublic } from "./depuis-membre";

export type { MembrePublic } from "./depuis-membre";

/** Test identique à `src/lib/cities.ts`. */
export function isStubDatabase(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

const SELECT_PUBLIC = {
  slug: true,
  category: true,
  firstName: true,
  organizationName: true,
  jobTitle: true,
  headline: true,
  bioMd: true,
  skills: true,
  languages: true,
  categoryAnswers: true,
  questionnaireVersion: true,
  linkedinUrl: true,
  websiteUrl: true,
  citySlug: true,
  departmentCode: true,
  locationLabel: true,
  latitude: true,
  longitude: true,
  showOnMap: true,
  photoKind: true,
  photoUrl256: true,
  photoUrl1024: true,
  photoAlt: true,
  photoConsentAt: true,
  linkedinConsentAt: true,
  publishedAt: true,
  updatedAt: true,
} as const;

const PUBLIE = { status: "publie", erasureRequestedAt: null } as const;

function estTableAbsente(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2021";
}

async function ouVide<T>(vide: T, lecture: () => Promise<T>): Promise<T> {
  if (isStubDatabase()) return vide;
  try {
    return await lecture();
  } catch (e) {
    if (estTableAbsente(e)) return vide;
    throw e;
  }
}

export function getPublishedMember(slug: string): Promise<MembrePublic | null> {
  return ouVide<MembrePublic | null>(null, async () => {
    const m = await prisma.teamMember.findFirst({
      where: { slug, ...PUBLIE },
      select: SELECT_PUBLIC,
    });
    return (m as MembrePublic | null) ?? null;
  });
}

export function listPublishedMembers(): Promise<MembrePublic[]> {
  return ouVide<MembrePublic[]>([], async () => {
    const l = await prisma.teamMember.findMany({
      where: { ...PUBLIE, slug: { not: SLUG_DIRIGEANT_PRINCIPAL } },
      select: SELECT_PUBLIC,
      orderBy: [{ sortOrder: "asc" }, { firstName: "asc" }],
    });
    return l as MembrePublic[];
  });
}

export interface PointCarteMembre {
  slug: string;
  firstName: string;
  category: string;
  locationLabel: string | null;
  departmentCode: string | null;
  latitude: number;
  longitude: number;
}

export function listMapPoints(): Promise<PointCarteMembre[]> {
  return ouVide<PointCarteMembre[]>([], async () => {
    const l = await prisma.teamMember.findMany({
      where: { ...PUBLIE, showOnMap: true, latitude: { not: null }, longitude: { not: null } },
      select: {
        slug: true,
        firstName: true,
        category: true,
        locationLabel: true,
        departmentCode: true,
        latitude: true,
        longitude: true,
      },
      orderBy: [{ sortOrder: "asc" }, { firstName: "asc" }],
    });
    return l.filter(
      (p): p is typeof p & { latitude: number; longitude: number } =>
        p.latitude !== null && p.longitude !== null,
    );
  });
}

export type FicheEquipeResolue =
  | { type: "williams" }
  | { type: "membre"; membre: MembrePublic }
  | { type: "auteur"; profil: NonNullable<Awaited<ReturnType<typeof lireAuteur>>> }
  | null;

function lireAuteur(slug: string) {
  return prisma.authorProfile.findUnique({ where: { slug } });
}

/**
 * Ordre de résolution de `/equipe/[slug]` : (1) « williams » STATIQUE (jamais la base) ;
 * (2) `TeamMember` publié ; (3) `AuthorProfile` actif (Manon) ; sinon null (404).
 */
export async function resoudreFicheEquipe(slug: string): Promise<FicheEquipeResolue> {
  if (slug === SLUG_DIRIGEANT_PRINCIPAL) return { type: "williams" };
  const membre = await getPublishedMember(slug);
  if (membre) return { type: "membre", membre };
  const profil = await lireAuteur(slug);
  if (profil && profil.isActive) return { type: "auteur", profil };
  return null;
}
