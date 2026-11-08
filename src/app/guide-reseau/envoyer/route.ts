// POST /guide-reseau/envoyer — réception du formulaire de la page « Recevoir le guide » (lot S2).
//
// Route (et non Server Action) : le formulaire est du HTML natif, sans JavaScript, et la page
// pose `Referrer-Policy: no-referrer`, sous lequel le navigateur envoie `Origin: null` sur un
// POST — ce que Next refuse pour une action serveur (voir `next.config.ts`, questionnaire).
// La protection contre les envois forgés est le jeton signé du lien, pas l'origine.
//
//   · interrupteur éteint → 503, rien n'est lu ni écrit ;
//   · débit par IP (`checkRateLimit`) ; champ piège rempli → faux succès (303 vers le merci) ;
//   · succès, jeton rejoué, adresse opposée → TOUS : 303 vers `/guide-reseau/merci` ;
//   · saisie incomplète / adresse refusée → 422 (page d'erreur statique + retour au formulaire) ;
//   · jeton refusé → 303 vers la page elle-même, qui montre sa page neutre.
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipDepuisEntetes } from "@/lib/client-ip";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import {
  FENETRE_PAGE_GUIDE_SEC,
  LIMITE_PAGE_GUIDE_PAR_IP,
  PREFIXE_DEBIT_PAGE_GUIDE,
  pageGuideReseauActive,
} from "@/server/guides-reseau/config";
import { lireSecretLien } from "@/server/guides-reseau/secret-lien";
import { confirmerPageGuide } from "@/server/guides-reseau/page-confirmation";
import { CHEMIN_PAGE_GUIDE } from "@/content/guides-reseau";
import { publicUrl } from "@/lib/public-url";
import { ENTETES_PAGE_GUIDE, echapper, pageStatique } from "../html-statique";
import { TEXTES_PAGE_GUIDE as T } from "../textes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTETES = ENTETES_PAGE_GUIDE;

function vers(chemin: string): NextResponse {
  // URL PUBLIQUE du site (`publicUrl`) : derrière le proxy, `req.url` porte l'adresse d'écoute
  // INTERNE du conteneur (Location: https://0.0.0.0:3000/…). 303 : le navigateur rejoue en GET.
  return NextResponse.redirect(publicUrl(chemin), { status: 303, headers: ENTETES });
}

/** Page d'erreur statique : aucun script, aucune donnée saisie n'y est répétée. */
function pageErreur(message: string, jeton: string, statut: number): NextResponse {
  const retour = jeton ? `${CHEMIN_PAGE_GUIDE}?j=${encodeURIComponent(jeton)}` : CHEMIN_PAGE_GUIDE;
  return pageStatique(
    T.titre,
    `<p role="alert">${echapper(message)}</p><p><a href="${echapper(retour)}">${echapper(T.retour)}</a></p>`,
    statut,
  );
}

function texte(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!pageGuideReseauActive()) {
    return NextResponse.json(
      { ok: false, erreur: "page_eteinte" },
      { status: 503, headers: ENTETES },
    );
  }

  const ip = ipDepuisEntetes(req.headers);
  const debit = await checkRateLimit(`${PREFIXE_DEBIT_PAGE_GUIDE}:${ip}`, {
    limit: LIMITE_PAGE_GUIDE_PAR_IP,
    windowSec: FENETRE_PAGE_GUIDE_SEC,
  });
  if (!debit.allowed) {
    return new NextResponse(T.erreurs.trop_de_requetes, {
      status: 429,
      headers: { ...ENTETES, "Retry-After": String(FENETRE_PAGE_GUIDE_SEC) },
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return pageErreur(T.erreurs.email, "", 422);
  }
  const jeton = texte(form.get("j"));

  // Champ piège : faux succès, rien d'écrit.
  const leurre = form.get("website");
  if (leurre) {
    await signalerHoneypot("guide-reseau-page", leurre);
    return vers(`${CHEMIN_PAGE_GUIDE}/merci`);
  }

  const secret = lireSecretLien();
  if (!secret) return vers(`${CHEMIN_PAGE_GUIDE}?j=${encodeURIComponent(jeton)}`);

  let resultat;
  try {
    resultat = await confirmerPageGuide({
      jeton,
      prenom: texte(form.get("prenom")),
      email: texte(form.get("email")),
      caseCochee: form.get("accord") === "oui",
      ip,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      secret,
    });
  } catch (e) {
    // Ni adresse ni prénom dans le journal : le nom de l'erreur seulement.
    console.error(
      JSON.stringify({
        event: "guides_reseau_page_echec",
        erreur: e instanceof Error ? e.name : "erreur",
      }),
    );
    return new NextResponse("Erreur. Réessayez dans quelques minutes.", {
      status: 500,
      headers: ENTETES,
    });
  }

  if (resultat.ok) return vers(`${CHEMIN_PAGE_GUIDE}/merci`);
  if (resultat.erreur === "lien")
    return vers(`${CHEMIN_PAGE_GUIDE}?j=${encodeURIComponent(jeton)}`);
  if (resultat.statut === 429) {
    return new NextResponse(T.erreurs.trop_de_requetes, { status: 429, headers: ENTETES });
  }
  return pageErreur(T.erreurs[resultat.erreur], jeton, 422);
}

// Un GET n'envoie rien : on revient au formulaire.
export async function GET(): Promise<NextResponse> {
  return vers(CHEMIN_PAGE_GUIDE);
}
