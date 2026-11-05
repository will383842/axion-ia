// Les conditions générales de vente en PDF : `GET /api/cgv`.
//
// Généré côté serveur depuis le texte publié (source unique : `getLegal`), nommé avec la
// version en vigueur. Public (les CGV le sont) ; aucune lecture de base, donc sans risque
// avec les stubs de build. Aucune écriture, aucun JavaScript navigateur.

import { CGV_VERSION } from "@/content/cgv-version";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";
import * as Sentry from "@sentry/nextjs";
import { rendreCgvPdf } from "@/server/cgv-pdf";
import {
  assurerArchiveCgvCourante,
  CgvArchiveAltere,
  lireOctetsArchives,
} from "@/server/legal/cgv-archive";
import { allumagePreuveCgv } from "@/server/legal/interrupteur-cgv-preuve";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  // Interrupteur `signature.cgv_preuve` : éteint (ou illisible) = rendu à la volée, comme avant.
  // Allumé : les octets ARCHIVÉS de la version courante, revérifiés ; altérés = 500, jamais servis.
  let pdf: Buffer;
  if ((await allumagePreuveCgv()) === null) {
    pdf = await rendreCgvPdf();
  } else {
    try {
      pdf = await lireOctetsArchives(await assurerArchiveCgvCourante());
    } catch (e) {
      Sentry.captureException(e, { tags: { zone: "cgv-archive" } });
      return new Response(
        e instanceof CgvArchiveAltere ? "CGV indisponibles" : "CGV temporairement indisponibles",
        { status: 500 },
      );
    }
  }
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(
        dispositionDemandee(req.url),
        `CGV-Axion-IA-${CGV_VERSION}.pdf`,
      ),
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
