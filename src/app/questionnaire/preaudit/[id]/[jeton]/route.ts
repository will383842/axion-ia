// Le questionnaire de pré-audit, page publique à jeton (2026-10-24).
//
// `/questionnaire/preaudit/<id>/<jeton>` sert le HTML de Will TEL QUEL, avec `CONFIG` injectée
// (voir `features/questionnaire-preaudit/html.ts`), en BAC À SABLE (voir `entetes.ts`) : son
// JavaScript n'a ni les cookies ni le stockage du site. `?essai=1` : mode essai (bandeau, rien
// enregistré, aucune notification). Le réel exige l'interrupteur allumé, la notice RGPD
// renseignée, la purge planifiée ET un questionnaire envoyé, ni clos ni expiré ; sinon la MÊME
// réponse neutre 404, qui ne dit pas lequel.
//
// Sous `/questionnaire/`, donc hors du proxy. `force-dynamic` : aucune requête à la base pendant
// `next build` (contrat `stub.invalid`).

import { mentionsRgpd, refusReel } from "@/features/questionnaire-preaudit/config";
import { ENTETES_PAGE_PREAUDIT } from "@/features/questionnaire-preaudit/entetes";
import { pagePourClient } from "@/features/questionnaire-preaudit/html";
import { accepteDesReponses, lireParJeton } from "@/features/questionnaire-preaudit/serveur";

export const dynamic = "force-dynamic";

function neutre(): Response {
  return new Response("Page introuvable", {
    status: 404,
    headers: { ...ENTETES_PAGE_PREAUDIT, "Content-Type": "text/plain; charset=utf-8" },
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
  if (!essai && (refusReel() !== null || !accepteDesReponses(q))) return neutre();

  // Le `ref` est imposé par le serveur : dirigeant, collaborateurs et référent informatique
  // se regroupent sous la même référence (le HTML la lit dans `?ref=`).
  if (url.searchParams.get("ref") !== q.ref) {
    url.searchParams.set("ref", q.ref);
    return new Response(null, {
      status: 302,
      headers: { ...ENTETES_PAGE_PREAUDIT, Location: `${url.pathname}${url.search}` },
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
    headers: { ...ENTETES_PAGE_PREAUDIT, "Content-Type": "text/html; charset=utf-8" },
  });
}
