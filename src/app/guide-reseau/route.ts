// GET /guide-reseau?j=<jeton> — page « Recevoir le guide » (lot S2), en RÉPONSE HTML DE ROUTE.
//
// Aucun composant React, aucun JavaScript, aucun `page-*.js` : un formulaire HTML natif en POST vers
// `/guide-reseau/envoyer` (route), qui répond 303 vers `/guide-reseau/merci`. Pourquoi une route :
// une page App Router embarque le socle Next/React (≈ 185 Ko gz de First Load JS) et ajoute un
// chunk au bucket « page chunks publics » de `size-limit` (dépassé de 415 o par la version en page).
//
//   · interrupteur `PAGE_GUIDE_RESEAU_ENABLED` éteint → 404, rien n'est lu ;
//   · jeton absent, invalide, expiré, déjà utilisé, guide inconnu, secret mal configuré → la MÊME
//     page neutre (texte + lien vers le formulaire /guide-ia), jamais la cause ;
//   · sinon le formulaire : prénom (obligatoire), e-mail, une case obligatoire (le guide), une case facultative décochée (les informations), un champ piège.
//
// Rendu à la demande (`force-dynamic`), jamais au build : le build tourne avec une base factice
// (`stub.invalid`) et sans le secret du lien, qui n'est lu qu'ici, à la requête.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { pageGuideReseauActive } from "@/server/guides-reseau/config";
import { lireSecretLien } from "@/server/guides-reseau/secret-lien";
import {
  empreinteJeton,
  normaliserJetonRecu,
  TAILLE_MAX_JETON_RECU,
  verifierJeton,
} from "@/server/guides-reseau/lien-page-guide";
import { GUIDES_RESEAU_CONNUS, PRENOM_MAX, PRENOM_MIN } from "@/content/guides-reseau";
import { ENTETES_PAGE_GUIDE, echapper, pageStatique } from "./html-statique";
import { boutonSuivrePageHtml } from "@/server/guides-reseau/page-suivre";
import { TEXTES_PAGE_GUIDE as T, URL_CONFIDENTIALITE, URL_FORMULAIRE_GUIDE } from "./textes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le jeton est-il utilisable ? Toute cause d'échec donne la même réponse (`false`). */
async function jetonUtilisable(jeton: string | null): Promise<boolean> {
  if (!jeton) return false;
  const secret = lireSecretLien();
  if (!secret) return false;
  try {
    const v = verifierJeton(jeton, secret, Date.now());
    // Guide inconnu = page neutre dès le GET (sinon la personne remplirait un formulaire qui échouera).
    if (!v.ok || !GUIDES_RESEAU_CONNUS.includes(v.donnees.guide)) return false;
    const deja = await prisma.contactGuideReseau.findUnique({
      where: { jetonEmpreinte: empreinteJeton(jeton) },
      select: { id: true },
    });
    return deja === null;
  } catch {
    return false;
  }
}

const CHAMP =
  "display:block;width:100%;box-sizing:border-box;margin-top:.4rem;padding:.75rem .9rem;font:inherit;font-size:1.05rem;border:1px solid #c9c2b8;border-radius:.5rem"; // hex-ok: page HTML autonome, aucun jeton Tailwind (réponse de route)

const BOUTON =
  "width:100%;padding:.9rem 1.2rem;font:inherit;font-size:1.05rem;font-weight:600;color:#fff;background:#c24a1b;border:0;border-radius:.5rem"; // hex-ok: page HTML autonome, aucun jeton Tailwind (réponse de route)

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!pageGuideReseauActive()) {
    return new NextResponse("Not found", { status: 404, headers: ENTETES_PAGE_GUIDE });
  }
  const brut = req.nextUrl.searchParams.get("j");
  // Ponctuation finale avalée par un client de messagerie : retirée avant toute vérification.
  // Démesuré : page neutre tout de suite, avant toute normalisation, lecture ou base.
  const jeton =
    brut === null || brut.length > TAILLE_MAX_JETON_RECU ? null : normaliserJetonRecu(brut);

  if (!(await jetonUtilisable(jeton))) {
    return pageStatique(
      T.titre,
      `<p>${echapper(T.lienNeutre)}</p><p><a href="${echapper(URL_FORMULAIRE_GUIDE)}">${echapper(T.lienNeutreCta)}</a></p>`,
      200,
    );
  }

  const corps = `<p>${echapper(T.intro)}</p>
<form method="post" action="/guide-reseau/envoyer">
<input type="hidden" name="j" value="${echapper(jeton as string)}">
<p><label for="prenom"><strong>${echapper(T.prenom)}</strong></label><input id="prenom" name="prenom" type="text" required minlength="${PRENOM_MIN}" maxlength="${PRENOM_MAX}" autocomplete="given-name" style="${CHAMP}"></p>
<p><label for="email"><strong>${echapper(T.email)}</strong></label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" style="${CHAMP}"></p>
<div aria-hidden="true" style="position:absolute;left:-10000px"><label for="site-web">Site web</label><input id="site-web" name="website" type="text" tabindex="-1" autocomplete="off"></div>
<p style="display:flex;gap:.75rem;align-items:flex-start"><input id="accord" name="accord" type="checkbox" value="oui" required style="width:1.25rem;height:1.25rem;margin-top:.2rem;flex:none"><label for="accord">${echapper(T.case)}</label></p>
<p style="display:flex;gap:.75rem;align-items:flex-start"><input id="infos" name="infos" type="checkbox" value="oui" style="width:1.25rem;height:1.25rem;margin-top:.2rem;flex:none"><label for="infos">${echapper(T.caseInfos)}</label></p>
<p style="font-size:.875rem;opacity:.8">${echapper(T.information)} <a href="${echapper(URL_CONFIDENTIALITE)}">${echapper(T.lienConfidentialite)}</a>.</p>
<p><button type="submit" style="${BOUTON}">${echapper(T.envoyer)}</button></p>
</form>
<p>${echapper(T.sansCaseDebut)} <a href="${echapper(URL_FORMULAIRE_GUIDE)}">${echapper(T.sansCaseLien)}</a>.</p>`;
  // « Suivre la page » : simple lien, jamais une condition pour recevoir le guide (aucun bouton sans variable).
  const verifie = verifierJeton(jeton as string, lireSecretLien() as string, Date.now());
  const suivre = verifie.ok ? boutonSuivrePageHtml(verifie.donnees.reseau) : "";
  return pageStatique(T.titre, corps + suivre, 200);
}
