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
import { normaliserJetonRecu, TAILLE_MAX_JETON_RECU } from "@/server/guides-reseau/lien-page-guide";
import { adresseMerci } from "@/server/guides-reseau/page-suivre";
import { confirmerPageGuide } from "@/server/guides-reseau/page-confirmation";
import { CHEMIN_PAGE_GUIDE } from "@/content/guides-reseau";
import { publicUrl } from "@/lib/public-url";
import { ENTETES_PAGE_GUIDE, echapper, pageStatique } from "../html-statique";
import { TEXTES_PAGE_GUIDE as T } from "../textes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTETES = ENTETES_PAGE_GUIDE;

/** Plafond du corps du POST : jeton, prénom, e-mail et case tiennent largement dans 8 Kio. */
const CORPS_MAX_OCTETS = 8 * 1024;

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
    `<p id="erreur" role="alert">${echapper(message)}</p><p><a href="${echapper(retour)}" aria-describedby="erreur">${echapper(T.retour)}</a></p>`,
    statut,
  );
}

/** Lit le corps en flux et s'arrête dès que le plafond est franchi (jamais tout en mémoire). */
async function lireCorpsPlafonne(req: NextRequest): Promise<ArrayBuffer | null> {
  if (!req.body) return new ArrayBuffer(0);
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > CORPS_MAX_OCTETS) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  const brut = new Uint8Array(new ArrayBuffer(total));
  let pos = 0;
  for (const m of morceaux) {
    brut.set(m, pos);
    pos += m.byteLength;
  }
  return brut.buffer;
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

  // Plafond de taille du corps : au-delà, message générique (413), rien n'est lu ni confirmé.
  const annonce = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(annonce) && annonce > CORPS_MAX_OCTETS)
    return pageErreur(T.erreurs.corps_trop_gros, "", 413);

  let form: FormData;
  try {
    const brut = await lireCorpsPlafonne(req);
    if (brut === null) return pageErreur(T.erreurs.corps_trop_gros, "", 413);
    form = await new Response(brut, {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return pageErreur(T.erreurs.email, "", 422);
  }
  const brut = texte(form.get("j"));
  // Démesuré : réponse neutre habituelle (retour à la page, qui montre sa page neutre), avant
  // toute autre opération — ni normalisation, ni piège, ni base.
  if (brut.length > TAILLE_MAX_JETON_RECU) return vers(CHEMIN_PAGE_GUIDE);
  // Avant la vérification ET l'empreinte (usage unique) : un point final ne change ni l'une ni l'autre.
  const jeton = normaliserJetonRecu(brut);

  // Champ piège : faux succès, rien d'écrit.
  const leurre = form.get("website");
  if (leurre) {
    await signalerHoneypot("guide-reseau-page", leurre);
    // MÊME adresse qu'un envoi réel (`adresseMerci`) : rien ne dit que le piège a répondu.
    return vers(adresseMerci(jeton, lireSecretLien()));
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
      infosCochee: form.get("infos") === "oui",
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

  if (resultat.ok) {
    // Le réseau d'origine (valeur du jeton, jamais une donnée saisie) sert au seul bouton « Suivre la page ».
    return vers(adresseMerci(jeton, secret));
  }
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
