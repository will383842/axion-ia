// POST /api/candidature/complement — enregistre les réponses de la page
// « compléter ma candidature ». Route FIXE (et non Server Action) : une page
// ouverte avant une mise en ligne doit pouvoir envoyer après. Le jeton signé,
// porté dans le formulaire, est la seule autorisation (cf. `complement-envoi.ts`).

import { NextResponse, type NextRequest } from "next/server";

import { completerCandidature } from "@/features/job-application/complement-envoi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Envoi illisible, réessaie." }, { status: 400 });
  }
  const etat = await completerCandidature(formData);
  return NextResponse.json(etat, { status: etat?.ok ? 200 : 422 });
}
