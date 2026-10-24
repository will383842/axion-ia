// Le questionnaire de pré-audit, page publique à jeton (2026-10-24).
//
// `/questionnaire/preaudit/<id>/<jeton>` sert le HTML de Will TEL QUEL, avec `CONFIG` injectée
// (voir `features/questionnaire-preaudit/html.ts`). `?essai=1` : mode essai (bandeau, rien
// enregistré, aucune notification). Le réel exige l'interrupteur allumé ET un questionnaire
// envoyé par Will ; sinon la MÊME réponse neutre 404, qui ne dit pas lequel.
//
// Sous `/questionnaire/`, donc hors du proxy et sous la CSP stricte de `next.config.ts`.
// `force-dynamic` : aucune requête à la base pendant `next build` (contrat `stub.invalid`).

import { mentionsRgpd, preauditActif } from "@/features/questionnaire-preaudit/config";
import { pagePourClient } from "@/features/questionnaire-preaudit/html";
import { lireParJeton } from "@/features/questionnaire-preaudit/serveur";

export const dynamic = "force-dynamic";

const ENTETES = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "same-origin",
} as const;

function neutre(): Response {
  return new Response("Page introuvable", {
    status: 404,
    headers: { ...ENTETES, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; jeton: string }> },
): Promise<Response> {
  const { id, jeton } = await ctx.params;
  const q = await lireParJeton(id, jeton);
  if (q === null) return neutre();
  const url = new URL(req.url);
  const essai = url.searchParams.get("essai") === "1";
  if (!essai && (!preauditActif() || q.envoyeLe === null)) return neutre();

  // Le `ref` est imposé par le serveur : dirigeant, collaborateurs et référent informatique
  // se regroupent sous la même référence (le HTML la lit dans `?ref=`).
  if (url.searchParams.get("ref") !== q.ref) {
    url.searchParams.set("ref", q.ref);
    return new Response(null, {
      status: 302,
      headers: { ...ENTETES, Location: `${url.pathname}${url.search}` },
    });
  }

  const rgpd = mentionsRgpd();
  const base = `/api/questionnaire-preaudit/${q.id}/${jeton}`;
  const page = pagePourClient(q.html, {
    endpoint: essai ? `${base}?essai=1` : base,
    client: "",
    contact: rgpd?.contact ?? "",
    conservation: rgpd?.conservation ?? "",
    essai,
  });
  return new Response(page, {
    status: 200,
    headers: { ...ENTETES, "Content-Type": "text/html; charset=utf-8" },
  });
}
