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

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import {
  avecCompteGoogle,
  compteOrganisateur,
  estLienVisio,
  estRedirectionCalendly,
} from "@/features/admin-rendezvous/visio";
// La résolution (et sa liste blanche d'hôtes) vit côté serveur, réutilisable
// (chantier visio, PR 4).
import { resoudreConference } from "@/features/admin-rendezvous/visio-serveur";

export const dynamic = "force-dynamic";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // La garde d'abord, la base ensuite (cf. `features/admin-calendly/acces.ts`).
  const session = await auth();
  // 401 en texte, PAS une redirection vers la connexion : le chemin de cette
  // route est public (il est dans le dépôt), et un `Location:` vers la page de
  // connexion livrerait le préfixe secret de la console à n'importe quel
  // `curl -I`. Même réponse que les autres routes `api/admin/*`.
  if (!session?.user) {
    return page(401, "Session expirée : reconnectez-vous à la console, puis rouvrez le lien.");
  }
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
