/**
 * Téléchargement d'un document de projet depuis la console (ADR 0063, D7).
 *
 * 🔴 Première instruction : `exigerAccesEchanges()` (décision A2), avant toute
 * lecture — sans session 401, rôle hors de la liste 403.
 * Puis le TRIPLET (documentId, projetId, clientId) de l'URL : hors triplet,
 * 404 — jamais 403, qui confirmerait qu'un document existe chez un autre client.
 *
 * Toujours en pièce jointe, en `application/octet-stream`, quel que soit le
 * format : un HTML ou un e-mail déposé ne s'affiche jamais dans la console.
 * Un fichier ne sort qu'avec un verdict antivirus « sain » (409 infecté, 503
 * antivirus indisponible).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { AccesRefuse, exigerAccesEchanges } from "@/features/dossier-client/acces";
import {
  entetesTelechargement,
  telechargerDocument,
} from "@/features/dossier-client/documents/telecharger";
import { prisma } from "@/lib/prisma";
import { analyserOctets } from "@/server/careers/clamav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Une analyse refaite au téléchargement a 30 s, comme à l'ajout. */
const DELAI_ANTIVIRUS_MS = 30_000;

const SANS_CACHE = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function refus(statut: number, texte: string): NextResponse {
  return new NextResponse(texte, { status: statut, headers: SANS_CACHE });
}

const uuid = z.string().uuid();

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      locale: string;
      adminPrefix: string;
      id: string;
      projetId: string;
      documentId: string;
    }>;
  },
): Promise<NextResponse> {
  const acces = await exigerAccesEchanges().catch((e: unknown) => e);
  if (acces instanceof AccesRefuse) {
    // `exigerAccesEchanges` dit « Session expirée » quand personne n'est connecté.
    return acces.message.startsWith("Session expirée")
      ? refus(401, "Session expirée : reconnectez-vous.")
      : refus(403, acces.message);
  }
  if (acces instanceof Error || acces === null || typeof acces !== "object") {
    return refus(403, "Accès refusé.");
  }
  const { userId } = acces as { userId: string };

  const { id: clientId, projetId, documentId } = await params;
  if (![clientId, projetId, documentId].every((x) => uuid.safeParse(x).success)) {
    return refus(404, "Document introuvable.");
  }

  const r = await telechargerDocument(
    prisma,
    { id: documentId, projetId, clientId, parAdminId: userId },
    (octets) => analyserOctets(octets, DELAI_ANTIVIRUS_MS),
  );
  switch (r.issue) {
    case "introuvable":
      return refus(404, "Document introuvable.");
    case "infecte":
      return refus(
        409,
        "L'antivirus a trouvé un risque dans ce fichier : il ne peut pas être téléchargé.",
      );
    case "antivirus_indisponible":
      return refus(
        503,
        "La vérification antivirus est momentanément indisponible. Réessayez dans quelques minutes.",
      );
    case "servi":
      return new NextResponse(r.octets as unknown as BodyInit, {
        status: 200,
        headers: entetesTelechargement(r.nom, r.octets.length),
      });
  }
}
