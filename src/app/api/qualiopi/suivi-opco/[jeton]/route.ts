/**
 * Lot OPCO A8 — réponse en un clic de l'ENTREPRISE : `/api/qualiopi/suivi-opco/<jeton>`.
 *
 * Route PUBLIQUE (aucune session) : le jeton est la seule clé. Sous `/api/`,
 * donc hors du `matcher` du proxy (pas de redirection vers `/fr/…`) ; ses
 * en-têtes (CSP stricte, `noindex`, `no-store`, `Referrer-Policy: same-origin`)
 * sont posés ici ET par `next.config.ts`.
 *
 *   GET  → page de QUESTION ou de CONFIRMATION. 🔴 Jamais d'écriture : les
 *          antivirus de messagerie suivent les liens des e-mails.
 *   POST → la seule écriture (`enregistrerReponse`), limitée en débit par IP
 *          HACHÉE.
 *
 * Jeton inconnu, expiré, déjà utilisé, suivi coupé → la même page neutre, 404.
 */

import { getClientIp } from "@/lib/client-ip";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { jourParis } from "@/server/qualiopi/financements/suivi-entreprise/planning";
import {
  ENTETES_PAGE_SUIVI,
  pageConfirmation,
  pageMerci,
  pageNeutre,
  pageQuestion,
} from "@/server/qualiopi/financements/suivi-entreprise/page-publique";
import {
  TAILLE_MAX_ACCORD_OCTETS,
  enregistrerReponse,
  lireJeton,
  reponseAdmise,
} from "@/server/qualiopi/financements/suivi-entreprise/reponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ jeton: string }> };

/** 10 réponses par quart d'heure et par IP : une entreprise en donne une. */
const LIMITE: RateLimitConfig = { limit: 10, windowSec: 900, surPanne: "laisser-passer" };

function html(corps: string, status = 200): Response {
  return new Response(corps, { status, headers: ENTETES_PAGE_SUIVI });
}

const neutre = () => html(pageNeutre(), 404);

export async function GET(req: Request, { params }: Contexte): Promise<Response> {
  const { jeton } = await params;
  const lu = await lireJeton(jeton, "reponse");
  if (lu.etat !== "valide") return neutre();
  const c = {
    chemin: `/api/qualiopi/suivi-opco/${jeton}`,
    question: lu.question,
    intituleFormation: lu.intituleFormation,
    nomOpco: lu.nomOpco,
    dossierTelechargeable: lu.dossierTelechargeable,
  };
  const reponse = reponseAdmise(lu.question, new URL(req.url).searchParams.get("reponse"));
  return html(
    reponse === null ? pageQuestion(c) : pageConfirmation(c, reponse, jourParis(new Date())),
  );
}

async function cleDeDebit(): Promise<string> {
  try {
    return `suivi-opco:${hashIp(await getClientIp()) ?? "sans-ip"}`;
  } catch {
    return "suivi-opco:sans-sel";
  }
}

export async function POST(req: Request, { params }: Contexte): Promise<Response> {
  const { jeton } = await params;
  const debit = await checkRateLimit(await cleDeDebit(), LIMITE);
  if (!debit.allowed) {
    return new Response("Trop de tentatives : réessayez dans quelques minutes.", {
      status: 429,
      headers: { ...ENTETES_PAGE_SUIVI, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const longueur = Number(req.headers.get("content-length") ?? "0");
  if (longueur > TAILLE_MAX_ACCORD_OCTETS + 64 * 1024) return neutre();

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return neutre();
  }
  const brut = fd.get("fichier");
  const fichier =
    brut instanceof Blob && brut.size > 0 && brut.size <= TAILLE_MAX_ACCORD_OCTETS
      ? new Uint8Array(await brut.arrayBuffer())
      : brut instanceof Blob && brut.size > TAILLE_MAX_ACCORD_OCTETS
        ? new Uint8Array(TAILLE_MAX_ACCORD_OCTETS + 1)
        : null;

  const issue = await enregistrerReponse({
    jeton,
    reponse: fd.get("reponse"),
    dateAccord: fd.get("date"),
    fichier,
  });
  if (issue.issue === "neutre") return neutre();
  if (issue.issue === "invalide") {
    const lu = await lireJeton(jeton, "reponse");
    if (lu.etat !== "valide") return neutre();
    return html(
      pageConfirmation(
        {
          chemin: `/api/qualiopi/suivi-opco/${jeton}`,
          question: lu.question,
          intituleFormation: lu.intituleFormation,
          nomOpco: lu.nomOpco,
          dossierTelechargeable: lu.dossierTelechargeable,
        },
        "accord",
        jourParis(new Date()),
        issue.message,
      ),
      400,
    );
  }
  return html(pageMerci(issue.reponse, issue.fichier));
}
