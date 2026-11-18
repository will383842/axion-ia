// Le questionnaire de pré-audit, page publique à jeton (2026-10-24).
//
// `/questionnaire/preaudit/<id>/<jeton>` sert le HTML de Will TEL QUEL, avec `CONFIG` injectée
// (voir `features/questionnaire-preaudit/html.ts`), en BAC À SABLE (voir `entetes.ts`) : son
// JavaScript n'a ni les cookies ni le stockage du site. `?essai=1` : mode essai (bandeau, rien
// enregistré, aucune notification). Le réel exige l'interrupteur allumé ET un questionnaire
// envoyé, ni clos ni expiré ; sinon la MÊME réponse neutre 404, qui ne dit pas lequel. La notice
// RGPD a ses valeurs par défaut dans le code (`config.ts`) : aucune variable à poser.
//
// Sous `/questionnaire/`, donc hors du proxy. `force-dynamic` : aucune requête à la base pendant
// `next build` (contrat `stub.invalid`).

import { mentionsRgpd, refusReel } from "@/features/questionnaire-preaudit/config";
import { ENTETES_PAGE_PREAUDIT } from "@/features/questionnaire-preaudit/entetes";
import { pagePourClient } from "@/features/questionnaire-preaudit/html";
import { ajoutsSuivi } from "@/features/questionnaire-preaudit/balise-ouverture";
import {
  phrasesNoticeSuivi,
  TITRE_NOTICE_SUIVI,
} from "@/features/questionnaire-preaudit/notice-suivi";
import { noticeVisible, suiviActif } from "@/features/questionnaire-preaudit/ouvertures";
import {
  accepteDesReponses,
  essaiPermis,
  lireParJeton,
} from "@/features/questionnaire-preaudit/serveur";

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
  // Audit E2, point 5 : l'essai sert au bouton « Essayer » de la console (lien pas encore envoyé,
  // ou envoyé et ouvert). Un lien CLOS ou EXPIRÉ ne rend plus son HTML pré-rempli, même en essai.
  if (essai && !essaiPermis(q)) return neutre();

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
  // Suivi des ouvertures (2026-10-27) : la notice dit ce qui est noté, la balise le note. En
  // ESSAI, rien n'est noté (la notice reste visible pour que Will la relise telle quelle).
  const ouvertures = suiviActif();
  const finDePage = ajoutsSuivi({
    endpoint: ouvertures && !essai ? `${base}/ouverture` : null,
    titre: TITRE_NOTICE_SUIVI,
    phrases: noticeVisible() ? phrasesNoticeSuivi({ ouvertures: true, brouillon: true }) : [],
  });
  const page = pagePourClient(q.html, {
    endpoint: essai ? `${base}?essai=1` : base,
    // Le nom affiché sur l'accueil (« Questionnaire préparé pour … ») : la raison sociale de la
    // fiche, passée par `jsonSur` (échappée). Vide : le HTML garde son texte par défaut.
    client: (q.rencontre?.client?.raisonSociale ?? "").trim().slice(0, 120),
    contact: rgpd.contact,
    conservation: rgpd.conservation,
    essai,
    finDePage,
  });
  return new Response(page, {
    status: 200,
    headers: { ...ENTETES_PAGE_PREAUDIT, "Content-Type": "text/html; charset=utf-8" },
  });
}
