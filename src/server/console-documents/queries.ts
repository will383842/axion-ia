// Lectures (server-only) des documents console.
import "server-only";
import { prisma } from "@/lib/prisma";
import type { ConsoleDocSection } from "../../../prisma/generated/client";

export interface ConsoleDocListItem {
  id: string;
  section: ConsoleDocSection;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sensitive: boolean;
  sortOrder: number;
  createdAt: Date;
}

/** Liste les documents d'une section, triés par ordre manuel puis date. */
export async function listConsoleDocsBySection(
  section: ConsoleDocSection,
): Promise<ConsoleDocListItem[]> {
  return prisma.consoleDocument.findMany({
    where: { section },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      section: true,
      title: true,
      description: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      sensitive: true,
      sortOrder: true,
      createdAt: true,
    },
  });
}

/** Récupère le chemin de stockage + métadonnées d'un document (route de download). */
export async function getConsoleDocForDownload(id: string): Promise<{
  storagePath: string;
  fileName: string;
  mimeType: string;
  sensitive: boolean;
} | null> {
  return prisma.consoleDocument.findUnique({
    where: { id },
    select: { storagePath: true, fileName: true, mimeType: true, sensitive: true },
  });
}
