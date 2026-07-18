// Redirection publique des QR codes dynamiques — /qr/<slug> → 302 destinationUrl.
//
// Chaque QR imprimé encode https://axion-ia.com/qr/<slug>. Ce handler résout le
// slug en base et redirige (302, jamais 301 : la cible peut changer) vers la
// destination courante, éditable dans l'admin sans réimprimer le QR.
//
// ⚠️ Route racine NON localisée : `qr/` DOIT être exclu du matcher de
// `src/proxy.ts` ET de `middleware.ts` (racine), sinon la règle "0bis" 301 vers
// `/fr/qr/<slug>` (mauvais, et un 301 fige la cible dans les caches).
//
// Node runtime (Prisma) + force-dynamic (jamais pré-rendu au SSG / build stub).

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  const link = await prisma.qrLink.findUnique({
    where: { slug },
    select: { id: true, destinationUrl: true, active: true },
  });

  if (!link || !link.active) {
    return new Response("QR code introuvable ou désactivé.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Comptage du scan — fire-and-forget (ne bloque jamais la redirection).
  void prisma.qrLink
    .update({
      where: { id: link.id },
      data: { scanCount: { increment: 1 }, lastScanAt: new Date() },
    })
    .catch(() => {});

  return Response.redirect(link.destinationUrl, 302);
}
