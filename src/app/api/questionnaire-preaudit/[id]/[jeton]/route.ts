// Réception des réponses du questionnaire de pré-audit (2026-10-24).
//
// POST JSON « schéma 3 », une personne à la fois. Jeton faux → 404 neutre.
//   · `?essai=1` : on valide la forme et on répond 200 SANS RIEN ÉCRIRE ni notifier ;
//   · réel : interrupteur allumé ET questionnaire envoyé par Will ; réponse chiffrée.
// Aucune notification par e-mail : la console affiche « à traiter » (`lu_le` vide).

import { NextResponse } from "next/server";

import { preauditActif } from "@/features/questionnaire-preaudit/config";
import { CHARGE_MAX_OCTETS, validerCharge } from "@/features/questionnaire-preaudit/donnees";
import { enregistrerReponse, lireParJeton } from "@/features/questionnaire-preaudit/serveur";

export const dynamic = "force-dynamic";

const ENTETES = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } as const;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; jeton: string }> },
): Promise<Response> {
  const { id, jeton } = await ctx.params;
  const q = await lireParJeton(id, jeton);
  if (q === null) return NextResponse.json({ ok: false }, { status: 404, headers: ENTETES });

  const essai = new URL(req.url).searchParams.get("essai") === "1";
  const declare = Number(req.headers.get("content-length") ?? "0");
  if (declare > CHARGE_MAX_OCTETS) {
    return NextResponse.json({ ok: false }, { status: 413, headers: ENTETES });
  }
  const v = validerCharge(await req.text());
  if (!v.ok)
    return NextResponse.json({ ok: false, motif: v.motif }, { status: 400, headers: ENTETES });

  if (essai) return NextResponse.json({ ok: true, essai: true }, { headers: ENTETES });

  if (!preauditActif()) return NextResponse.json({ ok: false }, { status: 404, headers: ENTETES });
  const r = await enregistrerReponse(q, v.charge);
  if (r === "pas_envoye")
    return NextResponse.json({ ok: false }, { status: 404, headers: ENTETES });
  if (r === "trop") return NextResponse.json({ ok: false }, { status: 429, headers: ENTETES });
  return NextResponse.json({ ok: true }, { headers: ENTETES });
}
