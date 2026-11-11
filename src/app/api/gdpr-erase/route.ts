// API /api/gdpr-erase — demande d'effacement RGPD en libre-service.
//
// POST { email, token, confirm: "ERASE_MY_DATA" }
//
// 🔴 DÉCISION DE WILLIAMS DU 11/11/2026 (fait foi) — PLUS AUCUNE SUPPRESSION.
//
// Jusqu'à cette date, la route enchaînait une vingtaine d'effaceurs (`src/lib/rgpd-erase.ts`) :
// `guide_requests`, `newsletter_subscribers`, `email_outbox`, `crm_sync_outbox`, chat, pièces
// jointes, candidatures, podcast, dossier client… supprimés ou anonymisés, puis une alerte
// Telegram et un e-mail « vos données ont été effacées » (audit RGPD du 11/11/2026, point E1).
//
// Désormais la demande MET LA PERSONNE À L'ÉCART (`server/rgpd/ecarter-au-lieu-d-effacer.ts`) :
// plus aucun envoi, plus aucune réinscription par un nouvel accord, données GARDÉES, preuve de
// la demande au journal, et une alerte dans la CLOCHE de la console (pas de Telegram, pas
// d'e-mail) pour que Williams traite la demande à la main. Les effaceurs de `rgpd-erase.ts`
// restent l'outil de ce geste humain ; cette route ne les appelle plus.
//
// Contrôles gardés : jeton HMAC (même schéma que `/api/gdpr-export`), anti-rejeu (adresse du
// jeton = adresse du corps), confirmation littérale, une demande par jour et par adresse.
//
// ⚠️ Plus d'e-mail de confirmation : l'ancien affirmait un effacement qui n'a plus lieu. Le
// texte d'un accusé de réception est À TRANCHER PAR WILLIAMS (et l'adresse étant écartée,
// le site ne peut plus rien lui envoyer : la réponse part à la main).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyGdprToken } from "@/lib/gdpr-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipVisiteurOuNull } from "@/lib/client-ip";
import { ecarterPourDemandeEffacement } from "@/server/rgpd/ecarter-au-lieu-d-effacer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  token: z.string().min(20),
  confirm: z.literal("ERASE_MY_DATA"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const { email, token } = parsed.data;

  // Rate limit 1/jour/email — l'erase est one-shot
  const rl = await checkRateLimit(`gdpr:erase:${email}`, {
    limit: 1,
    windowSec: 86_400,
    surPanne: "refuser",
  });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const v = await verifyGdprToken(token);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.reason }, { status: 401 });
  }
  if (v.email !== email) {
    return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 401 });
  }

  // Mise à l'écart : opposition (envois programmés retirés, CRM averti), marque « effacement
  // demandé » (plus aucun envoi), lettre et contacts du guide écartés, preuve, alerte cloche.
  // Ne lève pas sur une étape en panne : l'alerte nomme les étapes à reprendre à la main.
  await ecarterPourDemandeEffacement({
    email,
    origine: "libre-service",
    jti: v.jti,
    // L'IP du VISITEUR, jamais le relais Cloudflare ni `x-forwarded-for` brut.
    ip: ipVisiteurOuNull(req.headers),
  });

  return NextResponse.json({
    ok: true,
    statut: "demande_recue_mise_a_l_ecart",
    recueLe: new Date().toISOString(),
    notice: {
      explanation:
        "Votre demande d'effacement a bien été reçue. Vous ne recevrez plus aucun message de " +
        "notre part et vos coordonnées ne seront plus utilisées. Votre demande est traitée à la " +
        "main par notre responsable, qui vous répondra dans un délai d'un mois.",
      contactDpo: "contact@axion-ia.com",
    },
  });
}
