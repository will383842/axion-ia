/**
 * `POST /api/interne/guides-reseau/contenu` — le Studio envoie le texte validé d'un guide, le site fabrique
 * le PDF et le range (G3). Signée ; 404 tant que `GUIDES_RESEAU_FABRIQUE_ENABLED` n'est pas vrai.
 * Voir `server/guides-reseau/fabrique-pdf.ts`.
 */
import type { NextRequest } from "next/server";
import { deposerContenu } from "@/server/guides-reseau/fabrique-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return deposerContenu(req);
}
