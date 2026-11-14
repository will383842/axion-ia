// API /api/guide-ia/telecharger?t=… — le lien PERSONNEL de l'e-mail « Votre guide »
// (lot L2, 2026-09-24).
//
// Deux portes, et elles ne disent pas la même chose :
//
//   · GET  — quelqu'un, ou quelque chose, a OUVERT le lien. Ce peut être un
//            antivirus de messagerie (Safe Links, Mimecast, prévisualisation) :
//            ils suivent les liens d'un GET avant la personne. On pose donc
//            seulement `first_seen_at` (« vu »), et on rend une page minimale
//            avec un bouton ;
//   · POST — le bouton de cette page. Un scanneur ne soumet pas de formulaire :
//            c'est le seul geste qui vaut « guide ouvert par un humain ». On
//            pose `first_click_at` (premier clic) et `last_click_at` (à CHAQUE
//            clic : la conservation court depuis lui), on émet l'événement Plausible « Guide
//            Downloaded » (sans donnée personnelle), puis 303 vers le PDF.
//
// Le PDF garde son adresse publique (`content/guide-ia.ts` : elle part déjà dans
// des e-mails envoyés). Ce qui est personnel, c'est le LIEN, pas le fichier.
//
// Hors i18n (le `matcher` de `proxy.ts` écarte `/api`), hors sitemap, interdit
// aux robots (`robots.ts` : `Disallow: /api/`) et `noindex` en en-tête. La page
// rendue n'embarque AUCUN JavaScript.
//
// Jeton inconnu → 404, sans dire s'il a existé.

import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipDepuisEntetes } from "@/lib/client-ip";
import { urlGuideIa } from "@/content/guide-ia";
import { SITE_URL } from "@/lib/site-url";
import { AIMANT_GUIDE_IA } from "@/server/guide-ia/config";
import { RACINE_GUIDES, resoudreGuide } from "@/server/guides-reseau/guide-a-livrer";
import { emettreEvenementPlausible } from "@/lib/analytics/plausible-serveur";
import { auPlus } from "@/server/crm-sync/enqueue";
import { transmettreClicGuide } from "@/server/crm-sync/lettre-guide";
import { confirmerPreuvesAuClic } from "@/server/guides-reseau/preuve-page-guide";
import {
  CHEMIN_LIEN_GUIDE,
  langueDeLaRequete,
  pageDuLien,
  pageErreurLien,
} from "@/server/guide-ia/page-du-lien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_PAR_MINUTE = 30;
/** Attente maximale de l'écriture CRM avant la redirection vers le PDF (lot L4-S). */
const ATTENTE_MAX_CRM_MS = 1_500;
/** Jeton : 64 caractères hexadécimaux (`randomBytes(32)`). Tout autre format est refusé d'emblée. */
const FORMAT_JETON = /^[0-9a-f]{64}$/;

const ENTETES_PAGE: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store, private",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  // Page sans script : on le dit au navigateur. Le formulaire ne poste que vers
  // le site lui-même.
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

/** IP du client, `x-forwarded-for` n'étant cru que d'un proxy de confiance. */
function ipDe(req: NextRequest): string {
  return ipDepuisEntetes(req.headers);
}

async function debitDepasse(req: NextRequest): Promise<boolean> {
  const rl = await checkRateLimit(`guide-ia-lien:${ipDe(req)}`, {
    limit: LIMITE_PAR_MINUTE,
    windowSec: 60,
  });
  return !rl.allowed;
}

/** Jeton inconnu ou mal formé : la demande n'est pas lue, la langue vient du navigateur. */
function introuvable(req: NextRequest): NextResponse {
  return new NextResponse(
    pageErreurLien("introuvable", langueDeLaRequete(req.headers.get("accept-language"))),
    { status: 404, headers: ENTETES_PAGE },
  );
}

/** Débit dépassé : une vraie phrase, jamais le code `rate_limited`. */
function tropDeDemandes(req: NextRequest): NextResponse {
  return new NextResponse(
    pageErreurLien("debit", langueDeLaRequete(req.headers.get("accept-language"))),
    { status: 429, headers: { ...ENTETES_PAGE, "retry-after": "60" } },
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (await debitDepasse(req)) return tropDeDemandes(req);
  const jeton = new URL(req.url).searchParams.get("t") ?? "";
  if (!FORMAT_JETON.test(jeton)) return introuvable(req);

  const demande = await prisma.guideRequest.findUnique({
    where: { downloadToken: jeton },
    select: { id: true, locale: true, aimant: true, email: true },
  });
  if (demande === null) return introuvable(req);
  const langue = demande.locale === "en" ? "en" : "fr";

  // S2b — le guide-ia reste sur sa page, sans aucune lecture du catalogue.
  let titreCatalogue: string | null = null;
  if (demande.aimant !== AIMANT_GUIDE_IA) {
    const guide = await resoudreGuide(demande.aimant, demande.email).catch(() => null);
    if (guide === null || guide.kind !== "catalogue") {
      return new NextResponse(pageErreurLien("indisponible", langue), {
        status: 200,
        headers: ENTETES_PAGE,
      });
    }
    titreCatalogue = guide.titre;
  }

  // « Vu », pas « ouvert » : peut être un antivirus. Premier passage seulement.
  await prisma.guideRequest
    .updateMany({ where: { id: demande.id, firstSeenAt: null }, data: { firstSeenAt: new Date() } })
    .catch(() => undefined);

  const page =
    titreCatalogue === null
      ? pageDuLien(jeton, langue)
      : pageDuLien(jeton, langue, { titre: titreCatalogue });
  return new NextResponse(page, {
    status: 200,
    headers: ENTETES_PAGE,
  });
}

async function jetonDuCorps(req: NextRequest): Promise<string> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(await req.text()).get("t") ?? "";
  }
  if (type.includes("multipart/form-data")) {
    return ((await req.formData()).get("t") as string | null) ?? "";
  }
  return new URL(req.url).searchParams.get("t") ?? "";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (await debitDepasse(req)) return tropDeDemandes(req);
  const jeton = await jetonDuCorps(req);
  if (!FORMAT_JETON.test(jeton)) return introuvable(req);

  const demande = await prisma.guideRequest.findUnique({
    where: { downloadToken: jeton },
    select: { id: true, source: true, locale: true, aimant: true, email: true },
  });
  if (demande === null) return introuvable(req);

  const maintenant = new Date();
  // Premier clic : `first_click_at` et `last_click_at` ensemble. Clics
  // suivants : `last_click_at` seul — « 3 ans après votre dernier échange »
  // (mention du formulaire) se compte depuis LUI (`newsletter/retention.ts`).
  // `first_seen_at` aussi, au cas où le GET n'a pas eu lieu (bouton recopié,
  // navigateur qui a gardé la page).
  const premier = await prisma.guideRequest
    .updateMany({
      where: { id: demande.id, firstClickAt: null },
      data: { firstClickAt: maintenant, lastClickAt: maintenant },
    })
    .catch(() => ({ count: 0 }));
  if (premier.count === 0) {
    await prisma.guideRequest
      .updateMany({ where: { id: demande.id }, data: { lastClickAt: maintenant } })
      .catch(() => undefined);
  }
  await prisma.guideRequest
    .updateMany({ where: { id: demande.id, firstSeenAt: null }, data: { firstSeenAt: maintenant } })
    .catch(() => undefined);

  // Mesure d'audience, SANS donnée personnelle : la provenance seulement, et
  // si c'est la première ouverture. Le chemin transmis ne porte pas le jeton.
  // ⚠️ PAS d'`await` : Plausible peut mettre jusqu'à 1,5 s à répondre, et
  // c'est la personne qui attendait son PDF. L'envoi part, la redirection
  // aussi ; une mesure perdue ne coûte qu'une mesure.
  void emettreEvenementPlausible({
    nom: "Guide Downloaded",
    chemin: CHEMIN_LIEN_GUIDE,
    props: { source: demande.source ?? "inconnue", premier: premier.count > 0 ? "oui" : "non" },
    userAgent: req.headers.get("user-agent"),
    ip: ipDe(req),
  }).catch(() => undefined);

  // Preuve de l'accord de la page « Recevoir le guide » : le clic est la VÉRIFICATION de
  // l'adresse (« en attente » → « confirmée »). À CHAQUE POST (un second dépôt sur la même
  // demande se confirme au clic suivant), HORS de tout interrupteur du CRM — la preuve ne
  // dépend pas de lui —, AVANT lui, et bornée comme lui : la personne attend son PDF. Ne
  // lève jamais. Un GET ne confirme jamais (un antivirus n'est pas une personne).
  await auPlus(confirmerPreuvesAuClic(demande.id, maintenant), ATTENTE_MAX_CRM_MS);

  // Lot L4-S — entrée au CRM AU CLIC (décision D1) : `lead_magnet_requested`,
  // et l'inscription à la lettre s'il y en a une. Derrière
  // `CRM_SYNC_GUIDE_ENABLED` (fermé : rien, `crm_emitted_at` reste vide et le
  // rattrapage reprendra la ligne). Une seule fois par demande, même au
  // second clic (réservation par `crm_emitted_at`). JAMAIS au GET.
  // Ne lève pas. L'écriture en base est attendue, mais AU PLUS
  // `ATTENTE_MAX_CRM_MS` : au-delà, la redirection part et l'écriture finit
  // seule (ou le rattrapage la reprend). La mise en file Redis, elle, n'est
  // JAMAIS attendue (`mettreEnFileCrm`) : un Redis injoignable la ferait
  // attendre sans fin, et c'est la personne qui attend son PDF.
  await auPlus(transmettreClicGuide(demande.id, maintenant), ATTENTE_MAX_CRM_MS);

  // Le guide-ia garde sa redirection d'origine, sans lecture du catalogue ni du disque.
  if (demande.aimant === AIMANT_GUIDE_IA)
    return NextResponse.redirect(urlGuideIa(), { status: 303 });

  // Guide du catalogue : le fichier doit exister (non vide) sous `public/guides-reseau/`. Tout doute
  // (cible retirée, chemin refusé, fichier absent) rend la page neutre — jamais une 500.
  const indisponible = (): NextResponse =>
    new NextResponse(pageErreurLien("indisponible", demande.locale === "en" ? "en" : "fr"), {
      status: 200,
      headers: ENTETES_PAGE,
    });
  try {
    const guide = await resoudreGuide(demande.aimant, demande.email);
    if (guide.kind !== "catalogue") return indisponible();
    const racine = path.resolve(process.cwd(), "public", RACINE_GUIDES);
    const fichier = path.resolve(process.cwd(), "public", guide.chemin);
    if (!fichier.startsWith(racine)) return indisponible();
    const info = await stat(fichier);
    if (!info.isFile() || info.size <= 0) return indisponible();
    return NextResponse.redirect(`${SITE_URL}/${guide.chemin}`, { status: 303 });
  } catch {
    return indisponible();
  }
}
