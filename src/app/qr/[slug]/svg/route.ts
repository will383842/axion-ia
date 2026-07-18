// SVG vectoriel d'un QR code — /qr/<slug>/svg → image/svg+xml.
//
// Le QR encode l'URL de redirection stable (https://axion-ia.com/qr/<slug>),
// jamais la destination finale (qui, elle, peut changer). Sert à télécharger
// le QR prêt pour l'impression depuis l'admin (<img src="/qr/<slug>/svg">).
// Public : n'expose aucune donnée sensible (juste l'image du lien public).

import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  const link = await prisma.qrLink.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!link) {
    return new Response("QR code introuvable.", { status: 404 });
  }

  const target = `${SITE_URL}/qr/${slug}`;
  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1a1815", light: "#ffffff" },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="qr-${slug}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
