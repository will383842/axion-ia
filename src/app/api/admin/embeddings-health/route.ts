/**
 * GET /api/admin/embeddings-health
 *
 * P1 observabilité RAG — diagnostic du provider d'embeddings (Voyage AI).
 *
 * Vérifie la présence de `VOYAGE_API_KEY`, fait un appel d'embedding réel minimal
 * (1 court texte) avec timeout court, et renvoie l'état du RAG vectoriel.
 *
 * Réponse : { ok, provider, model, dimension, stub, latencyMs, error? }
 *
 * - Build stub (`stub.invalid`) ou clé absente → `ok:false, stub:true` (sans throw).
 * - `ok:false` → le RAG retombe SILENCIEUSEMENT en FTS (lexical) : dégradé mais OK.
 *
 * Auth : admin uniquement (session NextAuth), même pattern que les autres routes admin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { checkEmbeddingHealth } from "@/lib/knowledge/embeddings";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkEmbeddingHealth();

  return NextResponse.json(health, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
