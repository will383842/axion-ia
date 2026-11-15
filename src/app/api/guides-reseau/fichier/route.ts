/**
 * `GET /api/guides-reseau/fichier?c=&v=&e=&s=` — lecture d'un PDF de guide rangé sur le VOLUME (G4).
 * Lien signé (HMAC, 10 min, secret distinct) émis par le téléchargement par version. Jamais indexé,
 * jamais en cache ; toute anomalie = 404 neutre, jamais de 500.
 */
import type { NextRequest } from "next/server";
import {
  cleObjet,
  fabriqueActive,
  secretFichierGuide,
} from "@/server/guides-reseau/fabrique-config";
import { verifierLienFichier } from "@/server/guides-reseau/lien-fichier-guide";
import { RE_CODE_GUIDE_CATALOGUE } from "@/server/guides-reseau/format-code-guide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTETES = {
  "cache-control": "no-store, private",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

const introuvable = (): Response => new Response("Introuvable", { status: 404, headers: ENTETES });

export async function GET(req: NextRequest): Promise<Response> {
  try {
    if (!fabriqueActive()) return introuvable();
    const q = new URL(req.url).searchParams;
    const code = q.get("c") ?? "";
    const v = q.get("v") ?? "";
    const e = q.get("e") ?? "";
    const s = q.get("s") ?? "";
    if (!RE_CODE_GUIDE_CATALOGUE.test(code) || !/^\d{1,6}$/.test(v) || !/^\d{1,12}$/.test(e)) {
      return introuvable();
    }
    const version = Number(v);
    const secret = secretFichierGuide();
    if (secret === null || !verifierLienFichier(secret, code, version, Number(e), s))
      return introuvable();
    const { prisma } = await import("@/lib/prisma");
    const ligne = await prisma.guideReseauVersion.findUnique({
      where: { code_version: { code, version } },
      select: { statut: true, stockage: true },
    });
    if (ligne === null || ligne.statut !== "pret" || ligne.stockage !== "volume")
      return introuvable();
    const { cheminLisibleVolume } = await import("@/server/guides-reseau/stockage-guides");
    const fichier = await cheminLisibleVolume(cleObjet(code, version));
    if (fichier === null) return introuvable();
    const { readFile } = await import("node:fs/promises");
    const contenu = await readFile(fichier);
    if (contenu.length === 0) return introuvable();
    return new Response(new Uint8Array(contenu), {
      status: 200,
      headers: {
        ...ENTETES,
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${code}.pdf"`,
        "content-length": String(contenu.length),
      },
    });
  } catch {
    return introuvable();
  }
}
