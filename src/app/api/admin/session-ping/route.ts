// Endpoint léger heartbeat session admin — refonte mai 2026 §3.6.
//
// Pourquoi cet endpoint :
//   Le composant <AdminSessionExpiryWarning> (livré en PR 1) interroge cet
//   endpoint toutes les 5 min pour détecter une session sur le point
//   d'expirer (JWT maxAge 30 jours, updateAge 24h — cf. src/auth.config.ts).
//   Si la réponse renvoie 401 ou `expiresAt < now() + 2min`, le composant
//   affiche une modal non-bloquante proposant :
//   - « Se reconnecter » (popup /login, préserve la page).
//   - « Sauvegarder en draft local » (sérialise dans localStorage).
//
//   Mitigation critique pour TiptapEditor publications/edit où une session
//   expirée silencieuse = perte du travail rédactionnel.
//
// Contrat :
//   GET /api/admin/session-ping
//   → 200 { ok: true, expiresAt: "<ISO>" } si session valide
//   → 401 { ok: false } sinon
//
//   Payload < 200 octets. Pas de DB call (lecture JWT pure).
//   force-dynamic obligatoire (session check chaque appel).
//
// Cf. _AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md (PR 0).

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json(
    { ok: true, expiresAt: session.expires },
    {
      status: 200,
      headers: {
        // Évite mise en cache CDN/proxy de la réponse (session-bound).
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
