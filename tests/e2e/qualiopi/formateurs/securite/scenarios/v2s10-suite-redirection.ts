// V2-S10 — Redirection ouverte par le paramètre `suite` du lien de connexion.
//
// Pour chaque variante, un lien NEUF est fabriqué par le code du dépôt puis
// présenté à la vraie route de connexion avec `?suite=<variante>`. On rend
// l'adresse de redirection reçue. Témoins : deux `suite` de la liste blanche.

import { NextRequest } from "next/server";

// eslint-disable-next-line no-restricted-imports
import { GET as connexion } from "@/app/[locale]/espace-formateur/connexion/[token]/route";
import { createFormateurMagicLink } from "@/server/formateur/magic-link";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";

import { creerIndependant, menage } from "../donnees";
import { poserCookie } from "../../../../fixtures/formateurs/securite-serveur/faux-next-headers";

export default async function v2s10(p: {
  variantes: string[];
  temoins: string[];
}): Promise<unknown> {
  try {
    const t = await creerIndependant({ actif: true });
    const suivre = async (suite: string) => {
      const jeton = await createFormateurMagicLink(t.id);
      const url = new URL(`https://axion-ia.com/fr/espace-formateur/connexion/${jeton}`);
      url.searchParams.set("suite", suite);
      const r = await connexion(new NextRequest(url), {
        params: Promise.resolve({ token: jeton, locale: "fr" }),
      });
      poserCookie(FORMATEUR_COOKIE_NAME, null);
      return { suite, statut: r.status, location: r.headers.get("location") };
    };
    const variantes = [];
    for (const v of p.variantes) variantes.push(await suivre(v));
    const temoins = [];
    for (const v of p.temoins) temoins.push(await suivre(v));
    return { variantes, temoins };
  } finally {
    await menage();
  }
}
