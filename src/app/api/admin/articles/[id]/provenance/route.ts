/**
 * GET /api/admin/articles/[id]/provenance
 *
 * B.4 P1.5 — Trace de provenance LLM complete pour un article (AI Act art. 50).
 * Retourne tous les enregistrements `generation_provenance` pour l'article,
 * ordonnes par timestamp ASC (hash chaine verifiable).
 *
 * Auth : admin uniquement (session NextAuth).
 * 404 si article introuvable ou pas de trace.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getProvenanceForArticle } from "@/server/content-gen/provenance/provenance-logger";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trace = await getProvenanceForArticle(id);

  if (trace.length === 0) {
    return NextResponse.json(
      { articleId: id, provenance: [], message: "No provenance trace found" },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      articleId: id,
      regulationVersion: "AI-Act-2024/1689",
      count: trace.length,
      provenance: trace,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
