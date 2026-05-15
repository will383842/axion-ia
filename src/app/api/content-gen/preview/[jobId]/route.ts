/**
 * Content Generator — Preview HTML rendu (Fix P1-13 audit opérationnel
 * 2026-05-14).
 *
 * § 12.1 master prompt — iframe preview JWT-signed (10 min) pour la review
 * queue. Le token est passé en query param `?t=<token>`. Le route lit
 * `ContentGenJob.outputJsonRaw` et émet un HTML minimal stylé (pas l'article
 * publié — le job n'est pas encore inséré DB).
 *
 * Auth = token valide ; pas de RBAC additionnel (le token est le secret).
 * X-Frame-Options: SAMEORIGIN pour autoriser l'iframe depuis admin.
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPreviewToken } from "@/server/content-gen/shared/preview-token";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("t");
  if (!token) return new Response("missing_token", { status: 401 });

  const payload = verifyPreviewToken(token);
  if (!payload) return new Response("invalid_or_expired_token", { status: 401 });
  if (payload.jobId !== jobId) return new Response("token_jobid_mismatch", { status: 401 });

  const job = await prisma.contentGenJob.findUnique({
    where: { id: jobId },
    select: { outputJsonRaw: true, contentType: true, anchorVilleSlug: true },
  });
  if (!job || !job.outputJsonRaw) {
    return new Response("job_output_not_found", { status: 404 });
  }
  const output = job.outputJsonRaw as Record<string, unknown>;
  const title = typeof output.title === "string" ? output.title : "Sans titre";
  const metaDescription = typeof output.metaDescription === "string" ? output.metaDescription : "";
  const bodyHtmlRaw = typeof output.bodyHtml === "string" ? output.bodyHtml : "";
  // Sanitize côté serveur AVANT rendu (même pipeline que publish — anti XSS
  // si un futur change introduit un HTML non-purgé).
  const bodyHtml = sanitizeContentGenHtml(bodyHtmlRaw);

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${escapeHtml(title)} · Preview</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 720px; margin: 32px auto; padding: 0 16px; line-height: 1.6; color: rgb(31,27,22); }
  h1 { font-size: 1.8em; }
  .preview-meta { background: rgba(196,90,62,0.08); border-left: 3px solid rgb(196,90,62); padding: 12px; margin-bottom: 24px; font-size: 13px; }
  img { max-width: 100%; height: auto; }
  pre { background: rgba(0,0,0,0.04); padding: 8px; overflow-x: auto; }
</style>
</head>
<body>
  <div class="preview-meta">
    <strong>Aperçu admin</strong> — ${escapeHtml(job.contentType)}${job.anchorVilleSlug ? ` · ${escapeHtml(job.anchorVilleSlug)}` : ""}
    · token valide 10 min · noindex,nofollow.
  </div>
  <article>
    <h1>${escapeHtml(title)}</h1>
    ${metaDescription ? `<p><em>${escapeHtml(metaDescription)}</em></p>` : ""}
    ${bodyHtml}
  </article>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
