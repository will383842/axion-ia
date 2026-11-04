// Les conditions générales de vente en PDF : `GET /api/cgv`.
//
// Généré côté serveur depuis le texte publié (source unique : `getLegal`), nommé avec la
// version en vigueur. Public (les CGV le sont) ; aucune lecture de base, donc sans risque
// avec les stubs de build. Aucune écriture, aucun JavaScript navigateur.

import { CGV_VERSION } from "@/content/cgv-version";
import { rendreCgvPdf } from "@/server/cgv-pdf";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const pdf = await rendreCgvPdf();
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CGV-Axion-IA-${CGV_VERSION}.pdf"`,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
