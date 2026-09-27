// Ouvre la visio d'un appel réservé, sur le compte Google qui l'organise
// (2026-09-27).
//
// Pourquoi une route et pas un simple lien : voir `features/admin-rendezvous/
// visio.ts`. En deux mots, Calendly enregistre une redirection qui perd
// `?authuser=`, donc on la suit ici et on pose le compte sur le vrai lien Meet.
//
// Garde : la même que les écrans d'appels (`peutVoirLesAppels`). Le lien de
// visio d'un prospect vaut une invitation à sa réunion ; il ne sort pas vers un
// rôle qui n'a pas le droit de lire la fiche.

import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import {
  avecCompteGoogle,
  compteOrganisateur,
  estLienVisio,
  estRedirectionCalendly,
} from "@/features/admin-rendezvous/visio";

export const dynamic = "force-dynamic";

/** Au-delà, on renvoie sur le lien Calendly tel quel : il mène quand même à la salle. */
const DELAI_RESOLUTION_MS = 5_000;

function rediriger(location: string): NextResponse {
  // Location RELATIVE ou absolue, posée à la main : `NextResponse.redirect`
  // exige une URL absolue, et reconstruire l'hôte depuis la requête derrière
  // Cloudflare et Coolify est une source d'erreur inutile ici.
  return new NextResponse(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

function page(status: number, texte: string): NextResponse {
  return new NextResponse(texte, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Suit la redirection Calendly jusqu'à la conférence. `null` si Calendly ne
 * répond pas une redirection `https` exploitable.
 */
async function resoudreConference(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(DELAI_RESOLUTION_MS),
      cache: "no-store",
    });
    await res.body?.cancel();
    const cible = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !cible) return null;
    return estLienVisio(cible) ? new URL(cible, url).toString() : null;
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "appels-visio", etape: "resolution" } });
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // La garde d'abord, la base ensuite (cf. `features/admin-calendly/acces.ts`).
  const session = await auth();
  if (!session?.user) return rediriger(adminPath("fr", "login"));
  const role = (session.user as { role?: string | null }).role ?? null;
  if (!peutVoirLesAppels(role)) {
    return page(403, "Votre rôle ne donne pas accès aux appels réservés.");
  }

  const { id } = await params;
  const event = await prisma.calendlyEvent.findUnique({
    where: { id },
    select: { location: true, rawPayload: true },
  });
  if (!event) return page(404, "Rendez-vous introuvable.");

  const lieu = event.location?.trim() ?? "";
  if (!estLienVisio(lieu)) {
    return page(
      404,
      "Ce rendez-vous n'a pas de lien de visio. Ouvrez sa fiche dans la console, ou Google Agenda.",
    );
  }

  const conference = estRedirectionCalendly(lieu) ? await resoudreConference(lieu) : lieu;
  // Si Calendly n'a pas répondu, son lien reste bon : il mène à la même salle,
  // seulement sans le choix du compte.
  const cible = conference ?? lieu;
  return rediriger(avecCompteGoogle(cible, compteOrganisateur(event.rawPayload)));
}
