// V2-S07 — Le webhook Calendly, non signé, mal signé, périmé, rejoué.
//
// Livraisons présentées à la VRAIE route (`/api/calendly/webhook`), signées
// au format Calendly par le banc (`signerLivraisonCalendly`, qui se relit avec
// la vérification du code). Le type d'évènement du témoin est inconnu de la
// route : elle répond 200 sans appeler l'API Calendly (aucun réseau au banc).

import crypto from "node:crypto";

import { NextRequest } from "next/server";

// eslint-disable-next-line no-restricted-imports
import { POST as webhook } from "@/app/api/calendly/webhook/route";

import { reponse } from "../v2s-outils";
import { signerLivraisonCalendly } from "../../../../fixtures/formateurs/serveur/webhook-signe";

const CLE = `banc-v2s07-${crypto.randomUUID()}`;

export default async function v2s07(): Promise<unknown> {
  const avant = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
  try {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = CLE;
    const corps = JSON.stringify({ event: "banc.inconnu", payload: { banc: true } });
    const livrer = async (body: string, signature: string | null) => {
      const r = await reponse(
        await webhook(
          new NextRequest("https://axion-ia.com/api/calendly/webhook", {
            method: "POST",
            body,
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": ip,
              ...(signature === null ? {} : { "Calendly-Webhook-Signature": signature }),
            },
          }),
        ),
      );
      return { statut: r.statut, corps: r.corps };
    };
    const t = Math.floor(Date.now() / 1000);
    const valide = signerLivraisonCalendly(corps, CLE, t);
    const r = {
      temoin: await livrer(corps, valide),
      rejeu: await livrer(corps, valide),
      sansSignature: await livrer(corps, null),
      autreCle: await livrer(corps, signerLivraisonCalendly(corps, `${CLE}-autre`, t)),
      corpsModifie: await livrer(corps.replace("banc.inconnu", "invitee.created"), valide),
      perimee: await livrer(corps, signerLivraisonCalendly(corps, CLE, t - 400)),
      future: await livrer(corps, signerLivraisonCalendly(corps, CLE, t + 400)),
      enteteIllisible: await livrer(corps, "t=abc,v1=zz"),
    };
    return r;
  } finally {
    if (avant === undefined) delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    else process.env.CALENDLY_WEBHOOK_SIGNING_KEY = avant;
  }
}
