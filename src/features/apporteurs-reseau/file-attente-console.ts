/**
 * Console — la file d'attente de l'article 3.5, en LECTURE SEULE : par entreprise, les rangs 1 et 2.
 * Tri par horodatage de la déclaration, rien d'autre. Table absente : file vide.
 */

import "server-only";

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { ordreDeFile } from "./file-attente-regles";
import { tableAbsente } from "./reservation-presentation";

export interface RangFile {
  rang: number;
  presentationId: string;
  apporteur: string;
  recueAt: Date;
  statut: "en_attente" | "informee";
  informeeAt: Date | null;
  fenetreFinAt: Date | null;
}

export interface FileEntreprise {
  cleFile: string;
  denomination: string;
  rangs: RangFile[];
}

export async function lireFilesAttente(): Promise<FileEntreprise[]> {
  let lignes;
  try {
    lignes = await prisma.declarationEnAttente.findMany({
      where: { statut: { in: ["en_attente", "informee"] } },
      orderBy: [{ recueAt: "asc" }, { id: "asc" }],
      take: 500,
    });
  } catch (err) {
    if (tableAbsente(err)) return [];
    throw err;
  }
  if (lignes.length === 0) return [];
  const [presentations, apporteurs] = await Promise.all([
    prisma.presentationEntreprise.findMany({
      where: { id: { in: lignes.map((l) => l.presentationId) } },
      select: { id: true, denomination: true },
    }),
    prisma.apporteurReseau.findMany({
      where: { id: { in: [...new Set(lignes.map((l) => l.apporteurId))] } },
      select: { id: true, prenom: true, nom: true },
    }),
  ]);
  const denomination = new Map(presentations.map((p) => [p.id, p.denomination]));
  const nom = new Map(
    apporteurs.map((a) => [
      a.id,
      [decryptPii(a.prenom), decryptPii(a.nom)].filter(Boolean).join(" ") || "—",
    ]),
  );
  const parCle = new Map<string, typeof lignes>();
  for (const l of lignes) parCle.set(l.cleFile, [...(parCle.get(l.cleFile) ?? []), l]);
  return [...parCle.entries()].map(([cleFile, ls]) => ({
    cleFile,
    denomination: denomination.get(ls[0]!.presentationId) ?? "—",
    rangs: ordreDeFile(ls).map((l, i) => ({
      rang: i + 1,
      presentationId: l.presentationId,
      apporteur: nom.get(l.apporteurId) ?? "—",
      recueAt: l.recueAt,
      statut: l.statut as "en_attente" | "informee",
      informeeAt: l.informeeAt,
      fenetreFinAt: l.fenetreFinAt,
    })),
  }));
}
