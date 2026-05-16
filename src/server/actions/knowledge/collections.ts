/**
 * KB V4 (Sprint KB-18) — Server actions collections éditoriales.
 *
 * Collection = série curatée d'entries (ex : « Parcours dirigeants IA »).
 * Visibility public/unlisted/team. Items ordonnés via `position` (unique).
 */

"use server";

import { prisma } from "@/lib/prisma";

export type CollectionVisibility = "public" | "unlisted" | "team";

export interface CreateCollectionInput {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn?: string | null;
  readonly descriptionFr?: string | null;
  readonly descriptionEn?: string | null;
  readonly visibility?: CollectionVisibility;
  readonly ownerId?: string | null;
}

export async function createCollection(input: CreateCollectionInput) {
  if (input.titleFr.trim().length < 3) {
    throw new Error("Title FR trop court (min 3 chars)");
  }
  return prisma.knowledgeCollection.create({
    data: {
      slug: input.slug,
      titleFr: input.titleFr.trim(),
      titleEn: input.titleEn ?? null,
      descriptionFr: input.descriptionFr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      visibility: input.visibility ?? "team",
      ownerId: input.ownerId ?? null,
    },
    select: { id: true, slug: true, titleFr: true, visibility: true },
  });
}

export async function addItemToCollection(
  collectionId: string,
  entryId: string,
  position?: number,
  noteFr?: string | null,
) {
  // Si position non précisée, on ajoute en fin
  let targetPosition = position;
  if (targetPosition === undefined) {
    const last = await prisma.knowledgeCollectionItem.findFirst({
      where: { collectionId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    targetPosition = (last?.position ?? -1) + 1;
  }
  return prisma.knowledgeCollectionItem.create({
    data: {
      collectionId,
      entryId,
      position: targetPosition,
      noteFr: noteFr ?? null,
    },
    select: { entryId: true, position: true },
  });
}

export async function removeItemFromCollection(collectionId: string, entryId: string) {
  return prisma.knowledgeCollectionItem.delete({
    where: { collectionId_entryId: { collectionId, entryId } },
  });
}

export async function getCollectionBySlug(slug: string, viewerCanSeeTeam: boolean = false) {
  const collection = await prisma.knowledgeCollection.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleEn: true,
      descriptionFr: true,
      descriptionEn: true,
      visibility: true,
      publishedAt: true,
    },
  });
  if (!collection) return null;
  if (collection.visibility === "team" && !viewerCanSeeTeam) return null;

  const items = await prisma.knowledgeCollectionItem.findMany({
    where: { collectionId: collection.id },
    orderBy: { position: "asc" },
    select: {
      position: true,
      noteFr: true,
      noteEn: true,
      entry: {
        select: {
          id: true,
          slug: true,
          type: true,
          status: true,
          publishedAt: true,
        },
      },
    },
  });

  return { ...collection, items };
}

export async function publishCollection(collectionId: string) {
  return prisma.knowledgeCollection.update({
    where: { id: collectionId },
    data: { publishedAt: new Date(), visibility: "public" },
    select: { id: true, publishedAt: true, visibility: true },
  });
}
