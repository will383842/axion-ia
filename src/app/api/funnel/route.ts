// use-client: not needed — Route Handler, pas un composant React.
//
// Ingestion des balises de tunnel d'acquisition.
//
// ── Pourquoi cette route existe en plus de Plausible ──────────────────────
// Plausible sait dire combien de visiteurs ont démarré le simulateur et
// combien l'ont terminé. Il ne sait pas dire à quel écran partent ceux qui
// abandonnent, ni si ceux qui décrochent viennent d'une campagne précise. Or
// c'est la seule information qui indique quoi corriger. Le chaînage par
// `sessionId` en base le permet.
//
// ── Posture de confiance ──────────────────────────────────────────────────
// 🔴 Cette route est PUBLIQUE et non authentifiée : n'importe qui peut lui
// envoyer n'importe quoi. Les chiffres qu'elle produit sont donc INDICATIFS —
// bons pour comparer des variantes de page ou lire une courbe d'abandon,
// jamais pour facturer ni pour prouver quoi que ce soit. La source de vérité
// des conversions reste la table `submissions`, écrite par une action serveur.
//
// Trois gardes limitent le bruit : la limitation de débit par IP, la
// validation stricte (`funnelEventSchema`), et le fait qu'aucune valeur libre
// ne dimensionne quoi que ce soit côté serveur.
//
// ── Vie privée ────────────────────────────────────────────────────────────
// 🔴 Aucune adresse IP n'est enregistrée, même hachée. L'IP sert uniquement de
// clé de limitation de débit, en mémoire/Redis, et n'atteint jamais la table.
// C'est une condition de l'exemption de consentement sous laquelle les pages
// de tunnel se passent volontairement de bannière (cf. la migration
// `20260812210000_funnel_events`). Ne pas ajouter `ipHash` ici « pour
// déduplique » : cela ferait tomber l'exemption.

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { funnelEventSchema } from "@/lib/schemas/funnel-event-schema";

/** Le corps utile fait quelques centaines d'octets ; 4 Ko est déjà généreux. */
const MAX_BODY_BYTES = 4096;

/**
 * Un parcours complet émet une quinzaine de balises. 120/min laisse passer un
 * visiteur pressé et deux onglets ouverts, tout en coupant un script.
 */
const RATE_LIMIT = { limit: 120, windowSec: 60 } as const;

export async function POST(req: NextRequest): Promise<Response> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`funnel:${ip}`, RATE_LIMIT);
  if (!rl.allowed) {
    return new Response(null, { status: 429 });
  }

  // Refus avant lecture quand le client annonce un corps démesuré. L'en-tête
  // est déclaratif et peut mentir : la vraie borne reste celle des longueurs
  // de champ dans le schéma Zod.
  const annonce = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(annonce) && annonce > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let brut: unknown;
  try {
    brut = await req.json();
  } catch {
    // JSON invalide : robots et clients cassés. On répond 204 sans journaliser,
    // pour ne pas transformer un bruit de fond en inondation de logs.
    return new Response(null, { status: 204 });
  }

  const parse = funnelEventSchema.safeParse(brut);
  if (!parse.success) {
    return new Response(null, { status: 204 });
  }
  const balise = parse.data;

  // L'attribution est relue CÔTÉ SERVEUR depuis le cookie déposé à l'arrivée,
  // et non reçue du client. Deux raisons : le client ne connaît plus les
  // paramètres d'URL après une navigation interne, et une valeur envoyée par
  // le client serait falsifiable — ce qui fausserait l'attribution des
  // campagnes payantes, précisément la donnée qu'on veut fiable.
  const jar = await cookies();
  const utm = readUtmCookie(jar.get(UTM_COOKIE_NAME)?.value);

  try {
    await prisma.funnelEvent.create({
      data: {
        funnel: balise.funnel,
        event: balise.event,
        sessionId: balise.sessionId,
        locale: balise.locale ?? null,
        route: balise.route ?? null,
        deviceType: balise.deviceType ?? null,
        step: balise.step ?? null,
        stepIndex: balise.stepIndex ?? null,
        stepTotal: balise.stepTotal ?? null,
        sector: balise.sector ?? null,
        headcount: balise.headcount ?? null,
        gainBucket: balise.gainBucket ?? null,
        utmSource: utm.utm_source ?? null,
        utmMedium: utm.utm_medium ?? null,
        utmCampaign: utm.utm_campaign ?? null,
        landing: balise.landing ?? null,
        placement: balise.placement ?? null,
      },
    });
  } catch {
    // 🔴 Une panne de mesure ne doit JAMAIS dégrader le tunnel. Si la base est
    // indisponible, on perd des statistiques — pas un prospect. On répond 204
    // comme si de rien n'était : le client n'a de toute façon rien à faire de
    // cette information, la balise est émise sans attendre la réponse.
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 204 });
}
