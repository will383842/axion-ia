/**
 * Notes du site d'audit : lecture de la dernière version, enregistrement
 * d'une nouvelle (voir `features/site-audit/notes.ts`). Super_admin seul,
 * écriture : même origine + en-tête `x-site-audit`.
 */
import { NextResponse, type NextRequest } from "next/server";

import { ErreurDocument } from "@/features/dossier-client/documents/ajouter";
import { telechargerDocument } from "@/features/dossier-client/documents/telecharger";
import { SANS_CACHE } from "@/features/site-audit/config";
import { gardeSiteAudit, refus } from "@/features/site-audit/garde";
import {
  derniereVersion,
  enregistrerNotes,
  MAX_NOTES_OCTETS,
  validerNotes,
} from "@/features/site-audit/notes";
import { prisma } from "@/lib/prisma";
import { analyserOctets } from "@/server/careers/clamav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_ENTETES = {
  ...SANS_CACHE,
  "Content-Type": "application/json; charset=utf-8",
};

function json(statut: number, corps: unknown): NextResponse {
  return new NextResponse(JSON.stringify(corps), { status: statut, headers: JSON_ENTETES });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const { clientId } = await params;
  const g = await gardeSiteAudit(req, clientId, { ecriture: false });
  if (g instanceof NextResponse) return g;

  const v = await derniereVersion(prisma, g);
  if (v === null) return new NextResponse(null, { status: 204, headers: SANS_CACHE });
  const r = await telechargerDocument(
    prisma,
    { id: v.id, projetId: g.projetId, clientId: g.clientId, parAdminId: g.userId },
    (o) => analyserOctets(o, 30_000),
  );
  if (r.issue === "antivirus_indisponible") {
    return refus(503, "La vérification antivirus est momentanément indisponible. Réessayez.");
  }
  if (r.issue !== "servi") return refus(404, "Introuvable.");
  let contenu: unknown;
  try {
    contenu = JSON.parse(new TextDecoder().decode(r.octets));
  } catch {
    return refus(500, "Notes illisibles.");
  }
  return json(200, { version: v.id, ...(contenu as object) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const { clientId } = await params;
  const g = await gardeSiteAudit(req, clientId, { ecriture: true });
  if (g instanceof NextResponse) return g;

  const annonce = Number(req.headers.get("content-length") ?? "0");
  if (annonce > MAX_NOTES_OCTETS) return refus(413, "Notes trop volumineuses.");
  const texte = await req.text();
  if (new TextEncoder().encode(texte).length > MAX_NOTES_OCTETS) {
    return refus(413, "Notes trop volumineuses.");
  }
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return refus(400, "Notes illisibles.");
  }
  const v = validerNotes(brut);
  if (!v.ok) return refus(400, "Notes invalides.");
  const base = (brut as { base?: unknown }).base;
  if (base !== null && base !== undefined && typeof base !== "string") {
    return refus(400, "Notes invalides.");
  }

  try {
    const r = await enregistrerNotes(
      prisma,
      {
        clientId: g.clientId,
        projetId: g.projetId,
        base: typeof base === "string" ? base : null,
        notes: v.notes,
        parAdminId: g.userId,
      },
      (o) => analyserOctets(o, 30_000),
    );
    if (r.issue === "ok") return json(200, { version: r.version });
    if (r.issue === "conflit" || r.issue === "moins") {
      return json(409, { version: r.version, raison: r.issue });
    }
    if (r.issue === "volumineux") return refus(413, "Notes trop volumineuses.");
    return refus(503, "La vérification antivirus est momentanément indisponible. Réessayez.");
  } catch (e) {
    if (e instanceof ErreurDocument) return refus(400, e.message);
    throw e;
  }
}
